import { useState, useEffect } from "react";
import { format, startOfWeek, addDays, subWeeks, addWeeks, isSameDay, subMonths, addMonths } from "date-fns";
import { zhTW } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, MapPin, ChevronsLeft, ChevronsRight, List } from "lucide-react";
import { useAuth } from "../AuthContext";
import clsx from "clsx";

import { apiCall } from "../api";

type Classroom = { id: string; name: string };
type Booking = { id: string; classroomId: string; date: string; period: number; type: string; bookerName: string; courseContent: string; userName: string; batchId?: string };
type Lock = { id: string; classroomId: string; date: string; period: number };

const PERIODS = [
  { id: 1, name: "第 1 節 (08:10-09:00)" },
  { id: 2, name: "第 2 節 (09:10-10:00)" },
  { id: 3, name: "第 3 節 (10:10-11:00)" },
  { id: 4, name: "第 4 節 (11:10-12:00)" },
  { id: 5, name: "第 5 節 (13:10-14:00)" },
  { id: 6, name: "第 6 節 (14:10-15:00)" },
  { id: 7, name: "第 7 節 (15:10-16:00)" },
  { id: 8, name: "第 8 節 (16:10-17:00)" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<string>("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [locks, setLocks] = useState<Lock[]>([]);
  
  // Selection State
  const [selectedSlots, setSelectedSlots] = useState<{date: string; period: number}[]>([]);
  
  // Booking Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookingFormData, setBookingFormData] = useState({ bookerName: "", userName: "", courseContent: "" });

  // Edit/Delete Modal State
  const [editTarget, setEditTarget] = useState<Booking | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{isBatch: boolean} | null>(null);
  const relatedBookings = editTarget?.batchId ? bookings.filter(b => b.batchId === editTarget.batchId) : [];

  // Booking List Modal State
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [listBookings, setListBookings] = useState<Booking[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  useEffect(() => {
    fetchClassrooms();
  }, []);

  useEffect(() => {
    if (selectedClassroom) {
      fetchSchedule();
      setSelectedSlots([]); // Clear selections when classroom changes
    }
  }, [selectedClassroom, currentDate]);

  const fetchClassrooms = async () => {
    const res = await apiCall("getClassrooms");
    if(res.success && res.classrooms) {
      setClassrooms(res.classrooms);
      if (res.classrooms.length > 0 && !selectedClassroom) setSelectedClassroom(res.classrooms[0].id);
    }
  };

  const openBookingList = async () => {
    setIsListModalOpen(true);
    setIsLoadingList(true);
    try {
      const res = await apiCall("getUserBookings", { 
        username: user?.username, 
        role: user?.role 
      });
      if (res.success) {
        const sorted = (res.bookings || []).sort((a:Booking, b:Booking) => {
           if(a.date !== b.date) return a.date.localeCompare(b.date);
           return Number(a.period) - Number(b.period);
        });
        setListBookings(sorted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingList(false);
    }
  };

  const fetchSchedule = async () => {
    const weekStartStr = format(startDate, "yyyy-MM-dd");
    const weekEndStr = format(addDays(startDate, 6), "yyyy-MM-dd");
    
    const res = await apiCall("getSchedule", { classroomId: selectedClassroom, startDate: weekStartStr, endDate: weekEndStr });
    if(res.success) {
      setBookings(res.bookings || []);
      setLocks(res.locks || []);
    }
  };

  const handleSlotClick = (date: Date, period: number) => {
    const dateStr = format(date, "yyyy-MM-dd");
    
    // Check if locked
    if (locks.some(l => l.date === dateStr && Number(l.period) === period)) {
      if (user?.role !== 'admin') {
        alert("此時段已被鎖定，不可預約。");
        return;
      }
    }
    
    // Check if booked
    const booking = bookings.find(b => b.date === dateStr && Number(b.period) === period);
    if (booking) {
      if (user?.role === 'admin' || user?.username === booking.bookerName) {
        setEditTarget(booking);
        setBookingFormData({ 
          bookerName: booking.bookerName, 
          userName: booking.userName, 
          courseContent: booking.courseContent 
        });
      }
      return; 
    }

    // Toggle selection
    setSelectedSlots(prev => {
      const exists = prev.some(s => s.date === dateStr && s.period === period);
      if (exists) {
        return prev.filter(s => !(s.date === dateStr && s.period === period));
      } else {
        return [...prev, { date: dateStr, period }];
      }
    });
  };

  const openBookingModal = () => {
    setBookingFormData({ bookerName: user?.username || "", userName: "", courseContent: "" });
    setIsModalOpen(true);
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSlots.length === 0) return;

    try {
      // Generate a batch ID for this group of bookings
      const batchId = Date.now().toString() + Math.random().toString(36).substring(7);

      // Create a booking for each selected slot
      await Promise.all(
        selectedSlots.map(async (slot) => {
          const res = await apiCall("addBooking", {
            classroomId: selectedClassroom,
            type: "short",
            date: slot.date,
            period: slot.period,
            batchId,
            ...bookingFormData
          });
          if (!res.success) {
            throw new Error(res.error || `預約 ${slot.date} 第 ${slot.period} 節失敗`);
          }
        })
      );
      
      setIsModalOpen(false);
      setSelectedSlots([]);
      fetchSchedule();
    } catch(err: any) {
      alert(err.message);
      // Refresh schedule anyway to show what succeeded
      fetchSchedule();
    }
  };

  const handleUpdateBooking = async (e: React.FormEvent, isBatch: boolean) => {
    e.preventDefault();
    if (!editTarget) return;
    
    try {
      const res = await apiCall("updateBooking", {
        id: editTarget.id,
        batchId: editTarget.batchId,
        isBatch,
        userName: bookingFormData.userName,
        courseContent: bookingFormData.courseContent
      });
      if(res.success) {
        setEditTarget(null);
        fetchSchedule();
      } else {
        alert(res.error || "更新失敗");
      }
    } catch(err: any) {
      alert(err.message);
    }
  };

  const handleDeleteBooking = async (isBatch: boolean) => {
    if (!editTarget) return;
    
    try {
      await apiCall("deleteBooking", { 
        id: editTarget.id,
        batchId: editTarget.batchId,
        isBatch
      });
      setDeleteConfirm(null);
      setEditTarget(null);
      fetchSchedule();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-stone-900 border-l-4 border-[#4F46E5] pl-3">教室預約</h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={openBookingList}
            className="flex items-center px-4 py-1.5 bg-white border border-[#E7E5E4] rounded-[16px] shadow-sm text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
            title={user?.role === 'admin' ? "所有預約紀錄" : "我的預約紀錄"}
          >
            <List className="w-4 h-4 mr-2 text-stone-500" />
            {user?.role === 'admin' ? "所有預約" : "我的預約"}
          </button>
          <div className="flex items-center bg-white border border-[#E7E5E4] rounded-[16px] p-1 shadow-sm">
            <MapPin className="w-5 h-5 text-stone-400 ml-2" />
            <select
              className="w-full sm:w-auto bg-transparent border-none focus:ring-0 text-sm font-medium text-stone-700 cursor-pointer py-1.5 pl-2 pr-8"
              value={selectedClassroom}
              onChange={(e) => setSelectedClassroom(e.target.value)}
            >
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[20px] shadow-sm border border-[#E7E5E4] overflow-hidden">
        <div className="p-4 border-b border-[#E7E5E4] flex items-center justify-between bg-stone-50">
          <h2 className="text-lg font-semibold text-stone-800">
            {format(startDate, "yyyy 年 MM 月")}
          </h2>
          <div className="flex space-x-1 sm:space-x-2">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-1.5 rounded-[12px] bg-white border border-[#E7E5E4] text-stone-600 hover:bg-stone-50 transition-colors"
              title="上個月"
            >
              <ChevronsLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
              className="p-1.5 rounded-[12px] bg-white border border-[#E7E5E4] text-stone-600 hover:bg-stone-50 transition-colors"
              title="上一週"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 rounded-[12px] bg-white border border-[#E7E5E4] text-stone-700 text-sm font-medium hover:bg-stone-50 transition-colors whitespace-nowrap"
            >
              本週
            </button>
            <button
              onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
              className="p-1.5 rounded-[12px] bg-white border border-[#E7E5E4] text-stone-600 hover:bg-stone-50 transition-colors"
              title="下一週"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-1.5 rounded-[12px] bg-white border border-[#E7E5E4] text-stone-600 hover:bg-stone-50 transition-colors"
              title="下個月"
            >
              <ChevronsRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center border-collapse">
            <thead>
              <tr>
                <th className="border-b border-r border-[#E7E5E4] p-3 bg-stone-50 w-24">節次 / 日期</th>
                {weekDays.map((day, i) => (
                  <th key={i} className={clsx(
                    "border-b border-[#E7E5E4] p-3",
                    isSameDay(day, new Date()) ? "bg-indigo-50/50 text-[#4F46E5]" : "bg-stone-50 text-stone-600",
                    i !== 6 && "border-r"
                  )}>
                    <div className="font-semibold">{format(day, "E", { locale: zhTW })}</div>
                    <div className="text-xs mt-1 opacity-75">{format(day, "MM/dd")}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(({ id, name }) => (
                <tr key={id}>
                  <td className="border-b border-r border-[#E7E5E4] p-2 text-xs font-medium text-stone-500 bg-stone-50 whitespace-normal">
                    {name}
                  </td>
                  {weekDays.map((day, i) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const booking = bookings.find(b => b.date === dateStr && Number(b.period) === id);
                    const isLocked = locks.some(l => l.date === dateStr && Number(l.period) === id);
                    const isSelected = selectedSlots.some(s => s.date === dateStr && s.period === id);

                    return (
                      <td 
                        key={i} 
                        className={clsx(
                          "border-b border-[#E7E5E4] p-2 h-16 transition-colors relative group",
                          i !== 6 && "border-r",
                          isLocked ? "bg-red-50/80 cursor-not-allowed" :
                          booking ? clsx(booking.type === 'long' ? "bg-stone-100" : "bg-indigo-50/80", (user?.role === 'admin' || user?.username === booking.bookerName) ? "cursor-pointer" : "") :
                          isSelected ? "bg-orange-50 ring-2 ring-[#FB923C] ring-inset cursor-pointer" :
                          "hover:bg-stone-50 cursor-pointer"
                        )}
                        onClick={() => handleSlotClick(day, id)}
                      >
                         {isLocked ? (
                            <div className="text-stone-400 text-xs font-medium">鎖定 (不可預約)</div>
                         ) : booking ? (
                            <div className="flex flex-col h-full justify-center">
                              <div className={clsx("text-xs font-bold leading-tight", booking.type === 'long' ? "text-stone-700" : "text-[#4F46E5]")}>
                                {booking.courseContent || "已預約"}
                              </div>
                              <div className="text-[10px] text-stone-500 mt-1 flex flex-col space-y-0.5">
                                <span>預約者: {booking.bookerName}</span>
                                {booking.userName && <span>使用者: {booking.userName}</span>}
                              </div>
                              {(user?.role === "admin" || user?.username === booking.bookerName) && (
                                <div className="absolute inset-0 bg-indigo-900/5 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-[8px]">
                                  <span className="bg-white/90 text-[#4F46E5] text-xs font-bold px-2 py-1 rounded-[8px] shadow-sm border border-indigo-200">
                                    🔧 管理
                                  </span>
                                </div>
                              )}
                            </div>
                         ) : isSelected ? (
                            <div className="text-[#FB923C] text-xs font-bold flex flex-col items-center justify-center h-full">
                              已選取
                            </div>
                         ) : (
                           <div className="opacity-0 group-hover:opacity-100 text-stone-300 flex justify-center w-full">
                              <Plus className="w-5 h-5 text-stone-400" />
                           </div>
                         )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSlots.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-stone-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center space-x-6 z-40 animate-in slide-in-from-bottom-10 border border-stone-700">
          <div className="font-medium text-sm">
            已選擇 <span className="text-[#FB923C] font-bold text-lg mx-1">{selectedSlots.length}</span> 個時段
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSelectedSlots([])}
              className="text-stone-400 hover:text-white text-sm px-2 py-1 rounded transition-colors"
            >
              取消
            </button>
            <button
              onClick={openBookingModal}
              className="bg-[#FB923C] hover:bg-orange-500 text-white font-bold px-5 py-2 rounded-full text-sm transition-colors shadow-[0_0_15px_rgba(251,146,60,0.3)]"
            >
              確定預約
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[20px] shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-stone-900 mb-4 border-b border-[#E7E5E4] pb-2">新增預約 (共 {selectedSlots.length} 節)</h3>
            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <div className="text-sm text-stone-600 bg-stone-50 p-3 rounded-[12px] border border-[#E7E5E4] max-h-32 overflow-y-auto space-y-1">
                {selectedSlots.map((s, idx) => (
                   <div key={idx} className="flex justify-between items-center bg-white px-2 py-1.5 rounded-[8px] border border-[#E7E5E4]">
                     <span className="font-medium text-stone-700">{s.date}</span>
                     <span className="bg-orange-50 text-[#FB923C] px-2 py-0.5 rounded-[8px] text-xs font-semibold">第 {s.period} 節</span>
                   </div>
                ))}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">預約者</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[16px] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none text-sm transition-all"
                  value={bookingFormData.bookerName}
                  onChange={(e) => setBookingFormData({...bookingFormData, bookerName: e.target.value})}
                  disabled={user?.role !== "admin"} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">使用者名稱</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[16px] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none text-sm transition-all"
                  value={bookingFormData.userName}
                  onChange={(e) => setBookingFormData({...bookingFormData, userName: e.target.value})}
                  placeholder="例如：張老師"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">課程內容</label>
                <textarea
                  required
                  rows={3}
                  className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[16px] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none text-sm resize-none transition-all"
                  value={bookingFormData.courseContent}
                  onChange={(e) => setBookingFormData({...bookingFormData, courseContent: e.target.value})}
                  placeholder="例如：高中基礎物理實驗"
                />
              </div>
               <div className="flex justify-end space-x-3 pt-4 border-t border-[#E7E5E4]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-[#E7E5E4] rounded-[16px] hover:bg-stone-50 focus:outline-none transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-[#FB923C] border border-transparent rounded-[16px] hover:bg-orange-500 shadow-sm focus:outline-none transition-colors"
                >
                  確認預約
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[20px] shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-stone-900 mb-4 border-b border-[#E7E5E4] pb-2">管理預約</h3>
            <form className="space-y-4">
              <div className="text-sm text-stone-600 bg-stone-50 p-3 rounded-[12px] border border-[#E7E5E4]">
                <div><span className="font-medium text-stone-900">日期：</span> {editTarget.date}</div>
                <div><span className="font-medium text-stone-900">節次：</span> 第 {editTarget.period} 節</div>
                {relatedBookings.length > 1 && (
                  <div className="mt-2 text-[#FB923C] font-medium text-xs">
                    * 此筆資料屬於同批次預約 (共有 {relatedBookings.length} 節)
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">預約者</label>
                <input
                  type="text"
                  disabled
                  className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[16px] bg-stone-50 text-stone-500 cursor-not-allowed text-sm"
                  value={bookingFormData.bookerName}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">使用者名稱</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[16px] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none text-sm transition-all"
                  value={bookingFormData.userName}
                  onChange={(e) => setBookingFormData({...bookingFormData, userName: e.target.value})}
                  placeholder="例如：張老師"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">課程內容</label>
                <textarea
                  required
                  rows={3}
                  className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[16px] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none text-sm resize-none transition-all"
                  value={bookingFormData.courseContent}
                  onChange={(e) => setBookingFormData({...bookingFormData, courseContent: e.target.value})}
                  placeholder="例如：高中基礎物理實驗"
                />
              </div>
              
              <div className="pt-4 border-t border-[#E7E5E4] flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleUpdateBooking(e, false)}
                    className="flex-1 py-2 text-sm font-medium text-white bg-[#4F46E5] rounded-[16px] hover:bg-indigo-700 transition-colors"
                  >
                    儲存修改 (僅此節)
                  </button>
                  {relatedBookings.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => handleUpdateBooking(e, true)}
                      className="flex-1 py-2 text-sm font-medium text-[#4F46E5] bg-indigo-50 border border-indigo-200 rounded-[16px] hover:bg-indigo-100 transition-colors"
                    >
                      儲存修改 (整批)
                    </button>
                  )}
                </div>
                
                <div className="flex gap-2 mt-2">
                  {deleteConfirm ? (
                    <div className="flex gap-2 w-full animate-in fade-in zoom-in-95">
                      <button
                        type="button"
                        onClick={() => handleDeleteBooking(deleteConfirm.isBatch)}
                        className="flex-1 py-2 text-sm font-medium text-white bg-red-500 rounded-[16px] hover:bg-red-600 transition-colors"
                      >
                        ✅ 確定取消 ({deleteConfirm.isBatch ? "整批" : "單節"})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(null)}
                        className="flex-1 py-2 text-sm font-medium text-stone-700 bg-stone-100 rounded-[16px] hover:bg-stone-200 transition-colors"
                      >
                        返回
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm({ isBatch: false })}
                        className="flex-1 py-2 text-sm font-medium text-red-500 bg-red-50 border border-red-200 rounded-[16px] hover:bg-red-100 transition-colors"
                      >
                        取消預約 (僅此節)
                      </button>
                      {relatedBookings.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm({ isBatch: true })}
                          className="flex-1 py-2 text-sm font-medium text-red-500 bg-red-50 border border-red-200 rounded-[16px] hover:bg-red-100 transition-colors"
                        >
                          取消預約 (整批)
                        </button>
                      )}
                    </>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    setEditTarget(null);
                    setDeleteConfirm(null);
                  }}
                  className="w-full mt-2 py-2 text-sm font-medium text-stone-700 bg-white border border-[#E7E5E4] rounded-[16px] hover:bg-stone-50 transition-colors"
                >
                  關閉
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isListModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[20px] shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-[#E7E5E4] flex justify-between items-center bg-stone-50 rounded-t-[20px]">
               <h3 className="text-lg font-bold text-stone-900 border-l-4 border-[#4F46E5] pl-3">
                 {user?.role === 'admin' ? "所有預約列表" : "我的預約列表"}
               </h3>
               <button onClick={() => setIsListModalOpen(false)} className="text-stone-400 hover:text-stone-600 text-2xl leading-none px-2">&times;</button>
            </div>
            <div className="p-0 flex-1 overflow-y-auto">
               <table className="w-full text-sm text-left">
                 <thead className="bg-stone-100 text-stone-600 sticky top-0 z-10 shadow-sm">
                   <tr>
                     <th className="p-3 px-4 border-b border-[#E7E5E4]">教室</th>
                     <th className="p-3 border-b border-[#E7E5E4]">日期</th>
                     <th className="p-3 border-b border-[#E7E5E4]">節次</th>
                     <th className="p-3 border-b border-[#E7E5E4]">課程內容</th>
                     <th className="p-3 border-b border-[#E7E5E4]">預約者 / 使用者</th>
                     <th className="p-3 border-b border-[#E7E5E4] text-center">操作</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-[#E7E5E4]">
                   {isLoadingList ? (
                     <tr><td colSpan={6} className="p-8 text-center text-stone-500">正在從資料庫載入中...</td></tr>
                   ) : listBookings.length === 0 ? (
                     <tr><td colSpan={6} className="p-8 text-center text-stone-500">目前沒有任何預約資料</td></tr>
                   ) : listBookings.map(b => {
                      const canEdit = user?.role === 'admin' || user?.username === b.bookerName;
                      const cName = classrooms.find(c => c.id === b.classroomId)?.name || '未知教室';
                      return (
                        <tr key={b.id} className="hover:bg-stone-50 transition-colors">
                          <td className="p-3 px-4 whitespace-nowrap text-[#4F46E5] font-bold">{cName}</td>
                          <td className="p-3 whitespace-nowrap text-stone-700 font-medium">{b.date}</td>
                          <td className="p-3 text-[#FB923C] font-bold whitespace-nowrap">第 {b.period} 節</td>
                          <td className="p-3 text-stone-800 font-medium">{b.courseContent}</td>
                          <td className="p-3">
                            <span className="text-stone-900">{b.bookerName}</span>
                            {b.userName && <span className="text-xs text-stone-500 block mt-0.5">使用者: {b.userName}</span>}
                          </td>
                          <td className="p-3 text-center">
                             {canEdit ? (
                               <button 
                                 onClick={() => {
                                    setIsListModalOpen(false);
                                    setEditTarget(b);
                                    setBookingFormData({ bookerName: b.bookerName, userName: b.userName, courseContent: b.courseContent });
                                 }} 
                                 className="px-4 py-1.5 bg-indigo-50 text-[#4F46E5] rounded-[8px] hover:bg-indigo-100 text-xs font-semibold border border-indigo-200 transition-colors"
                               >
                                 管理
                               </button>
                             ) : (
                               <span className="text-stone-300 text-xs">-</span>
                             )}
                          </td>
                        </tr>
                      )
                   })}
                 </tbody>
               </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
