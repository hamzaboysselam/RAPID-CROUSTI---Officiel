import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Employee, Schedule } from "./data";
import { calculateHours, formatDateKey, getMonday } from "./utils";

export function exportToCSV(
  employees: Employee[],
  schedules: Schedule[],
  weekStart: Date,
  group: string
) {
  const weekStartStr = formatDateKey(weekStart);
  const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  let csv = "Employé,Poste," + dayNames.join(",") + ",Total Semaine\n";

  employees.forEach((emp) => {
    csv += `"${emp.fullName}","${emp.position}",`;
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const sch = schedules.find(
        (s) => s.employeeId === emp.id && s.dayOfWeek === i && s.weekStart === weekStartStr && s.group === group
      );
      if (sch?.isOff) {
        csv += "OFF,";
      } else if (sch?.startTime && sch?.endTime) {
        total += calculateHours(sch.startTime, sch.endTime);
        csv += `"${sch.startTime?.substring(0, 5)}-${sch.endTime?.substring(0, 5)}",`;
      } else {
        csv += ",";
      }
    }
    csv += `${total.toFixed(1)}H\n`;
  });

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `planning_${group}_${weekStartStr}.csv`;
  link.click();
}

export function exportToExcel(
  employees: Employee[],
  schedules: Schedule[],
  weekStart: Date,
  group: string
) {
  const weekStartStr = formatDateKey(weekStart);
  const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  const data: any[] = [];
  employees.forEach((emp) => {
    const row: any = { Employé: emp.fullName, Poste: emp.position };
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const sch = schedules.find(
        (s) => s.employeeId === emp.id && s.dayOfWeek === i && s.weekStart === weekStartStr && s.group === group
      );
      if (sch?.isOff) {
        row[dayNames[i]] = "OFF";
      } else if (sch?.startTime && sch?.endTime) {
        total += calculateHours(sch.startTime, sch.endTime);
        row[dayNames[i]] = `${sch.startTime?.substring(0, 5)} - ${sch.endTime?.substring(0, 5)}`;
      } else {
        row[dayNames[i]] = "";
      }
    }
    row["Total Semaine"] = `${total.toFixed(1)}H`;
    data.push(row);
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Planning");
  XLSX.writeFile(wb, `planning_${group}_${weekStartStr}.xlsx`);
}

export function exportToPDF(
  employees: Employee[],
  schedules: Schedule[],
  weekStart: Date,
  group: string
) {
  const weekStartStr = formatDateKey(weekStart);
  const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(18);
  doc.text("PLANNING HEBDOMADAIRE", 14, 20);
  doc.setFontSize(12);
  doc.text(`Semaine du ${weekStartStr} - Groupe ${group}`, 14, 30);

  const body: any[] = [];
  employees.forEach((emp) => {
    const row: any[] = [emp.fullName, emp.position];
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const sch = schedules.find(
        (s) => s.employeeId === emp.id && s.dayOfWeek === i && s.weekStart === weekStartStr && s.group === group
      );
      if (sch?.isOff) {
        row.push("OFF");
      } else if (sch?.startTime && sch?.endTime) {
        total += calculateHours(sch.startTime, sch.endTime);
        row.push(`${sch.startTime?.substring(0, 5)}\n${sch.endTime?.substring(0, 5)}`);
      } else {
        row.push("");
      }
    }
    row.push(`${total.toFixed(1)}H`);
    body.push(row);
  });

  autoTable(doc, {
    head: [["Employé", "Poste", ...dayNames, "Total"]],
    body,
    startY: 40,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [220, 38, 38], textColor: 255 },
    alternateRowStyles: { fillColor: [39, 39, 42] },
  });

  doc.save(`planning_${group}_${weekStartStr}.pdf`);
}

export function parseTime(timeStr: string | null): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h + m / 60;
}

