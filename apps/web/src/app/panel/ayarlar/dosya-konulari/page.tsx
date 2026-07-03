'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { applyNameWithAutoCode, blurNameWithAutoCode, suggestAutoCode } from '@/utils/auto-code';
import { TANIMLAR_BACK_HREF, TANIMLAR_BACK_TEXT } from '@/utils/settings-definition-nav';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import {
  DepartmentContextBand,
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
import { persistAlphabeticSortOrders } from '@/utils/definition-sort-order';
import { normalizeFormFreeText, sortCompareTR } from '@/utils/text-helpers';

type Department = DepartmentTab & { code: string; reportFormat: string; isSystem: boolean };
type FileSubject = { id: string; code: string; name: string; sortOrder: number; isSystem: boolean; status: string };
type FileSubjectRow = FileSubject & {
  departmentId: string;
  departmentName: string;
  departmentColor: string;
  departmentCode: string;
};

const emptyForm = { code: '', name: '', status: 'active', departmentId: '' };

function sortSubjectRows(rows: FileSubjectRow[]): FileSubjectRow[] {
  return [...rows].sort((a, b) => {
    const deptCmp = sortCompareTR(a.departmentName, b.departmentName);
    if (deptCmp !== 0) return deptCmp;
    return sortCompareTR(a.name, b.name);
  });
}

export default function DosyaKonulariPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [rows, setRows] = useState<FileSubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDeptId, setFilterDeptId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FileSubjectRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FileSubjectRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const syncSubjectSortOrders = useCallback(async (data: FileSubject[]) => {
    await persistAlphabeticSortOrders(data, (id, sortOrder) =>
      axios.put(`${API}/department-file-subjects/${id}`, { sortOrder }, { headers: authHeader() }),
    );
  }, []);

  const fetchAllSubjects = useCallback(async (depts: Department[]) => {
    setLoading(true);
    try {
      const bundles = await Promise.all(
        depts.map(async (dept) => {
          const res = await axios.get(`${API}/departments/${dept.id}/file-subjects`, { headers: authHeader() });
          const data: FileSubject[] = res.data.data ?? [];
          await syncSubjectSortOrders(data);
          const res2 = await axios.get(`${API}/departments/${dept.id}/file-subjects`, { headers: authHeader() });
          const synced: FileSubject[] = res2.data.data ?? data;
          return synced.map((s) => ({
            ...s,
            departmentId: dept.id,
            departmentName: dept.name,
            departmentColor: dept.color,
            departmentCode: dept.code,
          }));
        }),
      );
      setRows(bundles.flat());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [syncSubjectSortOrders]);

  useEffect(() => {
    axios.get(`${API}/departments`, { headers: authHeader() })
      .then((r) => {
        const depts: Department[] = r.data.data ?? [];
        setDepartments(depts);
        if (depts.length > 0) {
          void fetchAllSubjects(depts);
        } else {
          setLoading(false);
        }
      })
      .catch(console.error);
  }, [fetchAllSubjects]);

  const reload = useCallback(async () => {
    if (departments.length > 0) await fetchAllSubjects(departments);
  }, [departments, fetchAllSubjects]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (filterDeptId) {
      list = list.filter((r) => r.departmentId === filterDeptId);
    }
    if (q) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.departmentName.toLowerCase().includes(q),
      );
    }
    return sortSubjectRows(list);
  }, [rows, search, filterDeptId]);

  const rowsWithDisplayOrder = useMemo(() => {
    const orderByDept = new Map<string, number>();
    return filteredRows.map((row) => {
      const next = (orderByDept.get(row.departmentId) ?? 0) + 1;
      orderByDept.set(row.departmentId, next);
      return { ...row, displayOrder: next };
    });
  }, [filteredRows]);

  const modalDept = departments.find((d) => d.id === form.departmentId) ?? null;

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      departmentId: filterDeptId || departments[0]?.id || '',
    });
    setError('');
    setShowModal(true);
  };

  const openEdit = (s: FileSubjectRow) => {
    setEditing(s);
    setForm({
      code: s.code,
      name: s.name,
      status: s.status,
      departmentId: s.departmentId,
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    const deptId = form.departmentId;
    if (!deptId) {
      setError('Departman seçilmelidir');
      return;
    }
    const dept = departments.find((d) => d.id === deptId);
    const name = normalizeFormFreeText(form.name);
    if (!name) {
      setError('Kod ve ad zorunludur');
      return;
    }
    const code = editing ? form.code : (form.code.trim() || suggestAutoCode(dept?.code ?? 'KONU', name));
    if (!code) {
      setError('Kod ve ad zorunludur');
      return;
    }
    const dupName = rows.find(
      (s) =>
        s.departmentId === deptId &&
        s.name.trim().toLowerCase() === name.toLowerCase() &&
        (!editing || s.id !== editing.id),
    );
    if (dupName) {
      setError('Bu departmanda aynı isimde bir dosya konusu zaten mevcut');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await axios.put(`${API}/department-file-subjects/${editing.id}`, {
          code,
          name,
          status: form.status,
        }, { headers: authHeader() });
      } else {
        await axios.post(`${API}/departments/${deptId}/file-subjects`, {
          code,
          name,
        }, { headers: authHeader() });
      }
      setShowModal(false);
      await reload();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? 'Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (s: FileSubjectRow) => {
    const newStatus = s.status === 'active' ? 'inactive' : 'active';
    try {
      await axios.put(`${API}/department-file-subjects/${s.id}`, { status: newStatus }, { headers: authHeader() });
      await reload();
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
      await reload();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? 'Silinemedi');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsPageLayout
      title="Dosya Konuları"
      description="Tüm departmanların dosya konuları tek listede. Hasar/acil branş listeleri, ihbar konuları ve dosya açılışı bu tanımlardan beslenir."
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
      headerExtra={
        departments.length > 0 ? (
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
        ) : null
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Konu veya departman ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            value={filterDeptId}
            onChange={(e) => setFilterDeptId(e.target.value)}
          >
            <option value="">Tüm Departmanlar</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <p className="text-xs text-slate-500 shrink-0">
            {filteredRows.length} konu
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <SettingsTable
            loading={loading}
            empty={rowsWithDisplayOrder.length === 0}
            emptyText={
              search.trim() || filterDeptId
                ? 'Filtreye uyan konu bulunamadı.'
                : 'Henüz dosya konusu tanımlanmamış.'
            }
          >
            <SettingsTableHead>
              <SettingsTableTh className="w-16 text-center">Sıra</SettingsTableTh>
              <SettingsTableTh className="w-44">Departman</SettingsTableTh>
              <SettingsTableTh>Konu Adı</SettingsTableTh>
              <SettingsTableTh className="w-28">Durum</SettingsTableTh>
              <SettingsTableTh />
            </SettingsTableHead>
            <SettingsTableBody>
              {rowsWithDisplayOrder.map((s) => (
                <SettingsTableRow key={s.id}>
                  <SettingsTableTd className="text-center text-slate-600 tabular-nums">
                    {s.displayOrder}
                  </SettingsTableTd>
                  <SettingsTableTd>
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: s.departmentColor }}
                      />
                      <span className="text-sm font-medium text-slate-800 truncate">{s.departmentName}</span>
                    </div>
                  </SettingsTableTd>
                  <SettingsTableTd>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{s.name}</span>
                      {s.isSystem && (
                        <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">Sistem</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{s.code}</p>
                  </SettingsTableTd>
                  <SettingsTableTd>
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
      </div>

      <SettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Dosya Konusu Düzenle' : 'Yeni Dosya Konusu'}
        onSave={handleSave}
        saving={saving}
        error={error}
      >
        {!editing ? (
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
          </div>
        ) : null}
        {modalDept && (
          <DepartmentContextBand name={modalDept.name} color={modalDept.color} code={modalDept.code} />
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
                  modalDept?.code ?? 'KONU',
                ),
              )
            }
            onBlur={() => setForm((p) => blurNameWithAutoCode(p, !!editing, modalDept?.code ?? 'KONU'))}
            placeholder="Örn: Dahili Su, Yangın"
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
  );
}
