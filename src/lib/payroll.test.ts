import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePayroll } from "./payroll.ts";

const employees = [{ id: 1, fullName: "Test Employee", group: "A", hourlyRate: 25 }];

test("payroll summarizes only the selected month and applies explicit hour penalties", () => {
  const rows = calculatePayroll(employees, [
    { employeeId: 1, date: "2026-10-01", workedHours: 8, expectedHours: 8, penaltyHours: 2 },
    { employeeId: 1, date: "2026-10-02", workedHours: 7.5, expectedHours: 8, penaltyHours: 0 },
    { employeeId: 1, date: "2026-09-30", workedHours: 8, expectedHours: 8, penaltyHours: 0 },
  ], "2026-10");

  assert.equal(rows[0].totalHours, 15.5);
  assert.equal(rows[0].expectedHours, 16);
  assert.equal(rows[0].penaltyHours, 2);
  assert.equal(rows[0].finalHours, 13.5);
  assert.equal(rows[0].gross, 337.5);
});

test("payroll does not produce negative pay when penalties exceed worked hours", () => {
  const [row] = calculatePayroll(employees, [
    { employeeId: 1, date: "2026-10-01", workedHours: 2, expectedHours: 8, penaltyHours: 8 },
  ], "2026-10");
  assert.equal(row.finalHours, 0);
  assert.equal(row.gross, 0);
});

test("payroll rejects invalid month and negative source values", () => {
  assert.throws(() => calculatePayroll(employees, [], "October 2026"), /YYYY-MM/);
  assert.throws(() => calculatePayroll(employees, [
    { employeeId: 1, date: "2026-10-01", workedHours: -1, expectedHours: 8, penaltyHours: 0 },
  ], "2026-10"), /Invalid payroll data/);
});

test("payroll marks unknown hourly rates instead of inventing a gross amount", () => {
  const [row] = calculatePayroll([{ ...employees[0], hourlyRate: null }], [
    { employeeId: 1, date: "2026-10-01", workedHours: 8, expectedHours: 8, penaltyHours: 0 },
  ], "2026-10");
  assert.equal(row.hourlyRate, null);
  assert.equal(row.gross, null);
});
