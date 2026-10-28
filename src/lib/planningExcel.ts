import * as XLSX from "xlsx";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { Employee, GroupConfig, Schedule } from "./data";
import { validateShiftTimes } from "./schedule.ts";

export type PlanningExportScope = "selected" | "all";

export interface PlanningExcelFile {
  fileName: string;
  bytes: Uint8Array;
}

interface PlanningSection {
  groups: GroupConfig[];
  employees: Employee[];
  title: string;
  kind: "morning" | "evening" | "night" | "evening-night" | "other";
}

interface SectionLayout {
  headerRow: number;
  firstEmployeeRow: number;
  lastEmployeeRow: number;
  totalRow: number;
  employees: Employee[];
}

interface NumericCell {
  t: "n";
  v: number;
  f?: string;
}

const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const TABLE_HEADER_ROW = 4;
const FIRST_EMPLOYEE_ROW = TABLE_HEADER_ROW + 1;
const FIRST_HELPER_COLUMN = 11; // L:R contain numeric Excel durations in days and stay hidden.
const VISIBLE_LAST_COLUMN = 10; // K, Total semaine.
const EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const STYLE = {
  base: 0,
  brand: 1,
  restaurant: 2,
  title: 3,
  subtitle: 4,
  exportMeta: 5,
  morningBand: 6,
  eveningNightBand: 7,
  morningInfo: 8,
  eveningInfo: 9,
  nightInfo: 10,
  tableHeader: 11,
  rowNumber: 12,
  employee: 13,
  position: 14,
  morningShift: 15,
  eveningShift: 16,
  nightShift: 17,
  off: 18,
  incomplete: 19,
  unplanned: 20,
  weeklyHours: 21,
  totalLabel: 22,
  totalHours: 23,
  recapTitle: 24,
  recapHeader: 25,
  recapLabel: 26,
  recapCount: 27,
  recapHours: 28,
  legendMorning: 29,
  legendEvening: 30,
  legendNight: 31,
  legendOff: 32,
  legendIncomplete: 33,
  grandLabel: 34,
  grandCount: 35,
  grandHours: 36,
} as const;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="[h]&quot;h&quot;mm"/></numFmts>
  <fonts count="7">
    <font><sz val="10"/><color rgb="FF182334"/><name val="Arial"/></font>
    <font><b/><sz val="10"/><color rgb="FF182334"/><name val="Arial"/></font>
    <font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="17"/><color rgb="FFF57C00"/><name val="Arial"/></font>
    <font><sz val="9"/><color rgb="FFE2E8F0"/><name val="Arial"/></font>
    <font><b/><sz val="10"/><color rgb="FF14532D"/><name val="Arial"/></font>
  </fonts>
  <fills count="17">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0C1B2A"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF7B879"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF9EABF8"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF142A3D"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD8F8C5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFD9B5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD4D0FF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD3D5D8"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFD0D0"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F3F5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD6F5D4"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFD09A"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF9FE2A7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE8F7E9"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FF9CA8B6"/></left><right style="thin"><color rgb="FF9CA8B6"/></right><top style="thin"><color rgb="FF9CA8B6"/></top><bottom style="thin"><color rgb="FF9CA8B6"/></bottom><diagonal/></border>
    <border><left style="medium"><color rgb="FFEA8A32"/></left><right style="medium"><color rgb="FFEA8A32"/></right><top style="medium"><color rgb="FFEA8A32"/></top><bottom style="medium"><color rgb="FFEA8A32"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="37">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="4" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="16" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="16" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="16" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="8" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="9" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="11" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="1" fillId="12" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="13" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="164" fontId="1" fillId="13" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="14" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="16" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="15" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="1" fillId="15" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="8" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="9" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="13" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="13" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="1" fillId="13" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function durationHours(hours: number): string {
  const minutes = Math.max(0, Math.round(hours * 60));
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

function hoursAsExcelDays(hours: number): number {
  return hours / 24;
}

function safeSpreadsheetText(value: string | null | undefined): string {
  const text = value?.trim() || "—";
  return /^[\s\u0000-\u001F]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function groupKind(group: GroupConfig): PlanningSection["kind"] {
  if (group.id === "A") return "morning";
  if (group.id === "B") return "evening";
  if (group.id === "C") return "night";
  const normalized = group.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR");
  if (normalized.includes("matin")) return "morning";
  if (normalized.includes("soir")) return "evening";
  if (normalized.includes("nuit")) return "night";
  return "other";
}

function displayGroupName(group: GroupConfig): string {
  if (group.id === "A") return "Matin";
  if (group.id === "B") return "Soir";
  if (group.id === "C") return "Nuit";
  return group.label;
}

function workbookSheetName(group: GroupConfig): string {
  const name = displayGroupName(group).replace(/[\\/?*:[\]]/g, " ").trim().slice(0, 31);
  return name || `Groupe ${group.id}`;
}

function groupOrder(groups: GroupConfig[]): GroupConfig[] {
  const rank = new Map([["A", 0], ["B", 1], ["C", 2]]);
  return [...groups].sort((left, right) => (rank.get(left.id) ?? 3) - (rank.get(right.id) ?? 3));
}

function createSections(
  groups: GroupConfig[],
  employees: Employee[],
  scope: PlanningExportScope,
  selectedGroup: string,
): PlanningSection[] {
  const sortedGroups = groupOrder(groups);
  const groupEmployees = (members: GroupConfig[]) => {
    const ordered: Employee[] = [];
    for (const member of members) ordered.push(...employees.filter((employee) => employee.group === member.id));
    return ordered;
  };
  const labelFor = (group: GroupConfig) => {
    if (group.id === "A") return `ÉQUIPE DU MATIN (${group.start} – ${group.end})`;
    if (group.id === "B") return `ÉQUIPE DU SOIR (${group.start} – ${group.end})`;
    if (group.id === "C") return `ÉQUIPE DE NUIT (${group.start} – ${group.end})`;
    return `${group.label.toLocaleUpperCase("fr-FR")} (${group.start} – ${group.end})`;
  };

  if (scope === "selected") {
    const group = sortedGroups.find((item) => item.id === selectedGroup);
    if (!group) return [];
    return [{ groups: [group], employees: groupEmployees([group]), title: labelFor(group), kind: groupKind(group) }];
  }

  const sections: PlanningSection[] = [];
  const morning = sortedGroups.filter((group) => group.id === "A");
  const eveningNight = sortedGroups.filter((group) => group.id === "B" || group.id === "C");
  const remaining = sortedGroups.filter((group) => !["A", "B", "C"].includes(group.id));

  if (morning.length) {
    sections.push({ groups: morning, employees: groupEmployees(morning), title: labelFor(morning[0]), kind: "morning" });
  }
  if (eveningNight.length) {
    const names = eveningNight.map((group) => group.id === "B"
      ? "ÉQUIPE DU SOIR"
      : group.id === "C"
        ? "ÉQUIPE DE NUIT"
        : `ÉQUIPE ${displayGroupName(group)}`);
    const title = names.join(" & ");
    sections.push({ groups: eveningNight, employees: groupEmployees(eveningNight), title, kind: "evening-night" });
  }
  for (const group of remaining) {
    sections.push({ groups: [group], employees: groupEmployees([group]), title: labelFor(group), kind: groupKind(group) });
  }
  return sections;
}

function scheduleFor(
  schedules: Schedule[],
  employee: Employee,
  groupId: string,
  weekStartKey: string,
  dayOfWeek: number,
): Schedule | undefined {
  return schedules.find((schedule) => schedule.employeeId === employee.id
    && schedule.group === groupId
    && schedule.weekStart === weekStartKey
    && schedule.dayOfWeek === dayOfWeek);
}

function validHours(schedule: Schedule | undefined): number {
  if (!schedule || schedule.isOff) return 0;
  const result = validateShiftTimes(schedule.startTime, schedule.endTime);
  return result.status === "valid" ? result.hours ?? 0 : 0;
}

function scheduleCell(schedule: Schedule | undefined): { text: string; style: number } {
  if (schedule?.isOff) return { text: "OFF", style: STYLE.off };
  if (!schedule) return { text: "Non planifié", style: STYLE.unplanned };

  const validation = validateShiftTimes(schedule.startTime, schedule.endTime);
  if (validation.status === "valid") {
    return { text: `${schedule.startTime} - ${schedule.endTime}`, style: STYLE.base };
  }
  if (validation.status === "incomplete") {
    return {
      text: `Incomplet\nDébut : ${schedule.startTime || "—"} | Fin : ${schedule.endTime || "—"}`,
      style: STYLE.incomplete,
    };
  }
  return {
    text: `À vérifier\n${schedule.startTime || "—"} - ${schedule.endTime || "—"}`,
    style: STYLE.incomplete,
  };
}

function groupShiftStyle(group: GroupConfig): number {
  switch (groupKind(group)) {
    case "morning": return STYLE.morningShift;
    case "evening": return STYLE.eveningShift;
    case "night": return STYLE.nightShift;
    default: return STYLE.unplanned;
  }
}

function groupDefaultHours(group: GroupConfig): number | null {
  const result = validateShiftTimes(group.start, group.end);
  return result.status === "valid" ? result.hours : null;
}

function reference(column: number, row: number): string {
  return `${XLSX.utils.encode_col(column)}${row}`;
}

function setCell(aoa: unknown[][], row: number, column: number, value: unknown): void {
  while (aoa.length < row) aoa.push([]);
  while (aoa[row - 1].length < column) aoa[row - 1].push("");
  aoa[row - 1][column - 1] = value;
}

function addMerge(merges: XLSX.Range[], row: number, startColumn: number, endColumn: number, endRow = row): void {
  merges.push({ s: { r: row - 1, c: startColumn - 1 }, e: { r: endRow - 1, c: endColumn - 1 } });
}

function addStyledText(
  aoa: unknown[][],
  styles: Map<string, number>,
  row: number,
  column: number,
  value: unknown,
  style: number,
): void {
  setCell(aoa, row, column, value);
  styles.set(reference(column - 1, row), style);
}

function addFormulaCell(
  cells: Map<string, NumericCell>,
  styles: Map<string, number>,
  ref: string,
  value: number,
  style: number,
  formula?: string,
): void {
  cells.set(ref, formula ? { t: "n", f: formula, v: value } : { t: "n", v: value });
  styles.set(ref, style);
}

function makeSheet(
  workbook: XLSX.WorkBook,
  groups: GroupConfig[],
  employees: Employee[],
  schedules: Schedule[],
  weekStart: Date,
  generatedAt: Date,
  scope: PlanningExportScope,
  selectedGroup: string,
): { name: string; lastRow: number; filterRef: string | null; styles: Map<string, number> } {
  const weekStartKey = dateKey(weekStart);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return date;
  });
  const sections = createSections(groups, employees, scope, selectedGroup);
  const aoa: unknown[][] = [];
  const styles = new Map<string, number>();
  const merges: XLSX.Range[] = [];
  const numericCells = new Map<string, NumericCell>();
  const employeeRowsByGroup = new Map<string, number[]>();
  const teamHours = new Map<string, number>();
  const sectionLayouts: SectionLayout[] = [];
  let largestFilter: { ref: string; count: number } | null = null;

  addStyledText(aoa, styles, 1, 1, "RAPID CROUSTI", STYLE.brand);
  addStyledText(aoa, styles, 2, 1, "RESTAURANT", STYLE.restaurant);
  addStyledText(aoa, styles, 1, 4, "PLANNING HEBDOMADAIRE", STYLE.title);
  addStyledText(aoa, styles, 2, 4, `Semaine du ${formatFullDate(days[0])} au ${formatFullDate(days[6])}`, STYLE.subtitle);
  addStyledText(
    aoa,
    styles,
    1,
    9,
    `Date d’export : ${new Intl.DateTimeFormat("fr-MA", { dateStyle: "short", timeStyle: "short" }).format(generatedAt)}\nGénéré par : RAPID CROUSTI`,
    STYLE.exportMeta,
  );
  addMerge(merges, 1, 1, 3);
  addMerge(merges, 2, 1, 3);
  addMerge(merges, 1, 4, 8);
  addMerge(merges, 2, 4, 8);
  addMerge(merges, 1, 9, 11, 2);

  let currentRow = 3;
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex];
    const count = section.employees.length;
    const headingKind = section.kind === "morning" || section.kind === "evening"
      ? "morning"
      : "night";
    const titleStyle = headingKind === "morning" ? STYLE.morningBand : STYLE.eveningNightBand;
    addStyledText(aoa, styles, currentRow, 1, `${section.title} (${count} employés)`, titleStyle);
    addMerge(merges, currentRow, 1, 6);

    if (section.kind === "evening-night") {
      const evening = section.groups.find((group) => group.id === "B");
      const night = section.groups.find((group) => group.id === "C");
      const eveningHours = evening ? groupDefaultHours(evening) : null;
      const nightHours = night ? groupDefaultHours(night) : null;
      if (evening) {
        addStyledText(aoa, styles, currentRow, 7, `Soir : ${evening.start} – ${evening.end} | ${eveningHours === null ? "—" : durationHours(eveningHours)}`, STYLE.eveningInfo);
      }
      if (night) {
        addStyledText(aoa, styles, currentRow, 9, `Nuit : ${night.start} – ${night.end} | ${nightHours === null ? "—" : durationHours(nightHours)}`, STYLE.nightInfo);
      }
      const sectionTotal = section.employees.reduce((sum, employee) => sum + Array.from({ length: 7 }, (_, day) =>
        validHours(scheduleFor(schedules, employee, employee.group, weekStartKey, day))).reduce((daySum, hours) => daySum + hours, 0), 0);
      addStyledText(aoa, styles, currentRow, 11, `Total : ${durationHours(sectionTotal)}`, STYLE.eveningNightBand);
      addMerge(merges, currentRow, 7, 8);
      addMerge(merges, currentRow, 9, 10);
    } else {
      const group = section.groups[0];
      const defaultHours = groupDefaultHours(group);
      const hours = section.employees.reduce((sum, employee) => sum + Array.from({ length: 7 }, (_, day) =>
        validHours(scheduleFor(schedules, employee, group.id, weekStartKey, day))).reduce((daySum, value) => daySum + value, 0), 0);
      const infoStyle = groupKind(group) === "night" ? STYLE.nightInfo : STYLE.morningInfo;
      addStyledText(aoa, styles, currentRow, 7, `Durée/jour : ${defaultHours === null ? "—" : durationHours(defaultHours)}`, infoStyle);
      addStyledText(aoa, styles, currentRow, 9, `Total : ${durationHours(hours)}`, infoStyle);
      addStyledText(aoa, styles, currentRow, 11, `${count} employés`, infoStyle);
      addMerge(merges, currentRow, 7, 8);
      addMerge(merges, currentRow, 9, 10);
    }
    currentRow++;

    const headerRow = currentRow;
    const headers = ["#", "Employé", "Poste", ...DAY_NAMES.map((day, index) => `${day}\n${formatShortDate(days[index])}`), "Total semaine"];
    headers.forEach((header, index) => addStyledText(aoa, styles, headerRow, index + 1, header, STYLE.tableHeader));
    currentRow++;
    const firstEmployeeRow = currentRow;
    const rowHours: number[] = [];
    const dayHours = Array.from({ length: 7 }, () => 0);

    section.employees.forEach((employee, employeeIndex) => {
      const row = currentRow++;
      const group = section.groups.find((item) => item.id === employee.group);
      const employeeGroup = group ?? groups.find((item) => item.id === employee.group);
      let weeklyHours = 0;
      addStyledText(aoa, styles, row, 1, employeeIndex + 1, STYLE.rowNumber);
      addStyledText(aoa, styles, row, 2, safeSpreadsheetText(employee.fullName), STYLE.employee);
      addStyledText(aoa, styles, row, 3, safeSpreadsheetText(employee.position), STYLE.position);
      const rowsForGroup = employeeRowsByGroup.get(employee.group) ?? [];
      rowsForGroup.push(row);
      employeeRowsByGroup.set(employee.group, rowsForGroup);

      for (let day = 0; day < 7; day++) {
        const schedule = scheduleFor(schedules, employee, employee.group, weekStartKey, day);
        const cell = scheduleCell(schedule);
        const column = day + 4;
        addStyledText(aoa, styles, row, column, cell.text, cell.style === STYLE.base
          ? (employeeGroup ? groupShiftStyle(employeeGroup) : STYLE.unplanned)
          : cell.style);
        const hours = validHours(schedule);
        weeklyHours += hours;
        dayHours[day] += hours;
        const helperRef = reference(FIRST_HELPER_COLUMN + day, row);
        numericCells.set(helperRef, { t: "n", v: hoursAsExcelDays(hours) });
      }
      addStyledText(aoa, styles, row, 11, hoursAsExcelDays(weeklyHours), STYLE.weeklyHours);
      addFormulaCell(numericCells, styles, `K${row}`, hoursAsExcelDays(weeklyHours), STYLE.weeklyHours,
        `SUM(${reference(FIRST_HELPER_COLUMN, row)}:${reference(FIRST_HELPER_COLUMN + 6, row)})`);
      rowHours.push(weeklyHours);
      teamHours.set(employee.group, (teamHours.get(employee.group) ?? 0) + weeklyHours);
    });

    const lastEmployeeRow = currentRow - 1;
    const totalRow = currentRow++;
    addStyledText(aoa, styles, totalRow, 1, "Total heures par jour", STYLE.totalLabel);
    addMerge(merges, totalRow, 1, 3);
    for (let day = 0; day < 7; day++) {
      const column = day + 4;
      const helperColumn = reference(FIRST_HELPER_COLUMN + day, 1).replace(/\d+$/, "");
      const formula = count ? `SUM(${helperColumn}${firstEmployeeRow}:${helperColumn}${lastEmployeeRow})` : undefined;
      addStyledText(aoa, styles, totalRow, column, hoursAsExcelDays(dayHours[day]), STYLE.totalHours);
      addFormulaCell(numericCells, styles, reference(column - 1, totalRow), hoursAsExcelDays(dayHours[day]), STYLE.totalHours, formula);
    }
    const sectionHours = rowHours.reduce((sum, value) => sum + value, 0);
    const weeklyFormula = count ? `SUM(K${firstEmployeeRow}:K${lastEmployeeRow})` : undefined;
    addStyledText(aoa, styles, totalRow, 11, hoursAsExcelDays(sectionHours), STYLE.totalHours);
    addFormulaCell(numericCells, styles, `K${totalRow}`, hoursAsExcelDays(sectionHours), STYLE.totalHours, weeklyFormula);

    section.groups.forEach((group) => {
      teamHours.set(group.id, teamHours.get(group.id) ?? 0);
    });
    sectionLayouts.push({ headerRow, firstEmployeeRow, lastEmployeeRow, totalRow, employees: section.employees });
    if (count && (!largestFilter || count > largestFilter.count)) {
      largestFilter = { ref: `A${headerRow}:K${lastEmployeeRow}`, count };
    }
    currentRow++;
  }

  currentRow++;
  const legendTitleRow = currentRow++;
  addStyledText(aoa, styles, legendTitleRow, 1, "LÉGENDE DES HORAIRES", STYLE.recapTitle);
  addMerge(merges, legendTitleRow, 1, VISIBLE_LAST_COLUMN + 1);
  const legendRow = currentRow++;
  const legendEntries = [
    { start: 1, end: 2, text: "Matin (11:00 – 19:30)", style: STYLE.legendMorning },
    { start: 3, end: 4, text: "Soir (19:30 – 04:00)", style: STYLE.legendEvening },
    { start: 5, end: 6, text: "Nuit (04:00 – 11:00)", style: STYLE.legendNight },
    { start: 7, end: 8, text: "Repos (OFF)", style: STYLE.legendOff },
    { start: 9, end: 11, text: "Incomplet ou non planifié", style: STYLE.legendIncomplete },
  ];
  for (const entry of legendEntries) {
    addStyledText(aoa, styles, legendRow, entry.start, entry.text, entry.style);
    addMerge(merges, legendRow, entry.start, entry.end);
  }

  currentRow++;
  const recapTitleRow = currentRow++;
  addStyledText(aoa, styles, recapTitleRow, 1, "RÉCAPITULATIF HEBDOMADAIRE", STYLE.recapTitle);
  addMerge(merges, recapTitleRow, 1, VISIBLE_LAST_COLUMN + 1);
  const recapHeaderRow = currentRow++;
  addStyledText(aoa, styles, recapHeaderRow, 1, "Équipe", STYLE.recapHeader);
  addStyledText(aoa, styles, recapHeaderRow, 6, "Employés", STYLE.recapHeader);
  addStyledText(aoa, styles, recapHeaderRow, 8, "Total planifié", STYLE.recapHeader);
  addMerge(merges, recapHeaderRow, 1, 5);
  addMerge(merges, recapHeaderRow, 6, 7);
  addMerge(merges, recapHeaderRow, 8, 11);

  const exportGroupIds = new Set(sections.flatMap((section) => section.groups.map((group) => group.id)));
  const recapGroups = groupOrder(groups).filter((group) => exportGroupIds.has(group.id));
  const recapRows = new Map<string, number>();
  const recapHours = new Map<string, number>();
  const recapCounts = new Map<string, number>();
  const formulaForEmployeeRows = (rows: number[]) => rows.length
    ? `SUM(${rows.map((row) => `K${row}`).join(",")})`
    : undefined;

  for (const group of recapGroups) {
    const row = currentRow++;
    const groupEmployees = employees.filter((employee) => employee.group === group.id);
    const hours = teamHours.get(group.id) ?? 0;
    const rows = employeeRowsByGroup.get(group.id) ?? [];
    addStyledText(aoa, styles, row, 1, `Total ${displayGroupName(group)}`, STYLE.recapLabel);
    addStyledText(aoa, styles, row, 6, groupEmployees.length, STYLE.recapCount);
    addStyledText(aoa, styles, row, 8, hoursAsExcelDays(hours), STYLE.recapHours);
    addMerge(merges, row, 1, 5);
    addMerge(merges, row, 6, 7);
    addMerge(merges, row, 8, 11);
    addFormulaCell(numericCells, styles, `H${row}`, hoursAsExcelDays(hours), STYLE.recapHours, formulaForEmployeeRows(rows));
    recapRows.set(group.id, row);
    recapHours.set(group.id, hours);
    recapCounts.set(group.id, groupEmployees.length);
  }

  const includesEveningAndNight = scope === "all" && recapRows.has("B") && recapRows.has("C");
  if (includesEveningAndNight) {
    const row = currentRow++;
    const combinedHours = (recapHours.get("B") ?? 0) + (recapHours.get("C") ?? 0);
    const combinedCount = (recapCounts.get("B") ?? 0) + (recapCounts.get("C") ?? 0);
    addStyledText(aoa, styles, row, 1, "Total Soir & Nuit", STYLE.recapLabel);
    addStyledText(aoa, styles, row, 6, combinedCount, STYLE.recapCount);
    addStyledText(aoa, styles, row, 8, hoursAsExcelDays(combinedHours), STYLE.recapHours);
    addMerge(merges, row, 1, 5);
    addMerge(merges, row, 6, 7);
    addMerge(merges, row, 8, 11);
    addFormulaCell(numericCells, styles, `H${row}`, hoursAsExcelDays(combinedHours), STYLE.recapHours,
      `SUM(H${recapRows.get("B")},H${recapRows.get("C")})`);
  }

  const grandTotalRow = currentRow++;
  const grandTotalHours = recapGroups.reduce((sum, group) => sum + (recapHours.get(group.id) ?? 0), 0);
  addStyledText(aoa, styles, grandTotalRow, 1, "Total général", STYLE.grandLabel);
  const reportEmployeeCount = sections.reduce((sum, section) => sum + section.employees.length, 0);
  addStyledText(aoa, styles, grandTotalRow, 6, reportEmployeeCount, STYLE.grandCount);
  addStyledText(aoa, styles, grandTotalRow, 8, hoursAsExcelDays(grandTotalHours), STYLE.grandHours);
  addMerge(merges, grandTotalRow, 1, 5);
  addMerge(merges, grandTotalRow, 6, 7);
  addMerge(merges, grandTotalRow, 8, 11);
  addFormulaCell(numericCells, styles, `H${grandTotalRow}`, hoursAsExcelDays(grandTotalHours), STYLE.grandHours,
    `SUM(${recapGroups.map((group) => `H${recapRows.get(group.id)}`).join(",")})`);

  const lastRow = grandTotalRow;
  const sheetName = scope === "all" ? "Planning" : workbookSheetName(sections[0].groups[0]);
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!ref"] = `A1:R${lastRow}`;
  worksheet["!cols"] = [
    { wch: 5 }, { wch: 29 }, { wch: 15 },
    ...Array.from({ length: 7 }, () => ({ wch: 16 })),
    { wch: 17 },
    ...Array.from({ length: 7 }, () => ({ wch: 9, hidden: true })),
  ];
  const rowHeights: Array<{ hpt: number }> = [];
  const setRowHeight = (row: number, hpt: number) => { rowHeights[row - 1] = { hpt }; };
  setRowHeight(1, 32);
  setRowHeight(2, 24);
  for (const section of sectionLayouts) {
    setRowHeight(section.headerRow - 1, 29);
    setRowHeight(section.headerRow, 32);
    for (let row = section.firstEmployeeRow; row <= section.lastEmployeeRow; row++) setRowHeight(row, 23);
    setRowHeight(section.totalRow, 24);
  }
  setRowHeight(legendTitleRow, 23);
  setRowHeight(legendRow, 25);
  setRowHeight(recapTitleRow, 23);
  for (let row = recapHeaderRow; row <= lastRow; row++) setRowHeight(row, 23);
  worksheet["!rows"] = rowHeights;
  worksheet["!merges"] = merges;
  if (largestFilter) worksheet["!autofilter"] = { ref: largestFilter.ref };
  for (const [ref, cell] of numericCells) worksheet[ref] = cell;
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  return { name: sheetName, lastRow, filterRef: largestFilter?.ref ?? null, styles };
}

