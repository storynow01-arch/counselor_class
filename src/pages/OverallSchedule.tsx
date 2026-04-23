import { useState, useEffect } from "react";
import { format, startOfWeek, addDays, subDays } from "date-fns";
import { zhTW } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, LayoutGrid, Calendar } from "lucide-react";
import { apiCall } from "../api";
import clsx from "clsx";

import { useAuth } from "../AuthContext";

type Classroom = { id: string; name: string };
type Booking = { id: string; classroomId: string; date: string; period: number; type: string; bookerName: string; userName: string; courseContent: string };

const PERIODS = [
  { id: 1, name: "第 1 節", time: "08:00-08:50" },
  { id: 2, name: "第 2 節", time: "09:00-09:50" },
  { id: 3, name: "第 3 節", time: "10:00-10:50" },
  { id: 4, name: "第 4 節", time: "11:00-11:50" },
  { id: 5, name: "午休時間", time: "12:20-13:10" },
  { id: 6, name: "第 5 節", time: "13:20-14:10" },
  { id: 7, name: "第 6 節", time: "14:20-15:10" },
  { id: 8, name: "第 7 節", time: "15:20-16:10" },
  { id: 9, name: "第 8 節", time: "16:20-17:10" },
];

export default function OverallSchedule({ myOnly = false }: { myOnly?: boolean }) {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New state for click-to-book feature
  type SelectedSlot = {
    classroomId: string;
    roomName: string;
    date: string;
    period: number;
    periodName: string;
  };
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [courseContent, setCourseContent] = useState("");
  const [userName, setUserName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  // New state for filters
  const [selectedClassrooms, setSelectedClassrooms] = useState<string[]>([]);
  const [hasInitializedClassrooms, setHasInitializedClassrooms] = useState(false);

  // Edit/Delete Modal State
  const [editTarget, setEditTarget] = useState<Booking | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{isBatch: boolean} | null>(null);
  const [bookingFormData, setBookingFormData] = useState({ bookerName: "", userName: "", courseContent: "" });
  const relatedBookings = editTarget?.batchId ? bookings.filter(b => b.batchId === editTarget.batchId) : [];

  const startDateOfWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDateOfWeek, i));

  const weekRange = {
    start: format(weekDays[0], "yyyy-MM-dd"),
    end: format(weekDays[6], "yyyy-MM-dd"),
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const roomsRes = await apiCall("getClassrooms");
      if (roomsRes.success) {
        setClassrooms(roomsRes.classrooms);
        if (!hasInitializedClassrooms) {
          setSelectedClassrooms(roomsRes.classrooms.map((c: Classroom) => c.id));
          setHasInitializedClassrooms(true);
        }
      }
      
      const bookingsRes = await apiCall("getSchedule", {
        startDate: weekRange.start,
        endDate: weekRange.end
      });
      
      if (bookingsRes.success) {
        setBookings(bookingsRes.bookings as Booking[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const navigateWeek = (amount: number) => {
    setCurrentDate(addDays(currentDate, amount * 7));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleSlotClick = (slot: SelectedSlot) => {
    setSelectedSlots(prev => {
      const exists = prev.some(s => s.classroomId === slot.classroomId && s.date === slot.date && s.period === slot.period);
      if (exists) {
        return prev.filter(s => !(s.classroomId === slot.classroomId && s.date === slot.date && s.period === slot.period));
      } else {
        return [...prev, slot];
      }
    });
  };

  const handleBookSubmit = async () => {
    if (selectedSlots.length === 0) return;
    if (!courseContent.trim()) {
      alert("課程名稱為必填項目！");
      return;
    }

    setIsSubmitting(true);
    try {
      const batchId = Date.now().toString() + Math.random().toString(36).substring(7);
      const total = selectedSlots.length;
      setProgress({ current: 0, total });

      for (const slot of selectedSlots) {
        const res = await apiCall("addBooking", {
          classroomId: slot.classroomId,
          date: slot.date,
          period: slot.period,
          type: "short",
          bookerName: user?.username,
          userName: userName.trim() || user?.username, // Use provided userName, fallback to bookerName
          courseContent: courseContent.trim(),
          batchId
        });
        if (!res.success) {
           throw new Error(res.error || `預約 ${slot.date} 第 ${slot.period} 節 失敗`);
        }
        setProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
      }
      
      setProgress(null);
      setIsModalOpen(false);
      setSelectedSlots([]);
      setCourseContent("");
      fetchData();
    } catch (err: any) {
      setProgress(null);
      alert(err.message || "預約發生錯誤");
      fetchData(); // Fetch anyway to show what succeeded
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBooking = async (e: React.FormEvent, isBatch: boolean) => {
    e.preventDefault();
    if (!editTarget) return;
    
    if (!bookingFormData.courseContent.trim()) {
      alert("課程名稱為必填項目！");
      return;
    }
    
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
        fetchData();
      } else {
        alert(res.error || "更新失敗");
      }
    } catch(err: any) {
      alert(err.message || "更新發生錯誤");
    }
  };

  const handleDeleteBooking = async (isBatch: boolean) => {
    if (!editTarget) return;
    try {
      const res = await apiCall("deleteBooking", { 
        id: editTarget.id, 
        batchId: editTarget.batchId, 
        isBatch 
      });
      if(res.success) {
        setDeleteConfirm(null);
        setEditTarget(null);
        fetchData();
      } else {
        alert(res.error || "刪除失敗");
      }
    } catch(err: any) {
      alert(err.message || "刪除發生錯誤");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-stone-900 border-l-4 border-indigo-600 pl-3">
          {myOnly ? "我的預約" : "預約總表"}
        </h1>
        <div className="flex items-center space-x-3 bg-white p-1 rounded-[16px] border border-[#E7E5E4] shadow-sm">
          <button onClick={() => navigateWeek(-4)} className="p-2 hover:bg-stone-50 rounded-[12px] text-stone-500 transition-colors" title="前四週">
            <ChevronsLeft className="w-5 h-5" />
          </button>
          <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-stone-50 rounded-[12px] text-stone-500 transition-colors" title="前一週">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={goToToday}
            className="px-4 py-2 text-sm font-bold text-stone-700 hover:bg-stone-50 rounded-[12px] transition-colors"
          >
            本週
          </button>
          <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-stone-50 rounded-[12px] text-stone-500 transition-colors" title="後一週">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={() => navigateWeek(4)} className="p-2 hover:bg-stone-50 rounded-[12px] text-stone-500 transition-colors" title="後四週">
            <ChevronsRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[24px] border border-[#E7E5E4] shadow-sm overflow-hidden overflow-x-auto">
        <div className="p-6 border-b border-[#E7E5E4] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center text-xl font-bold text-stone-900">
            <Calendar className="w-6 h-6 mr-2 text-indigo-600" />
            {format(currentDate, "yyyy 年 MM 月")}
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs bg-stone-50 px-3 py-1.5 rounded-full border border-stone-200">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded bg-indigo-100 border border-indigo-200"></span>
                <span className="text-stone-600 font-medium">您的預約 (可編輯)</span>
              </div>
              {!myOnly && (
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200"></span>
                  <span className="text-stone-600 font-medium">他人預約</span>
                </div>
              )}
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded bg-white border border-stone-200 text-stone-400 font-bold flex justify-center items-center text-[8px]">+</span>
                <span className="text-stone-600 font-medium">可預約</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded bg-orange-50 border border-orange-300"></span>
                <span className="text-stone-600 font-medium">已選取</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-stone-500 mr-1 hidden md:inline">顯示：</span>
              <button
                onClick={() => {
                  if (selectedClassrooms.length === classrooms.length) {
                    setSelectedClassrooms([]);
                  } else {
                    setSelectedClassrooms(classrooms.map(c => c.id));
                  }
                }}
                className={clsx(
                  "px-3 py-1.5 text-xs font-bold rounded-full border transition-colors cursor-pointer",
                  selectedClassrooms.length === classrooms.length && classrooms.length > 0
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-stone-300 text-stone-600 hover:bg-stone-50"
                )}
              >
                全選
              </button>
              {classrooms.map((c) => {
                const isSelected = selectedClassrooms.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedClassrooms(prev => prev.filter(id => id !== c.id));
                      } else {
                        setSelectedClassrooms(prev => [...prev, c.id]);
                      }
                    }}
                    className={clsx(
                      "px-3 py-1.5 text-xs font-bold rounded-full border transition-colors cursor-pointer",
                      isSelected
                        ? "bg-stone-800 border-stone-800 text-white"
                        : "bg-white border-stone-300 text-stone-600 hover:bg-stone-50"
                    )}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <table className="w-full border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-stone-50/50">
              <th className="border-b border-r border-[#E7E5E4] p-4 text-sm font-bold text-stone-500 w-32">節次 / 日期</th>
              {weekDays.map((day) => (
                <th 
                  key={day.toISOString()} 
                  className={clsx(
                    "border-b border-[#E7E5E4] p-4 text-center",
                    format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") && "bg-indigo-50/30"
                  )}
                >
                  <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">
                    {format(day, "EEEE", { locale: zhTW })}
                  </div>
                  <div className={clsx(
                    "text-lg font-bold",
                    format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? "text-indigo-600" : "text-stone-700"
                  )}>
                    {format(day, "MM/dd")}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period) => (
              <tr key={period.id} className="group hover:bg-stone-50/50 transition-colors">
                <td className="border border-l-0 border-[#E7E5E4] p-4 bg-stone-50/50 group-hover:bg-indigo-50/30 transition-colors">
                  <div className="text-sm font-bold text-stone-700">{period.name}</div>
                  <div className="text-[11px] font-medium text-stone-400 mt-0.5">({period.time})</div>
                </td>
                {weekDays.map((day, dayIndex) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const displayedClassrooms = classrooms.filter(c => selectedClassrooms.includes(c.id));
                  
                  return (
                    <td 
                      key={dateStr} 
                      className={clsx(
                        "border border-[#E7E5E4] p-2 align-top text-[12px] transition-colors",
                        format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") && "bg-indigo-50/10"
                      )}
                    >
                      <div className="space-y-1">
                        {displayedClassrooms.map((room) => {
                          const booking = bookings.find(b => String(b.classroomId) === String(room.id) && b.date === dateStr && Number(b.period) === period.id);
                          
                          if (booking) {
                            const isEditable = user?.role === 'admin' || user?.username === booking.bookerName;
                            const isMine = user?.username === booking.bookerName;
                            
                            if (myOnly && !isMine) {
                              return null;
                            }
                            
                            return (
                              <div 
                                key={room.id} 
                                onClick={() => {
                                  if (isEditable) {
                                    setEditTarget(booking);
                                    setBookingFormData({ 
                                      bookerName: booking.bookerName, 
                                      userName: booking.userName, 
                                      courseContent: booking.courseContent 
                                    });
                                  }
                                }}
                                className={clsx(
                                  "relative group/booking px-2 py-1 rounded-md border flex items-center justify-between font-medium",
                                  isEditable ? "bg-indigo-50 text-indigo-700 border-indigo-100 cursor-pointer hover:bg-indigo-100 hover:ring-1 hover:ring-indigo-300 transition-colors" : "bg-emerald-50 text-emerald-700 border-emerald-100 cursor-not-allowed"
                                )}
                              >
                                <span className="truncate mr-1">{booking.bookerName} + {room.name}</span>
                                <span className={clsx("flex-shrink-0 w-1.5 h-1.5 rounded-full", isEditable ? "bg-indigo-500" : "bg-emerald-400")}></span>
                                
                                {/* 懸浮提示 */}
                                <div className={clsx(
                                  "absolute z-10 bottom-full mb-2 w-48 bg-stone-900 text-white p-3 rounded-xl shadow-xl opacity-0 invisible group-hover/booking:opacity-100 group-hover/booking:visible transition-all duration-200 pointer-events-none",
                                  dayIndex === 0 ? "left-0" : dayIndex >= 5 ? "right-0" : "left-1/2 -translate-x-1/2"
                                )}>
                                  <div className="text-xs font-bold text-indigo-300 mb-1 border-b border-white/10 pb-1">
                                    {isEditable ? "點擊以編輯此預約" : "預約詳情"}
                                  </div>
                                  <div className="space-y-1.5">
                                    <div>
                                      <div className="text-[10px] text-stone-400">課程 / 內容</div>
                                      <div className="text-sm leading-tight leading-snug">{booking.courseContent || "未填寫內容"}</div>
                                    </div>
                                    <div className="flex justify-between items-end gap-2 pt-1">
                                      <div className="flex-1">
                                        <div className="text-[10px] text-stone-400">預約者</div>
                                        <div className="text-xs">{booking.bookerName}</div>
                                      </div>
                                      {booking.userName && (
                                        <div className="flex-1 text-right">
                                          <div className="text-[10px] text-stone-400">使用者</div>
                                          <div className="text-xs truncate">{booking.userName}</div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {/* Tooltip 箭頭 */}
                                  <div className={clsx(
                                    "absolute top-full -mt-1 border-4 border-transparent border-t-stone-900",
                                    dayIndex === 0 ? "left-4" : dayIndex >= 5 ? "right-4" : "left-1/2 -translate-x-1/2"
                                  )}></div>
                                </div>
                              </div>
                            );
                          } else {
                            const isSelected = selectedSlots.some(s => s.classroomId === room.id && s.date === dateStr && s.period === period.id);
                            
                            return (
                              <div 
                                key={room.id} 
                                onClick={() => handleSlotClick({
                                  classroomId: room.id,
                                  roomName: room.name,
                                  date: dateStr,
                                  period: period.id,
                                  periodName: period.name.split(" (")[0]
                                })}
                                className={clsx(
                                  "px-2 py-1 rounded-md border flex items-center justify-between italic cursor-pointer transition-colors group/room font-medium",
                                  isSelected
                                    ? "bg-orange-50 border-orange-300 text-orange-700 ring-1 ring-orange-300"
                                    : "border-transparent text-stone-400 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                                )}
                              >
                                <span className="truncate">{room.name} - {isSelected ? "已選取" : "未預約"}</span>
                                {!isSelected && <span className="text-[10px] opacity-0 group-hover/room:opacity-100 font-bold">點選</span>}
                              </div>
                            );
                          }
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {isLoading && (
        <div className="fixed inset-0 bg-stone-100/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-[24px] shadow-xl flex items-center space-x-3">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="font-bold text-stone-700">正在讀取預約資料...</span>
          </div>
        </div>
      )}

      {selectedSlots.length > 0 && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-stone-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center space-x-6 z-40 animate-in slide-in-from-top-10 border border-stone-700">
          <div className="font-medium text-sm">
            已選擇 <span className="text-orange-400 font-bold text-lg mx-1">{selectedSlots.length}</span> 個時段
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSelectedSlots([])}
              className="px-4 py-2 rounded-full hover:bg-stone-800 text-stone-300 transition-colors text-sm font-medium"
            >
              取消
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors shadow-lg"
            >
              填寫預約資料
            </button>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] p-5 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <h2 className="text-lg font-bold text-stone-900 mb-4 shrink-0">新增預約</h2>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-0">
              <div className="bg-emerald-50 text-emerald-800 p-3 rounded-[12px] mb-4 space-y-1 text-sm border border-emerald-100 max-h-32 overflow-y-auto">
                <div className="font-bold mb-1">已選擇 {selectedSlots.length} 個時段：</div>
                <ul className="space-y-1">
                  {selectedSlots.map((slot, idx) => (
                    <li key={idx} className="flex justify-between border-b border-emerald-100/50 pb-1 last:border-0 text-xs">
                      <span>{slot.date} {slot.periodName}</span>
                      <span className="font-bold">{slot.roomName}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">預約者名稱</label>
                  <input
                    type="text"
                    disabled
                    value={user?.username || ""}
                    className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] bg-stone-100 text-stone-500 cursor-not-allowed text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">使用者名稱</label>
                  <input
                    type="text"
                    placeholder={user?.username || "例如：張老師"}
                    className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all text-sm"
                    value={userName}
                    onChange={e => setUserName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">課程名稱 / 內容 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="例如：微積分、系學會開會"
                    className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all text-sm"
                    value={courseContent}
                    onChange={e => setCourseContent(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-4 shrink-0 pt-4 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setCourseContent("");
                  setUserName("");
                }}
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-4 rounded-[12px] border border-[#E7E5E4] text-stone-600 font-bold hover:bg-stone-50 transition-colors text-sm"
              >
                取消
              </button>
              <button
                onClick={handleBookSubmit}
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-4 rounded-[12px] bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  "確認預約"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Form Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] shadow-2xl max-w-sm w-full p-5 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <h3 className="text-lg font-bold text-stone-900 mb-4 shrink-0">管理預約</h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-0">
              <form className="space-y-3">
                <div className="bg-emerald-50 text-emerald-800 p-3 rounded-[12px] mb-4 space-y-1 text-sm border border-emerald-100">
                  {relatedBookings.length > 1 ? (
                    <>
                      <div className="font-bold mb-1">此批次預約 (共 {relatedBookings.length} 節)：</div>
                      <ul className="space-y-1 max-h-24 overflow-y-auto pr-2 custom-scrollbar">
                         {relatedBookings.map((b, idx) => {
                           const room = classrooms.find(c => String(c.id) === String(b.classroomId));
                           return (
                             <li key={idx} className="flex justify-between border-b border-emerald-100/50 pb-1.5 pt-1.5 first:pt-0 last:border-0 text-xs">
                               <div className="flex items-center space-x-2">
                                 <span className={clsx("w-2 h-2 rounded-full flex-shrink-0", b.id === editTarget.id ? "bg-orange-500" : "bg-emerald-400")}></span>
                                 <span>{b.date} {PERIODS.find(p => p.id === Number(b.period))?.name.split(" (")[0]}</span>
                               </div>
                               <span className="font-bold truncate max-w-[80px] text-right">{room?.name || b.classroomId}</span>
                             </li>
                           );
                         })}
                      </ul>
                    </>
                  ) : (
                    <>
                      <div className="flex font-bold justify-between text-xs">
                        <span>日期：</span>
                        <span>{editTarget.date}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="opacity-75">節次：</span>
                        <span>{PERIODS.find(p => p.id === Number(editTarget.period))?.name.split(" (")[0] || `第 ${editTarget.period} 節`}</span>
                      </div>
                    </>
                  )}
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">預約者</label>
                  <input
                    type="text"
                    disabled
                    className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] bg-stone-100 text-stone-500 cursor-not-allowed text-sm"
                    value={bookingFormData.bookerName}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">使用者名稱</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all text-sm"
                    value={bookingFormData.userName}
                    onChange={(e) => setBookingFormData({...bookingFormData, userName: e.target.value})}
                    placeholder="例如：張老師"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">課程名稱 / 內容 <span className="text-red-500">*</span></label>
                  <textarea
                    required
                    rows={2}
                    className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none transition-all text-sm"
                    value={bookingFormData.courseContent}
                    onChange={(e) => setBookingFormData({...bookingFormData, courseContent: e.target.value})}
                    placeholder="例如：高中基礎物理實驗"
                  />
                </div>
              </form>
            </div>
            
            <div className="shrink-0 pt-4 mt-4 border-t border-[#E7E5E4] flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={(e) => handleUpdateBooking(e, false)}
                  className="flex-1 px-3 py-2 text-xs font-bold text-white bg-indigo-600 rounded-[12px] hover:bg-indigo-700 transition-colors"
                >
                  儲存修改
                </button>
                {relatedBookings.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => handleUpdateBooking(e, true)}
                    className="flex-1 px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-[12px] hover:bg-indigo-100 transition-colors"
                  >
                    儲存整批
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm({ isBatch: false })}
                  className="flex-1 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-[12px] hover:bg-red-100 transition-colors"
                >
                  刪除預約
                </button>
                {relatedBookings.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm({ isBatch: true })}
                    className="flex-1 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-[12px] hover:bg-red-100 transition-colors"
                  >
                    刪除整批
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="w-full mt-1 px-3 py-2 text-xs font-bold text-stone-600 border border-[#E7E5E4] rounded-[12px] hover:bg-stone-50 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-[24px] shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200 text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-2">確定要刪除預約嗎？</h3>
            <p className="text-stone-500 mb-6 text-sm">
              {deleteConfirm.isBatch 
                ? `這將會刪除同屬一批次的所有 ${relatedBookings.length} 筆預約，且刪除後無法恢復。` 
                : "刪除後無法恢復，請確認。"}
            </p>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 px-4 rounded-[16px] border border-[#E7E5E4] text-stone-700 font-bold hover:bg-stone-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => handleDeleteBooking(deleteConfirm.isBatch)}
                className="flex-1 py-3 px-4 rounded-[16px] bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-sm"
              >
                確定刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {progress && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] backdrop-blur-sm">
          <div className="bg-white rounded-[24px] p-8 max-w-sm w-full shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="relative w-24 h-24 mx-auto">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="48" cy="48" r="40" stroke="#F5F5F4" strokeWidth="8" fill="transparent" />
                <circle
                  cx="48" cy="48" r="40" stroke="#10B981" strokeWidth="8" fill="transparent"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - progress.current / progress.total)}
                  strokeLinecap="round" className="transition-all duration-300"
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
            <div className="text-sm font-medium text-emerald-700 bg-emerald-50 py-2 px-4 rounded-full inline-block border border-emerald-200">
              {progress.current} / {progress.total} 筆完成
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
