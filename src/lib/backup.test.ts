import { test } from "node:test";
import assert from "node:assert/strict";
import { createBackup, restoreBackup } from "./backup.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test("backup round-trips all application data stores", () => {
  const storage = memoryStorage();
  storage.setItem("rc_employees", JSON.stringify([{ id: 1 }]));
  storage.setItem("rc_settings", JSON.stringify({ groups: [] }));
  const backup = createBackup(storage, "2026-10-01T00:00:00.000Z");
  storage.setItem("rc_employees", "[]");
  restoreBackup(storage, backup);
  assert.equal(storage.getItem("rc_employees"), '[{"id":1}]');
  assert.equal(storage.getItem("rc_settings"), '{"groups":[]}');
});

test("invalid backup is rejected without changing stored records", () => {
  const storage = memoryStorage();
  storage.setItem("rc_employees", "[{\"id\":1}]");
  assert.throws(() => restoreBackup(storage, JSON.stringify({ format: "rapid-crousti-backup", version: 1, data: {} })));
  assert.equal(storage.getItem("rc_employees"), '[{"id":1}]');
});