function applyCellStyles(xml: string, styles: Map<string, number>): string {
  let styled = xml;
  for (const [cellReference, styleId] of styles) {
    const escapedReference = cellReference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const openingCell = new RegExp(`<c(?=[^>]*\\br="${escapedReference}")[^>]*>`);
    styled = styled.replace(openingCell, (tag) => {
      const withoutStyle = tag.replace(/\s+s="\d+"/, "");
      return withoutStyle.replace(/(\/?)>$/, ` s="${styleId}"$1>`);
    });
  }
  return styled;
}

function finishWorksheetXml(xml: string, filterRef: string | null): string {
  let result = xml.replace(/<worksheet([^>]*)>/, (_tag, attributes: string) =>
    `<worksheet${attributes}><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`);
  const views = `<sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane xSplit="3" ySplit="${TABLE_HEADER_ROW}" topLeftCell="D${FIRST_EMPLOYEE_ROW}" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="D${FIRST_EMPLOYEE_ROW}" sqref="D${FIRST_EMPLOYEE_ROW}"/></sheetView></sheetViews>`;
  if (/<sheetViews>[\s\S]*?<\/sheetViews>/.test(result)) result = result.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, views);
  else result = result.replace(/<dimension\b[^>]*\/>/, (dimension) => `${dimension}${views}`);
  if (filterRef && !/<autoFilter\b/.test(result)) {
    result = result.replace("</sheetData>", `</sheetData><autoFilter ref="${filterRef}"/>`);
  }
  result = result.replace(/<ignoredErrors>[\s\S]*?<\/ignoredErrors>/g, "");
  const printSettings = `<printOptions/><pageMargins left="0.25" right="0.25" top="0.45" bottom="0.45" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;RPage &amp;P / &amp;N</oddFooter></headerFooter>`;
  return result.replace("</worksheet>", `${printSettings}</worksheet>`);
}

