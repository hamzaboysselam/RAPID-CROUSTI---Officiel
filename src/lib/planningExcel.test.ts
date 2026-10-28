import assert from "node:assert/strict";
import { test } from "node:test";
import * as XLSX from "xlsx";
import { strFromU8, unzipSync } from "fflate";
import type { Employee, GroupConfig, Schedule } from "./data.ts";
import { INITIAL_EMPLOYEES } from "./employeeSeeds.ts";
import { calculateWeeklyScheduleHours } from "./schedule.ts";
import { buildPlanningExcelFile } from "./planningExcel.ts";

const weekStart = new Date(2026, 9, 19, 12);
const weekStartKey = "2026-10-19";
const generatedAt = new Date(2026, 9, 22, 15, 30);
const groups: GroupConfig[] = [
  { id: "A", label: "Équipe du matin", start: "11:00", end: "19:30", color: "#f59e0b" },
  { id: "B", label: "Équipe du soir", start: "19:30", end: "04:00", color: "#ef4444" },
  { id: "C", label: "Nuit", start: "04:00", end: "11:00", color: "#3b82f6" },
];

function employee(id: number, fullName: string, group: string): Employee {
  return {
    id, fullName, group, position: "Employé", phone: "", hourlyRate: null,
    status: "active", hireDate: "2026-01-01", notes: "",
  };
}

function schedule(
  id: number,
  employeeId: number,
  dayOfWeek: number,
  values: Partial<Schedule> = {},
): Schedule {
  return {
    id, employeeId, weekStart: weekStartKey, dayOfWeek,
    startTime: "11:00", endTime: "19:30", isOff: false, group: "A",
    ...values,
  };
}

function readWorkbook(bytes: Uint8Array): XLSX.WorkBook {
  return XLSX.read(bytes, { type: "array", cellFormula: true, cellStyles: true });
}

function rowForLabel(sheet: XLSX.WorkSheet, label: string): number {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const index = rows.findIndex((row) => row[0] === label);
  assert.notEqual(index, -1, `Expected row labeled ${label}`);
  return index + 1;
}

function excelHours(sheet: XLSX.WorkSheet, cell: string): number {
  const value = sheet[cell]?.v;
  assert.equal(typeof value, "number", `${cell} should contain a numeric Excel duration`);
  return Number(value) * 24;
}

function cellStyle(xml: string, reference: string): number {
  const escaped = reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = xml.match(new RegExp(`<c(?=[^>]*\\br="${escaped}")[^>]*>`))?.[0];
  assert.ok(tag, `Expected XML cell ${reference}`);
  const style = tag.match(/\bs="(\d+)"/)?.[1];
  assert.ok(style, `Expected style on ${reference}`);
  return Number(style);
}

