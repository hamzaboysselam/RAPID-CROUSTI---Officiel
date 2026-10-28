import assert from "node:assert/strict";
import { test } from "node:test";
import { calculatePayroll } from "./payroll.ts";
import {
  calculateWeeklyScheduleHours,
  DEFAULT_TEAM_SHIFTS,
  getExpectedScheduledHours,
  initializeMissingWeekSchedules,
  isCurrentOrFutureWeek,
  migrateLegacyDefaultTeamShifts,
  persistSchedules,
  readSchedules,
  restoreScheduleDefault,
  toggleScheduleOff,
  updateScheduleTime,
  validateShiftTimes,
  type ScheduleRecord,
} from "./schedule.ts";

const key = { employeeId: 1, weekStart: "2026-10-19", dayOfWeek: 0, group: "B" };
const nextId = () => 100;

test("team defaults use Matin, Soir, and Nuit shift times", () => {
  assert.deepEqual(DEFAULT_TEAM_SHIFTS, {
    A: { startTime: "11:00", endTime: "19:30" },
    B: { startTime: "19:30", endTime: "04:00" },
    C: { startTime: "04:00", endTime: "11:00" },
  });
});

test("legacy shipped group defaults migrate once while custom team times stay intact", () => {
  const groups = [
    { id: "A", label: "Équipe du matin", start: "11:00", end: "19:00", color: "yellow" },
    { id: "B", label: "Équipe du soir et de nuit", start: "19:00", end: "04:00", color: "red" },
    { id: "C", label: "Groupe C", start: "04:00", end: "11:00", color: "blue" },
    { id: "X", label: "Personnalisé", start: "10:00", end: "18:00", color: "green" },
  ];
  const migrated = migrateLegacyDefaultTeamShifts(groups);
  assert.deepEqual(migrated.map(({ id, start, end, label }) => ({ id, start, end, label })), [
    { id: "A", label: "Équipe du matin", start: "11:00", end: "19:30" },
    { id: "B", label: "Équipe du soir et de nuit", start: "19:30", end: "04:00" },
    { id: "C", label: "Nuit", start: "04:00", end: "11:00" },
    { id: "X", label: "Personnalisé", start: "10:00", end: "18:00" },
  ]);
  assert.deepEqual(migrateLegacyDefaultTeamShifts(migrated), migrated);
});

test("start and end edits update one assignment and recalculate its weekly total", () => {
  let schedules: ScheduleRecord[] = [];
  schedules = updateScheduleTime(schedules, key, "startTime", "20:00", DEFAULT_TEAM_SHIFTS.B, nextId);
  assert.equal(schedules[0].startTime, "20:00");
  assert.equal(schedules[0].endTime, "04:00");
  assert.equal(calculateWeeklyScheduleHours(schedules, 1, key.weekStart, key.group), 8);

  schedules = updateScheduleTime(schedules, key, "endTime", "05:30", DEFAULT_TEAM_SHIFTS.B, nextId);
  assert.equal(schedules[0].endTime, "05:30");
  assert.equal(calculateWeeklyScheduleHours(schedules, 1, key.weekStart, key.group), 9.5);
});

test("schedule edits persist and load back from the authoritative storage adapter", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (name: string) => data.get(name) ?? null,
    setItem: (name: string, value: string) => { data.set(name, value); },
  };
  const schedules = updateScheduleTime([], key, "startTime", "19:30", DEFAULT_TEAM_SHIFTS.B, nextId);
  persistSchedules(storage, schedules);
  assert.deepEqual(readSchedules(storage), schedules);
  assert.deepEqual(readSchedules(storage), schedules); // a fresh read, as after a page reload
});

test("overnight schedules calculate a positive duration across midnight", () => {
  assert.equal(validateShiftTimes("19:30", "04:00").hours, 8.5);
  assert.equal(calculateWeeklyScheduleHours([
    { ...key, id: 99, startTime: "19:30", endTime: "04:00", isOff: false },
  ], 1, key.weekStart, key.group), 8.5);
});

test("rest days and empty assignments contribute no planned hours", () => {
  let schedules: ScheduleRecord[] = [];
  schedules = toggleScheduleOff(schedules, key, DEFAULT_TEAM_SHIFTS.B, nextId);
  assert.equal(schedules[0].isOff, true);
  assert.equal(schedules[0].startTime, null);
  assert.equal(calculateWeeklyScheduleHours(schedules, 1, key.weekStart, key.group), 0);

  schedules = toggleScheduleOff(schedules, key, DEFAULT_TEAM_SHIFTS.B, nextId);
  assert.equal(schedules[0].isOff, false);
  assert.equal(schedules[0].startTime, "19:30");
  assert.equal(schedules[0].endTime, "04:00");
  assert.equal(calculateWeeklyScheduleHours([], 1, key.weekStart, key.group), 0);
});