export function importFromExcel(
  file: File,
  onSuccess: (employees: Employee[], schedules: Schedule[]) => void
) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target?.result as ArrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];

    if (json.length < 2) return;

    const headers = json[0];
    const empIdx = headers.findIndex((h) => h?.toString().toLowerCase().includes("employ"));
    const posteIdx = headers.findIndex((h) => h?.toString().toLowerCase().includes("poste"));

    const dayIndices: number[] = [];
    const dayNames = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
    dayNames.forEach((day) => {
      const idx = headers.findIndex((h) => h?.toString().toLowerCase().includes(day));
      dayIndices.push(idx);
    });

    const importedEmployees: Employee[] = [];
    const importedSchedules: Schedule[] = [];
    let empId = 1;
    const weekStart = formatDateKey(getMonday(new Date()));

    for (let i = 1; i < json.length; i++) {
      const row = json[i];
      if (!row[empIdx]) continue;

      const fullName = row[empIdx].toString().trim();
      const position = posteIdx >= 0 ? row[posteIdx]?.toString() || "Employé" : "Employé";

      const emp: Employee = {
        id: empId,
        fullName,
        position,
        group: "A",
        phone: "",
        hourlyRate: null,
        status: "active",
        hireDate: new Date().toISOString().split("T")[0],
        notes: "",
      };
      importedEmployees.push(emp);

      dayIndices.forEach((dayIdx, dayOfWeek) => {
        if (dayIdx < 0) return;
        const cell = row[dayIdx]?.toString().trim() || "";
        if (cell.toUpperCase() === "OFF") {
          importedSchedules.push({
            id: Date.now() + Math.random(),
            employeeId: empId,
            weekStart,
            dayOfWeek,
            startTime: null,
            endTime: null,
            isOff: true,
            group: "A",
          });
        } else if (cell.includes("-") || cell.includes("–")) {
          const sep = cell.includes("–") ? "–" : "-";
          const parts = cell.split(sep).map((s) => s.trim());
          if (parts.length === 2) {
            let start = parts[0];
            let end = parts[1];
            if (start.length === 4 && !start.includes(":")) start = start.slice(0, 2) + ":" + start.slice(2);
            if (end.length === 4 && !end.includes(":")) end = end.slice(0, 2) + ":" + end.slice(2);
            if (!start.includes(":")) start = start + ":00";
            if (!end.includes(":")) end = end + ":00";
            importedSchedules.push({
              id: Date.now() + Math.random(),
              employeeId: empId,
              weekStart,
              dayOfWeek,
              startTime: start,
              endTime: end,
              isOff: false,
              group: "A",
            });
          }
        }
      });

      empId++;
    }

    onSuccess(importedEmployees, importedSchedules);
  };
  reader.readAsArrayBuffer(file);
}

export function importFromCSV(
  file: File,
  onSuccess: (employees: Employee[], schedules: Schedule[]) => void
) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result as string;
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return;

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const empIdx = headers.findIndex((h) => h.toLowerCase().includes("employ"));
    const posteIdx = headers.findIndex((h) => h.toLowerCase().includes("poste"));

    const dayNames = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
    const dayIndices: number[] = [];
    dayNames.forEach((day) => {
      const idx = headers.findIndex((h) => h.toLowerCase().includes(day));
      dayIndices.push(idx);
    });

    const importedEmployees: Employee[] = [];
    const importedSchedules: Schedule[] = [];
    let empId = 1;
    const weekStart = formatDateKey(getMonday(new Date()));

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      if (!row[empIdx]) continue;

      const fullName = row[empIdx];
      const position = posteIdx >= 0 ? row[posteIdx] || "Employé" : "Employé";

      const emp: Employee = {
        id: empId,
        fullName,
        position,
        group: "A",
        phone: "",
        hourlyRate: null,
        status: "active",
        hireDate: new Date().toISOString().split("T")[0],
        notes: "",
      };
      importedEmployees.push(emp);

      dayIndices.forEach((dayIdx, dayOfWeek) => {
        if (dayIdx < 0) return;
        const cell = row[dayIdx] || "";
        if (cell.toUpperCase() === "OFF") {
          importedSchedules.push({
            id: Date.now() + Math.random(),
            employeeId: empId,
            weekStart,
            dayOfWeek,
            startTime: null,
            endTime: null,
            isOff: true,
            group: "A",
          });
        } else if (cell.includes("-") || cell.includes("–")) {
          const sep = cell.includes("–") ? "–" : "-";
          const parts = cell.split(sep).map((s) => s.trim());
          if (parts.length === 2) {
            let start = parts[0];
            let end = parts[1];
            if (!start.includes(":")) start = start.substring(0, 2) + ":" + start.substring(2, 4);
            if (!end.includes(":")) end = end.substring(0, 2) + ":" + end.substring(2, 4);
            importedSchedules.push({
              id: Date.now() + Math.random(),
              employeeId: empId,
              weekStart,
              dayOfWeek,
              startTime: start,
              endTime: end,
              isOff: false,
              group: "A",
            });
          }
        }
      });

      empId++;
    }

    onSuccess(importedEmployees, importedSchedules);
  };
  reader.readAsText(file);
}
