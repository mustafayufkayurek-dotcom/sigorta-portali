'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { applyNameWithAutoCode, suggestAutoCode } from '@/utils/auto-code';
import { TANIMLAR_BACK_HREF, TANIMLAR_BACK_TEXT } from '@/utils/settings-definition-nav';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import {
  DepartmentContextBand,
  DepartmentDefinitionToolbar,
  DepartmentTabSelector,
  type DepartmentTab,
} from '@/components/settings/DepartmentTabSelector';
import {
  EditButton,
  DeleteButton,
  StatusBadge,
  SettingsTable,
  SettingsTableHead,
  SettingsTableTh,
  SettingsTableBody,
  SettingsTableRow,
  SettingsTableTd,
  SettingsTableActions,
  inputCls,
  labelCls,
} from '@/components/settings/SettingsUI';
import { SettingsModal, DeleteConfirmDialog } from '@/components/settings/SettingsModal';
import type { TableColumnDef } from '@/components/ui/TableColumnPicker';
import { SettingsTableColumnsProvider, SettingsTableColumnPicker } from '@/components/settings/SettingsTableColumns';

const TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'sort', label: 'Sıra', defaultWidth: 64, minWidth: 48 },
  { id: 'name', label: 'Konu Adı', defaultWidth: 220, minWidth: 140 },
  { id: 'status', label: 'Durum', defaultWidth: 100, minWidth: 80 },
];

type Department = DepartmentTab & { code: string; reportFormat: string; isSystem: boolean };
type FileSubject = { id: string; code: string; name: string; sortOrder: number; isSystem: boolean; status: string };

const emptyForm = { code: '', name: '', sortOrder: 0, status: 'active', departmentId: '' };

