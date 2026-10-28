const STORAGE_KEYS = [
  "rc_employees",
  "rc_schedules",
  "rc_attendance",
  "rc_history",
  "rc_notes",
  "rc_settings",
  "rc_employee_seed_version",
] as const;

type BackupStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createBackup(storage: BackupStorage, createdAt = new Date().toISOString()) {
  const data = Object.fromEntries(STORAGE_KEYS.map((key) => {
    const value = storage.getItem(key);
    return [key, value === null ? null : JSON.parse(value)];
  }));
  return JSON.stringify({ format: "rapid-crousti-backup", version: 1, createdAt, data }, null, 2);
}

export function restoreBackup(storage: BackupStorage, text: string) {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") throw new Error("Fichier de sauvegarde invalide.");
  const backup = parsed as { format?: unknown; version?: unknown; data?: Record<string, unknown> };
  const data = backup.data;
  if (backup.format !== "rapid-crousti-backup" || backup.version !== 1 || !data) {
    throw new Error("Format de sauvegarde RAPID CROUSTI non reconnu.");
  }
  for (const key of STORAGE_KEYS.filter((key) => key !== "rc_settings" && key !== "rc_employee_seed_version")) {
    if (data[key] !== null && !Array.isArray(data[key])) throw new Error(`Données invalides : ${key}.`);
  }
  const settings = data.rc_settings;
  if (settings !== null && (!settings || typeof settings !== "object" || !Array.isArray((settings as { groups?: unknown }).groups))) {
    throw new Error("Paramètres de sauvegarde invalides.");
  }
  if (data.rc_employee_seed_version != null && data.rc_employee_seed_version !== 1 && data.rc_employee_seed_version !== "1") {
    throw new Error("Version de données initiales invalide.");
  }

  const previous = Object.fromEntries(STORAGE_KEYS.map((key) => [key, storage.getItem(key)]));
  try {
    for (const key of STORAGE_KEYS) {
      if (!Object.hasOwn(data, key) || data[key] === null) storage.removeItem(key);
      else storage.setItem(key, JSON.stringify(data[key]));
    }
  } catch (error) {
    for (const key of STORAGE_KEYS) {
      const oldValue = previous[key];
      if (oldValue === null) storage.removeItem(key);
      else if (oldValue !== undefined) storage.setItem(key, oldValue);
    }
    throw error;
  }
}
