import { useState, useEffect } from "react";
import { format, eachDayOfInterval, getDay, parseISO } from "date-fns";
import { CalendarClock } from "lucide-react";
import { apiCall } from "../api";
import { useAuth } from "../AuthContext";

type Classroom = { id: string; name: string };

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

export default function LongTerm() {
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  
  // Form state
  const [selectedClassroom, setSelectedClassroom] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startPeriod, setStartPeriod] = useState(1);
  const [endPeriod, setEndPeriod] = useState(1);
  const [courseContent, setCourseContent] = useState("");
  const [isRepeating, setIsRepeating] = useState(true);

  // Status state
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    targetDates: string[];
    periods: number[];
  } | null>(null);

  useEffect(() => {
    apiCall("getClassrooms").then(res => {
      if (res.success && res.classrooms) {
        setClassrooms(res.classrooms);
        if (res.classrooms.length > 0) setSelectedClassroom(res.classrooms[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleAddLongTerm = async () => {
    if (!selectedClassroom) {
      setToast({ message: "請選擇教室", type: "error" });
      return;
    }
    if (!courseContent.trim()) {
      setToast({ message: "課程名稱為必填項目", type: "error" });
      return;
    }
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
      setPendingAction({ targetDates, periods });
    } catch(err) {
      setToast({ message: "預約準備失敗", type: "error" });
    }
  };

  const executeLongTerm = async () => {
    if (!pendingAction) return;
    const { targetDates, periods } = pendingAction;
    setPendingAction(null);

    try {
      const batchId = "long-" + Date.now().toString() + Math.random().toString(36).substring(7);
      let successCount = 0;
      let failCount = 0;
      const total = targetDates.length * periods.length;
      setProgress({ current: 0, total });

      for (const date of targetDates) {
        for (const period of periods) {
          const res = await apiCall("addBooking", {
            classroomId: selectedClassroom,
            date,
            period,
            type: "long",
            bookerName: user?.username,
            userName: user?.username, // Always default to the person creating it (or override below)
            courseContent,
            batchId
          });
          if (res.success) successCount++;
          else failCount++;
          
          setProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
        }
      }
      
      setProgress(null);
      if (failCount > 0) {
        setToast({ message: `部分預約新增失敗 (成功: ${successCount}, 失敗: ${failCount})，可能發生衝突`, type: "error" });
      } else {
        setToast({ message: `已成功新增 ${successCount} 筆長期預約`, type: "success" });
        setCourseContent("");
      }
    } catch (err) {
      setToast({ message: "執行失敗，請稍後再試", type: "error" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center">
        <h1 className="text-2xl font-bold text-stone-900 border-l-4 border-purple-500 pl-3">長期預約</h1>
      </div>

      <div className="max-w-2xl bg-white p-8 rounded-[24px] border border-[#E7E5E4] shadow-sm space-y-6">
        <div>
          <label className="block text-sm font-bold text-stone-700 mb-1">選擇教室</label>
          <select className="w-full px-4 py-3 border border-[#E7E5E4] rounded-[12px] bg-stone-50 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition-colors" value={selectedClassroom} onChange={(e) => setSelectedClassroom(e.target.value)}>
            {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">開始日期</label>
            <input type="date" className="w-full px-4 py-3 border border-[#E7E5E4] rounded-[12px] bg-stone-50 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition-colors" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
             <label className="block text-sm font-bold text-stone-700 mb-1">結束日期</label>
            <input type="date" className="w-full px-4 py-3 border border-[#E7E5E4] rounded-[12px] bg-stone-50 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition-colors" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div>
           <label className="block text-sm font-bold text-stone-700 mb-3">重複週期 (星期)</label>
          <div className="grid grid-cols-4 gap-3 bg-stone-50 p-4 rounded-[12px] border border-[#E7E5E4]">
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
                  className="w-5 h-5 text-purple-600 border-[#E7E5E4] rounded focus:ring-purple-500" 
                  checked={selectedDays.includes(day.val)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedDays([...selectedDays, day.val]);
                    else setSelectedDays(selectedDays.filter(d => d !== day.val));
                  }}
                />
                <span className="text-sm font-medium text-stone-600 group-hover:text-stone-900 transition-colors">{day.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">開始節次</label>
            <select className="w-full px-4 py-3 border border-[#E7E5E4] rounded-[12px] bg-stone-50 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition-colors" value={startPeriod} onChange={(e) => setStartPeriod(Number(e.target.value))}>
              {PERIODS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">結束節次</label>
            <select className="w-full px-4 py-3 border border-[#E7E5E4] rounded-[12px] bg-stone-50 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition-colors" value={endPeriod} onChange={(e) => setEndPeriod(Number(e.target.value))}>
              {PERIODS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div>
           <label className="block text-sm font-bold text-stone-700 mb-1">課程名稱 / 備註</label>
           <input type="text" className="w-full px-4 py-3 border border-[#E7E5E4] rounded-[12px] bg-stone-50 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition-colors" placeholder="請填寫用途或課程名稱" value={courseContent} onChange={(e) => setCourseContent(e.target.value)} />
        </div>

        <div className="pt-4 border-t border-[#E7E5E4]">
          <button 
            onClick={handleAddLongTerm} 
            className="w-full py-4 text-white font-bold text-lg rounded-[16px] shadow-md transition-colors bg-purple-600 hover:bg-purple-700"
          >
            送出長期預約
          </button>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-full shadow-lg text-white font-medium animate-in slide-in-from-bottom-2 ${toast.type === "error" ? "bg-red-500" : "bg-emerald-500"}`}>
          {toast.message}
        </div>
      )}

      {pendingAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
          <div className="bg-white rounded-[24px] p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 text-center space-y-6">
            <h3 className="text-xl font-bold text-stone-900">確認長期預約</h3>
            <p className="text-stone-600 whitespace-pre-wrap">
              確定要在這段期間新增共 <span className="font-bold text-purple-600">{pendingAction.targetDates.length * pendingAction.periods.length}</span> 筆預約嗎？
              <br/>
              ({pendingAction.targetDates.length} 天 x {pendingAction.periods.length} 節)
            </p>
            <div className="flex space-x-3 pt-2">
              <button 
                onClick={() => setPendingAction(null)}
                className="flex-1 py-2.5 rounded-[12px] border border-stone-200 text-stone-600 font-bold hover:bg-stone-50 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={executeLongTerm}
                className="flex-1 py-2.5 rounded-[12px] bg-purple-600 text-white font-bold hover:bg-purple-700 transition-colors shadow-sm"
              >
                確認新增
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
                  cx="48" cy="48" r="40" stroke="#9333EA" strokeWidth="8" fill="transparent"
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
            <div className="text-sm font-medium text-purple-600 bg-purple-50 py-2 px-4 rounded-full inline-block">
              {progress.current} / {progress.total} 筆完成
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