test("single-team export matches the report layout and calculates validated shifts", () => {
  const schedules = [
    schedule(1, 1, 0),
    schedule(2, 1, 1, { startTime: null, endTime: null, isOff: true }),
    schedule(3, 1, 2, { startTime: "11:00", endTime: null }),
    schedule(4, 1, 3, { startTime: "19:30", endTime: "04:00" }),
    schedule(5, 1, 4, { startTime: "09:00", endTime: "09:00" }),
  ];
  const result = buildPlanningExcelFile(
    [employee(1, "Élodie El Ouafy", "A")], schedules, weekStart, groups, "A", "selected", generatedAt,
  );
  assert.equal(result.fileName, "RAPID_CROUSTI_Planning_Matin_2026-10-19.xlsx");
  assert.deepEqual([...result.bytes.slice(0, 2)], [0x50, 0x4b]);

  const workbook = readWorkbook(result.bytes);
  assert.deepEqual(workbook.SheetNames, ["Matin"]);
  const sheet = workbook.Sheets.Matin;
  assert.equal(sheet.A1.v, "RAPID CROUSTI");
  assert.equal(sheet.D1.v, "PLANNING HEBDOMADAIRE");
  assert.match(String(sheet.D2.v), /19 octobre 2026 au 25 octobre 2026/);
  assert.equal(sheet.A4.v, "#");
  assert.equal(sheet.B4.v, "Employé");
  assert.equal(sheet.B5.v, "Élodie El Ouafy");
  assert.equal(sheet.D5.v, "11:00 - 19:30");
  assert.equal(sheet.E5.v, "OFF");
  assert.match(String(sheet.F5.v), /Incomplet/);
  assert.equal(sheet.G5.v, "19:30 - 04:00");
  assert.match(String(sheet.H5.v), /À vérifier/);
  assert.equal(excelHours(sheet, "K5"), 17);
  assert.equal(sheet.K5.f, "SUM(L5:R5)");
  assert.equal(sheet.A6.v, "Total heures par jour");
  assert.equal(excelHours(sheet, "D6"), 8.5);
  assert.equal(excelHours(sheet, "G6"), 8.5);
  assert.equal(excelHours(sheet, "K6"), calculateWeeklyScheduleHours(schedules, 1, weekStartKey, "A"));

  const recapRow = rowForLabel(sheet, "Total Matin");
  assert.equal(excelHours(sheet, `H${recapRow}`), 17);
  const grandRow = rowForLabel(sheet, "Total général");
  assert.equal(excelHours(sheet, `H${grandRow}`), 17);

  const files = unzipSync(result.bytes);
  const worksheetXml = strFromU8(files["xl/worksheets/sheet1.xml"]);
  const workbookXml = strFromU8(files["xl/workbook.xml"]);
  const styleXml = strFromU8(files["xl/styles.xml"]);
  assert.equal((workbookXml.match(/<definedNames\b/g) ?? []).length, 1);
  assert.match(workbookXml, /_xlnm\._FilterDatabase/);
  assert.match(workbookXml, /_xlnm\.Print_Titles/);
  assert.match(workbookXml, /_xlnm\.Print_Area/);
  assert.match(worksheetXml, /state="frozen"/);
  assert.match(worksheetXml, /showGridLines="0"/);
  assert.match(worksheetXml, /<autoFilter ref="A4:K5"\/>/);
  assert.match(worksheetXml, /orientation="landscape" fitToWidth="1"/);
  assert.match(styleXml, /formatCode="\[h\]&quot;h&quot;mm"/);
  assert.equal(cellStyle(worksheetXml, "D5"), 15);
  assert.equal(cellStyle(worksheetXml, "E5"), 18);
  assert.equal(cellStyle(worksheetXml, "F5"), 19);
});

test("all-team export has the reference's combined evening and night table and a reconciled recap", () => {
  const employees = [
    employee(1, "Uthaymin Stitou", "A"),
    employee(2, "Elkandi Hamza", "B"),
    employee(3, "Kane Mossa", "C"),
  ];
  const schedules = [
    schedule(1, 1, 0),
    schedule(2, 2, 0, { group: "B", startTime: "19:30", endTime: "04:00" }),
    schedule(3, 3, 0, { group: "C", startTime: "04:00", endTime: "11:00" }),
  ];
  const result = buildPlanningExcelFile(employees, schedules, weekStart, groups, "A", "all", generatedAt);
  const workbook = readWorkbook(result.bytes);
  assert.equal(result.fileName, "RAPID_CROUSTI_Planning_Complet_2026-10-19.xlsx");
  assert.deepEqual(workbook.SheetNames, ["Planning"]);
  const sheet = workbook.Sheets.Planning;
  assert.equal(sheet.B5.v, "Uthaymin Stitou");
  assert.equal(sheet.B10.v, "Elkandi Hamza");
  assert.equal(sheet.B11.v, "Kane Mossa");
  assert.equal(sheet.D10.v, "19:30 - 04:00");
  assert.equal(sheet.D11.v, "04:00 - 11:00");
  assert.equal(excelHours(sheet, "K5"), 8.5);
  assert.equal(excelHours(sheet, "K10"), 8.5);
  assert.equal(excelHours(sheet, "K11"), 7);
  assert.equal(excelHours(sheet, "D12"), 15.5);
  assert.equal(excelHours(sheet, "K12"), 15.5);
  assert.match(String(sheet.A8.v), /ÉQUIPE DU SOIR & ÉQUIPE DE NUIT/);

  const morningRow = rowForLabel(sheet, "Total Matin");
  const eveningRow = rowForLabel(sheet, "Total Soir");
  const nightRow = rowForLabel(sheet, "Total Nuit");
  const combinedRow = rowForLabel(sheet, "Total Soir & Nuit");
  const grandRow = rowForLabel(sheet, "Total général");
  assert.equal(excelHours(sheet, `H${morningRow}`), 8.5);
  assert.equal(excelHours(sheet, `H${eveningRow}`), 8.5);
  assert.equal(excelHours(sheet, `H${nightRow}`), 7);
  assert.equal(excelHours(sheet, `H${combinedRow}`), 15.5);
  assert.equal(excelHours(sheet, `H${grandRow}`), 24);
  assert.equal(sheet[`F${morningRow}`].v, 1);
  assert.equal(sheet[`F${eveningRow}`].v, 1);
  assert.equal(sheet[`F${nightRow}`].v, 1);

  const files = unzipSync(result.bytes);
  const worksheetXml = strFromU8(files["xl/worksheets/sheet1.xml"]);
  assert.equal(cellStyle(worksheetXml, "D5"), 15);
  assert.equal(cellStyle(worksheetXml, "D10"), 16);
  assert.equal(cellStyle(worksheetXml, "D11"), 17);
  assert.match(worksheetXml, /<autoFilter ref="A9:K11"\/>/);
});

