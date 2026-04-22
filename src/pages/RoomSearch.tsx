import { useState, useEffect } from "react";
import { format, eachDayOfInterval, parseISO, getDay } from "date-fns";
import { Search as SearchIcon, CheckCircle2, XCircle, Info, CalendarSearch } from "lucide-react";
import { apiCall } from "../api";
import clsx from "clsx";

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

export default function RoomSearch() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  
  // Form State
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startPeriod, setStartPeriod] = useState(1);
  const [endPeriod, setEndPeriod] = useState(9);
  const [selectedClassroom, setSelectedClassroom] = useState("ALL");
  const [selectedDays, setSelectedDays] = useState<number[]>([]); // Empty means all days
  
  // Results State
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Classroom[]>([]);
  const [conflictedRooms, setConflictedRooms] = useState<{room: Classroom, conflicts: Booking[]}[]>([]);

  useEffect(() => {
    apiCall("getClassrooms").then(res => {
      if (res.success) setClassrooms(res.classrooms);
    });
  }, []);

  const handleSearch = async () => {
    setIsSearching(true);
    setHasSearched(false);
    
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      if (end < start) {
        alert("結束日期不能早於開始日期");
        setIsSearching(false);
        return;
      }
      
      let allIntervalDays = eachDayOfInterval({ start, end });
      
      // Filter by specified day of week if any are checked
      if (selectedDays.length > 0) {
        allIntervalDays = allIntervalDays.filter(d => selectedDays.includes(getDay(d)));
      }
      
      const targetDates = allIntervalDays.map(d => format(d, "yyyy-MM-dd"));
      const targetPeriods = PERIODS.filter(p => p.id >= startPeriod && p.id <= endPeriod).map(p => p.id);

      // fetch all bookings in this date range
      const res = await apiCall("getSchedule", {
        startDate,
        endDate
      });

      if (res.success) {
        const allBookings = res.bookings as Booking[];
        const roomsToEval = selectedClassroom === "ALL" 
          ? classrooms 
          : classrooms.filter(c => c.id === selectedClassroom);

        const available: Classroom[] = [];
        const conflicted: {room: Classroom, conflicts: Booking[]}[] = [];

        for (const room of roomsToEval) {
          // Check for overlapping bookings in the selected dates & periods for this room
          const overlaps = allBookings.filter(b => 
            String(b.classroomId) === String(room.id) &&
            targetDates.includes(b.date) &&
            targetPeriods.includes(Number(b.period))
          );

          if (overlaps.length === 0) {
            available.push(room);
          } else {
            // Sort conflicts by date then period
            overlaps.sort((a, b) => {
              if (a.date !== b.date) return a.date.localeCompare(b.date);
              return Number(a.period) - Number(b.period);
            });
            conflicted.push({ room, conflicts: overlaps });
          }
        }

        setAvailableRooms(available);
        setConflictedRooms(conflicted);
        setHasSearched(true);
      }
    } catch (err) {
      console.error(err);
      alert("查詢發生錯誤，請稍後再試");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center">
        <h1 className="text-2xl font-bold text-stone-900 border-l-4 border-emerald-500 pl-3">教室空堂查詢</h1>
      </div>

      <div className="bg-white p-6 rounded-[24px] border border-[#E7E5E4] shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dates */}
          <div className="space-y-4 border-r-0 md:border-r border-[#E7E5E4] md:pr-6">
            <h3 className="text-sm font-bold text-stone-900 flex items-center">
              <span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center mr-2 text-stone-500">1</span>
              設定查詢日期區間
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">開始日期</label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] focus:ring-emerald-500 focus:border-emerald-500"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">結束日期</label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] focus:ring-emerald-500 focus:border-emerald-500"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            </div>
            
            <div className="pt-2">
              <label className="block text-xs font-bold text-stone-700 mb-2">限定星期 (若未勾選則視為每天都查)</label>
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
                      className="w-4 h-4 text-emerald-600 border-[#E7E5E4] rounded focus:ring-emerald-500" 
                      checked={selectedDays.includes(day.val)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedDays([...selectedDays, day.val]);
                        else setSelectedDays(selectedDays.filter(d => d !== day.val));
                      }}
                    />
                    <span className="text-xs text-stone-600 group-hover:text-stone-900 transition-colors">{day.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Periods & Rooms */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center">
              <span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center mr-2 text-stone-500">2</span>
              設定節次與特定教室
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">開始節次</label>
                <select 
                  className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] bg-white focus:ring-emerald-500 focus:border-emerald-500"
                  value={startPeriod}
                  onChange={e => setStartPeriod(Number(e.target.value))}
                >
                  {PERIODS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">結束節次</label>
                <select 
                  className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] bg-white focus:ring-emerald-500 focus:border-emerald-500"
                  value={endPeriod}
                  onChange={e => setEndPeriod(Number(e.target.value))}
                >
                  {PERIODS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">指定範圍</label>
              <select 
                className="w-full px-3 py-2 border border-[#E7E5E4] rounded-[12px] bg-white focus:ring-emerald-500 focus:border-emerald-500"
                value={selectedClassroom}
                onChange={e => setSelectedClassroom(e.target.value)}
              >
                <option value="ALL">全部教室 (搜尋所有未被預約的教室)</option>
                {classrooms.map(c => <option key={c.id} value={c.id}>僅檢查 {c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[#E7E5E4]">
          <button 
            onClick={handleSearch}
            disabled={isSearching}
            className="w-full sm:w-auto px-8 py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-[16px] shadow-sm flex items-center justify-center transition-colors disabled:opacity-50"
          >
            {isSearching ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <CalendarSearch className="w-5 h-5 mr-2" />
            )}
            執行條件查詢
          </button>
        </div>
      </div>

      {/* Query Results */}
      {hasSearched && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center text-sm text-stone-500">
            <Info className="w-4 h-4 mr-1" />
            查詢結果擷取時間：{format(new Date(), "HH:mm:ss")}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Available List */}
            <div className="bg-white rounded-[24px] border border-emerald-100 shadow-sm overflow-hidden">
              <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex items-center justify-between">
                <div className="flex items-center text-emerald-800 font-bold">
                  <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600" />
                  完全空閒的教室 ({availableRooms.length})
                </div>
              </div>
              <div className="p-4">
                {availableRooms.length === 0 ? (
                  <p className="text-stone-500 text-sm text-center py-8">在您指定的時段與星期條件內，<br/>沒有任何教室是「完全空閒」的。</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableRooms.map(room => (
                      <span key={room.id} className="inline-flex items-center px-4 py-2 bg-emerald-100 text-emerald-800 text-sm font-bold rounded-[12px]">
                        {room.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Conflicted List */}
            <div className="bg-white rounded-[24px] border border-red-100 shadow-sm overflow-hidden">
              <div className="bg-red-50 p-4 border-b border-red-100 flex items-center justify-between">
                <div className="flex items-center text-red-800 font-bold">
                  <XCircle className="w-5 h-5 mr-2 text-red-600" />
                  已有預約衝突 ({conflictedRooms.length})
                </div>
              </div>
              <div className="p-4 max-h-[600px] overflow-y-auto">
                {conflictedRooms.length === 0 ? (
                  <p className="text-stone-500 text-sm text-center py-8">沒有發現任何衝突預約。</p>
                ) : (
                  <div className="space-y-4">
                    {conflictedRooms.map(({room, conflicts}) => (
                      <div key={room.id} className="border border-[#E7E5E4] rounded-[16px] p-4 bg-stone-50/50">
                        <div className="font-bold text-stone-900 mb-3">{room.name}</div>
                        <div className="space-y-2">
                          {conflicts.map(b => (
                            <div key={b.id} className="text-xs flex items-start space-x-2 bg-white border border-red-100 p-2 rounded-lg">
                              <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded font-mono">
                                {b.date} {PERIODS.find(p => p.id === Number(b.period))?.name}
                              </span>
                              <div className="flex-1 text-stone-600">
                                預約者: <span className="font-medium text-stone-900">{b.userName}</span>
                                {b.courseContent && <span className="ml-2 text-stone-400">({b.courseContent})</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
