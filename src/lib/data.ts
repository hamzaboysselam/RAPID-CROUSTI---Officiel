"use client";

import { initializeEmployees } from "./employeeSeeds";
import { DEFAULT_TEAM_SHIFTS, migrateLegacyDefaultTeamShifts, persistSchedules, readSchedules } from "./schedule";

// ============================================================
// RAPID CROUSTI PLANNING — Data Layer
// ============================================================

export interface Employee {
  id: number;
  fullName: string;
  position: string;
  group: string;
  phone: string;
  hourlyRate: number | null;
  status: "active" | "inactive";
  hireDate: string;
  notes: string;
}

export interface GroupConfig {
  id: string;
  label: string;
  start: string;
  end: string;
  color: string;
}

export interface Schedule {
  id: number;
  employeeId: number;
  weekStart: string;
  dayOfWeek: number;
  startTime: string | null;
  endTime: string | null;
  isOff: boolean;
  group: string;
}

export interface AttendanceRecord {
  id: number;
  employeeId: number;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: "present" | "late" | "absent" | "off";
  workedHours: number;
  expectedHours: number;
  penaltyHours: number;
  notes: string;
}

export interface WeekHistory {
  id: string;
  year: number;
  month: number;
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  group: string;
  finalized: boolean;
  createdAt: string;
}

export interface Note {
  id: number;
  employeeId: number | null;
  date: string;
  type: string;
  content: string;
}

export interface AppSettings {
  companyName: string;
  currency: string;
  normalWorkingHours: number;
  lateDeduction1to5: number;
  lateDeductionOver5: number;
  absentDeduction: number;
  offRule: string;
  groups: GroupConfig[];
  primaryColor: string;
  secondaryColor: string;
  teamShiftDefaultsVersion?: number;
}

// ============================================================
// DEFAULT GROUPS
// ============================================================

export const DEFAULT_GROUPS: GroupConfig[] = [
  { id: "A", label: "Équipe du matin", start: DEFAULT_TEAM_SHIFTS.A.startTime, end: DEFAULT_TEAM_SHIFTS.A.endTime, color: "#eab308" },
  { id: "B", label: "Équipe du soir et de nuit", start: DEFAULT_TEAM_SHIFTS.B.startTime, end: DEFAULT_TEAM_SHIFTS.B.endTime, color: "#ef4444" },
  { id: "C", label: "Nuit", start: DEFAULT_TEAM_SHIFTS.C.startTime, end: DEFAULT_TEAM_SHIFTS.C.endTime, color: "#3b82f6" },
];

// ============================================================
// Employee roster is added from employeeSeeds.ts on first browser initialization.
// ============================================================

const DEFAULT_SETTINGS: AppSettings = {
  companyName: "RAPID CROUSTI",
  currency: "MAD",
  normalWorkingHours: 8,
  lateDeduction1to5: 2,
  lateDeductionOver5: 4,
  absentDeduction: 8,
  offRule: "Jour de repos planifié — aucune déduction",
  groups: DEFAULT_GROUPS,
  primaryColor: "#ef4444",
  secondaryColor: "#eab308",
  teamShiftDefaultsVersion: 2,
};

// ============================================================
// LOCAL STORAGE HELPERS
// ============================================================

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ============================================================
// EXPORTED GETTERS / SETTERS
// ============================================================

export function getEmployees(): Employee[] {
  if (typeof window === "undefined") return [];
  return initializeEmployees(localStorage);
}

export function saveEmployees(employees: Employee[]) {
  saveToStorage("rc_employees", employees);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("rc_employee_seed_version", "1");
    } catch {
      // Employee edits remain usable for this session when browser storage is unavailable.
    }
  }
}

export function getSchedules(): Schedule[] {
  if (typeof window === "undefined") return [];
  return readSchedules(localStorage);
}

export function saveSchedules(schedules: Schedule[]) {
  if (typeof window === "undefined") return;
  persistSchedules(localStorage, schedules);
}

export function getAttendance(): AttendanceRecord[] {
  return loadFromStorage("rc_attendance", []);
}

export function saveAttendance(records: AttendanceRecord[]) {
  saveToStorage("rc_attendance", records);
}

export function getWeekHistory(): WeekHistory[] {
  return loadFromStorage("rc_history", []);
}

export function saveWeekHistory(history: WeekHistory[]) {
  saveToStorage("rc_history", history);
}

export function getNotes(): Note[] {
  return loadFromStorage("rc_notes", []);
}

export function saveNotes(notes: Note[]) {
  saveToStorage("rc_notes", notes);
}

export function getSettings(): AppSettings {
  const settings = loadFromStorage("rc_settings", DEFAULT_SETTINGS);
  if (settings.teamShiftDefaultsVersion === 2) return settings;

  const updated: AppSettings = {
    ...settings,
    groups: Array.isArray(settings.groups) ? migrateLegacyDefaultTeamShifts(settings.groups) : settings.groups,
    teamShiftDefaultsVersion: 2,
  };
  if (typeof window !== "undefined") {
    try {
      saveToStorage("rc_settings", updated);
    } catch {
      // Use the updated defaults for this view; report a storage error on the next attempted schedule save.
    }
  }
  return updated;
}

export function saveSettings(settings: AppSettings) {
  saveToStorage("rc_settings", settings);
}

export function getGroups(): GroupConfig[] {
  return getSettings().groups;
}

export function clearAllData() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("rc_employees");
  localStorage.removeItem("rc_schedules");
  localStorage.removeItem("rc_attendance");
  localStorage.removeItem("rc_history");
  localStorage.removeItem("rc_notes");
  localStorage.removeItem("rc_settings");
  // Clearing data is intentional; keep the initial roster from being re-added on the next read.
  localStorage.setItem("rc_employee_seed_version", "1");
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

export function getGroupConfig(groupId: string): GroupConfig | undefined {
  return getGroups().find((g) => g.id === groupId);
}

export function getEmployeesByGroup(groupId: string): Employee[] {
  return getEmployees().filter((e) => e.group === groupId && e.status === "active");
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getExpectedMonthlyHours(year: number, month: number): number {
  const days = getDaysInMonth(year, month);
  return days * getSettings().normalWorkingHours;
}

export function calculateWorkedHours(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const [ih, im] = checkIn.split(":").map(Number);
  const [oh, om] = checkOut.split(":").map(Number);
  let diff = (oh * 60 + om) - (ih * 60 + im);
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
}

export function calculateLateMinutes(scheduledStart: string, actualCheckIn: string): number {
  const [sh, sm] = scheduledStart.split(":").map(Number);
  const [ah, am] = actualCheckIn.split(":").map(Number);
  const scheduled = sh * 60 + sm;
  const actual = ah * 60 + am;
  return Math.max(0, actual - scheduled);
}

export function determineAttendanceStatus(
  isOff: boolean,
  isAbsent: boolean,
  lateMinutes: number
): AttendanceRecord["status"] {
  if (isOff) return "off";
  if (isAbsent) return "absent";
  if (lateMinutes > 0) return "late";
  return "present";
}

export function calculatePenaltyHours(status: AttendanceRecord["status"], lateMinutes: number): number {
  const settings = getSettings();
  if (status === "off") return 0;
  if (status === "absent") return settings.absentDeduction;
  if (status === "late") {
    if (lateMinutes <= 5) return settings.lateDeduction1to5;
    return settings.lateDeductionOver5;
  }
  return 0;
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
}

export function getMonthName(month: number): string {
  const names = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  return names[month - 1] || "";
}

export function generateId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}
