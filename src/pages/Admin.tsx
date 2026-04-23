import { useState, useEffect } from "react";
import clsx from "clsx";
import { format, startOfWeek, addDays, addMonths, eachDayOfInterval, parseISO, getDay } from "date-fns";
import { useAuth } from "../AuthContext";
import { Navigate } from "react-router-dom";
import { DoorOpen, Users, Lock as LockIcon, CalendarClock, Trash2, Database, Download, Upload, FileSpreadsheet, FileDown, AlertTriangle, CloudDownload, CloudUpload } from "lucide-react";
import { apiCall } from "../api";
import * as XLSX from "xlsx";

type Classroom = { id: string; name: string };
type UserAccount = { id: string; username: string; role: string; password?: string };
type Lock = { id: string; classroomId: string; date: string; period: number };
type Booking = { id: string; classroomId: string; date: string; period: number; type: string; bookerName: string; userName: string; courseContent: string };

const PERIODS = [
  { id: 1, name: "第 1 節 (08:00-08:50)" },
  { id: 2, name: "第 2 節 (09:00-09:50)" },
  { id: 3, name: "第 3 節 (10:00-10:50)" },
  { id: 4, name: "第 4 節 (11:00-11:50)" },
  { id: 5, name: "午休時間 (12:20-13:10)" },
  { id: 6, name: "第 5 節 (13:20-14:10)" },
  { id: 7, name: "第 6 節 (14:20-15:10)" },
  { id: 8, name: "第 7 節 (15:20-16:10)" },
  { id: 9, name: "第 8 節 (16:20-17:10)" },
];

