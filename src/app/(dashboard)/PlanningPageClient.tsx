"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Printer,
  FileSpreadsheet,
  Plus,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  CalendarOff,
  TrendingUp,
  Upload,
  FileUp,
  Trash2,
  Copy,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { getMonday, getWeekDays, formatDateFr, formatDateFull, formatDateKey } from "@/lib/utils";
import {
  calculateWeeklyScheduleHours,
  initializeMissingWeekSchedules,
  isCurrentOrFutureWeek,
  restoreScheduleDefault,
  toggleScheduleOff,
  updateScheduleTime,
  validateShiftTimes,
} from "@/lib/schedule";
import {
  getEmployees,
  getSchedules,
  getNotes,
  getGroups,
  DEFAULT_GROUPS,
  generateId,
  saveSchedules,
  saveNotes,
  Employee,
  Schedule,
  Note,
  GroupConfig,
} from "@/lib/data";
import {
  exportToCSV,
  exportToPDF,
  importFromExcel,
  importFromCSV,
} from "@/lib/importExport";
import {
  buildPlanningExcelFile,
  downloadPlanningExcelFile,
  type PlanningExportScope,
} from "@/lib/planningExcel";

const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const teamColors = [
  "border-l-red-500",
  "border-l-yellow-500",
  "border-l-emerald-500",
  "border-l-blue-500",
  "border-l-purple-500",
  "border-l-orange-500",
  "border-l-pink-500",
  "border-l-cyan-500",
];

