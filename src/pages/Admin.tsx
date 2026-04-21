import { useState, useEffect } from "react";
import { format, startOfWeek, addDays } from "date-fns";
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

  const [activeTab, setActiveTab] = useState<"classrooms" | "users" | "locks" | "longTerm">("classrooms");
  
  // Data State
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  
  // Inputs
  const [newRoomName, setNewRoomName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  
  // Lock / LongTerm Inputs
  const [selectedClassroom, setSelectedClassroom] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedPeriod, setSelectedPeriod] = useState(1);
  const [courseContent, setCourseContent] = useState("");

  useEffect(() => {
    fetchClassrooms();
    fetchUsers();
  }, []);

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
    if(!window.confirm("確定刪除教室？")) return;
    await apiCall("deleteClassroom", { id });
    fetchClassrooms();
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
    if(!window.confirm("確定刪除使用者？")) return;
    await apiCall("deleteUser", { id });
    fetchUsers();
  };

  // Lock Actions
  const handleAddLock = async () => {
    if (!selectedClassroom) return;
    try {
      const res = await apiCall("addLock", {
        classroomId: selectedClassroom,
        date: selectedDate,
        period: selectedPeriod
      });
      if(res.success) alert("已成功鎖定時段");
      else alert(res.error || "鎖定失敗");
    } catch(err) {
      alert("鎖定失敗");
    }
  };

  // Long-Term action
  const handleAddLongTerm = async () => {
    if (!selectedClassroom || !courseContent) return;
    try {
      const res = await apiCall("addBooking", {
        classroomId: selectedClassroom,
        date: selectedDate,
        period: selectedPeriod,
        type: "long",
        bookerName: user?.username,
        userName: "管理員長期佔用",
        courseContent
      });
      if(res.success) alert("已成功新增長期預約 (示範: 單筆排程)");
      else alert(res.error || "新增失敗");
    } catch(err) {
      alert("新增失敗");
    }
  };


  const TABS = [
    { id: "classrooms", label: "教室管理", icon: DoorOpen },
    { id: "users", label: "使用者管理", icon: Users },
    { id: "locks", label: "鎖定時段", icon: LockIcon },
    { id: "longTerm", label: "長期預約", icon: CalendarClock },
  ] as const;

  return (
    <div className="space-y-6 animate-in fade-in">
      <h1 className="text-2xl font-bold text-stone-900 border-l-4 border-[#4F46E5] pl-3">系統管理</h1>
      
      <div className="bg-white shadow-sm border border-[#E7E5E4] rounded-[20px] overflow-hidden">
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

          {(activeTab === "locks" || activeTab === "longTerm") && (
            <div className="max-w-xl bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">選擇教室</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded shadow-sm bg-white" value={selectedClassroom} onChange={(e) => setSelectedClassroom(e.target.value)}>
                  {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">日期 (用於單次示範)</label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded shadow-sm" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">節次</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded shadow-sm bg-white" value={selectedPeriod} onChange={(e) => setSelectedPeriod(Number(e.target.value))}>
                    {[1,2,3,4,5,6,7,8].map(p => <option key={p} value={p}>第 {p} 節</option>)}
                  </select>
                </div>
              </div>
              {activeTab === "longTerm" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">課程名稱</label>
                  <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded shadow-sm" placeholder="例如: 整個學期的線性代數" value={courseContent} onChange={(e) => setCourseContent(e.target.value)} />
                </div>
              )}
              <div className="pt-2">
                <button 
                  onClick={activeTab === "locks" ? handleAddLock : handleAddLongTerm} 
                  className={`w-full py-2.5 text-white font-medium rounded-lg shadow-sm transition-colors ${activeTab === 'locks' ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                >
                  {activeTab === "locks" ? "鎖定此時段 (不可預約)" : "新增長期預約 (示範)"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