function addWorkbookPrintNames(xml: string, sheetName: string, lastRow: number): string {
  const sheetRef = `'${sheetName.replaceAll("'", "''")}'`;
  const names = `<definedName name="_xlnm.Print_Titles" localSheetId="0">${sheetRef}!$1:$${TABLE_HEADER_ROW}</definedName>`
    + `<definedName name="_xlnm.Print_Area" localSheetId="0">${sheetRef}!$A$1:$K$${lastRow}</definedName>`;
  const existingDefinedNames = /<definedNames(?:\s[^>]*)?>[\s\S]*?<\/definedNames>/;
  let result: string;
  if (existingDefinedNames.test(xml)) {
    result = xml.replace(existingDefinedNames, (section) => section.replace("</definedNames>", `${names}</definedNames>`));
  } else {
    const definedNames = `<definedNames>${names}</definedNames>`;
    result = xml.includes("<calcPr")
      ? xml.replace(/<calcPr\b/, `${definedNames}<calcPr`)
      : xml.replace("</workbook>", `${definedNames}</workbook>`);
  }
  const calcPr = `<calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>`;
  return /<calcPr\b[^>]*\/>/.test(result)
    ? result.replace(/<calcPr\b[^>]*\/>/, calcPr)
    : result.replace("</workbook>", `${calcPr}</workbook>`);
}

