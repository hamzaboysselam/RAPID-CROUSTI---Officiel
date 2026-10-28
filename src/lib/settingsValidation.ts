import type { AppSettings } from "./data.ts";
import { isValidClockTime } from "./schedule.ts";

export function validateAppSettings(settings: AppSettings): string | null {
  if (!settings.companyName.trim()) return "Saisissez le nom de l’entreprise.";
  if (!["MAD", "EUR", "USD"].includes(settings.currency)) return "Choisissez une devise prise en charge.";
  if (!Number.isFinite(settings.normalWorkingHours) || settings.normalWorkingHours <= 0 || settings.normalWorkingHours > 24) {
    return "Les heures normales doivent être comprises entre 0 et 24.";
  }
  if ([settings.lateDeduction1to5, settings.lateDeductionOver5, settings.absentDeduction].some((value) => !Number.isFinite(value) || value < 0 || value > 24)) {
    return "Les déductions doivent être comprises entre 0 et 24 heures.";
  }
  if (!settings.groups.length || settings.groups.some((group) => !group.id.trim() || !group.label.trim()
    || !isValidClockTime(group.start) || !isValidClockTime(group.end) || group.start === group.end
    || !/^#[0-9a-f]{6}$/i.test(group.color))) {
    return "Chaque groupe doit avoir un identifiant, un nom, une couleur et des horaires valides et différents.";
  }
  if (new Set(settings.groups.map((group) => group.id.trim().toLowerCase())).size !== settings.groups.length) {
    return "Chaque identifiant de groupe doit être unique.";
  }
  return null;
}
