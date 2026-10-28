"use client";

import { useEffect, useRef, useState } from "react";
import { Save, Building2, Coins, Clock, AlertTriangle, Users, Trash2, Plus, X, Download, Upload } from "lucide-react";
import { getSettings, saveSettings, clearAllData, getEmployees, getSchedules, AppSettings, GroupConfig } from "@/lib/data";
import { createBackup, restoreBackup } from "@/lib/backup";
import { formatDateKey } from "@/lib/utils";
import { isValidClockTime } from "@/lib/schedule";
import { validateAppSettings } from "@/lib/settingsValidation";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [newGroup, setNewGroup] = useState({ id: "", label: "", start: "", end: "", color: "#666666" });
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const backupInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettings(getSettings()));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!settings) return null;

  const handleSave = () => {
    const error = validateAppSettings(settings);
    if (error) return setSettingsError(error);
    setSettingsError("");
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const downloadBackup = () => {
    const blob = new Blob([createBackup(localStorage)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rapid-crousti-backup-${formatDateKey(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (!confirm("Restaurer cette sauvegarde remplacera les données locales actuelles. Une copie de l’état actuel sera téléchargée avant le remplacement. Continuer ?")) return;
      downloadBackup();
      restoreBackup(localStorage, text);
      window.location.reload();
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "La restauration a échoué.");
    } finally {
      event.target.value = "";
    }
  };

  const handleUpdateGroup = (index: number, updates: Partial<GroupConfig>) => {
    const updated = { ...settings, groups: settings.groups.map((g, i) => i === index ? { ...g, ...updates } : g) };
    setSettings(updated);
  };

  const handleDeleteGroup = (index: number) => {
    const group = settings.groups[index];
    if (getEmployees().some((employee) => employee.group === group.id)
      || getSchedules().some((schedule) => schedule.group === group.id)) {
      setSettingsError("Ce groupe est encore utilisé par des employés ou des plannings. Réaffectez-les avant de le supprimer.");
      return;
    }
    if (!confirm("Supprimer ce groupe ?")) return;
    const updated = { ...settings, groups: settings.groups.filter((_, i) => i !== index) };
    setSettings(updated);
    setSettingsError("");
  };

  const handleAddGroup = () => {
    if (!newGroup.id.trim() || !newGroup.label.trim() || !isValidClockTime(newGroup.start)
      || !isValidClockTime(newGroup.end) || newGroup.start === newGroup.end
      || !/^#[0-9a-f]{6}$/i.test(newGroup.color)) {
      setSettingsError("Renseignez un identifiant, un nom, une couleur et des horaires valides et différents.");
      return;
    }
    if (settings.groups.some((group) => group.id.trim().toLowerCase() === newGroup.id.trim().toLowerCase())) {
      setSettingsError("Cet identifiant de groupe existe déjà.");
      return;
    }
    const updated = { ...settings, groups: [...settings.groups, { ...newGroup }] };
    setSettings(updated);
    setSettingsError("");
    setNewGroup({ id: "", label: "", start: "", end: "", color: "#666666" });
    setShowAddGroup(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-white">Paramètres</h1>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-6">
        {/* Company */}
        <div>
          <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Building2 className="w-4 h-4 text-red-500" /> Entreprise</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-zinc-400 mb-1">Nom de l&apos;entreprise</label><input value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-red-500" /></div>
            <div><label className="block text-sm text-zinc-400 mb-1">Devise</label><select value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-red-500"><option value="MAD">MAD</option><option value="EUR">EUR</option><option value="USD">USD</option></select></div>
          </div>
        </div>

        {/* Working Hours */}
        <div>
          <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-yellow-500" /> Heures de travail</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-zinc-400 mb-1">Heures normales / jour</label><input type="number" value={settings.normalWorkingHours} onChange={(e) => setSettings({ ...settings, normalWorkingHours: Number(e.target.value) })} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-red-500" /></div>
          </div>
        </div>

        {/* Penalties */}
        <div>
          <h3 className="text-white font-bold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-500" /> Déductions & Pénalités</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-zinc-400 mb-1">Retard 1-5 min (heures à déduire)</label><input type="number" value={settings.lateDeduction1to5} onChange={(e) => setSettings({ ...settings, lateDeduction1to5: Number(e.target.value) })} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-red-500" /></div>
            <div><label className="block text-sm text-zinc-400 mb-1">Retard &gt;5 min (heures à déduire)</label><input type="number" value={settings.lateDeductionOver5} onChange={(e) => setSettings({ ...settings, lateDeductionOver5: Number(e.target.value) })} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-red-500" /></div>
            <div><label className="block text-sm text-zinc-400 mb-1">Absent (heures à déduire)</label><input type="number" value={settings.absentDeduction} onChange={(e) => setSettings({ ...settings, absentDeduction: Number(e.target.value) })} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-red-500" /></div>
            <div><label className="block text-sm text-zinc-400 mb-1">Règle OFF</label><input value={settings.offRule} onChange={(e) => setSettings({ ...settings, offRule: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-red-500" /></div>
          </div>
        </div>

        {/* Groups */}
        <div>
          <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /> Groupes</h3>
          <div className="space-y-3">
            {settings.groups.map((g, i) => (
              <div key={g.id} className="flex items-center gap-3 bg-zinc-950 rounded-lg p-3 border border-zinc-800">
                <input type="color" value={g.color} onChange={(e) => handleUpdateGroup(i, { color: e.target.value })} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                <input value={g.id} readOnly aria-label={`Identifiant du groupe ${g.label}`} className="w-16 bg-transparent border border-zinc-700 rounded px-2 py-1 text-zinc-500 text-sm" placeholder="ID" />
                <input value={g.label} onChange={(e) => handleUpdateGroup(i, { label: e.target.value })} className="flex-1 bg-transparent border border-zinc-700 rounded px-2 py-1 text-white text-sm" placeholder="Nom" />
                <input type="time" value={g.start} onChange={(e) => handleUpdateGroup(i, { start: e.target.value })} className="w-24 bg-transparent border border-zinc-700 rounded px-2 py-1 text-white text-sm" />
                <span className="text-zinc-500">→</span>
                <input type="time" value={g.end} onChange={(e) => handleUpdateGroup(i, { end: e.target.value })} className="w-24 bg-transparent border border-zinc-700 rounded px-2 py-1 text-white text-sm" />
                <button onClick={() => handleDeleteGroup(i)} className="p-1.5 text-zinc-500 hover:text-red-400"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          {showAddGroup ? (
            <div className="flex items-center gap-3 bg-zinc-950 rounded-lg p-3 border border-zinc-800 mt-3">
              <input type="color" value={newGroup.color} onChange={(e) => setNewGroup({ ...newGroup, color: e.target.value })} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
              <input value={newGroup.id} onChange={(e) => setNewGroup({ ...newGroup, id: e.target.value })} className="w-16 bg-transparent border border-zinc-700 rounded px-2 py-1 text-white text-sm" placeholder="ID" />
              <input value={newGroup.label} onChange={(e) => setNewGroup({ ...newGroup, label: e.target.value })} className="flex-1 bg-transparent border border-zinc-700 rounded px-2 py-1 text-white text-sm" placeholder="Nom" />
              <input type="time" value={newGroup.start} onChange={(e) => setNewGroup({ ...newGroup, start: e.target.value })} className="w-24 bg-transparent border border-zinc-700 rounded px-2 py-1 text-white text-sm" />
              <span className="text-zinc-500">→</span>
              <input type="time" value={newGroup.end} onChange={(e) => setNewGroup({ ...newGroup, end: e.target.value })} className="w-24 bg-transparent border border-zinc-700 rounded px-2 py-1 text-white text-sm" />
              <button onClick={handleAddGroup} className="px-3 py-1 bg-emerald-600 rounded text-white text-sm">Ajouter</button>
              <button onClick={() => setShowAddGroup(false)} className="p-1.5 text-zinc-500"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <button onClick={() => setShowAddGroup(true)} className="mt-3 flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"><Plus className="w-4 h-4" /> Ajouter un groupe</button>
          )}
        </div>

        {/* Colors */}
        <div>
          <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Coins className="w-4 h-4 text-emerald-500" /> Couleurs</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-zinc-400 mb-1">Couleur principale</label><div className="flex items-center gap-2"><input type="color" value={settings.primaryColor} onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })} className="w-10 h-10 rounded cursor-pointer bg-transparent border-0" /><span className="text-zinc-300 text-sm">{settings.primaryColor}</span></div></div>
            <div><label className="block text-sm text-zinc-400 mb-1">Couleur secondaire</label><div className="flex items-center gap-2"><input type="color" value={settings.secondaryColor} onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })} className="w-10 h-10 rounded cursor-pointer bg-transparent border-0" /><span className="text-zinc-300 text-sm">{settings.secondaryColor}</span></div></div>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-4 border-t border-zinc-800">
          <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium transition-colors"><Save className="w-4 h-4" /> Enregistrer</button>
          {saved && <span className="text-emerald-400 text-sm">Paramètres enregistrés !</span>}
        </div>
        {settingsError && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{settingsError}</p>}
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <h3 className="text-white font-bold mb-2">Sauvegarde des données locales</h3>
        <p className="text-zinc-400 text-sm mb-4">Les données restent dans ce navigateur. Téléchargez régulièrement une sauvegarde JSON et conservez-la dans un emplacement sûr.</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={downloadBackup} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white"><Download className="w-4 h-4" /> Télécharger la sauvegarde</button>
          <button onClick={() => backupInput.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white"><Upload className="w-4 h-4" /> Restaurer une sauvegarde</button>
          <input ref={backupInput} type="file" accept="application/json,.json" onChange={handleRestore} className="hidden" />
        </div>
        {backupMessage && <p role="alert" className="mt-3 text-sm text-red-400">{backupMessage}</p>}
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <h3 className="text-white font-bold mb-3 text-sm uppercase tracking-wider">Zone dangereuse</h3>
        <p className="text-zinc-400 text-sm mb-4">Supprimer toutes les données stockées localement.</p>
        <button onClick={() => { if (confirm("Supprimer TOUTES les données ?")) { clearAllData(); setSaved(true); setTimeout(() => setSaved(false), 3000); } }} className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 rounded-lg text-sm text-red-400 font-medium transition-colors"><Trash2 className="w-4 h-4" /> Effacer toutes les données</button>
      </div>
    </div>
  );
}
