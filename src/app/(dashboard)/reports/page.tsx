"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FileText, Users, Clock, AlertTriangle, Calendar, TrendingUp } from "lucide-react";
import { getEmployees, getAttendance, getSettings } from "@/lib/data";
import { formatDateKey, getMonday } from "@/lib/utils";

export default function ReportsPage() {
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly" | "yearly">("weekly");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const employees = getEmployees();
    const attendance = getAttendance();
    const settings = getSettings();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let periodStartDate = new Date(today);
    let periodEndDate = new Date(today);
    if (reportType === "weekly") {
      periodStartDate = getMonday(today);
      periodEndDate = new Date(periodStartDate);
      periodEndDate.setDate(periodEndDate.getDate() + 7);
    } else if (reportType === "monthly") {
      periodStartDate.setDate(1);
      periodEndDate = new Date(periodStartDate);
      periodEndDate.setMonth(periodEndDate.getMonth() + 1);
    } else if (reportType === "yearly") {
      periodStartDate = new Date(today.getFullYear(), 0, 1);
      periodEndDate = new Date(today.getFullYear() + 1, 0, 1);
    } else {
      periodEndDate.setDate(periodEndDate.getDate() + 1);
    }
    const startKey = formatDateKey(periodStartDate);
    const endKey = formatDateKey(periodEndDate);
    const periodAttendance = attendance.filter((record) => record.date >= startKey && record.date < endKey);

    const totalEmployees = employees.length;
    const totalHours = periodAttendance.reduce((sum, record) => sum + record.workedHours, 0);

    const employeeReport = employees.map((emp) => {
      const empAttendance = periodAttendance.filter((a) => a.employeeId === emp.id);
      const worked = empAttendance.reduce((acc, a) => acc + a.workedHours, 0);
      const expected = empAttendance.reduce((acc, a) => acc + a.expectedHours, 0);
      const penalty = empAttendance.reduce((acc, a) => acc + a.penaltyHours, 0);
      const lateCount = empAttendance.filter((a) => a.status === "late").length;
      const absentCount = empAttendance.filter((a) => a.status === "absent").length;
      const offCount = empAttendance.filter((a) => a.status === "off").length;
      return {
        name: emp.fullName,
        group: emp.group,
        workedHours: Math.round(worked * 10) / 10,
        expectedHours: expected,
        penaltyHours: penalty,
        finalHours: Math.round((worked - penalty) * 10) / 10,
        lateCount,
        absentCount,
        offCount,
      };
    });

    const report = {
      totalEmployees,
      totalHours: Math.round(totalHours * 10) / 10,
      lateCount: periodAttendance.filter((record) => record.status === "late").length,
      absenceCount: periodAttendance.filter((record) => record.status === "absent").length,
      employeeReport,
      settings,
    };
    const frame = requestAnimationFrame(() => setData(report));
    return () => cancelAnimationFrame(frame);
  }, [reportType]);

  if (!data) return <div className="flex items-center justify-center h-96"><div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Reports</h1>

      <div className="flex gap-2">
        {(["daily", "weekly", "monthly", "yearly"] as const).map((t) => (
          <button key={t} onClick={() => setReportType(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${reportType === t ? "bg-red-600 text-white" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"}`}>
            {t === "daily" ? "Journalier" : t === "weekly" ? "Hebdomadaire" : t === "monthly" ? "Mensuel" : "Annuel"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><Users className="w-5 h-5 text-blue-400" /></div><div><p className="text-2xl font-bold text-white">{data.totalEmployees}</p><p className="text-xs text-zinc-400">Employés</p></div></div></div>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Clock className="w-5 h-5 text-emerald-400" /></div><div><p className="text-2xl font-bold text-white">{data.totalHours}H</p><p className="text-xs text-zinc-400">Heures totales</p></div></div></div>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-yellow-400" /></div><div><p className="text-2xl font-bold text-white">{data.lateCount}</p><p className="text-xs text-zinc-400">Retards</p></div></div></div>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center"><FileText className="w-5 h-5 text-red-400" /></div><div><p className="text-2xl font-bold text-white">{data.absenceCount}</p><p className="text-xs text-zinc-400">Absences</p></div></div></div>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-red-500" /> Rapport par employé</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.employeeReport}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" stroke="#71717a" fontSize={10} angle={-30} textAnchor="end" height={60} />
              <YAxis stroke="#71717a" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px" }} itemStyle={{ color: "#fff" }} />
              <Bar dataKey="workedHours" fill="#22c55e" name="Travaillé" radius={[4, 4, 0, 0]} />
              <Bar dataKey="penaltyHours" fill="#ef4444" name="Pénalité" radius={[4, 4, 0, 0]} />
              <Bar dataKey="finalHours" fill="#3b82f6" name="Final" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-800">
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Employé</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Groupe</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Travaillé</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Attendu</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Retards</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Absences</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">OFF</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Pénalité</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Final</th>
              </tr>
            </thead>
            <tbody>
              {data.employeeReport.map((row: any, i: number) => (
                <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">Groupe {row.group}</td>
                  <td className="px-4 py-3 text-emerald-400">{row.workedHours}h</td>
                  <td className="px-4 py-3 text-zinc-300">{row.expectedHours}h</td>
                  <td className="px-4 py-3 text-yellow-400">{row.lateCount}</td>
                  <td className="px-4 py-3 text-red-400">{row.absentCount}</td>
                  <td className="px-4 py-3 text-zinc-400">{row.offCount}</td>
                  <td className="px-4 py-3 text-red-400">-{row.penaltyHours}h</td>
                  <td className="px-4 py-3 text-white font-bold">{row.finalHours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