export default function DosyaKonulariPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [subjects, setSubjects] = useState<FileSubject[]>([]);
  const [deptCounts, setDeptCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FileSubject | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FileSubject | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refreshCounts = useCallback(async (depts: Department[]) => {
    try {
      const entries = await Promise.all(
        depts.map(async (d) => {
          const res = await axios.get(`${API}/departments/${d.id}/file-subjects`, { headers: authHeader() });
          return [d.id, (res.data.data ?? []).length] as const;
        }),
      );
      setDeptCounts(Object.fromEntries(entries));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    axios.get(`${API}/departments`, { headers: authHeader() })
      .then((r) => {
        const depts: Department[] = r.data.data ?? [];
        setDepartments(depts);
        if (depts.length > 0) setSelectedDept(depts[0]);
        if (depts.length > 0) refreshCounts(depts);
      })
      .catch(console.error);
  }, [refreshCounts]);

  const fetchSubjects = useCallback(async (deptId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/departments/${deptId}/file-subjects`, { headers: authHeader() });
      const data: FileSubject[] = res.data.data ?? [];
      setSubjects(data);
      setDeptCounts((prev) => ({ ...prev, [deptId]: data.length }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDept) fetchSubjects(selectedDept.id);
  }, [selectedDept, fetchSubjects]);

  const filteredSubjects = search.trim()
    ? subjects.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()))
    : subjects;

  const modalDept = departments.find((d) => d.id === form.departmentId) ?? selectedDept;

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      departmentId: selectedDept?.id ?? '',
    });
    setError('');
    setShowModal(true);
  };

  const openEdit = (s: FileSubject) => {
    setEditing(s);
    setForm({
      code: s.code,
      name: s.name,
      sortOrder: s.sortOrder,
      status: s.status,
      departmentId: selectedDept?.id ?? '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    const deptId = form.departmentId || selectedDept?.id;
    if (!deptId) {
      setError('Departman seçilmelidir');
      return;
    }
    const dept = departments.find((d) => d.id === deptId);
    const code = editing ? form.code : (form.code.trim() || suggestAutoCode(dept?.code ?? 'KONU', form.name));
    if (!code || !form.name.trim()) {
      setError('Kod ve ad zorunludur');
      return;
    }
    const dupName = subjects.find((s) =>
      s.name.trim().toLowerCase() === form.name.trim().toLowerCase() && (!editing || s.id !== editing.id),
    );
    if (dupName && deptId === selectedDept?.id) {
      setError('Bu departmanda aynı isimde bir dosya konusu zaten mevcut');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await axios.put(`${API}/department-file-subjects/${editing.id}`, {
          code,
          name: form.name,
          sortOrder: form.sortOrder,
          status: form.status,
        }, { headers: authHeader() });
      } else {
        await axios.post(`${API}/departments/${deptId}/file-subjects`, {
          code,
          name: form.name,
          sortOrder: form.sortOrder,
        }, { headers: authHeader() });
      }
      setShowModal(false);
      if (deptId === selectedDept?.id) {
        fetchSubjects(deptId);
      } else {
        setSelectedDept(dept ?? null);
      }
      refreshCounts(departments);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? 'Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (s: FileSubject) => {
    const newStatus = s.status === 'active' ? 'inactive' : 'active';
    try {
      await axios.put(`${API}/department-file-subjects/${s.id}`, { status: newStatus }, { headers: authHeader() });
      if (selectedDept) fetchSubjects(selectedDept.id);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? 'Durum değiştirilemedi');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/department-file-subjects/${deleteTarget.id}`, { headers: authHeader() });
      setDeleteTarget(null);
      if (selectedDept) fetchSubjects(selectedDept.id);
      refreshCounts(departments);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? 'Silinemedi');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsTableColumnsProvider columns={TABLE_COLUMNS}>
      {(tableColumns) => (
    <SettingsPageLayout
      title="Dosya Konuları"
      description="Departman bazlı dosya konularını tanımlayın. İhbar konuları bu ekranda birleştirildi."
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
      headerExtra={
        <div className="flex items-center gap-2">
          <SettingsTableColumnPicker tableColumns={tableColumns} />
          {selectedDept ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Konu Ekle
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <DepartmentTabSelector
          departments={departments}
          selectedId={selectedDept?.id ?? null}
          onSelect={(d) => setSelectedDept(departments.find((x) => x.id === d.id) ?? null)}
          counts={deptCounts}
        />

        <DepartmentDefinitionToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Departman veya dosya konusu ara..."
          hierarchyChild="Dosya Konusu"
        />

        {!selectedDept ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            Üstten bir departman seçin
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: selectedDept.color }} />
                <p className="font-semibold text-slate-900 truncate">{selectedDept.name}</p>
                <span className="text-sm text-slate-400 shrink-0">— Dosya Konuları</span>
              </div>
              <button
                type="button"
                onClick={openCreate}
                className="sm:hidden text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 shrink-0"
              >
                + Konu Ekle
              </button>
            </div>

            <SettingsTable
              loading={loading}
              empty={filteredSubjects.length === 0}
              emptyText={
                search.trim()
                  ? 'Arama sonucu bulunamadı.'
                  : 'Bu departman için henüz dosya konusu tanımlanmamış.'
              }
            >
              <SettingsTableHead>
                <SettingsTableTh colId="sort" className="w-16">Sıra</SettingsTableTh>
                <SettingsTableTh colId="name">Konu Adı</SettingsTableTh>
                <SettingsTableTh colId="status">Durum</SettingsTableTh>
                <SettingsTableTh />
              </SettingsTableHead>
              <SettingsTableBody>
                {filteredSubjects.map((s) => (
                  <SettingsTableRow key={s.id}>
                    <SettingsTableTd colId="sort" className="w-16 text-slate-600">{s.sortOrder}</SettingsTableTd>
                    <SettingsTableTd colId="name">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{s.name}</span>
                        {s.isSystem && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">Sistem</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">{s.code}</p>
                    </SettingsTableTd>
                    <SettingsTableTd colId="status">
                      <button type="button" onClick={() => handleToggleStatus(s)}>
                        <StatusBadge active={s.status === 'active'} />
                      </button>
                    </SettingsTableTd>
                    <SettingsTableActions>
                      <EditButton onClick={() => openEdit(s)} />
                      {!s.isSystem && <DeleteButton onClick={() => setDeleteTarget(s)} />}
                    </SettingsTableActions>
                  </SettingsTableRow>
                ))}
              </SettingsTableBody>
            </SettingsTable>
          </div>
        )}
      </div>

      <SettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Dosya Konusu Düzenle' : 'Yeni Dosya Konusu'}
        onSave={handleSave}
        saving={saving}
        error={error}
      >
        {!editing && (
          <div>
            <label className={labelCls}>Departman *</label>
            <select
              className={`${inputCls} bg-white`}
              value={form.departmentId}
              onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value }))}
            >
              <option value="">Departman seçin...</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1.5">
              Bu konu hangi departmana ait olacak? Örn: Dahili Su → Hasar Onarım
            </p>
          </div>
        )}
        {modalDept && !editing && (
          <DepartmentContextBand name={modalDept.name} color={modalDept.color} code={modalDept.code} />
        )}
        {editing && selectedDept && (
          <DepartmentContextBand name={selectedDept.name} color={selectedDept.color} code={selectedDept.code} />
        )}
        <div>
          <label className={labelCls}>Kod</label>
          <input
            className={`${inputCls} disabled:bg-slate-50`}
            value={form.code}
            disabled
            placeholder={editing ? 'KONU_KODU' : 'Ad yazınca otomatik üretilir'}
          />
        </div>
        <div>
          <label className={labelCls}>Konu Adı *</label>
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) =>
              setForm((p) =>
                applyNameWithAutoCode(
                  p,
                  e.target.value,
                  !!editing,
                  modalDept?.code ?? selectedDept?.code ?? 'KONU',
                ),
              )
            }
            placeholder="Örn: Dahili Su, Yangın"
          />
        </div>
        <div>
          <label className={labelCls}>Sıra No</label>
          <input
            type="number"
            className={inputCls}
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
          />
        </div>
        {editing && (
          <div>
            <label className={labelCls}>Durum</label>
            <select
              className={`${inputCls} bg-white`}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </select>
          </div>
        )}
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
        itemName={deleteTarget?.name}
      />
    </SettingsPageLayout>
      )}
    </SettingsTableColumnsProvider>
  );
}
