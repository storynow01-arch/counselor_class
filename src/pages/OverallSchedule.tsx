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

export default function OverallSchedule() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const startDateOfWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDateOfWeek, i));

  const weekRange = {
    start: format(weekDays[0], "yyyy-MM-dd"),
    end: format(weekDays[6], "yyyy-MM-dd"),
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const roomsRes = await apiCall("getClassrooms");
        if (roomsRes.success) setClassrooms(roomsRes.classrooms);
        
        // 現在 GAS 的 getSchedule 已支援不帶 classroomId 抓取全部資料
        const bookingsRes = await apiCall("getSchedule", {
          startDate: weekRange.start,
          endDate: weekRange.end
          // 故意不傳 classroomId，讓 GAS 回傳該日期範圍內的所有教室預約
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
    fetchData();
  }, [currentDate]);

  const navigateWeek = (amount: number) => {
    setCurrentDate(addDays(currentDate, amount * 7));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-stone-900 border-l-4 border-indigo-600 pl-3">預約總表</h1>
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
        <div className="p-6 border-b border-[#E7E5E4] flex items-center justify-between">
          <div className="flex items-center text-xl font-bold text-stone-900">
            <Calendar className="w-6 h-6 mr-2 text-indigo-600" />
            {format(currentDate, "yyyy 年 MM 月")}
          </div>
          <div className="text-sm text-stone-500 font-medium">
            顯示所有教室之預約狀態
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
                {weekDays.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  
                  return (
                    <td 
                      key={dateStr} 
                      className={clsx(
                        "border border-[#E7E5E4] p-2 align-top text-[12px] transition-colors",
                        format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") && "bg-indigo-50/10"
                      )}
                    >
                      <div className="space-y-1">
                        {classrooms.map((room) => {
                          const booking = bookings.find(b => String(b.classroomId) === String(room.id) && b.date === dateStr && Number(b.period) === period.id);
                          
                          if (booking) {
                            return (
                              <div key={room.id} className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md border border-indigo-100 flex items-center justify-between font-medium">
                                <span className="truncate mr-1">{booking.bookerName} + {room.name}</span>
                                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                              </div>
                            );
                          } else {
                            return (
                              <div key={room.id} className="text-stone-400 px-2 py-1 border border-transparent flex items-center justify-between italic">
                                <span className="truncate">{room.name} - 未預約</span>
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
    </div>
  );
}