test("all supplied employees are available in the all-team export without invented shifts", () => {
  const result = buildPlanningExcelFile(INITIAL_EMPLOYEES, [], weekStart, groups, "A", "all", generatedAt);
  const sheet = readWorkbook(result.bytes).Sheets.Planning;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const names = new Set(rows.map((row) => row[1]).filter((value): value is string => typeof value === "string"));
  for (const employee of INITIAL_EMPLOYEES) assert.ok(names.has(employee.fullName), employee.fullName);
  assert.equal(INITIAL_EMPLOYEES.length, 18);
  const nonPlannedCells = rows.flatMap((row) => row.slice(3, 10)).filter((value) => value === "Non planifié");
  assert.equal(nonPlannedCells.length, 18 * 7);
  assert.equal(excelHours(sheet, `K${rowForLabel(sheet, "Total heures par jour")}`), 0);
});

test("selected Soir export keeps overnight duration numeric and uses the team-specific filename", () => {
  const employees = [employee(5, "Youssef", "B")];
  const schedules = [
    schedule(10, 5, 0, { group: "B", startTime: "19:30", endTime: "04:00" }),
    schedule(11, 5, 1, { group: "B", startTime: null, endTime: null, isOff: true }),
    schedule(12, 5, 2, { group: "B", startTime: "20:00", endTime: "05:15" }),
  ];
  const result = buildPlanningExcelFile(employees, schedules, weekStart, groups, "B", "selected", generatedAt);
  assert.equal(result.fileName, "RAPID_CROUSTI_Planning_Soir_2026-10-19.xlsx");
  const sheet = readWorkbook(result.bytes).Sheets.Soir;
  const expected = calculateWeeklyScheduleHours(schedules, 5, weekStartKey, "B");
  assert.equal(expected, 17.75);
  assert.equal(excelHours(sheet, "K5"), expected);
  assert.equal(excelHours(sheet, "K6"), expected);
  assert.equal(sheet.K5.w, "17h45");
  assert.equal(sheet.E5.v, "OFF");
});

test("formula-like employee text remains inert and empty or incomplete assignments add zero hours", () => {
  const result = buildPlanningExcelFile(
    [employee(12, "=HYPERLINK(\"https://example.invalid\")", "A")],
    [schedule(13, 12, 0, { startTime: "11:00", endTime: null })],
    weekStart,
    groups,
    "A",
    "selected",
    generatedAt,
  );
  const sheet = readWorkbook(result.bytes).Sheets.Matin;
  assert.equal(sheet.B5.v, "'=HYPERLINK(\"https://example.invalid\")");
  assert.equal(sheet.B5.f, undefined);
  assert.match(String(sheet.D5.v), /Incomplet/);
  assert.equal(excelHours(sheet, "K5"), 0);
  assert.equal(excelHours(sheet, "K6"), 0);
});
