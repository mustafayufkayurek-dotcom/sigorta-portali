'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { suggestAutoCode, applyNameWithAutoCode } from '@/utils/auto-code';
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
  { id: 'name', label: 'Ad', defaultWidth: 200, minWidth: 120 },
  { id: 'description', label: 'Açıklama', defaultWidth: 180, minWidth: 100 },
  { id: 'required', label: 'Zorunlu', defaultWidth: 90, minWidth: 70 },
  { id: 'sort', label: 'Sıra', defaultWidth: 70, minWidth: 56 },
  { id: 'count', label: 'Evrak Sayısı', defaultWidth: 100, minWidth: 80 },
  { id: 'status', label: 'Durum', defaultWidth: 90, minWidth: 70 },
];

type Department = DepartmentTab & { code: string };

type DocumentType = {
  id: string;
  code: string;
  name: string;
  description?: string;
  isRequired: boolean;
  sortOrder: number;
  status: string;
  departmentIds?: string[];
  _count?: { vendorDocuments: number };
};

const emptyForm = {
  code: '',
  name: '',
  description: '',
  isRequired: false,
  sortOrder: 0,
  departmentId: '',
};

function parseIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
  return [];
}

export default function EvrakTurleriPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [deptCounts, setDeptCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DocumentType | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DocumentType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refreshCounts = useCallback(async (depts: Department[]) => {
    try {
      const entries = await Promise.all(
        depts.map(async (d) => {
          const res = await axios.get(`${API}/document-types`, {
            headers: authHeader(),
            params: { departmentId: d.id },
          });
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

  const fetchTypes = useCallback(async (deptId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/document-types`, {
        headers: authHeader(),
        params: { departmentId: deptId },
      });
      const data = (res.data.data ?? []).map((t: DocumentType) => ({
        ...t,
        departmentIds: parseIds(t.departmentIds),
      }));
      setTypes(data);
      setDeptCounts((prev) => ({ ...prev, [deptId]: data.length }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDept) fetchTypes(selectedDept.id);
  }, [selectedDept, fetchTypes]);

  const filteredTypes = search.trim()
    ? types.filter((t) =>
        t.name.toLowerCase().includes(search.trim().toLowerCase()) ||
        (t.description ?? '').toLowerCase().includes(search.trim().toLowerCase()),
      )
    : types;

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

  const openEdit = (dt: DocumentType) => {
    setEditing(dt);
    const deptIds = parseIds(dt.departmentIds);
    setForm({
      code: dt.code,
      name: dt.name,
      description: dt.description ?? '',
      isRequired: dt.isRequired,
      sortOrder: dt.sortOrder,
      departmentId: deptIds[0] ?? selectedDept?.id ?? '',
    });
    setError('');
    setShowModal(true);
  };

  const handleNameChange = (name: string) => {
    setForm((p) => applyNameWithAutoCode(p, name, !!editing, 'EVRAK'));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Ad alanı zorunludur'); return; }
    if (!form.departmentId) { setError('Departman seçilmelidir'); return; }
    const code = (editing ? form.code : suggestAutoCode('EVRAK', form.name)).trim();
    if (!code) { setError('Kod üretilemedi'); return; }
    const dupName = types.find((t) =>
      t.name.trim().toLowerCase() === form.name.trim().toLowerCase() && (!editing || t.id !== editing.id),
    );
    if (dupName) { setError('Bu departmanda aynı isimde bir evrak türü zaten mevcut'); return; }
    setSaving(true);
    setError('');
    const payload = {
      code,
      name: form.name,
      description: form.description || undefined,
      isRequired: form.isRequired,
      sortOrder: form.sortOrder,
      departmentIds: [form.departmentId],
    };
    const targetDeptId = form.departmentId;
    try {
      if (editing) {
        await axios.put(`${API}/document-types/${editing.id}`, payload, { headers: authHeader() });
      } else {
        await axios.post(`${API}/document-types`, payload, { headers: authHeader() });
      }
      setShowModal(false);
      if (targetDeptId === selectedDept?.id) {
        fetchTypes(targetDeptId);
      } else {
        setSelectedDept(departments.find((d) => d.id === targetDeptId) ?? null);
      }
      refreshCounts(departments);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? 'Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/document-types/${deleteTarget.id}`, { headers: authHeader() });
      setDeleteTarget(null);
      if (selectedDept) fetchTypes(selectedDept.id);
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
      title="Evrak Türleri"
      description="Departman bazlı tedarikçi belge türlerini tanımlayın. Her evrak bir departmana bağlıdır."
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
              Evrak Türü Ekle
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
          searchPlaceholder="Departman veya evrak türü ara..."
          hierarchyChild="Evrak Türü"
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
                <span className="text-sm text-slate-400 shrink-0">— Evrak Türleri</span>
              </div>
              <button
                type="button"
                onClick={openCreate}
                className="sm:hidden text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 shrink-0"
              >
                + Evrak Ekle
              </button>
            </div>

            <SettingsTable
              loading={loading}
              empty={filteredTypes.length === 0}
              emptyText={
                search.trim()
                  ? 'Arama sonucu bulunamadı.'
                  : 'Bu departman için henüz evrak türü tanımlanmamış.'
              }
            >
              <SettingsTableHead>
                <SettingsTableTh colId="name">Ad</SettingsTableTh>
                <SettingsTableTh colId="description">Açıklama</SettingsTableTh>
                <SettingsTableTh colId="required" className="text-center">Zorunlu</SettingsTableTh>
                <SettingsTableTh colId="sort" className="text-center">Sıra</SettingsTableTh>
                <SettingsTableTh colId="count" className="text-center">Evrak Sayısı</SettingsTableTh>
                <SettingsTableTh colId="status" className="text-center">Durum</SettingsTableTh>
                <SettingsTableTh />
              </SettingsTableHead>
              <SettingsTableBody>
                {filteredTypes.map((dt) => {
                  const unassigned = parseIds(dt.departmentIds).length === 0;
                  return (
                    <SettingsTableRow key={dt.id}>
                      <SettingsTableTd colId="name">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-900">{dt.name}</span>
                          {unassigned && (
                            <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">Atanmamış</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">{dt.code}</p>
                      </SettingsTableTd>
                      <SettingsTableTd colId="description" className="max-w-xs truncate text-slate-500">{dt.description || '—'}</SettingsTableTd>
                      <SettingsTableTd colId="required" className="text-center">
                        {dt.isRequired ? (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Zorunlu</span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </SettingsTableTd>
                      <SettingsTableTd colId="sort" className="text-center text-slate-600">{dt.sortOrder}</SettingsTableTd>
                      <SettingsTableTd colId="count" className="text-center text-slate-600">{dt._count?.vendorDocuments ?? 0}</SettingsTableTd>
                      <SettingsTableTd colId="status" className="text-center">
                        <StatusBadge active={dt.status === 'active'} />
                      </SettingsTableTd>
                      <SettingsTableActions>
                        <EditButton onClick={() => openEdit(dt)} />
                        <DeleteButton onClick={() => setDeleteTarget(dt)} />
                      </SettingsTableActions>
                    </SettingsTableRow>
                  );
                })}
              </SettingsTableBody>
            </SettingsTable>
          </div>
        )}
      </div>

      <SettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Evrak Türünü Düzenle' : 'Yeni Evrak Türü'}
        onSave={handleSave}
        saving={saving}
        error={error}
      >
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
            Bu evrak hangi departmana ait? Örn: Muvafakatname → Hasar Onarım
          </p>
        </div>
        {modalDept && (
          <DepartmentContextBand name={modalDept.name} color={modalDept.color} code={modalDept.code} />
        )}
        <div>
          <label className={labelCls}>Ad *</label>
          <input
            className={inputCls}
            placeholder="Örn: Muvafakatname, Kimlik Fotokopisi"
            value={form.name}
            autoComplete="off"
            onChange={(e) => handleNameChange(e.target.value)}
          />
        </div>
        {editing && (
          <div>
            <label className={labelCls}>Kod</label>
            <input className={`${inputCls} disabled:bg-slate-50`} value={form.code} disabled />
          </div>
        )}
        <div>
          <label className={labelCls}>Açıklama</label>
          <input
            className={inputCls}
            placeholder="İsteğe bağlı açıklama"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Sıra No</label>
            <input
              type="number"
              className={inputCls}
              value={form.sortOrder}
              onChange={(e) => setForm((p) => ({ ...p, sortOrder: parseInt(e.target.value, 10) || 0 }))}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded"
                checked={form.isRequired}
                onChange={(e) => setForm((p) => ({ ...p, isRequired: e.target.checked }))}
              />
              <span className="text-sm text-slate-700">Zorunlu Evrak</span>
            </label>
          </div>
        </div>
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
        itemName={deleteTarget?.name}
        description={
          deleteTarget && (deleteTarget._count?.vendorDocuments ?? 0) > 0
            ? `Bu evrak türüne bağlı ${deleteTarget._count?.vendorDocuments} evrak var. Yine de silmek istiyor musunuz?`
            : undefined
        }
      />
    </SettingsPageLayout>
      )}
    </SettingsTableColumnsProvider>
  );
}
