"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, Coffee, Save, Calendar } from "lucide-react";
import {
  getEmployees,
  getSchedules,
  getAttendance,
  getGroups,
  getSettings,
  generateId,
  saveAttendance,
  Employee,
  Schedule,
  AttendanceRecord,
  GroupConfig,
} from "@/lib/data";
import { calculateWorkedHours, calculateLateMinutes, determineAttendanceStatus, calculatePenaltyHours } from "@/lib/data";
import { formatDateKey } from "@/lib/utils";
import { getExpectedScheduledHours } from "@/lib/schedule";

export default function AttendancePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [groups, setGroups] = useState<GroupConfig[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(new Date()));
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setEmployees(getEmployees());
      setSchedules(getSchedules());
      setRecords(getAttendance());
      setGroups(getGroups());
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const getRecord = (empId: number, date: string): AttendanceRecord | undefined => {
    return records.find((r) => r.employeeId === empId && r.date === date);
  };

  const getScheduleForDay = (empId: number, date: string): Schedule | undefined => {
    const [year, month, day] = date.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    const dayOfWeek = (d.getDay() + 6) % 7;
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - dayOfWeek);
    const weekStartStr = formatDateKey(weekStart);
    return schedules.find((s) => s.employeeId === empId && s.dayOfWeek === dayOfWeek && s.weekStart === weekStartStr);
  };

  const updateRecord = (empId: number, updates: Partial<AttendanceRecord>) => {
    const all = getAttendance();
    const existing = all.find((r) => r.employeeId === empId && r.date === selectedDate);
    if (existing) {
      const updated = all.map((r) => (r.id === existing.id ? { ...r, ...updates } : r));
      saveAttendance(updated);
      setRecords(updated);
    } else {
      const emp = employees.find((e) => e.id === empId);
      const sch = getScheduleForDay(empId, selectedDate);
      const newRec: AttendanceRecord = {
        id: generateId(),
        employeeId: empId,
        date: selectedDate,
        checkIn: null,
        checkOut: null,
        status: sch?.isOff ? "off" : "present",
        workedHours: 0,
        expectedHours: getExpectedScheduledHours(sch, getSettings().normalWorkingHours),
        penaltyHours: sch?.isOff ? calculatePenaltyHours("off", 0) : 0,
        notes: "",
        ...updates,
      };
      saveAttendance([...all, newRec]);
      setRecords([...all, newRec]);
    }
  };

  const handleCheckInChange = (empId: number, value: string) => {
    const rec = getRecord(empId, selectedDate);
    const sch = getScheduleForDay(empId, selectedDate);
    const checkIn = value || null;
    const checkOut = rec?.checkOut || null;
    const worked = calculateWorkedHours(checkIn, checkOut);
    const lateMinutes = sch?.startTime && checkIn ? calculateLateMinutes(sch.startTime, checkIn) : 0;
    const status = determineAttendanceStatus(sch?.isOff ?? false, false, lateMinutes);
    const penalty = calculatePenaltyHours(status, lateMinutes);
    updateRecord(empId, { checkIn, workedHours: worked, status, penaltyHours: penalty });
  };

  const handleCheckOutChange = (empId: number, value: string) => {
    const rec = getRecord(empId, selectedDate);
    const checkOut = value || null;
    const checkIn = rec?.checkIn || null;
    const worked = calculateWorkedHours(checkIn, checkOut);
    updateRecord(empId, { checkOut, workedHours: worked });
  };

  const handleStatusToggle = (empId: number, newStatus: AttendanceRecord["status"]) => {
    const penalty = calculatePenaltyHours(newStatus, 0);
    updateRecord(empId, { status: newStatus, penaltyHours: penalty, checkIn: null, checkOut: null, workedHours: 0 });
  };

  const handleSaveAll = () => {
    saveAttendance(records);
    setSavedMsg("Présences enregistrées !");
    setTimeout(() => setSavedMsg(""), 3000);
  };

  const filteredEmployees = employees.filter((e) => {
    if (groupFilter === "all") return e.status === "active";
    return e.group === groupFilter && e.status === "active";
  });

  const stats = {
    present: records.filter((r) => r.date === selectedDate && r.status === "present").length,
    late: records.filter((r) => r.date === selectedDate && r.status === "late").length,
    absent: records.filter((r) => r.date === selectedDate && r.status === "absent").length,
    off: records.filter((r) => r.date === selectedDate && r.status === "off").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Attendance</h1>
        <button onClick={handleSaveAll} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium transition-colors"><Save className="w-4 h-4" /> Enregistrer</button>
      </div>

      {savedMsg && <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2 text-emerald-400 text-sm">{savedMsg}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-emerald-400" /></div><div><p className="text-2xl font-bold text-white">{stats.present}</p><p className="text-xs text-zinc-400">Présents</p></div></div></div>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center"><Clock className="w-5 h-5 text-yellow-400" /></div><div><p className="text-2xl font-bold text-white">{stats.late}</p><p className="text-xs text-zinc-400">Retards</p></div></div></div>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center"><XCircle className="w-5 h-5 text-red-400" /></div><div><p className="text-2xl font-bold text-white">{stats.absent}</p><p className="text-xs text-zinc-400">Absents</p></div></div></div>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center"><Coffee className="w-5 h-5 text-zinc-400" /></div><div><p className="text-2xl font-bold text-white">{stats.off}</p><p className="text-xs text-zinc-400">OFF</p></div></div></div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
          <Calendar className="w-4 h-4 text-zinc-400" />
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent text-white text-sm outline-none" />
        </div>
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm outline-none">
          <option value="all">Tous les groupes</option>
          {groups.map((g) => (<option key={g.id} value={g.id}>{g.label}</option>))}
        </select>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-800">
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Employé</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Groupe</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Check In</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Check Out</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Heures</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Statut</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Pénalité</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => {
                const rec = getRecord(emp.id, selectedDate);
                const gc = groups.find((g) => g.id === emp.group);
                return (
                  <tr key={emp.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{emp.fullName}</td>
                    <td className="px-4 py-3"><span className="text-xs font-bold" style={{ color: gc?.color }}>{gc?.label}</span></td>
                    <td className="px-4 py-3"><input type="time" value={rec?.checkIn || ""} onChange={(e) => handleCheckInChange(emp.id, e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-white text-xs outline-none focus:ring-1 focus:ring-red-500" /></td>
                    <td className="px-4 py-3"><input type="time" value={rec?.checkOut || ""} onChange={(e) => handleCheckOutChange(emp.id, e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-white text-xs outline-none focus:ring-1 focus:ring-red-500" /></td>
                    <td className="px-4 py-3 text-zinc-300">{(rec?.workedHours || 0).toFixed(1)}h</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {(["present", "late", "absent", "off"] as const).map((st) => (
                          <button key={st} onClick={() => handleStatusToggle(emp.id, st)} className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${rec?.status === st ? st === "present" ? "bg-emerald-500 text-white" : st === "late" ? "bg-yellow-500 text-black" : st === "absent" ? "bg-red-500 text-white" : "bg-zinc-600 text-white" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"}`}>{st}</button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="text-red-400 text-xs font-bold">-{rec?.penaltyHours || 0}h</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
