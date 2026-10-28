"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Clock,
  Banknote,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { getGroups } from "@/lib/data";

const mainMenuItems = [
  { href: "/employees", label: "Employés", icon: Users },
  { href: "/attendance", label: "Attendance", icon: Clock },
  { href: "/payroll", label: "Payroll", icon: Banknote },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const groups = getGroups();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(true);

  const isPlanningActive = pathname === "/planning";
  const isDashboardActive = pathname === "/";

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3 px-4 py-5 border-b border-zinc-800">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-red-500 flex items-center justify-center text-black font-bold text-lg shrink-0">
          🍔
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-bold text-white text-lg leading-tight whitespace-nowrap">RAPID CROUSTI</h1>
            <p className="text-xs text-zinc-400 whitespace-nowrap">Planning Manager</p>
          </div>
        )}
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {/* Dashboard */}
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
            isDashboardActive
              ? "bg-red-600 text-white shadow-lg shadow-red-900/30"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
          }`}
        >
          <LayoutDashboard className={`w-5 h-5 shrink-0 ${isDashboardActive ? "text-white" : "text-zinc-400 group-hover:text-white"}`} />
          {!collapsed && <span className="text-sm font-medium whitespace-nowrap">Dashboard</span>}
        </Link>

        {/* Planning Section with sub-items */}
        <div>
          <button
            onClick={() => setPlanningOpen(!planningOpen)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full ${
              isPlanningActive
                ? "bg-red-600 text-white shadow-lg shadow-red-900/30"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            <CalendarDays className={`w-5 h-5 shrink-0 ${isPlanningActive ? "text-white" : "text-zinc-400"}`} />
            {!collapsed && (
              <>
                <span className="text-sm font-medium whitespace-nowrap flex-1 text-left">Planning</span>
                {planningOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </>
            )}
          </button>

          {!collapsed && planningOpen && (
            <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-zinc-800 pl-2">
              {groups.map((g) => {
                const isActive = isPlanningActive && (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("group") : null) === g.id;
                return (
                  <Link
                    key={g.id}
                    href={`/planning?group=${g.id}`}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm ${
                      isActive ? "bg-zinc-800 text-white" : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                    <div className="flex flex-col">
                      <span className="font-medium">{g.label}</span>
                      <span className="text-[10px] text-zinc-600">{g.start} → {g.end}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Other menu items */}
        {mainMenuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                isActive
                  ? "bg-red-600 text-white shadow-lg shadow-red-900/30"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "text-zinc-400 group-hover:text-white"}`} />
              {!collapsed && <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center text-white border border-zinc-700">
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
      {mobileOpen && <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setMobileOpen(false)} />}
      <aside className={`lg:hidden fixed top-0 left-0 h-full bg-zinc-950 border-r border-zinc-800 z-40 flex flex-col transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} w-64`}>
        {sidebarContent}
      </aside>
      <aside className={`hidden lg:flex fixed top-0 left-0 h-full bg-zinc-950 border-r border-zinc-800 z-30 flex-col transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`}>
        <button onClick={() => setCollapsed(!collapsed)} className="absolute -right-3 top-20 w-6 h-6 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
        {sidebarContent}
      </aside>
    </>
  );
}
