export interface PayrollEmployee {
  id: number;
  fullName: string;
  group: string;
  hourlyRate: number | null;
}

export interface PayrollAttendance {
  employeeId: number;
  date: string;
  workedHours: number;
  expectedHours: number;
  penaltyHours: number;
}

export interface PayrollRow {
  employeeId: number;
  employeeName: string;
  group: string;
  totalHours: number;
  expectedHours: number;
  penaltyHours: number;
  finalHours: number;
  hourlyRate: number | null;
  gross: number | null;
}

/** Build a transparent period summary. Unconfigured tax and bonus rules are not assumed. */
export function calculatePayroll(
  employees: PayrollEmployee[],
  attendance: PayrollAttendance[],
  month: string,
): PayrollRow[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Month must use YYYY-MM format");
  }

  return employees.map((employee) => {
    const records = attendance.filter(
      (record) => record.employeeId === employee.id && record.date.startsWith(`${month}-`),
    );
    const totalHours = records.reduce((sum, record) => sum + record.workedHours, 0);
    const expectedHours = records.reduce((sum, record) => sum + record.expectedHours, 0);
    const penaltyHours = records.reduce((sum, record) => sum + record.penaltyHours, 0);
    const finalHours = Math.max(0, totalHours - penaltyHours);

    if (![totalHours, expectedHours, penaltyHours].every(Number.isFinite)
      || (employee.hourlyRate !== null && (!Number.isFinite(employee.hourlyRate) || employee.hourlyRate < 0))
      || records.some((record) =>
        record.workedHours < 0 || record.expectedHours < 0 || record.penaltyHours < 0)) {
      throw new Error(`Invalid payroll data for ${employee.fullName}`);
    }

    return {
      employeeId: employee.id,
      employeeName: employee.fullName,
      group: employee.group,
      totalHours,
      expectedHours,
      penaltyHours,
      finalHours,
      hourlyRate: employee.hourlyRate,
      gross: employee.hourlyRate === null ? null : Math.round(finalHours * employee.hourlyRate * 100) / 100,
    };
  });
}
