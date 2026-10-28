import { test } from "node:test";
import assert from "node:assert/strict";
import { INITIAL_EMPLOYEES, initializeEmployees, mergeInitialEmployees } from "./employeeSeeds.ts";

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, String(value)); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test("initial roster has all supplied names and correct team group assignment", () => {
  const morning = [
    "UTHAYMIN STITOU", "YOUSSEF SELMAN", "OBEYED ALLAH STITOU", "MAROUANE NACER",
    "BADER EL OUAFY", "YAHYA EL HADIRI", "EL LADJI NIR",
  ];
  const eveningNight = [
    "ELKANDI HAMZA", "ABDESALAM HAKKI", "MOUHSSIN KARICH", "HAMZA BOUSSLAM",
    "YAKHYA KOUNTA", "BASSAKA MOHAMMED", "KANE MOSSA", "OUSSAMA OUIATFAROUIN",
    "ABDESAMIE SAHRAOUI", "FAHD EL BADOUY", "AMR MANSOURI",
  ];
  assert.equal(INITIAL_EMPLOYEES.length, 18);
  assert.deepEqual(INITIAL_EMPLOYEES.filter((employee) => employee.group === "A").map((employee) => employee.fullName), morning);
  assert.deepEqual(INITIAL_EMPLOYEES.filter((employee) => employee.group === "B").map((employee) => employee.fullName), eveningNight);
  assert.ok(INITIAL_EMPLOYEES.every((employee) => employee.hourlyRate === null));
  assert.ok(INITIAL_EMPLOYEES.every((employee) => employee.phone === "" && employee.hireDate === ""));
});

test("seed merge is idempotent, stable, and leaves existing employee records untouched", () => {
  const existing = [{ ...INITIAL_EMPLOYEES[0], id: 77, fullName: "  Uthaymin   Stitou ", hourlyRate: 41, group: "B" }];
  const first = mergeInitialEmployees(existing);
  const second = mergeInitialEmployees(first);
  assert.equal(first.length, 18);
  assert.deepEqual(second, first);
  assert.deepEqual(first[0], existing[0]);
});

test("seed IDs avoid collisions without overwriting unrelated records", () => {
  const existing = [{ ...INITIAL_EMPLOYEES[0], fullName: "Other Employee" }];
  const merged = mergeInitialEmployees(existing);
  assert.equal(merged[0].fullName, "Other Employee");
  assert.notEqual(merged.find((employee) => employee.fullName === INITIAL_EMPLOYEES[0].fullName)?.id, existing[0].id);
});

test("browser initialization persists the roster once and does not restore a later deletion", () => {
  const existing = { ...INITIAL_EMPLOYEES[0], id: 42, fullName: "Existing Person" };
  const storage = createMemoryStorage({ rc_employees: JSON.stringify([existing]) });
  const firstRead = initializeEmployees(storage);
  assert.equal(firstRead.length, 19);
  assert.deepEqual(firstRead[0], existing);
  assert.deepEqual(initializeEmployees(storage), firstRead);

  const afterDelete = firstRead.filter((employee) => employee.fullName !== INITIAL_EMPLOYEES[1].fullName);
  storage.setItem("rc_employees", JSON.stringify(afterDelete));
  assert.equal(initializeEmployees(storage).some((employee) => employee.fullName === INITIAL_EMPLOYEES[1].fullName), false);
  assert.equal(JSON.parse(storage.getItem("rc_employees")!).length, 18);
});

test("invalid stored employee JSON is left untouched", () => {
  const storage = createMemoryStorage({ rc_employees: "not-json" });
  assert.deepEqual(initializeEmployees(storage), []);
  assert.equal(storage.getItem("rc_employees"), "not-json");
  assert.equal(storage.getItem("rc_employee_seed_version"), null);
});
