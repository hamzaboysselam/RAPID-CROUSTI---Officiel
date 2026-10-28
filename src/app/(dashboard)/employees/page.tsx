"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, X, User, Phone, Calendar } from "lucide-react";
import { getEmployees, saveEmployees, getGroups, generateId, Employee, GroupConfig } from "@/lib/data";
import { normalizeEmployeeName } from "@/lib/employeeSeeds";
import { formatDateKey } from "@/lib/utils";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups] = useState<GroupConfig[]>([]);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    position: "Serveur",
    group: "A",
    phone: "",
    hourlyRate: "",
    status: "active" as "active" | "inactive",
    hireDate: formatDateKey(new Date()),
    notes: "",
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setEmployees(getEmployees());
      setGroups(getGroups());
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const all = getEmployees();
    const fullName = form.fullName.trim();
    const hourlyRate = form.hourlyRate.trim() === "" ? null : Number(form.hourlyRate);
    if (!fullName) {
      setFormError("Saisissez un nom complet.");
      return;
    }
    if (all.some((employee) => employee.id !== editing?.id && normalizeEmployeeName(employee.fullName) === normalizeEmployeeName(fullName))) {
      setFormError("Un employé porte déjà ce nom.");
      return;
    }
    if (hourlyRate !== null && (!Number.isFinite(hourlyRate) || hourlyRate < 0)) {
      setFormError("Le taux horaire doit être un nombre positif ou nul.");
      return;
    }
    if (editing) {
      const updated = all.map((emp) => (emp.id === editing.id ? { ...editing, ...form, fullName, hourlyRate } : emp));
      saveEmployees(updated);
    } else {
      const newEmp: Employee = {
        id: generateId(),
        fullName,
        position: form.position,
        group: form.group,
        phone: form.phone,
        hourlyRate,
        status: form.status,
        hireDate: form.hireDate,
        notes: form.notes,
      };
      saveEmployees([...all, newEmp]);
    }
    setShowModal(false);
    setEditing(null);
    setFormError("");
    setForm({ fullName: "", position: "Serveur", group: "A", phone: "", hourlyRate: "", status: "active", hireDate: formatDateKey(new Date()), notes: "" });
    setEmployees(getEmployees());
  };

  const handleDelete = (id: number) => {
    if (!confirm("Supprimer cet employé ?")) return;
    const updated = getEmployees().filter((e) => e.id !== id);
    saveEmployees(updated);
    setEmployees(updated);
  };

  const handleEdit = (emp: Employee) => {
    setEditing(emp);
    setFormError("");
    setForm({
      fullName: emp.fullName,
      position: emp.position,
      group: emp.group,
      phone: emp.phone,
      hourlyRate: emp.hourlyRate == null ? "" : String(emp.hourlyRate),
      status: emp.status,
      hireDate: emp.hireDate,
      notes: emp.notes,
    });
    setShowModal(true);
  };

  const filtered = employees.filter((e) => {
    const matchSearch = `${e.fullName} ${e.position} ${e.phone}`.toLowerCase().includes(search.toLowerCase());
    const matchGroup = groupFilter === "all" || e.group === groupFilter;
    return matchSearch && matchGroup;
  });

  const groupCounts: Record<string, number> = {};
  groups.forEach((g) => { groupCounts[g.id] = employees.filter((e) => e.group === g.id).length; });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Employés</h1>
        <button onClick={() => { setEditing(null); setFormError(""); setForm({ fullName: "", position: "Serveur", group: "A", phone: "", hourlyRate: "", status: "active", hireDate: formatDateKey(new Date()), notes: "" }); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium transition-colors">
          <Plus className="w-4 h-4" /> Ajouter un employé
        </button>
      </div>

      <div className="flex gap-3">
        {groups.map((g) => (
          <div key={g.id} className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
            <span className="text-zinc-300 text-sm">{g.label}:</span>
            <span className="text-white font-bold">{groupCounts[g.id] || 0}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full sm:w-80 bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:ring-2 focus:ring-red-500">
          <option value="all">Tous les groupes</option>
          {groups.map((g) => (<option key={g.id} value={g.id}>{g.label}</option>))}
        </select>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-800">
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Employé</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Poste</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Groupe</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Téléphone</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Taux/H</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Embauche</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Statut</th>
                <th className="px-4 py-3 text-right text-zinc-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => {
                const gc = groups.find((g) => g.id === emp.group);
                return (
                  <tr key={emp.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-white font-bold text-sm">{emp.fullName.charAt(0)}</div>
                        <div><p className="font-medium text-white">{emp.fullName}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{emp.position}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: (gc?.color || "#666") + "20", color: gc?.color || "#999" }}>{gc?.label || emp.group}</span></td>
                    <td className="px-4 py-3 text-zinc-300 text-xs">{emp.phone}</td>
                    <td className="px-4 py-3 text-zinc-300">{emp.hourlyRate == null ? "À définir" : `${emp.hourlyRate} MAD`}</td>
                    <td className="px-4 py-3 text-zinc-300 text-xs">{emp.hireDate}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${emp.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-700 text-zinc-400"}`}>{emp.status === "active" ? "Actif" : "Inactif"}</span></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(emp)} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(emp.id)} className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center py-12 text-zinc-500"><User className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Aucun employé trouvé</p></div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">{editing ? "Modifier" : "Ajouter"} un employé</h3>
              <button onClick={() => { setShowModal(false); setFormError(""); }} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{formError}</p>}
              <div><label className="block text-sm text-zinc-400 mb-1">Nom complet</label><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-red-500" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-zinc-400 mb-1">Poste</label><select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-red-500"><option>Serveur</option><option>Cuisinier</option><option>Caissier</option><option>Manager</option><option>Livreur</option></select></div>
                <div><label className="block text-sm text-zinc-400 mb-1">Groupe</label><select value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-red-500">{groups.map((g) => (<option key={g.id} value={g.id}>{g.label}</option>))}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-zinc-400 mb-1">Téléphone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-red-500" /></div>
                <div><label className="block text-sm text-zinc-400 mb-1">Taux horaire (MAD, facultatif)</label><input type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-red-500" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-zinc-400 mb-1">Date d&apos;embauche</label><input type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-red-500" /></div>
                <div><label className="block text-sm text-zinc-400 mb-1">Statut</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-red-500"><option value="active">Actif</option><option value="inactive">Inactif</option></select></div>
              </div>
              <div><label className="block text-sm text-zinc-400 mb-1">Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-red-500 resize-none" /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors">Annuler</button>
                <button type="submit" className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium transition-colors">{editing ? "Modifier" : "Ajouter"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