function readSavedList<T>(
  key: string,
  isRecord: (value: unknown) => value is T,
): T[] {
  const raw = localStorage.getItem(key);
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Les données sauvegardées (${key}) sont illisibles.`);
  }
  if (!Array.isArray(parsed) || !parsed.every(isRecord)) {
    throw new Error(`Les données sauvegardées (${key}) ont un format invalide.`);
  }
  return parsed;
}

function isSavedEmployee(value: unknown): value is Employee {
  if (value === null || typeof value !== "object") return false;
  const employee = value as Record<string, unknown>;
  return typeof employee.id === "number"
    && typeof employee.fullName === "string"
    && typeof employee.position === "string"
    && typeof employee.group === "string"
    && (employee.status === "active" || employee.status === "inactive");
}

function isSavedSchedule(value: unknown): value is Schedule {
  if (value === null || typeof value !== "object") return false;
  const schedule = value as Record<string, unknown>;
  return typeof schedule.id === "number"
    && typeof schedule.employeeId === "number"
    && typeof schedule.weekStart === "string"
    && Number.isInteger(schedule.dayOfWeek)
    && typeof schedule.group === "string"
    && typeof schedule.isOff === "boolean"
    && (schedule.startTime === null || typeof schedule.startTime === "string")
    && (schedule.endTime === null || typeof schedule.endTime === "string");
}

export default function PlanningPageClient() {
  const searchParams = useSearchParams();
  const groupParam = searchParams.get("group") || "A";
  const [groups, setGroups] = useState<GroupConfig[]>(DEFAULT_GROUPS);
  const groupConfig = groups.find((item) => item.id === groupParam) || groups[0];
  const group = groupConfig?.id || "A";

  const [currentWeek, setCurrentWeek] = useState(() => getMonday(new Date()));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newNote, setNewNote] = useState({ type: "retard", content: "" });
  const [importMsg, setImportMsg] = useState("");
  const [excelExportScope, setExcelExportScope] = useState<PlanningExportScope>("selected");
  const [excelExportState, setExcelExportState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [excelExportMessage, setExcelExportMessage] = useState("");
  const [scheduleSaveState, setScheduleSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [scheduleSaveMessage, setScheduleSaveMessage] = useState("");
  const [lastSavedCell, setLastSavedCell] = useState<string | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const saveFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cellFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const weekDays = getWeekDays(currentWeek);
  const weekStartStr = formatDateKey(currentWeek);
  const config = groupConfig;

  const loadData = () => {
    setEmployees(getEmployees().filter((e) => e.group === group && e.status === "active"));
    setSchedules(getSchedules());
    setNotes(getNotes());
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setScheduleSaveState("idle");
      setScheduleSaveMessage("");
      const allEmployees = getEmployees();
      const activeEmployees = allEmployees.filter((employee) => employee.status === "active");
      const loadedGroups = getGroups();
      const loadedSchedules = getSchedules();
      setEmployees(activeEmployees.filter((employee) => employee.group === group));
      setNotes(getNotes());
      setGroups(loadedGroups);

      let displaySchedules = loadedSchedules;
      let storedSchedulesAreValid = true;
      try {
        const rawSchedules = localStorage.getItem("rc_schedules");
        if (rawSchedules !== null) {
          const parsed: unknown = JSON.parse(rawSchedules);
          storedSchedulesAreValid = Array.isArray(parsed) && parsed.every((item) => {
            if (item === null || typeof item !== "object") return false;
            const record = item as Record<string, unknown>;
            return typeof record.employeeId === "number"
              && typeof record.weekStart === "string"
              && typeof record.dayOfWeek === "number"
              && typeof record.group === "string";
          });
        }
      } catch {
        storedSchedulesAreValid = false;
      }

      if (!storedSchedulesAreValid) {
        setScheduleSaveState("error");
        setScheduleSaveMessage("Les horaires enregistrés sont illisibles. Le préremplissage est suspendu pour préserver les données.");
      } else {
        const initialized = isCurrentOrFutureWeek(weekStartStr, formatDateKey(getMonday(new Date())))
          ? initializeMissingWeekSchedules(
            loadedSchedules,
            activeEmployees,
            loadedGroups,
            weekStartStr,
            generateId,
          )
          : loadedSchedules;
        if (initialized.length > loadedSchedules.length) {
          try {
            saveSchedules(initialized);
            displaySchedules = initialized;
            setScheduleSaveState("saved");
            setScheduleSaveMessage("Horaires par défaut enregistrés pour tous les employés et équipes de cette semaine.");
            if (saveFeedbackTimer.current) clearTimeout(saveFeedbackTimer.current);
            saveFeedbackTimer.current = setTimeout(() => {
              setScheduleSaveState("idle");
              setScheduleSaveMessage("");
            }, 3200);
          } catch (error) {
            setScheduleSaveState("error");
            setScheduleSaveMessage(error instanceof Error
              ? `Préremplissage impossible : ${error.message}`
              : "Préremplissage impossible. Vérifiez le stockage du navigateur.");
          }
        }
      }
      setSchedules(displaySchedules);
    });
    return () => cancelAnimationFrame(frame);
  }, [group, weekStartStr]);

  useEffect(() => () => {
    if (saveFeedbackTimer.current) clearTimeout(saveFeedbackTimer.current);
    if (cellFeedbackTimer.current) clearTimeout(cellFeedbackTimer.current);
  }, []);

  const getSchedule = (empId: number, dayIndex: number) => {
    return schedules.find(
      (s) => s.employeeId === empId && s.dayOfWeek === dayIndex && s.weekStart === weekStartStr && s.group === group
    );
  };

  const getWeeklyHours = (empId: number) => {
    return calculateWeeklyScheduleHours(schedules, empId, weekStartStr, group);
  };

  const getOffDays = (empId: number) => {
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const sch = getSchedule(empId, i);
      if (sch?.isOff) count++;
    }
    return count;
  };

  const totalPlannedHours = employees.reduce((acc, emp) => acc + getWeeklyHours(emp.id), 0);
  const totalOffDays = employees.reduce((acc, emp) => acc + getOffDays(emp.id), 0);
  const avgHours = employees.length > 0 ? totalPlannedHours / employees.length : 0;

  const groupStats = groups.map((g) => ({
    name: g.label,
    value: g.id === group ? totalPlannedHours : 0,
    color: g.color,
  }));
  groupStats.push({ name: "OFF", value: totalOffDays * 8, color: "#18181b" });

  const updateSchedules = (newSchedules: Schedule[], cellKey?: string) => {
    if (saveFeedbackTimer.current) clearTimeout(saveFeedbackTimer.current);
    setScheduleSaveState("saving");
    setScheduleSaveMessage("Enregistrement des horaires…");
    try {
      saveSchedules(newSchedules);
      setSchedules(newSchedules);
      if (cellKey) {
        setLastSavedCell(cellKey);
        if (cellFeedbackTimer.current) clearTimeout(cellFeedbackTimer.current);
        cellFeedbackTimer.current = setTimeout(() => setLastSavedCell(null), 1600);
      }
      if (saveFeedbackTimer.current) clearTimeout(saveFeedbackTimer.current);
      saveFeedbackTimer.current = setTimeout(() => {
        setScheduleSaveState("saved");
        setScheduleSaveMessage("Horaires enregistrés dans ce navigateur.");
        saveFeedbackTimer.current = setTimeout(() => setScheduleSaveState("idle"), 2400);
      }, 100);
    } catch (error) {
      setScheduleSaveState("error");
      setScheduleSaveMessage(error instanceof Error ? `Enregistrement impossible : ${error.message}` : "Enregistrement impossible.");
    }
  };

  const handleUpdateSchedule = (empId: number, dayIndex: number, field: "startTime" | "endTime", value: string | null) => {
    try {
      const key = { employeeId: empId, weekStart: weekStartStr, dayOfWeek: dayIndex, group };
      const updated = updateScheduleTime(
        getSchedules(), key, field, value,
        { startTime: config.start, endTime: config.end }, generateId,
      );
      updateSchedules(updated, `${empId}:${dayIndex}`);
    } catch (error) {
      if (saveFeedbackTimer.current) clearTimeout(saveFeedbackTimer.current);
      setScheduleSaveState("error");
      setScheduleSaveMessage(error instanceof Error ? error.message : "Heure invalide.");
    }
  };

  const handleRestoreDefault = (empId: number, dayIndex: number) => {
    try {
      const key = { employeeId: empId, weekStart: weekStartStr, dayOfWeek: dayIndex, group };
      const updated = restoreScheduleDefault(
        getSchedules(), key, { startTime: config.start, endTime: config.end }, generateId,
      );
      updateSchedules(updated, `${empId}:${dayIndex}`);
    } catch (error) {
      if (saveFeedbackTimer.current) clearTimeout(saveFeedbackTimer.current);
      setScheduleSaveState("error");
      setScheduleSaveMessage(error instanceof Error ? error.message : "Horaires par défaut invalides.");
    }
  };

  const toggleOff = (empId: number, dayIndex: number) => {
    try {
      const key = { employeeId: empId, weekStart: weekStartStr, dayOfWeek: dayIndex, group };
      const updated = toggleScheduleOff(
        getSchedules(), key, { startTime: config.start, endTime: config.end }, generateId,
      );
      updateSchedules(updated, `${empId}:${dayIndex}`);
    } catch (error) {
      if (saveFeedbackTimer.current) clearTimeout(saveFeedbackTimer.current);
      setScheduleSaveState("error");
      setScheduleSaveMessage(error instanceof Error ? error.message : "Impossible de modifier le repos.");
    }
  };

  const handleAddNote = () => {
    const allNotes = getNotes();
    const note: Note = {
      id: Date.now(),
      employeeId: null,
      date: formatDateKey(new Date()),
      type: newNote.type,
      content: newNote.content,
    };
    const updated = [note, ...allNotes];
    setNotes(updated);
    saveNotes(updated);
    setShowNoteModal(false);
    setNewNote({ type: "retard", content: "" });
  };

  const handleDeleteNote = (id: number) => {
    const updated = getNotes().filter((n) => n.id !== id);
    setNotes(updated);
    saveNotes(updated);
  };

  const handleNewPlanning = () => {
    if (!confirm(`Créer un nouveau planning pour ${config.label} ?`)) return;
    const allSchedules = getSchedules();
    const newSchedules = [...allSchedules];
    employees.forEach((emp) => {
      for (let i = 0; i < 7; i++) {
        const existing = getSchedule(emp.id, i);
        if (!existing) {
          newSchedules.push({
            id: generateId() + i,
            employeeId: emp.id,
            weekStart: weekStartStr,
            dayOfWeek: i,
            group,
            startTime: config.start,
            endTime: config.end,
            isOff: false,
          });
        }
      }
    });
    updateSchedules(newSchedules);
  };

  const handleCopyPreviousWeek = () => {
    const previousWeek = new Date(currentWeek);
    previousWeek.setDate(previousWeek.getDate() - 7);
    const previousWeekKey = formatDateKey(previousWeek);
    const allSchedules = getSchedules();
    const previousSchedules = allSchedules.filter((schedule) => schedule.weekStart === previousWeekKey && schedule.group === group);
    if (previousSchedules.length === 0) {
      setImportMsg("Aucun planning trouvé pour la semaine précédente.");
      return;
    }
    if (!confirm("Copier les horaires et jours de repos de la semaine précédente ? Les cases déjà renseignées cette semaine resteront inchangées.")) return;

    const nextSchedules = [...allSchedules];
    for (const schedule of previousSchedules) {
      const alreadySet = nextSchedules.some((item) =>
        item.weekStart === weekStartStr && item.group === group &&
        item.employeeId === schedule.employeeId && item.dayOfWeek === schedule.dayOfWeek,
      );
      if (!alreadySet) nextSchedules.push({ ...schedule, id: generateId(), weekStart: weekStartStr });
    }
    updateSchedules(nextSchedules);
    setImportMsg(`Planning de la semaine du ${previousWeekKey} copié.`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importFromExcel(file, (emps, schs) => {
      updateSchedules(schs);
      loadData();
      setImportMsg(`Importé ${emps.length} employés et ${schs.length} horaires depuis Excel`);
      setTimeout(() => setImportMsg(""), 4000);
    });
    e.target.value = "";
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importFromCSV(file, (emps, schs) => {
      updateSchedules(schs);
      loadData();
      setImportMsg(`Importé ${emps.length} employés et ${schs.length} horaires depuis CSV`);
      setTimeout(() => setImportMsg(""), 4000);
    });
    e.target.value = "";
  };

  const handleExportExcel = async () => {
    setExcelExportState("loading");
    setExcelExportMessage("");
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const latestEmployees = readSavedList("rc_employees", isSavedEmployee)
        .filter((employee) => employee.status === "active");
      const latestSchedules = readSavedList("rc_schedules", isSavedSchedule);
      const latestGroups = groups;
      const selectedGroups = excelExportScope === "all"
        ? latestGroups
        : latestGroups.filter((item) => item.id === group);
      const groupIds = new Set(selectedGroups.map((item) => item.id));
      const exportEmployees = latestEmployees.filter((employee) => groupIds.has(employee.group));
      if (exportEmployees.length === 0) {
        throw new Error(excelExportScope === "all"
          ? "Aucun employé actif n’est disponible dans les équipes configurées."
          : "Aucun employé actif n’est disponible dans cette équipe.");
      }

      const file = buildPlanningExcelFile(
        exportEmployees,
        latestSchedules,
        currentWeek,
        latestGroups,
        group,
        excelExportScope,
      );
      downloadPlanningExcelFile(file);
      setExcelExportState("success");
      setExcelExportMessage(`Fichier téléchargé : ${file.fileName}`);
    } catch (error) {
      setExcelExportState("error");
      setExcelExportMessage(error instanceof Error ? error.message : "L’export Excel a échoué.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">PLANNING HEBDOMADAIRE</h1>
          <p className="text-zinc-400 text-sm mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
            <span className="font-bold" style={{ color: config.color }}>{config.label}</span>
            <span className="text-zinc-500">|</span>
            <span>{config.start} → {config.end}</span>
            <span className="text-zinc-500">|</span>
            <span>S{Math.ceil((currentWeek.getTime() - new Date(currentWeek.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))} DU {formatDateFull(currentWeek)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">
            <button onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d); }} className="px-3 py-2 hover:bg-zinc-800 text-zinc-400 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-3 py-2 text-sm text-white border-x border-zinc-700 font-medium">S{Math.ceil((currentWeek.getTime() - new Date(currentWeek.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))} ({formatDateFr(weekDays[0])} - {formatDateFr(weekDays[6])})</span>
            <button onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d); }} className="px-3 py-2 hover:bg-zinc-800 text-zinc-400 transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Group selector tabs */}
      <div className="flex gap-2">
        {groups.map((g) => {
          const isActive = group === g.id;
          return (
            <a key={g.id} href={`/planning?group=${g.id}`} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${isActive ? "text-white shadow-lg" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-800"}`} style={isActive ? { backgroundColor: g.color } : {}}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
              {g.label}
              <span className="text-xs opacity-70 font-normal">{g.start}-{g.end}</span>
            </a>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 items-center">
        <input ref={excelInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
        <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
        <button onClick={() => excelInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm text-white font-medium transition-colors shadow-lg shadow-emerald-900/20"><FileUp className="w-4 h-4" /> Importer Excel</button>
        <button onClick={() => csvInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white font-medium transition-colors shadow-lg shadow-blue-900/20"><Upload className="w-4 h-4" /> Importer CSV</button>
        <select aria-label="Équipes à exporter" value={excelExportScope} onChange={(event) => setExcelExportScope(event.target.value as PlanningExportScope)} className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="selected">Équipe active uniquement</option>
          <option value="all">Toutes les équipes</option>
        </select>
        <button onClick={handleExportExcel} disabled={excelExportState === "loading"} className="flex items-center gap-2 px-4 py-2 bg-emerald-700 border border-emerald-600 rounded-lg text-sm text-white hover:bg-emerald-600 transition-colors disabled:cursor-wait disabled:opacity-70"><FileSpreadsheet className="w-4 h-4" /> {excelExportState === "loading" ? <><Loader2 className="w-4 h-4 animate-spin" /> Préparation Excel…</> : "Exporter Excel"}</button>
        <button onClick={() => exportToCSV(employees, schedules, currentWeek, group)} className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white hover:bg-zinc-800 transition-colors"><FileSpreadsheet className="w-4 h-4" /> Exporter CSV</button>
        <button onClick={() => exportToPDF(employees, schedules, currentWeek, group)} className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white hover:bg-zinc-800 transition-colors"><Printer className="w-4 h-4" /> Exporter PDF</button>
        <button onClick={handleCopyPreviousWeek} className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white hover:bg-zinc-800"><Copy className="w-4 h-4" /> Copier la semaine précédente</button>
        <button onClick={handleNewPlanning} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium transition-colors ml-auto shadow-lg" style={{ backgroundColor: config.color }}><Plus className="w-4 h-4" /> Nouveau Planning</button>
      </div>

      {importMsg && <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2 text-emerald-400 text-sm flex items-center gap-2"><span className="w-2 h-2 bg-emerald-400 rounded-full" />{importMsg}</div>}
      {excelExportMessage && <div role={excelExportState === "error" ? "alert" : "status"} aria-live="polite" className={`rounded-lg border px-4 py-2 text-sm ${excelExportState === "error" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>{excelExportMessage}</div>}
      {scheduleSaveState !== "idle" && (
        <div role={scheduleSaveState === "error" ? "alert" : "status"} aria-live="polite" className={`rounded-lg border px-4 py-2 text-sm ${scheduleSaveState === "error" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>
          {scheduleSaveState === "saving" ? "Enregistrement…" : scheduleSaveMessage}
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Main Table */}
        <div className="flex-1 overflow-auto">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden min-w-[1000px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-950 border-b border-zinc-800">
                  <th className="px-4 py-3 text-left text-zinc-400 font-medium w-44 sticky left-0 bg-zinc-950 z-10">Employé</th>
                  {weekDays.map((day, i) => (
                    <th key={i} className="px-2 py-3 text-center text-zinc-400 font-medium min-w-[110px]">
                      <div className="text-white font-semibold">{formatDateFr(day)}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{dayNames[i]}</div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-zinc-400 font-medium w-24">Total Semaine</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, empIdx) => {
                  const weeklyHours = getWeeklyHours(emp.id);
                  const colorClass = teamColors[empIdx % teamColors.length];
                  return (
                    <tr key={emp.id} className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors border-l-4 ${colorClass}`}>
                      <td className="px-4 py-3 sticky left-0 bg-zinc-900 z-10">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-white font-bold text-sm shrink-0 border border-zinc-600">
                            {emp.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm">{emp.fullName.toUpperCase()}</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{emp.position}</p>
                          </div>
                        </div>
                      </td>
                      {Array.from({ length: 7 }).map((_, dayIdx) => {
                        const sch = getSchedule(emp.id, dayIdx);
                        const isOff = sch?.isOff;
                        const validation = validateShiftTimes(sch?.startTime ?? null, sch?.endTime ?? null);
                        const cellKey = `${emp.id}:${dayIdx}`;
                        const wasJustSaved = lastSavedCell === cellKey;
                        return (
                          <td key={dayIdx} className="px-1 py-2">
                            <div className={`rounded-lg p-1.5 text-center transition-all ${isOff ? "bg-zinc-950 border-2 border-zinc-700" : `bg-zinc-950/50 border ${wasJustSaved ? "border-emerald-500 ring-1 ring-emerald-500/40" : "border-zinc-800 hover:border-zinc-600"}`}`}>
                              {isOff ? (
                                <button type="button" onClick={() => toggleOff(emp.id, dayIdx)} aria-label={`Rétablir l’horaire par défaut de ${emp.fullName}, ${dayNames[dayIdx]}`} className="w-full rounded-md py-3 text-zinc-400 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                                  <span className="block font-bold text-sm">OFF</span>
                                  <span className="block text-[9px] mt-1">Rétablir</span>
                                </button>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-zinc-500 uppercase">Début</span>
                                    <button type="button" onClick={() => toggleOff(emp.id, dayIdx)} aria-label={`Marquer ${emp.fullName}, ${dayNames[dayIdx]} comme jour de repos`} title="Marquer OFF" className="rounded px-1 text-[9px] font-semibold text-zinc-500 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">OFF</button>
                                  </div>
                                  <label className="block">
                                    <span className="sr-only">Début — {emp.fullName}, {dayNames[dayIdx]}</span>
                                    <input type="time" lang="fr-FR" step={60} value={sch?.startTime || ""} onChange={(e) => handleUpdateSchedule(emp.id, dayIdx, "startTime", e.target.value || null)} aria-label={`Début — ${emp.fullName}, ${dayNames[dayIdx]}`} className="w-full min-w-0 rounded border border-zinc-700 bg-zinc-900 px-1 py-1 text-center text-xs font-semibold text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 [color-scheme:dark]" />
                                  </label>
                                  <label className="block">
                                    <span className="block text-[10px] text-zinc-500 uppercase">Fin</span>
                                    <input type="time" lang="fr-FR" step={60} value={sch?.endTime || ""} onChange={(e) => handleUpdateSchedule(emp.id, dayIdx, "endTime", e.target.value || null)} aria-label={`Fin — ${emp.fullName}, ${dayNames[dayIdx]}`} className="w-full min-w-0 rounded border border-zinc-700 bg-zinc-900 px-1 py-1 text-center text-xs font-semibold text-blue-300 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 [color-scheme:dark]" />
                                  </label>
                                  <div className="flex items-center justify-between gap-1 pt-0.5">
                                    <span className={`text-[10px] font-bold ${validation.status === "valid" ? "text-emerald-400" : "text-amber-400"}`} aria-live="polite">
                                      {validation.status === "valid" ? `${validation.hours!.toFixed(1)}h` : "Non planifié"}
                                    </span>
                                    <button type="button" onClick={() => handleRestoreDefault(emp.id, dayIdx)} title={`Rétablir ${config.start}–${config.end}`} aria-label={`Rétablir l’horaire ${config.start} à ${config.end} pour ${emp.fullName}, ${dayNames[dayIdx]}`} className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] text-zinc-500 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                                      <RotateCcw className="h-3 w-3" /><span>Défaut</span>
                                    </button>
                                  </div>
                                  {validation.message && <p role={validation.status === "invalid" || validation.status === "identical" ? "alert" : undefined} className={`text-[9px] leading-tight ${validation.status === "invalid" || validation.status === "identical" ? "text-red-300" : "text-amber-300"}`}>{validation.message}</p>}
                                  {validation.status === "empty" && <p className="text-[9px] leading-tight text-zinc-600">Sélectionner une heure</p>}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-bold ${weeklyHours >= 48 ? "bg-red-500/20 text-red-400" : weeklyHours >= 40 ? "bg-yellow-500/20 text-yellow-400" : "bg-emerald-500/20 text-emerald-400"}`}>{Math.round(weeklyHours * 10) / 10}H</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-zinc-950 border-t border-zinc-800 flex flex-wrap items-center justify-between text-sm gap-4">
              <div className="flex items-center gap-3">
                <span className="text-zinc-400 text-xs font-medium">Légende :</span>
                <span className="px-2 py-1 rounded text-xs font-medium border" style={{ color: config.color, borderColor: config.color + "40", backgroundColor: config.color + "10" }}>{config.start} - {config.end}</span>
                <span className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs font-medium border border-zinc-700">OFF</span>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-zinc-400 text-sm">Total Heures : <span className="font-bold text-lg" style={{ color: config.color }}>{Math.round(totalPlannedHours * 10) / 10}H</span></span>
                <span className="text-zinc-400 text-sm">Total OFF : <span className="text-red-400 font-bold text-lg">{totalOffDays}</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-full xl:w-80 space-y-5">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider"><span className="w-1 h-5 rounded-full" style={{ backgroundColor: config.color }} /> Résumé — {config.label}</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-zinc-400 text-sm"><Users className="w-4 h-4" /> Employés</div><span className="text-white font-bold text-lg">{employees.length}</span></div>
              <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-zinc-400 text-sm"><TrendingUp className="w-4 h-4" /> Heures Planifiées</div><span className="font-bold text-lg" style={{ color: config.color }}>{Math.round(totalPlannedHours * 10) / 10}H</span></div>
              <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-zinc-400 text-sm"><Clock className="w-4 h-4" /> Moyenne / Employé</div><span className="text-yellow-400 font-bold text-lg">{Math.round(avgHours * 10) / 10}H</span></div>
              <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-zinc-400 text-sm"><CalendarOff className="w-4 h-4" /> Jours OFF Total</div><span className="text-emerald-400 font-bold text-lg">{totalOffDays}</span></div>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider"><span className="w-1 h-5 rounded-full" style={{ backgroundColor: config.color }} /> Statistiques</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={groupStats} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">{groupStats.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px" }} itemStyle={{ color: "#fff" }} /></PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {groupStats.map((s, i) => (<div key={i} className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} /><span className="text-zinc-400">{s.name} ({Math.round(s.value * 10) / 10}H)</span></div>))}
            </div>
          </div>

          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider"><span className="w-1 h-5 rounded-full" style={{ backgroundColor: config.color }} /> Notes & Remarques</h3>
            <div className="space-y-3 max-h-72 overflow-y-auto scrollbar-thin">
              {notes.slice(0, 8).map((note) => (
                <div key={note.id} className="bg-zinc-950 rounded-lg p-3 border border-zinc-800 hover:border-zinc-700 transition-colors group">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-zinc-500 font-medium">{note.date}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${note.type === "retard" ? "bg-red-500/20 text-red-400" : note.type === "absence" ? "bg-orange-500/20 text-orange-400" : note.type === "sortie" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"}`}>{note.type}</span>
                      <button onClick={() => handleDeleteNote(note.id)} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-300 leading-snug">{note.content}</p>
                </div>
              ))}
              {notes.length === 0 && <p className="text-zinc-500 text-sm text-center py-6">Aucune note</p>}
            </div>
            <button onClick={() => setShowNoteModal(true)} className="w-full mt-4 py-2.5 rounded-lg text-sm text-white font-bold transition-colors flex items-center justify-center gap-2 shadow-lg" style={{ backgroundColor: config.color }}><Plus className="w-4 h-4" /> Ajouter une note</button>
          </div>
        </div>
      </div>

      {showNoteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-5">Ajouter une note</h3>
            <div className="space-y-4">
              <div><label className="block text-sm text-zinc-400 mb-1.5">Type</label><select value={newNote.type} onChange={(e) => setNewNote({ ...newNote, type: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-red-500"><option value="retard">Retard</option><option value="absence">Absence</option><option value="sortie">Sortie anticipée</option><option value="remarque">Remarque</option></select></div>
              <div><label className="block text-sm text-zinc-400 mb-1.5">Contenu</label><textarea value={newNote.content} onChange={(e) => setNewNote({ ...newNote, content: e.target.value })} rows={3} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-red-500 resize-none" placeholder="Description..." /></div>
              <div className="flex gap-3 pt-2"><button onClick={() => setShowNoteModal(false)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors font-medium">Annuler</button><button onClick={handleAddNote} className="flex-1 py-2.5 rounded-lg text-sm text-white font-bold transition-colors" style={{ backgroundColor: config.color }}>Enregistrer</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
