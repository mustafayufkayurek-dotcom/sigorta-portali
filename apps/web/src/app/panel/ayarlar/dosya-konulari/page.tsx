'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { applyNameWithAutoCode, blurNameWithAutoCode, suggestAutoCode } from '@/utils/auto-code';
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
  SettingsRowIndexTh,
  SettingsRowIndexTd,
  inputCls,
  labelCls,
} from '@/components/settings/SettingsUI';
import { SettingsModal, DeleteConfirmDialog } from '@/components/settings/SettingsModal';
import { persistAlphabeticSortOrders, sortByNameTR } from '@/utils/definition-sort-order';
import { normalizeFormFreeText } from '@/utils/text-helpers';

type Department = DepartmentTab & { code: string; reportFormat: string; isSystem: boolean };
type FileSubject = { id: string; code: string; name: string; sortOrder: number; isSystem: boolean; status: string };

const KONU_TABS = [
  { id: 'hasar-onarim', name: 'Hasar Onarım', color: '#3B82F6', departmentCode: 'hasar-onarim' },
  { id: 'acil-yardim', name: 'Acil Yardım', color: '#EF4444', departmentCode: 'acil-yardim' },
  { id: 'ozel-musteri', name: 'Özel Müşteri', color: '#10B981', departmentCode: 'ozel-musteri' },
  { id: 'danismanlik', name: 'Danışmanlık', color: '#8B5CF6', departmentCode: 'danismanlik' },
  { id: 'staj', name: 'Staj', color: '#F59E0B', departmentCode: 'staj' },
] as const;

type KonuTabId = (typeof KONU_TABS)[number]['id'];

const emptyForm = { code: '', name: '', status: 'active' };

function resolveDepartment(depts: Department[], tab: (typeof KONU_TABS)[number]): Department | null {
  return (
    depts.find((d) => d.code === tab.departmentCode) ??
    depts.find((d) => d.name.localeCompare(tab.name, 'tr', { sensitivity: 'base' }) === 0) ??
    null
  );
}