export default function Admin() {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/" replace />;

  const [activeTab, setActiveTab] = useState<"classrooms" | "users" | "longTerm" | "dataManagement">("classrooms");
  
  // Data State
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  
  // Inputs
  const [newRoomName, setNewRoomName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  
  // Confirmation / Error UI State
  const [pendingAction, setPendingAction] = useState<{
    type: "deleteRoom" | "deleteUser" | "longTerm" | "deleteAllBookings";
    id?: string;
    message: string;
    data?: any;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Setup
  const [selectedClassroom, setSelectedClassroom] = useState("");
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    fetchClassrooms();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchClassrooms = async () => {
    const res = await apiCall("getClassrooms");
    if(res.success && res.classrooms) {
      setClassrooms(res.classrooms);
      if (res.classrooms.length > 0 && !selectedClassroom) setSelectedClassroom(res.classrooms[0].id);
    }
  };

  const fetchUsers = async () => {
    const res = await apiCall("getUsers");
    if(res.success && res.users) {
      setUsers(res.users);
    }
  };

  // Classrooms Actions
  const handleAddClassroom = async () => {
    if(!newRoomName) return;
    await apiCall("addClassroom", { name: newRoomName });
    setNewRoomName("");
    fetchClassrooms();
  };

  const handleDeleteClassroom = async (id: string) => {
    const room = classrooms.find(c => c.id === id);
    setPendingAction({
      type: "deleteRoom",
      id,
      message: `確定要刪除教室 「${room?.name}」 嗎？`
    });
  };

  // Users Actions
  const handleAddUser = async () => {
    if(!newUsername || !newPassword) return;
    await apiCall("addUser", { username: newUsername, password: newPassword, role: newUserRole });
    setNewUsername("");
    setNewPassword("");
    fetchUsers();
  };

  const handleDeleteUser = async (id: string) => {
    const u = users.find(account => account.id === id);
    setPendingAction({
      type: "deleteUser",
      id,
      message: `確定要刪除使用者 「${u?.username}」 嗎？`
    });
  };

  const executePendingAction = async () => {
    if (!pendingAction) return;
    
    const { type, id, data, message } = pendingAction;
    setPendingAction(null);

    try {
      if (type === "deleteRoom" && id) {
        await apiCall("deleteClassroom", { id });
        setToast({ message: "教室已刪除", type: "success" });
        fetchClassrooms();
      } else if (type === "deleteUser" && id) {
        await apiCall("deleteUser", { id });
        setToast({ message: "使用者已刪除", type: "success" });
        fetchUsers();
      } else if (type === "deleteAllBookings") {
        const res = await apiCall("deleteAllBookings");
        if (res.success) {
          setToast({ message: "所有預約資料已清空", type: "success" });
        } else {
          setToast({ message: res.error || "清空失敗 (請確認後台腳本已更新)", type: "error" });
        }
      } else if (type === "deleteUserBookings" && data?.deleteTargetUser) {
        const res = await apiCall("deleteUserBookings", { targetUser: data.deleteTargetUser });
        if (res.success) {
          setToast({ message: `已清空「${data.deleteTargetUser}」的所有預約紀錄`, type: "success" });
        } else {
          setToast({ message: res.error || "刪除失敗 (請確認後台腳本已更新)", type: "error" });
        }
      }
    } catch (err) {
      setToast({ message: "執行失敗，請稍後再試", type: "error" });
    }
  };


  const TABS = [
    { id: "classrooms", label: "教室管理", icon: DoorOpen },
    { id: "users", label: "使用者管理", icon: Users },
    { id: "dataManagement", label: "資料管理", icon: Database },
  ] as const;

  const [deleteTargetUser, setDeleteTargetUser] = useState("");

  const handleExportExcel = async () => {
    try {
      const res = await apiCall("getUserBookings", { role: "admin" });
      if (res.success && res.bookings) {
        const bookings = res.bookings.map((b: any) => ({
          "日期": b.date,
          "節次": b.period,
          "教室ID": b.classroomId,
          "預約者": b.bookerName,
          "使用者": b.userName,
          "課程內容": b.courseContent,
          "類型": b.type === "long" ? "長期" : "一般",
          "批次ID": b.batchId
        }));

        const worksheet = XLSX.utils.json_to_sheet(bookings);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Bookings");
        XLSX.writeFile(workbook, `教室預約資料匯出_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
        setToast({ message: "匯出成功", type: "success" });
      }
    } catch (err) {
      setToast({ message: "匯出失敗", type: "error" });
    }
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        "日期": "2026-05-01",
        "節次": 1,
        "教室名稱": "A101",
        "預約者": "admin",
        "使用者": "張老師",
        "課程內容": "物理實驗",
        "備註": "範例資料，節次請輸入 1-9"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "預約資料匯入範例.xlsx");
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <h1 className="text-2xl font-bold text-stone-900 border-l-4 border-[#4F46E5] pl-3">系統管理</h1>
      
      <div className="bg-white shadow-sm border border-[#E7E5E4] rounded-[20px] overflow-hidden">
        {/* Toast Notification */}
        {toast && (
          <div className={clsx(
            "fixed top-4 right-4 px-6 py-3 rounded-[16px] shadow-lg z-[100] animate-in slide-in-from-right-10",
            toast.type === "success" ? "bg-[#4F46E5] text-white" : "bg-red-500 text-white"
          )}>
            {toast.message}
          </div>
        )}

        {/* Progress Overlay */}
        {progress && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] backdrop-blur-sm">
            <div className="bg-white rounded-[24px] p-8 max-w-sm w-full shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-200">
              <div className="relative w-24 h-24 mx-auto">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="48" cy="48" r="40"
                    stroke="#F5F5F4" strokeWidth="8" fill="transparent"
                  />
                  <circle
                    cx="48" cy="48" r="40"
                    stroke="#4F46E5" strokeWidth="8" fill="transparent"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - progress.current / progress.total)}
                    strokeLinecap="round"
                    className="transition-all duration-300"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-bold text-stone-700">
                  {Math.round((progress.current / progress.total) * 100)}%
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-stone-900">正在處理中...</h3>
                <p className="text-stone-500 mt-2">請稍候，正在寫入預約資料</p>
              </div>
              <div className="text-sm font-medium text-[#4F46E5] bg-indigo-50 py-2 px-4 rounded-full inline-block">
                {progress.current} / {progress.total} 筆完成
              </div>
            </div>
          </div>
        )}

        <div className="flex border-b border-[#E7E5E4] overflow-x-auto bg-stone-50">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === tab.id 
                    ? "bg-indigo-50 text-[#4F46E5] border-b-2 border-[#4F46E5]"
                    : "text-stone-500 hover:text-stone-700 hover:bg-stone-100"
                }`}
              >
                <Icon className="w-5 h-5 mr-2" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="p-6">
          {activeTab === "classrooms" && (
            <div className="max-w-2xl space-y-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="輸入新教室名稱 (例如: A103)"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                />
                <button onClick={handleAddClassroom} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium whitespace-nowrap">
                  新增教室
                </button>
              </div>
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {classrooms.map(c => (
                  <li key={c.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <span className="font-medium text-gray-800">{c.name}</span>
                    <button onClick={() => handleDeleteClassroom(c.id)} className="text-red-500 p-1 hover:bg-red-50 rounded">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === "users" && (
            <div className="max-w-4xl space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-gray-500 mb-1">帳號</label>
                  <input type="text" className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5]" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-stone-500 mb-1">密碼</label>
                  <input type="text" className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5]" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-stone-500 mb-1">權限</label>
                  <select className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5]" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}>
                    <option value="user">一般使用者</option>
                    <option value="admin">管理員</option>
                  </select>
                </div>
                <button onClick={handleAddUser} className="px-4 py-2 bg-[#4F46E5] text-white rounded-[16px] hover:bg-indigo-700 font-medium shadow-sm">
                  新增
                </button>
              </div>
              <table className="w-full text-sm text-left border-collapse border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 border-b border-gray-200">帳號</th>
                    <th className="p-3 border-b border-gray-200">密碼 (示意)</th>
                    <th className="p-3 border-b border-gray-200">權限</th>
                    <th className="p-3 border-b border-gray-200 w-24">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-800">{u.username}</td>
                      <td className="p-3 text-gray-500 font-mono text-xs">{u.password}</td>
                      <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>{u.role}</span></td>
                      <td className="p-3">
                        <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 p-1 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "dataManagement" && (
            <div className="max-w-2xl space-y-8 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Export Section */}
                <div className="bg-stone-50 p-6 rounded-[24px] border border-[#E7E5E4] flex flex-col items-center text-center space-y-4 md:col-span-2 max-w-xl mx-auto w-full">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                    <CloudDownload className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-stone-900">匯出預約資料</h3>
                    <p className="text-sm text-stone-500 mt-1">將目前系統內的所有預約紀錄匯出為 Excel 檔案進行備份或查閱。</p>
                  </div>
                  <button 
                    onClick={handleExportExcel}
                    className="w-full flex items-center justify-center px-4 py-3 bg-white border-2 border-blue-200 text-blue-600 rounded-[16px] font-bold hover:bg-blue-50 transition-colors shadow-sm max-w-sm"
                  >
                    <FileSpreadsheet className="w-5 h-5 mr-2" />
                    立即匯出 Excel
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-red-50 p-6 rounded-[24px] border border-red-100 space-y-6">
                <div className="flex items-center space-x-3 text-red-600">
                  <AlertTriangle className="w-6 h-6" />
                  <h3 className="text-lg font-bold italic tracking-tight">危險區域 (Danger Zone)</h3>
                </div>

                {/* 1. 刪除特定使用者預約 */}
                <div className="p-4 bg-white/60 rounded-[16px] border border-red-200">
                  <div className="mb-3">
                    <h4 className="font-bold text-stone-800">刪除特定使用者的所有預約</h4>
                    <p className="text-xs text-stone-500 mt-1">選擇一個帳號，並將屬於該帳號的「所有」預約紀錄永久刪除。</p>
                  </div>
                  <div className="flex gap-3">
                    <select 
                      className="flex-1 px-3 py-2 border border-[#E7E5E4] rounded-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      value={deleteTargetUser}
                      onChange={(e) => setDeleteTargetUser(e.target.value)}
                    >
                      <option value="">-- 請選擇欲刪除資料的帳號 --</option>
                      {users.map(u => (
                        <option key={u.id} value={u.username}>{u.username}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => {
                        if (!deleteTargetUser) {
                          setToast({ message: "請先選擇帳號", type: "error" });
                          return;
                        }
                        setPendingAction({
                          type: "deleteUserBookings",
                          data: { deleteTargetUser },
                          message: `【警告】您確定要清除「${deleteTargetUser}」的所有預約嗎？\n此動作無法復原。`
                        });
                      }}
                      className="px-4 py-2 bg-red-500 text-white rounded-[12px] font-bold hover:bg-red-600 transition-colors shadow-sm disabled:opacity-50"
                      disabled={!deleteTargetUser}
                    >
                      刪除該使用者預約
                    </button>
                  </div>
                </div>

                {/* 2. 清空整個資料庫 */}
                <div className="p-4 bg-white/60 rounded-[16px] border border-red-200">
                  <div className="mb-3">
                    <h4 className="font-bold text-red-700">清空所有預約資料</h4>
                    <p className="text-sm text-red-800 opacity-80 mt-1">
                      此操作將會永久刪除資料庫中所有的預約紀錄（包括長期與一般預約）。此動作無法復原，請在執行前確認您已備份資料。
                    </p>
                  </div>
                  <button 
                    onClick={() => setPendingAction({
                      type: "deleteAllBookings",
                      message: "【警告】您確定要刪除「所有」預約資料嗎？\n此動作將清空整個系統的預約紀錄，且無法復原。"
                    })}
                    className="px-6 py-3 bg-red-600 text-white rounded-[16px] font-bold hover:bg-red-700 transition-all hover:scale-[1.02] shadow-md flex items-center"
                  >
                    <Trash2 className="w-5 h-5 mr-2" />
                    清空整個系統的預約
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {pendingAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[20px] shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-stone-900 mb-2">確認執行</h3>
            <p className="text-stone-600 mb-6 whitespace-pre-wrap">{pendingAction.message}</p>
            <div className="flex space-x-3">
              <button 
                onClick={() => setPendingAction(null)} 
                className="flex-1 py-2 text-stone-700 bg-stone-100 rounded-[12px] hover:bg-stone-200"
              >
                取消
              </button>
              <button 
                onClick={executePendingAction} 
                className="flex-1 py-2 text-white bg-[#4F46E5] rounded-[12px] hover:bg-indigo-700"
              >
                確定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
