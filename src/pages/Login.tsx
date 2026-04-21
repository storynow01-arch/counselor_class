import { useState } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";

import { apiCall } from "../api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      const response = await apiCall("login", { username, password });

      if (!response.success) {
        throw new Error(response.error || "帳號或密碼錯誤");
      }

      login(response.token, response.role, response.username);
      navigate("/");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F4] font-sans">
      <div className="max-w-md w-full p-8 bg-white rounded-[20px] shadow-sm border border-[#E7E5E4]">
        <div className="flex flex-col items-center mb-8">
          <BookOpen className="w-12 h-12 text-[#4F46E5] mb-2" />
          <h2 className="text-2xl font-bold text-gray-900">教室預約系統</h2>
          <p className="text-gray-500 mt-2 text-sm">請登入您的帳號以繼續</p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">帳號</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-[#E7E5E4] rounded-[16px] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none transition-all"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="預設: admin / user"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">密碼</label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 border border-[#E7E5E4] rounded-[16px] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-[#4F46E5] text-white font-medium py-2.5 rounded-[16px] hover:bg-indigo-700 transition-colors"
          >
            登入
          </button>
        </form>
      </div>
    </div>
  );
}
