import assert from "node:assert/strict";
import test from "node:test";
import type { AppSettings } from "./data.ts";
import { validateAppSettings } from "./settingsValidation.ts";

const validSettings: AppSettings = {
  companyName: "RAPID CROUSTI",
  currency: "MAD",
  normalWorkingHours: 8,
  lateDeduction1to5: 2,
  lateDeductionOver5: 4,
  absentDeduction: 8,
  offRule: "Aucune déduction",
  groups: [{ id: "A", label: "Matin", start: "11:00", end: "19:30", color: "#eab308" }],
  primaryColor: "#ef4444",
  secondaryColor: "#eab308",
};

test("accepts valid settings and overnight shifts", () => {
  assert.equal(validateAppSettings(validSettings), null);
  assert.equal(validateAppSettings({
    ...validSettings,
    groups: [{ ...validSettings.groups[0], start: "19:30", end: "04:00" }],
  }), null);
});

test("rejects invalid working hours, deductions, and currencies", () => {
  assert.match(validateAppSettings({ ...validSettings, normalWorkingHours: 0 })!, /heures normales/);
  assert.match(validateAppSettings({ ...validSettings, lateDeductionOver5: -1 })!, /déductions/);
  assert.match(validateAppSettings({ ...validSettings, currency: "XXX" })!, /devise/);
});

test("rejects empty, duplicate, or invalid shift groups", () => {
  assert.match(validateAppSettings({ ...validSettings, groups: [] })!, /groupe/);
  assert.match(validateAppSettings({
    ...validSettings,
    groups: [...validSettings.groups, { ...validSettings.groups[0], id: "a" }],
  })!, /unique/);
  assert.match(validateAppSettings({
    ...validSettings,
    groups: [{ ...validSettings.groups[0], start: "12:00", end: "12:00" }],
  })!, /horaires/);
});