test("empty, partial, invalid, and identical time ranges stay incomplete", () => {
  assert.equal(validateShiftTimes(null, null).status, "empty");
  assert.equal(validateShiftTimes("19:30", null).status, "incomplete");
  assert.equal(validateShiftTimes("25:10", "04:00").status, "invalid");
  assert.equal(validateShiftTimes("09:00", "09:00").status, "identical");
  assert.equal(validateShiftTimes("09:00", "17:00").hours, 8);
  assert.equal(calculateWeeklyScheduleHours([
    { ...key, id: 99, startTime: "09:00", endTime: "09:00", isOff: false },
  ], 1, key.weekStart, key.group), 0);
  assert.throws(() => updateScheduleTime([], key, "startTime", "25:10", DEFAULT_TEAM_SHIFTS.B, nextId), /HH:mm/);
});

test("restoring defaults changes only the selected assignment", () => {
  const other = { ...key, id: 101, employeeId: 2, startTime: "10:00", endTime: "18:00", isOff: false };
  const current = { ...key, id: 102, startTime: "21:00", endTime: "05:00", isOff: false };
  const updated = restoreScheduleDefault([other, current], key, DEFAULT_TEAM_SHIFTS.B, nextId);
  assert.deepEqual(updated[0], other);
  assert.equal(updated[1].startTime, "19:30");
  assert.equal(updated[1].endTime, "04:00");
});

test("week initialization fills all employees from their team defaults without overwriting saved entries", () => {
  const schedules: ScheduleRecord[] = [
    { ...key, id: 201, startTime: null, endTime: null, isOff: true },
    { ...key, id: 202, employeeId: 2, startTime: "20:00", endTime: "05:00", isOff: false },
  ];
  let id = 300;
  const initialized = initializeMissingWeekSchedules(
    schedules,
    [{ id: 1, group: "B" }, { id: 2, group: "B" }, { id: 3, group: "A" }],
    [
      { id: "A", start: "11:00", end: "19:30" },
      { id: "B", start: "19:30", end: "04:00" },
    ],
    key.weekStart,
    () => id++,
  );

  assert.equal(initialized.length, 21);
  assert.deepEqual(initialized[0], schedules[0]);
  assert.deepEqual(initialized[1], schedules[1]);
  assert.deepEqual(
    initialized.filter((schedule) => schedule.employeeId === 1 && schedule.group === "B").length,
    7,
  );
  assert.equal(initialized.find((schedule) => schedule.employeeId === 1 && schedule.dayOfWeek === 0)?.isOff, true);
  assert.equal(initialized.find((schedule) => schedule.employeeId === 2 && schedule.dayOfWeek === 0)?.startTime, "20:00");
  assert.equal(initialized.find((schedule) => schedule.employeeId === 3 && schedule.dayOfWeek === 0)?.startTime, "11:00");
  const stored = new Map<string, string>();
  const storage = {
    getItem: (name: string) => stored.get(name) ?? null,
    setItem: (name: string, value: string) => { stored.set(name, value); },
  };
  persistSchedules(storage, initialized);
  assert.deepEqual(readSchedules(storage), initialized);
  assert.deepEqual(
    initializeMissingWeekSchedules(initialized, [{ id: 1, group: "B" }, { id: 2, group: "B" }, { id: 3, group: "A" }], [
      { id: "A", start: "11:00", end: "19:30" },
      { id: "B", start: "19:30", end: "04:00" },
    ], key.weekStart, () => id++),
    initialized,
  );
});

test("automatic defaults do not backfill past weeks", () => {
  assert.equal(isCurrentOrFutureWeek("2026-10-12", "2026-10-19"), false);
  assert.equal(isCurrentOrFutureWeek("2026-10-19", "2026-10-19"), true);
  assert.equal(isCurrentOrFutureWeek("2026-10-26", "2026-10-19"), true);
});

test("edited shifts supply future attendance expectations without rewriting payroll history", () => {
  const attendance = [{
    employeeId: 1,
    date: "2026-10-19",
    workedHours: 8.5,
    expectedHours: getExpectedScheduledHours({ isOff: false, startTime: "19:30", endTime: "04:00" }, 8),
    penaltyHours: 0,
  }];
  const before = calculatePayroll([{ id: 1, fullName: "Employee", group: "B", hourlyRate: 30 }], attendance, "2026-10");
  const changedShift = { isOff: false, startTime: "20:00", endTime: "04:00" };
  assert.equal(getExpectedScheduledHours(changedShift, 8), 8);
  const after = calculatePayroll([{ id: 1, fullName: "Employee", group: "B", hourlyRate: 30 }], attendance, "2026-10");
  assert.deepEqual(after, before);
  assert.equal(before[0].expectedHours, 8.5);
});
