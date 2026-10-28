"use client";

import { useEffect, useState } from "react";
import { Banknote, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { getEmployees, getAttendance, getGroups, getSettings, AppSettings, GroupConfig } from "@/lib/data";
import { calculatePayroll, PayrollRow } from "@/lib/payroll";

export default function PayrollPage() {
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [groups, setGroups] = useState<GroupConfig[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setRows(calculatePayroll(getEmployees(), getAttendance(), month));
      setGroups(getGroups());
      setSettings(getSettings());
    });
    return () => cancelAnimationFrame(frame);
  }, [month]);

  if (!settings) return <div className="flex items-center justify-center h-96"><div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" /></div>;

  const filtered = groupFilter === "all" ? rows : rows.filter((r) => r.group === groupFilter);

  const totalGross = filtered.reduce((acc, r) => acc + (r.gross ?? 0), 0);
  const hasMissingRates = filtered.some((row) => row.gross === null);
  const totalPenalty = filtered.reduce((acc, r) => acc + r.penaltyHours, 0);
  const totalExpected = filtered.reduce((acc, r) => acc + r.expectedHours, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-white">Payroll</h1><p className="text-sm text-zinc-400 mt-1">Salaire brut indicatif basé sur les heures nettes et le taux horaire. Les retenues fiscales ne sont pas configurées.</p></div>
        <label className="text-sm text-zinc-400">Mois de paie<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="block mt-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white" /></label>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><Banknote className="w-5 h-5 text-blue-400" /></div><div><p className="text-2xl font-bold text-white">{hasMissingRates ? "À compléter" : `${totalGross.toFixed(2)} ${settings.currency}`}</p><p className="text-xs text-zinc-400">Total brut indicatif</p></div></div></div>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-red-400" /></div><div><p className="text-2xl font-bold text-white">{totalPenalty.toFixed(0)}h</p><p className="text-xs text-zinc-400">Pénalités</p></div></div></div>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-yellow-400" /></div><div><p className="text-2xl font-bold text-white">{totalExpected.toFixed(0)}h</p><p className="text-xs text-zinc-400">Attendu</p></div></div></div>
      </div>

      <div className="flex gap-2">
        {["all", ...groups.map((g) => g.id)].map((f) => (
          <button key={f} onClick={() => setGroupFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${groupFilter === f ? "bg-red-600 text-white" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"}`}>{f === "all" ? "Tous" : `Groupe ${f}`}</button>
        ))}
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
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Pénalité</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Final</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Taux horaire</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Brut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.employeeId} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{r.employeeName}</td>
                  <td className="px-4 py-3"><span className="text-xs font-bold text-zinc-400">Groupe {r.group}</span></td>
                  <td className="px-4 py-3 text-zinc-300">{r.totalHours.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-zinc-300">{r.expectedHours.toFixed(0)}h</td>
                  <td className="px-4 py-3 text-red-400">-{r.penaltyHours.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-emerald-400 font-bold">{r.finalHours.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-zinc-300">{r.hourlyRate === null ? "À définir" : `${r.hourlyRate.toFixed(2)} ${settings.currency}`}</td>
                  <td className="px-4 py-3 text-white font-bold">{r.gross === null ? "À définir" : `${r.gross.toFixed(2)} ${settings.currency}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