function fileTeamName(group: GroupConfig): string {
  if (group.id === "A") return "Matin";
  if (group.id === "B") return "Soir";
  if (group.id === "C") return "Nuit";
  return group.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || `Groupe_${group.id}`;
}

export function buildPlanningExcelFile(
  employees: Employee[],
  schedules: Schedule[],
  weekStart: Date,
  groups: GroupConfig[],
  selectedGroup: string,
  scope: PlanningExportScope,
  generatedAt: Date = new Date(),
): PlanningExcelFile {
  const exportGroups = scope === "all" ? groups : groups.filter((group) => group.id === selectedGroup);
  if (exportGroups.length === 0) throw new Error("Aucune équipe configurée n’est disponible pour l’export.");

  const sections = createSections(exportGroups, employees, scope, selectedGroup);
  if (sections.length === 0) throw new Error("Aucune équipe configurée n’est disponible pour l’export.");
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: "RAPID CROUSTI — Planning hebdomadaire",
    Subject: "Planning des équipes",
    Author: "RAPID CROUSTI",
    CreatedDate: generatedAt,
  };
  const layout = makeSheet(workbook, exportGroups, employees, schedules, weekStart, generatedAt, scope, selectedGroup);
  const baseBytes = new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true }));
  const archive = unzipSync(baseBytes);
  archive["xl/styles.xml"] = strToU8(STYLES_XML);
  archive["xl/workbook.xml"] = strToU8(addWorkbookPrintNames(strFromU8(archive["xl/workbook.xml"]), layout.name, layout.lastRow));
  const sheetPath = "xl/worksheets/sheet1.xml";
  archive[sheetPath] = strToU8(finishWorksheetXml(
    applyCellStyles(strFromU8(archive[sheetPath]), layout.styles),
    layout.filterRef,
  ));

  const bytes = zipSync(archive, { level: 6 });
  const teamSlug = scope === "all" ? "Complet" : fileTeamName(exportGroups.find((group) => group.id === selectedGroup) ?? exportGroups[0]);
  return {
    fileName: `RAPID_CROUSTI_Planning_${teamSlug}_${dateKey(weekStart)}.xlsx`,
    bytes,
  };
}

export function downloadPlanningExcelFile(file: PlanningExcelFile): void {
  const ownedBytes = new Uint8Array(file.bytes.byteLength);
  ownedBytes.set(file.bytes);
  const blob = new Blob([ownedBytes.buffer], { type: EXCEL_MIME });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = file.fileName;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