export default function DosyaKonulariPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjectsByDept, setSubjectsByDept] = useState<Record<string, FileSubject[]>>({});
  const [activeTab, setActiveTab] = useState<KonuTabId>('hasar-onarim');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FileSubject | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FileSubject | null>(null);
  const [deleting, setDeleting] = useState(false);

  const activeTabMeta = KONU_TABS.find((t) => t.id === activeTab) ?? KONU_TABS[0];
  const activeDepartment = useMemo(
    () => resolveDepartment(departments, activeTabMeta),
    [departments, activeTabMeta],
  );

  const syncSubjectSortOrders = useCallback(async (data: FileSubject[]) => {
    await persistAlphabeticSortOrders(data, (id, sortOrder) =>
      axios.put(`${API}/department-file-subjects/${id}`, { sortOrder }, { headers: authHeader() }),
    );
  }, []);

  const fetchSubjectsForDept = useCallback(
    async (deptId: string) => {
      const res = await axios.get(`${API}/departments/${deptId}/file-subjects`, { headers: authHeader() });
      const data: FileSubject[] = res.data.data ?? [];
      await syncSubjectSortOrders(data);
      const res2 = await axios.get(`${API}/departments/${deptId}/file-subjects`, { headers: authHeader() });
      return (res2.data.data ?? data) as FileSubject[];
    },
    [syncSubjectSortOrders],
  );

  const loadDepartmentsAndSubjects = useCallback(async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/departments/ensure-konu-tabs`, {}, { headers: authHeader() }).catch(() => undefined);
      const res = await axios.get(`${API}/departments`, { headers: authHeader() });
      const depts: Department[] = res.data.data ?? [];
      setDepartments(depts);

      const tabDepts = KONU_TABS.map((tab) => resolveDepartment(depts, tab)).filter(Boolean) as Department[];
      const bundles = await Promise.all(
        tabDepts.map(async (dept) => {
          const subjects = await fetchSubjectsForDept(dept.id);
          return [dept.id, subjects] as const;
        }),
      );
      setSubjectsByDept(Object.fromEntries(bundles));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [fetchSubjectsForDept]);

  useEffect(() => {
    void loadDepartmentsAndSubjects();
  }, [loadDepartmentsAndSubjects]);

  const reloadActiveTab = useCallback(async () => {
    if (!activeDepartment) return;
    const subjects = await fetchSubjectsForDept(activeDepartment.id);
    setSubjectsByDept((prev) => ({ ...prev, [activeDepartment.id]: subjects }));
  }, [activeDepartment, fetchSubjectsForDept]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tab of KONU_TABS) {
      const dept = resolveDepartment(departments, tab);
      counts[tab.id] = dept ? (subjectsByDept[dept.id]?.length ?? 0) : 0;
    }
    return counts;
  }, [departments, subjectsByDept]);

  const activeSubjects = useMemo(() => {
    if (!activeDepartment) return [];
    return sortByNameTR(subjectsByDept[activeDepartment.id] ?? []);
  }, [activeDepartment, subjectsByDept]);

  const filteredSubjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeSubjects;
    return activeSubjects.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [activeSubjects, search]);

  const openCreate = () => {
    if (!activeDepartment) return;
    setEditing(null);
    setForm({ ...emptyForm });
    setError('');
    setShowModal(true);
  };

  const openEdit = (s: FileSubject) => {
    setEditing(s);
    setForm({ code: s.code, name: s.name, status: s.status });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!activeDepartment) {
      setError('Bu sekme için departman kaydı bulunamadı');
      return;
    }
    const name = normalizeFormFreeText(form.name);
    if (!name) {
      setError('Konu adı zorunludur');
      return;
    }
    const code = editing ? form.code : (form.code.trim() || suggestAutoCode(activeDepartment.code ?? 'KONU', name));
    if (!code) {
      setError('Konu adı zorunludur');
      return;
    }
    const siblings = subjectsByDept[activeDepartment.id] ?? [];
    const dupName = siblings.find(
      (s) => s.name.trim().toLowerCase() === name.toLowerCase() && (!editing || s.id !== editing.id),
    );
    if (dupName) {
      setError('Bu hatta aynı isimde bir dosya konusu zaten mevcut');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await axios.put(
          `${API}/department-file-subjects/${editing.id}`,
          { code, name, status: form.status },
          { headers: authHeader() },
        );
      } else {
        await axios.post(
          `${API}/departments/${activeDepartment.id}/file-subjects`,
          { code, name },
          { headers: authHeader() },
        );
      }
      setShowModal(false);
      await reloadActiveTab();
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
      await reloadActiveTab();
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
      await reloadActiveTab();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? 'Silinemedi');
    } finally {
      setDeleting(false);
    }
  };

  const tabHint =
    activeTab === 'ozel-musteri'
      ? 'Özel müşteri dosyalarında seçilecek hizmet konuları'
      : activeTab === 'danismanlik'
        ? 'Danışmanlık hattı dosya konuları'
        : activeTab === 'staj'
          ? 'Staj programı dosya konuları'
          : activeTab === 'acil-yardim'
            ? 'Acil yardım ihbar ve dosya konuları'
            : 'Hasar onarım branş ve dosya konuları';

  return (
    <SettingsPageLayout
      title="Dosya Konuları"
      description="Her operasyon hattının dosya konularını ayrı sekmelerde yönetin. Hasar, acil yardım, özel müşteri, danışmanlık ve staj hatları buradan beslenir."
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
      headerExtra={
        activeDepartment ? (
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
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-blue-900 leading-relaxed">
          Her sekme bir operasyon hattını temsil eder. Konular yalnızca seçili sekmede listelenir; sıra numarası
          alfabetik sıraya göre otomatik atanır.
        </div>

        <DepartmentTabSelector
          departments={KONU_TABS.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
          selectedId={activeTab}
          onSelect={(t) => {
            setActiveTab(t.id as KonuTabId);
            setSearch('');
          }}
          counts={tabCounts}
        />

        {!activeDepartment && !loading && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>{activeTabMeta.name}</strong> hattı için departman kaydı bulunamadı.{' '}
            <Link href="/panel/ayarlar/departmanlar" className="underline font-medium">
              Departman Yönetimi
            </Link>
            {' '}ekranından oluşturabilir veya sayfayı yenileyebilirsiniz.
          </div>
        )}

        {activeDepartment && (
          <>
            <DepartmentDefinitionToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={`${activeTabMeta.name} konusu ara...`}
              hierarchyChild={`${activeTabMeta.name} dosya konusu`}
            />

            <p className="text-xs text-slate-500 -mt-1">{tabHint}</p>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <SettingsTable
                loading={loading}
                empty={filteredSubjects.length === 0}
                emptyText={
                  search.trim()
                    ? 'Aramaya uyan konu bulunamadı.'
                    : `Henüz ${activeTabMeta.name} konusu tanımlanmamış.`
                }
              >
                <SettingsTableHead>
                  <SettingsRowIndexTh className="w-16" />
                  <SettingsTableTh>Konu Adı</SettingsTableTh>
                  <SettingsTableTh className="w-28">Durum</SettingsTableTh>
                  <SettingsTableTh />
                </SettingsTableHead>
                <SettingsTableBody>
                  {filteredSubjects.map((s, index) => (
                    <SettingsTableRow key={s.id}>
                      <SettingsRowIndexTd index={index} />
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
          </>
        )}
      </div>

      <SettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Dosya Konusu Düzenle' : `Yeni ${activeTabMeta.name} Konusu`}
        onSave={handleSave}
        saving={saving}
        error={error}
      >
        {activeDepartment && (
          <DepartmentContextBand
            name={activeDepartment.name}
            color={activeDepartment.color}
            code={activeDepartment.code}
            suffix="hattına eklenecek"
          />
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
                  activeDepartment?.code ?? 'KONU',
                ),
              )
            }
            onBlur={() =>
              setForm((p) => blurNameWithAutoCode(p, !!editing, activeDepartment?.code ?? 'KONU'))
            }
            placeholder="Örn: Dahili Su, Yangın, Restorasyon"
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
