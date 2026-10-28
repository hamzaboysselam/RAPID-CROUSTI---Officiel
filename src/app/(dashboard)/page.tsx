"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  CheckCircle,
  Clock,
  XCircle,
  Coffee,
  Calendar,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from "lucide-react";
import {
  getEmployees,
  getAttendance,
  getSchedules,
  getGroups,
  getSettings,
  getWeekNumber,
  getExpectedMonthlyHours,
  getMonthName,
} from "@/lib/data";
import { calculateHours, formatDateKey } from "@/lib/utils";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const employees = getEmployees();
    const attendance = getAttendance();
    const schedules = getSchedules();
    const groups = getGroups();
    const settings = getSettings();

    const today = formatDateKey(new Date());
    const todayRecords = attendance.filter((a) => a.date === today);

    const present = todayRecords.filter((r) => r.status === "present").length;
    const late = todayRecords.filter((r) => r.status === "late").length;
    const absent = todayRecords.filter((r) => r.status === "absent").length;
    const off = todayRecords.filter((r) => r.status === "off").length;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentWeek = getWeekNumber(now);
    const expectedMonthly = getExpectedMonthlyHours(currentYear, currentMonth);

    const workedHours = attendance.reduce((acc, a) => acc + a.workedHours, 0);
    const plannedHours = schedules.reduce((acc, s) => {
      if (s.isOff || !s.startTime || !s.endTime) return acc;
      return acc + calculateHours(s.startTime, s.endTime);
    }, 0);

    const frame = requestAnimationFrame(() => setStats({
      totalEmployees: employees.filter((e) => e.status === "active").length,
      present,
      late,
      absent,
      off,
      currentYear,
      currentMonth,
      currentWeek,
      monthName: getMonthName(currentMonth),
      expectedMonthly,
      workedHours: Math.round(workedHours * 10) / 10,
      plannedHours: Math.round(plannedHours * 10) / 10,
      groups,
      settings,
    }));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    { label: "Employés", value: stats.totalEmployees, icon: Users, color: "bg-blue-500/10 text-blue-400" },
    { label: "Présents", value: stats.present, icon: CheckCircle, color: "bg-emerald-500/10 text-emerald-400" },
    { label: "Retards", value: stats.late, icon: Clock, color: "bg-yellow-500/10 text-yellow-400" },
    { label: "Absents", value: stats.absent, icon: XCircle, color: "bg-red-500/10 text-red-400" },
    { label: "OFF", value: stats.off, icon: Coffee, color: "bg-zinc-700/30 text-zinc-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Tableau de bord</h1>
        <p className="text-zinc-400 text-sm mt-1">{stats.settings.companyName} — {stats.monthName} {stats.currentYear} — Semaine {stats.currentWeek}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color.split(" ")[0]}`}>
                <card.icon className={`w-5 h-5 ${card.color.split(" ")[1]}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{card.value}</p>
                <p className="text-xs text-zinc-400">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hours Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-red-500" /> Heures du mois</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between"><span className="text-zinc-400 text-sm">Attendues</span><span className="text-white font-bold">{stats.expectedMonthly}h</span></div>
            <div className="flex items-center justify-between"><span className="text-zinc-400 text-sm">Travaillées</span><span className="text-emerald-400 font-bold">{stats.workedHours}h</span></div>
            <div className="flex items-center justify-between"><span className="text-zinc-400 text-sm">Planifiées</span><span className="text-blue-400 font-bold">{stats.plannedHours}h</span></div>
            <div className="w-full bg-zinc-800 rounded-full h-2 mt-2">
              <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (stats.workedHours / stats.expectedMonthly) * 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-yellow-500" /> Groupes</h3>
          <div className="space-y-3">
            {stats.groups.map((g: any) => (
              <Link key={g.id} href={`/planning?group=${g.id}`} className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                  <span className="text-white text-sm font-medium">{g.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 text-xs">{g.start} → {g.end}</span>
                  <ArrowRight className="w-4 h-4 text-zinc-500" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-500" /> Pénalités du jour</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800">
              <span className="text-zinc-400 text-sm">Retard 1-5 min</span>
              <span className="text-yellow-400 font-bold">-{stats.settings.lateDeduction1to5}h</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800">
              <span className="text-zinc-400 text-sm">Retard &gt;5 min</span>
              <span className="text-orange-400 font-bold">-{stats.settings.lateDeductionOver5}h</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800">
              <span className="text-zinc-400 text-sm">Absent</span>
              <span className="text-red-400 font-bold">-{stats.settings.absentDeduction}h</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800">
              <span className="text-zinc-400 text-sm">OFF</span>
              <span className="text-zinc-400 font-bold">0h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/employees" className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 hover:border-red-500/50 transition-colors">
          <Users className="w-6 h-6 text-blue-400 mb-2" />
          <p className="text-white font-bold text-sm">Employés</p>
          <p className="text-zinc-500 text-xs">Gérer le personnel</p>
        </Link>
        <Link href="/attendance" className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 hover:border-red-500/50 transition-colors">
          <CheckCircle className="w-6 h-6 text-emerald-400 mb-2" />
          <p className="text-white font-bold text-sm">Attendance</p>
          <p className="text-zinc-500 text-xs">Pointage quotidien</p>
        </Link>
        <Link href="/payroll" className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 hover:border-red-500/50 transition-colors">
          <TrendingUp className="w-6 h-6 text-yellow-400 mb-2" />
          <p className="text-white font-bold text-sm">Payroll</p>
          <p className="text-zinc-500 text-xs">Fiches de paie</p>
        </Link>
        <Link href="/reports" className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 hover:border-red-500/50 transition-colors">
          <Calendar className="w-6 h-6 text-red-400 mb-2" />
          <p className="text-white font-bold text-sm">Reports</p>
          <p className="text-zinc-500 text-xs">Rapports & stats</p>
        </Link>
      </div>
    </div>
  );
}
