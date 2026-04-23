import React, { useState } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import { BookOpen, ShieldAlert, Check } from "lucide-react";
import clsx from "clsx";

import { apiCall } from "../api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  // Terms agreement state
  const [showTerms, setShowTerms] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoggingIn(true);
    
    try {
      const response = await apiCall("login", { username, password });

      if (!response.success) {
        throw new Error(response.error || "帳號或密碼錯誤");
      }

      setPendingUser(response);
      setShowTerms(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const confirmLogin = () => {
    if (pendingUser) {
      login(pendingUser.token, pendingUser.role, pendingUser.username);
      navigate("/");
    }
  };

  const cancelLogin = () => {
    setShowTerms(false);
    setPendingUser(null);
    setTermsAccepted(false);
    setHasScrolled(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const bottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop <= e.currentTarget.clientHeight + 10;
    if (bottom) setHasScrolled(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F4] font-sans relative">
      <div className="max-w-md w-full p-8 bg-white rounded-[20px] shadow-sm border border-[#E7E5E4]">
        <div className="flex flex-col items-center mb-8">
          <BookOpen className="w-12 h-12 text-[#4F46E5] mb-2" />
          <h2 className="text-2xl font-bold text-gray-900">教室預約系統</h2>
          <p className="text-gray-500 mt-2 text-sm">請登入您的帳號以繼續</p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-[12px] mb-6 text-sm border border-red-100 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-2">帳號</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 border border-[#E7E5E4] rounded-[16px] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] bg-stone-50 focus:bg-white outline-none transition-all font-medium"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="請輸入帳號"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-2">密碼</label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 border border-[#E7E5E4] rounded-[16px] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] bg-stone-50 focus:bg-white outline-none transition-all font-medium"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼"
            />
          </div>
          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full bg-[#4F46E5] text-white font-bold py-3.5 rounded-[16px] hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {isLoggingIn ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "登入"
            )}
          </button>
        </form>
      </div>

      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-stone-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#E7E5E4] flex items-center shadow-sm z-10">
              <ShieldAlert className="w-6 h-6 text-[#4F46E5] mr-3" />
              <h2 className="text-xl font-bold text-stone-900 tracking-tight">服務條款與同意聲明</h2>
            </div>
            
            {/* Body */}
            <div 
              className="p-6 overflow-y-auto max-h-[50vh] custom-scrollbar bg-stone-50 text-stone-700 text-sm leading-relaxed"
              onScroll={handleScroll}
            >
              {/* Highlight Preamble */}
              <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 rounded-[16px] text-emerald-800 font-bold shadow-sm flex items-start">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h4 className="text-emerald-900 mb-1">【教室使用規範】</h4>
                  使用者應共同維護教室整潔，離開時請帶走個人物品與垃圾。若為最後一節使用者，離開前請協助關閉門窗及電源。感謝您！
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-stone-900 text-base mb-2">重要提示：</h3>
                  <p className="text-stone-600">
                    在使用本系統前，請仔細閱讀以下服務條款。使用本系統即表示您已閱讀並同意以下全部條款。本系統由個人開發者（努豆先生）維護，並非商業服務，請理解並接受相應的服務限制。
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-stone-900 mb-1">§1 服務性質與免費聲明</h4>
                    <ul className="list-disc pl-5 space-y-1 text-stone-600">
                      <li>努豆先生教室預約系統（以下簡稱「本系統」）係由個人開發者無償提供，完全免費使用，不含任何廣告。</li>
                      <li>本系統屬個人興趣開發之作品，並非商業產品，不附帶任何形式的服務水準協議（SLA）。</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-bold text-stone-900 mb-1">§2 服務中斷與停止之免責聲明</h4>
                    <ul className="list-disc pl-5 space-y-1 text-stone-600">
                      <li>開發者保留於任何時間、以任何理由（包括但不限於伺服器成本過高、流量過大、個人因素）暫停或終止本系統服務之權利，且無須事先通知使用者。</li>
                      <li>本系統不保證服務之連續性、穩定性及可用性。因系統停機、網路中斷、第三方平台（Vercel、Supabase 等）故障所導致之損失，開發者概不負責。</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-bold text-stone-900 mb-1">§3 資料儲存與維護之免責聲明</h4>
                    <ul className="list-disc pl-5 space-y-1 text-stone-600">
                      <li>本系統所儲存之課程、教師、預約等資料，均由使用者自行建立與維護。開發者不承擔任何資料備份、資料遷移或資料保全之義務。</li>
                      <li>因伺服器錯誤、資料庫故障、系統更新或服務終止導致資料遺失，開發者不負任何賠償責任。</li>
                      <li>強烈建議使用者定期使用系統內建之功能自行備份資料。</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-bold text-stone-900 mb-1">§4 使用限制：僅供個人非商業用途</h4>
                    <ul className="list-disc pl-5 space-y-1 text-stone-600">
                      <li>本系統授權使用者以個人、非營利之教育行政目的使用，例如學校教師自行排課管理，不得用於任何商業用途。</li>
                      <li>禁止行為包括但不限於：將本系統作為付費服務轉售給第三方、以本系統為基礎提供商業顧問服務、大量自動化抓取系統資料等。</li>
                      <li>違反本條款者，開發者有權立即終止其帳號使用資格，且無須給予任何補償或退費。</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-bold text-stone-900 mb-1">§5 智慧財產權</h4>
                    <ul className="list-disc pl-5 space-y-1 text-stone-600">
                      <li>本系統之程式碼、介面設計、文字內容等，其著作權均歸開發者個人所有。</li>
                      <li>使用者不得複製、修改、散布、逆向工程或以任何方式重製本系統之全部或部分內容，亦不得聲稱對本系統擁有任何所有權。</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-bold text-stone-900 mb-1">§6 隱私與個人資料</h4>
                    <ul className="list-disc pl-5 space-y-1 text-stone-600">
                      <li>本系統蒐集之個人資料（電子郵件、使用者名稱）僅作為帳號識別用途，不會出售或分享給任何第三方。</li>
                      <li>本系統使用第三方服務（Google Sheets 作為資料庫，Vercel 作為主機服務等），使用者輸入之資料受上述第三方之隱私政策規範。</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-bold text-stone-900 mb-1">§7 擔保免除</h4>
                    <ul className="list-disc pl-5 space-y-1 text-stone-600">
                      <li>本系統以「現狀」（AS IS）提供，不做任何明示或默示之擔保，包括但不限於適售性、特定用途之適用性及不侵權之默示擔保。</li>
                      <li>開發者不保證本系統無錯誤、無病毒或完全安全。因使用本系統所產生之任何直接、間接、附帶或後果性損失，開發者均不負賠償責任。</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-bold text-stone-900 mb-1">§8 條款變更</h4>
                    <ul className="list-disc pl-5 space-y-1 text-stone-600">
                      <li>開發者保留隨時修改本服務條款之權利，修改後繼續使用本系統即代表您同意接受修改後之條款。</li>
                      <li>若您不同意本服務條款或任何變更，請立即停止使用本系統並刪除您的帳號。</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-bold text-stone-900 mb-1">§9 準據法與爭議解決</h4>
                    <ul className="list-disc pl-5 space-y-1 text-stone-600">
                      <li>本服務條款受中華民國（台灣）法律規範。因本條款或使用本系統所產生之任何爭議，雙方同意以台灣台北地方法院為第一審管轄法院。</li>
                      <li>若本條款任何條款被認定為無效或不可執行，其餘條款仍繼續有效。</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-6 bg-white border-t border-[#E7E5E4] shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] z-10">
              <label className={clsx(
                "flex items-center space-x-3 mb-6 p-3 rounded-[12px] border transition-colors cursor-pointer",
                termsAccepted ? "bg-indigo-50 border-indigo-200" : "bg-stone-50 border-[#E7E5E4] hover:bg-stone-100"
              )}>
                <div className="flex-shrink-0 relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    className="w-5 h-5 cursor-pointer opacity-0 absolute inset-0 z-10"
                    checked={termsAccepted}
                    onChange={(e) => {
                      setTermsAccepted(e.target.checked);
                      if (!hasScrolled) setHasScrolled(true); // Auto-act as read if checked directly
                    }}
                  />
                  <div className={clsx(
                    "w-5 h-5 rounded-[6px] border-2 flex items-center justify-center transition-colors",
                    termsAccepted ? "bg-[#4F46E5] border-[#4F46E5]" : "border-stone-300 bg-white"
                  )}>
                    {termsAccepted && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                  </div>
                </div>
                <span className={clsx("text-sm font-bold", termsAccepted ? "text-[#4F46E5]" : "text-stone-600")}>
                  我已詳細閱讀並同意上述「服務條款」與「教室使用規範」
                </span>
              </label>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={cancelLogin}
                  className="flex-1 py-3 px-4 rounded-[16px] border border-[#E7E5E4] text-stone-600 font-bold hover:bg-stone-50 transition-colors"
                >
                  取消登入
                </button>
                <button
                  type="button"
                  onClick={confirmLogin}
                  disabled={!termsAccepted}
                  className="flex-1 py-3 px-4 rounded-[16px] bg-[#4F46E5] text-white font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  同意並開始使用
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
