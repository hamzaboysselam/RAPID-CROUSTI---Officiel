import type { Employee } from "./data";

/** Initial roster transcribed from the user's confirmed employee list. */
export const INITIAL_EMPLOYEES: Employee[] = [
  { id: 920001, fullName: "UTHAYMIN STITOU", position: "Employé", group: "A", phone: "", hourlyRate: null, status: "active", hireDate: "", notes: "" },
  { id: 920002, fullName: "YOUSSEF SELMAN", position: "Employé", group: "A", phone: "", hourlyRate: null, status: "active", hireDate: "", notes: "" },
  { id: 920003, fullName: "OBEYED ALLAH STITOU", position: "Employé", group: "A", phone: "", hourlyRate: null, status: "active", hireDate: "", notes: "" },
  { id: 920004, fullName: "MAROUANE NACER", position: "Employé", group: "A", phone: "", hourlyRate: null, status: "active", hireDate: "", notes: "" },
  { id: 920005, fullName: "BADER EL OUAFY", position: "Employé", group: "A", phone: "", hourlyRate: null, status: "active", hireDate: "", notes: "" },
  { id: 920006, fullName: "YAHYA EL HADIRI", position: "Employé", group: "A", phone: "", hourlyRate: null, status: "active", hireDate: "", notes: "" },
  { id: 920007, fullName: "EL LADJI NIR", position: "Employé", group: "A", phone: "", hourlyRate: null, status: "active", hireDate: "", notes: "" },
  { id: 920008, fullName: "ELKANDI HAMZA", position: "Employé", group: "B", phone: "", hourlyRate: null, status: "active", hireDate: "", notes: "" },
  { id: 920009, fullName: "ABDESALAM HAKKI", position: "Employé", group: "B", phone: "", hourlyRate: null, status: "active", hireDate: "", notes: "" },
  { id: 920010, fullName: "MOUHSSIN KARICH", position: "Employé", group: "B", phone: "", hourlyRate: null, status: "active", hireDate: "", notes: "" },
  { id: 920011, fullName: "HAMZA BOUSSLAM", position: "Employé", group: "B", phone: "", hourlyRate: null, status: "active", hireDate: "", notes: "" },
  { id: 920012, fullName: "YAKHYA KOUNTA", position: "Employé", group: "B", phone: "", hourlyRate: null, status: "active", hireDate: "", notes: "" },
  { id: 920013, fullName: "BASSAKA MOHAMMED", position: "Employé", group: "B", phone: "", hourlyRate: null, status: "active", hireDate: "", notes: "" },
  { id: 920014, fullName: "KANE MOSSA", position: "Employé", group: "B", phone: "", hourlyRate: null, hireDate: "", status: "active", notes: "" },
  { id: 920015, fullName: "OUSSAMA OUIATFAROUIN", position: "Employé", group: "B", phone: "", hourlyRate: null, status: "active", hireDate: "", notes: "" },
  { id: 920016, fullName: "ABDESAMIE SAHRAOUI", position: "Employé", group: "B", phone: "", hourlyRate: null, status: "active", hireDate: "", notes: "" },
  { id: 920017, fullName: "FAHD EL BADOUY", position: "Employé", group: "B", phone: "", hourlyRate: null, status: "active", hireDate: "", notes: "" },
  { id: 920018, fullName: "AMR MANSOURI", position: "Employé", group: "B", phone: "", hourlyRate: null, status: "active", hireDate: "", notes: "" },
];

export function normalizeEmployeeName(name: string) {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleUpperCase("fr-MA");
}

/** Add seed rows by normalized name, without changing any existing row. */
export function mergeInitialEmployees(existing: Employee[], seeds = INITIAL_EMPLOYEES): Employee[] {
  const merged = [...existing];
  const knownNames = new Set(existing.map((employee) => normalizeEmployeeName(employee.fullName)));

  for (const seed of seeds) {
    const key = normalizeEmployeeName(seed.fullName);
    if (!key || knownNames.has(key)) continue;

    let id = seed.id;
    while (merged.some((employee) => employee.id === id)) id++;
    merged.push({ ...seed, id });
    knownNames.add(key);
  }
  return merged;
}

type EmployeeSeedStorage = Pick<Storage, "getItem" | "setItem">;

/** Read and persist the initial roster once, preserving malformed data for recovery. */
export function initializeEmployees(storage: EmployeeSeedStorage, seeds = INITIAL_EMPLOYEES): Employee[] {
  let existing: Employee[] = [];
  let seedVersion: string | null;
  try {
    const raw = storage.getItem("rc_employees");
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      existing = parsed as Employee[];
    }
    seedVersion = storage.getItem("rc_employee_seed_version");
  } catch {
    return [];
  }
  if (seedVersion === "1") return existing;

  const merged = mergeInitialEmployees(existing, seeds);
  try {
    storage.setItem("rc_employees", JSON.stringify(merged));
    storage.setItem("rc_employee_seed_version", "1");
  } catch {
    // Keep this session usable if browser storage is unavailable or full.
  }
  return merged;
}
