export interface ShiftTimes {
  startTime: string;
  endTime: string;
}

export interface ScheduleRecord {
  id: number;
  employeeId: number;
  weekStart: string;
  dayOfWeek: number;
  startTime: string | null;
  endTime: string | null;
  isOff: boolean;
  group: string;
}

export interface ScheduleKey {
  employeeId: number;
  weekStart: string;
  dayOfWeek: number;
  group: string;
}

export const DEFAULT_TEAM_SHIFTS: Readonly<Record<string, ShiftTimes>> = {
  A: { startTime: "11:00", endTime: "19:30" },
  B: { startTime: "19:30", endTime: "04:00" },
  C: { startTime: "04:00", endTime: "11:00" },
};

export function migrateLegacyDefaultTeamShifts<T extends { id: string; start: string; end: string; label: string }>(groups: T[]): T[] {
  return groups.map((group) => {
    if (group.id === "A" && group.start === "11:00" && group.end === "19:00") {
      return { ...group, end: DEFAULT_TEAM_SHIFTS.A.endTime };
    }
    if (group.id === "B" && group.start === "19:00" && group.end === "04:00") {
      return { ...group, start: DEFAULT_TEAM_SHIFTS.B.startTime };
    }
    if (group.id === "C" && group.label === "Groupe C"
      && group.start === DEFAULT_TEAM_SHIFTS.C.startTime
      && group.end === DEFAULT_TEAM_SHIFTS.C.endTime) {
      return { ...group, label: "Nuit" };
    }
    return group;
  });
}

export function isValidClockTime(value: string | null | undefined): value is string {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  return true;
}

export type ShiftValidation = {
  status: "empty" | "incomplete" | "invalid" | "identical" | "valid";
  hours: number | null;
  message: string | null;
};

export function validateShiftTimes(startTime: string | null, endTime: string | null): ShiftValidation {
  if (!startTime && !endTime) return { status: "empty", hours: null, message: null };
  if ((startTime && !isValidClockTime(startTime)) || (endTime && !isValidClockTime(endTime))) {
    return { status: "invalid", hours: null, message: "Heure invalide (format HH:mm requis)." };
  }
  if (!startTime || !endTime) {
    return { status: "incomplete", hours: null, message: "Renseignez le début et la fin." };
  }
  if (startTime === endTime) {
    return { status: "identical", hours: null, message: "Début et fin identiques : vérifiez le créneau." };
  }

  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end < start) end += 24 * 60;
  return { status: "valid", hours: (end - start) / 60, message: null };
}

export function calculateShiftHours(startTime: string | null, endTime: string | null): number {
  return validateShiftTimes(startTime, endTime).hours ?? 0;
}

export function getExpectedScheduledHours(
  schedule: Pick<ScheduleRecord, "isOff" | "startTime" | "endTime"> | undefined,
  fallbackHours: number,
): number {
  if (schedule?.isOff) return 0;
  if (!schedule) return fallbackHours;
  return validateShiftTimes(schedule.startTime, schedule.endTime).hours ?? fallbackHours;
}

function matchesKey(schedule: ScheduleRecord, key: ScheduleKey) {
  return schedule.employeeId === key.employeeId
    && schedule.weekStart === key.weekStart
    && schedule.dayOfWeek === key.dayOfWeek
    && schedule.group === key.group;
}

export function updateScheduleTime(
  schedules: ScheduleRecord[],
  key: ScheduleKey,
  field: "startTime" | "endTime",
  value: string | null,
  defaults: ShiftTimes,
  createId: () => number = () => Date.now(),
): ScheduleRecord[] {
  if (value !== null && !isValidClockTime(value)) throw new Error("Saisissez une heure valide au format HH:mm.");
  if (!isValidClockTime(defaults.startTime) || !isValidClockTime(defaults.endTime)) {
    throw new Error("Les horaires par défaut de cette équipe sont invalides. Vérifiez les paramètres.");
  }

  const existing = schedules.find((schedule) => matchesKey(schedule, key));
  if (existing) {
    return schedules.map((schedule) => schedule.id === existing.id
      ? { ...schedule, [field]: value, isOff: false }
      : schedule);
  }

  const created: ScheduleRecord = {
    ...key,
    id: createId(),
    startTime: defaults.startTime,
    endTime: defaults.endTime,
    isOff: false,
  };
  created[field] = value;
  return [...schedules, created];
}

