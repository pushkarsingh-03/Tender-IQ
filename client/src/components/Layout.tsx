import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, FileText, RefreshCw, TrendingUp,
} from "lucide-react";

const NAV = [
  { to: "/",       label: "Dashboard",  icon: LayoutDashboard },
  { to: "/tenders",label: "Tenders",    icon: FileText        },
  { to: "/sync",   label: "Sync",       icon: RefreshCw       },
];

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-slate-900 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">TenderIQ</p>
              <p className="text-slate-500 text-xs mt-0.5">GEM Tracker</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white font-medium"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-800">
          <p className="text-slate-600 text-xs">Vardhman Hydraulic Hoses</p>
          <p className="text-slate-700 text-xs mt-0.5">GEM Portal Tracker</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}
