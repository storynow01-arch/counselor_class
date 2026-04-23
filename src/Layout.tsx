import { Outlet, Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { LogOut, CalendarDays, Settings, ShieldCheck, LayoutGrid, Search as SearchIcon, CalendarClock } from "lucide-react";
import clsx from "clsx";

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const navLinks = [
    { 
      name: "我的預約", path: "/", icon: CalendarDays,
      theme: { active: "bg-indigo-50 border-indigo-200 text-indigo-700", inactive: "border-transparent text-stone-600 hover:bg-indigo-50/50 hover:text-indigo-600", icon: "text-indigo-500" }
    },
    { 
      name: "預約總表", path: "/overall", icon: LayoutGrid,
      theme: { active: "bg-emerald-50 border-emerald-200 text-emerald-700", inactive: "border-transparent text-stone-600 hover:bg-emerald-50/50 hover:text-emerald-600", icon: "text-emerald-500" }
    },
    { 
      name: "長期預約", path: "/longterm", icon: CalendarClock,
      theme: { active: "bg-amber-50 border-amber-200 text-amber-700", inactive: "border-transparent text-stone-600 hover:bg-amber-50/50 hover:text-amber-600", icon: "text-amber-500" }
    },
    { 
      name: "空堂查詢", path: "/search", icon: SearchIcon,
      theme: { active: "bg-rose-50 border-rose-200 text-rose-700", inactive: "border-transparent text-stone-600 hover:bg-rose-50/50 hover:text-rose-600", icon: "text-rose-500" }
    },
    ...(user.role === "admin"
      ? [{ 
          name: "系統管理", path: "/admin", icon: Settings,
          theme: { active: "bg-stone-100 border-stone-300 text-stone-800", inactive: "border-transparent text-stone-600 hover:bg-stone-100/50 hover:text-stone-900", icon: "text-stone-500" }
        }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F4] flex flex-col font-sans">
      <nav className="bg-white border-b border-[#E7E5E4] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center pr-4">
                <CalendarDays className="h-8 w-8 text-[#4F46E5]" />
                <span className="ml-2 text-xl font-bold text-stone-900 hidden sm:block">
                  教室預約系統
                </span>
              </div>
              <div className="ml-2 flex items-center space-x-2">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = location.pathname === link.path;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={clsx(
                        "inline-flex items-center px-3 py-2 rounded-[14px] text-sm font-bold transition-all border",
                        isActive
                          ? link.theme.active
                          : link.theme.inactive
                      )}
                    >
                      <Icon className={clsx("h-4 w-4 mr-1.5", !isActive && link.theme.icon)} />
                      {link.name}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center">
              <div className="flex items-center text-sm font-medium text-stone-700 mr-4">
                {user.role === "admin" && (
                  <ShieldCheck className="h-4 w-4 text-orange-500 mr-1" />
                )}
                {user.username}
              </div>
              <button
                onClick={logout}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-stone-600 hover:text-stone-900 hover:bg-stone-100 focus:outline-none transition-colors"
              >
                <LogOut className="h-4 w-4 mr-1.5" />
                登出
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