export function restoreScheduleDefault(
  schedules: ScheduleRecord[],
  key: ScheduleKey,
  defaults: ShiftTimes,
  createId: () => number = () => Date.now(),
): ScheduleRecord[] {
  if (!isValidClockTime(defaults.startTime) || !isValidClockTime(defaults.endTime)
    || defaults.startTime === defaults.endTime) {
    throw new Error("Les horaires par défaut de cette équipe sont invalides. Vérifiez les paramètres.");
  }
  const existing = schedules.find((schedule) => matchesKey(schedule, key));
  if (existing) {
    return schedules.map((schedule) => schedule.id === existing.id
      ? { ...schedule, startTime: defaults.startTime, endTime: defaults.endTime, isOff: false }
      : schedule);
  }
  return [...schedules, { ...key, id: createId(), ...defaults, isOff: false }];
}

/**
 * Fill missing assignments for the displayed week using each employee's saved
 * team defaults. Existing shifts, OFF days, and incomplete edits are preserved.
 */
export function initializeMissingWeekSchedules<T extends ScheduleRecord>(
  schedules: T[],
  employees: readonly { id: number; group: string }[],
  groups: readonly { id: string; start: string; end: string }[],
  weekStart: string,
  createId: () => number = () => Date.now(),
): T[] {
  const defaultsByGroup = new Map<string, ShiftTimes>();
  for (const group of groups) {
    if (isValidClockTime(group.start) && isValidClockTime(group.end) && group.start !== group.end) {
      defaultsByGroup.set(group.id, { startTime: group.start, endTime: group.end });
    }
  }

  const result = [...schedules];
  const existingKeys = new Set(schedules.map((schedule) =>
    `${schedule.employeeId}|${schedule.weekStart}|${schedule.dayOfWeek}|${schedule.group}`,
  ));

  for (const employee of employees) {
    const defaults = defaultsByGroup.get(employee.group);
    if (!defaults) continue;

    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const key = `${employee.id}|${weekStart}|${dayOfWeek}|${employee.group}`;
      if (existingKeys.has(key)) continue;

      result.push({
        id: createId(),
        employeeId: employee.id,
        weekStart,
        dayOfWeek,
        group: employee.group,
        ...defaults,
        isOff: false,
      } as T);
      existingKeys.add(key);
    }
  }

  return result;
}

export function isCurrentOrFutureWeek(weekStart: string, currentWeekStart: string): boolean {
  return weekStart >= currentWeekStart;
}

export function toggleScheduleOff(
  schedules: ScheduleRecord[],
  key: ScheduleKey,
  defaults: ShiftTimes,
  createId: () => number = () => Date.now(),
): ScheduleRecord[] {
  const existing = schedules.find((schedule) => matchesKey(schedule, key));
  if (!existing) {
    return [...schedules, { ...key, id: createId(), startTime: null, endTime: null, isOff: true }];
  }
  if (!existing.isOff) {
    return schedules.map((schedule) => schedule.id === existing.id
      ? { ...schedule, startTime: null, endTime: null, isOff: true }
      : schedule);
  }
  if (!isValidClockTime(defaults.startTime) || !isValidClockTime(defaults.endTime)) {
    throw new Error("Les horaires par défaut de cette équipe sont invalides. Vérifiez les paramètres.");
  }
  return schedules.map((schedule) => schedule.id === existing.id
    ? { ...schedule, startTime: defaults.startTime, endTime: defaults.endTime, isOff: false }
    : schedule);
}

export interface ScheduleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readSchedules(storage: ScheduleStorage): ScheduleRecord[] {
  try {
    const value = storage.getItem("rc_schedules");
    if (value === null) return [];
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as ScheduleRecord[] : [];
  } catch {
    return [];
  }
}

export function persistSchedules(storage: ScheduleStorage, schedules: ScheduleRecord[]) {
  storage.setItem("rc_schedules", JSON.stringify(schedules));
}

export function calculateWeeklyScheduleHours(
  schedules: ScheduleRecord[],
  employeeId: number,
  weekStart: string,
  group: string,
): number {
  let total = 0;
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    const schedule = schedules.find((item) => matchesKey(item, { employeeId, weekStart, dayOfWeek, group }));
    if (schedule && !schedule.isOff) total += calculateShiftHours(schedule.startTime, schedule.endTime);
  }
  return total;
}
