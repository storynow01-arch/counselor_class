import { useState, useEffect } from "react";
import clsx from "clsx";
import { format, startOfWeek, addDays, addMonths, eachDayOfInterval, parseISO, getDay } from "date-fns";
import { useAuth } from "../AuthContext";
import { Navigate } from "react-router-dom";
import { DoorOpen, Users, Lock as LockIcon, CalendarClock, Trash2 } from "lucide-react";
import { apiCall } from "../api";

type Classroom = { id: string; name: string };
type UserAccount = { id: string; username: string; role: string; password?: string };
type Lock = { id: string; classroomId: string; date: string; period: number };
type Booking = { id: string; classroomId: string; date: string; period: number; type: string; bookerName: string; userName: string; courseContent: string };

export default function Admin() {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/" replace />;

  const [activeTab, setActiveTab] = useState<"classrooms" | "users" | "longTerm">("classrooms");
  
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
    type: "deleteRoom" | "deleteUser" | "longTerm";
    id?: string;
    message: string;
    data?: any;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Lock / LongTerm Inputs
  const [selectedClassroom, setSelectedClassroom] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(addMonths(new Date(), 3), "yyyy-MM-dd"));
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [isRepeating, setIsRepeating] = useState(true);
  const [startPeriod, setStartPeriod] = useState(1);
  const [endPeriod, setEndPeriod] = useState(1);
  const [courseContent, setCourseContent] = useState("");

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

  // Long-Term action
  const handleAddLongTerm = async () => {
    if (!selectedClassroom || !courseContent) return;
    if (selectedDays.length === 0) {
      setToast({ message: "請至少選擇一個星期幾", type: "error" });
      return;
    }
    if (startPeriod > endPeriod) {
      setToast({ message: "開始節次不能大於結束節次", type: "error" });
      return;
    }

    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      
      if (start > end) {
        setToast({ message: "開始日期不能晚於結束日期", type: "error" });
        return;
      }

      const allDays = eachDayOfInterval({ start, end });
      const targetDates = allDays
        .filter(day => selectedDays.includes(getDay(day)))
        .map(day => format(day, "yyyy-MM-dd"));

      if (targetDates.length === 0) {
        setToast({ message: "所選日期範圍內沒有符合的星期天數", type: "error" });
        return;
      }

      const periods = Array.from({ length: endPeriod - startPeriod + 1 }, (_, i) => startPeriod + i);
      const totalCount = targetDates.length * periods.length;

      setPendingAction({
        type: "longTerm",
        message: `確定要在這段期間新增共 ${totalCount} 筆預約嗎？\n(${targetDates.length} 天 x ${periods.length} 節)`,
        data: { targetDates, periods }
      });
    } catch(err) {
      setToast({ message: "預約準備失敗", type: "error" });
    }
  };

  const executePendingAction = async () => {
    if (!pendingAction) return;
    
    const { type, id, data } = pendingAction;
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
      } else if (type === "longTerm" && data) {
        const { targetDates, periods } = data;
        const batchId = "long-" + Date.now().toString() + Math.random().toString(36).substring(7);

        for (const date of targetDates) {
          await Promise.all(
            periods.map((period: number) => 
              apiCall("addBooking", {
                classroomId: selectedClassroom,
                date,
                period,
                type: "long",
                bookerName: user?.username,
                userName: "管理員長期佔用",
                courseContent,
                batchId
              })
            )
          );
        }
        setToast({ message: "已成功新增多筆長期預約", type: "success" });
        setCourseContent("");
      }
    } catch (err) {
      setToast({ message: "執行失敗，請稍後再試", type: "error" });
    }
  };


  const TABS = [
    { id: "classrooms", label: "教室管理", icon: DoorOpen },
    { id: "users", label: "使用者管理", icon: Users },
    { id: "longTerm", label: "長期預約", icon: CalendarClock },
  ] as const;

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

          {activeTab === "longTerm" && (
            <div className="max-w-xl bg-stone-50 p-6 rounded-[20px] border border-[#E7E5E4] space-y-5">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">選擇教室</label>
                <select className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] shadow-sm bg-white" value={selectedClassroom} onChange={(e) => setSelectedClassroom(e.target.value)}>
                  {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">開始日期</label>
                  <input type="date" className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] shadow-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">結束日期</label>
                  <input type="date" className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] shadow-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-3">重複週期 (星期)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: 1, label: "週一" },
                    { val: 2, label: "週二" },
                    { val: 3, label: "週三" },
                    { val: 4, label: "週四" },
                    { val: 5, label: "週五" },
                    { val: 6, label: "週六" },
                    { val: 0, label: "週日" },
                  ].map(day => (
                    <label key={day.val} className="flex items-center space-x-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-indigo-600 border-[#E7E5E4] rounded focus:ring-indigo-500" 
                        checked={selectedDays.includes(day.val)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedDays([...selectedDays, day.val]);
                          else setSelectedDays(selectedDays.filter(d => d !== day.val));
                        }}
                      />
                      <span className="text-sm text-stone-600 group-hover:text-stone-900 transition-colors">{day.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                 <input 
                  type="checkbox" 
                  id="repeat-weekly"
                  className="w-4 h-4 text-indigo-600 border-[#E7E5E4] rounded focus:ring-indigo-500" 
                  checked={isRepeating}
                  onChange={(e) => setIsRepeating(e.target.checked)}
                />
                <label htmlFor="repeat-weekly" className="text-sm font-medium text-stone-700 cursor-pointer">每週重覆</label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">開始節次</label>
                  <select className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] shadow-sm bg-white" value={startPeriod} onChange={(e) => setStartPeriod(Number(e.target.value))}>
                    {[1,2,3,4,5,6,7,8].map(p => <option key={p} value={p}>第 {p} 節</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">結束節次</label>
                  <select className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] shadow-sm bg-white" value={endPeriod} onChange={(e) => setEndPeriod(Number(e.target.value))}>
                    {[1,2,3,4,5,6,7,8].map(p => <option key={p} value={p}>第 {p} 節</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">課程名稱</label>
                <input type="text" className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] shadow-sm" placeholder="例如: 整個學期的線性代數" value={courseContent} onChange={(e) => setCourseContent(e.target.value)} />
              </div>

              <div className="pt-2">
                <button 
                  onClick={handleAddLongTerm} 
                  className="w-full py-2.5 text-white font-medium rounded-[12px] shadow-sm transition-colors bg-purple-600 hover:bg-purple-700"
                >
                  新增長週期預約
                </button>
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
