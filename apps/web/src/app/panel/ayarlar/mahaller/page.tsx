'use client';

import { useEffect, useState, useCallback, type Dispatch, type SetStateAction } from 'react';
import axios from 'axios';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { TANIMLAR_BACK_HREF, TANIMLAR_BACK_TEXT } from '@/utils/settings-definition-nav';
import { suggestAutoCode, applyNameWithAutoCode } from '@/utils/auto-code';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { DepartmentContextBand } from '@/components/settings/DepartmentTabSelector';
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
  { id: 'subRegion', label: 'Alt Bölge', defaultWidth: 200, minWidth: 140 },
  { id: 'description', label: 'Açıklama', defaultWidth: 180, minWidth: 100 },
  { id: 'sort', label: 'Sıra', defaultWidth: 70, minWidth: 56 },
  { id: 'status', label: 'Durum', defaultWidth: 100, minWidth: 80 },
];

type ClaimLocation = {
  id: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  status: string;
  parentId?: string | null;
  _count?: { children: number };
};

type FieldRule = { required: boolean };
type FieldsConfig = Record<string, FieldRule>;

function isFieldRequired(fields: FieldsConfig, key: string) {
  return fields[key]?.required ?? false;
}

function buildLabel(fields: FieldsConfig, label: string, key: string) {
  return isFieldRequired(fields, key) ? `${label} *` : label;
}

function buildPlaceholder(fields: FieldsConfig, key: string) {
  return isFieldRequired(fields, key) ? 'Zorunlu Alan' : 'Opsiyonel';
}

const emptyForm = { code: '', name: '', description: '', sortOrder: 0 };
type LocationFormData = typeof emptyForm;

function LocationFormFields({
  f,
  setF,
  fc,
  isNew,
  codePrefix,
}: {
  f: LocationFormData;
  setF: Dispatch<SetStateAction<LocationFormData>>;
  fc: FieldsConfig;
  isNew?: boolean;
  codePrefix: string;
}) {
  return (
    <>
      <div>
        <label className={labelCls}>{buildLabel(fc, 'Kod', 'code')}</label>
        <input
          className={`${inputCls} disabled:bg-slate-50`}
          value={f.code}
          disabled
          placeholder={isNew ? 'Ad yazınca otomatik üretilir' : buildPlaceholder(fc, 'code')}
        />
      </div>
      <div>
        <label className={labelCls}>{buildLabel(fc, 'Ad', 'name')}</label>
        <input
          className={inputCls}
          value={f.name}
          autoComplete="off"
          name="mahal-ad"
          onChange={(e) => setF((prev) => applyNameWithAutoCode(prev, e.target.value, !isNew, codePrefix))}
          placeholder={buildPlaceholder(fc, 'name')}
        />
      </div>
      <div>
        <label className={labelCls}>{buildLabel(fc, 'Açıklama', 'description')}</label>
        <input
          className={inputCls}
          value={f.description}
          autoComplete="off"
          onChange={(e) => setF((prev) => ({ ...prev, description: e.target.value }))}
          placeholder={buildPlaceholder(fc, 'description')}
        />
      </div>
      <div>
        <label className={labelCls}>{buildLabel(fc, 'Sıra', 'sortOrder')}</label>
        <input
          type="number"
          min={0}
          className={inputCls}
          value={f.sortOrder}
          onChange={(e) => setF((prev) => ({ ...prev, sortOrder: parseInt(e.target.value, 10) || 0 }))}
          placeholder={buildPlaceholder(fc, 'sortOrder')}
        />
      </div>
    </>
  );
}

export default function MahallerPage() {
  const [locations, setLocations] = useState<ClaimLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ClaimLocation | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldConfig, setFieldConfig] = useState<FieldsConfig>({});

  const [subLocations, setSubLocations] = useState<Record<string, ClaimLocation[]>>({});
  const [loadingSubs, setLoadingSubs] = useState<Record<string, boolean>>({});
  const [showSubModal, setShowSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState<ClaimLocation | null>(null);
  const [subForm, setSubForm] = useState({ ...emptyForm, parentId: '' });
  const [subSaving, setSubSaving] = useState(false);
  const [subError, setSubError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<ClaimLocation | null>(null);
  const [deleteSubTarget, setDeleteSubTarget] = useState<ClaimLocation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/claim-locations`, { headers: authHeader() });
      const data: ClaimLocation[] = res.data.data ?? [];
      setLocations(data);
      setExpandedIds((prev) => {
        if (prev.size > 0) return prev;
        return new Set(data.slice(0, 2).map((l) => l.id));
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
    axios
      .get(`${API}/system-settings/location-fields`, { headers: authHeader() })
      .then((r) => setFieldConfig(r.data.data ?? {}))
      .catch(console.error);
  }, [fetchLocations]);

  const fetchSubLocations = useCallback(async (parentId: string) => {
    setLoadingSubs((prev) => ({ ...prev, [parentId]: true }));
    try {
      const res = await axios.get(`${API}/claim-locations/${parentId}/sub-locations`, { headers: authHeader() });
      setSubLocations((prev) => ({ ...prev, [parentId]: res.data.data ?? [] }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSubs((prev) => ({ ...prev, [parentId]: false }));
    }
  }, []);

  const ensureSubsLoaded = (parentId: string) => {
    if (!subLocations[parentId]) fetchSubLocations(parentId);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        ensureSubsLoaded(id);
      }
      return next;
    });
  };

  const parentLocation = (id: string) => locations.find((l) => l.id === id) ?? null;
  const selectedParentForSubModal = subForm.parentId ? parentLocation(subForm.parentId) : null;

  const filteredLocations = search.trim()
    ? locations.filter((loc) => {
        const q = search.toLowerCase();
        if (loc.name.toLowerCase().includes(q) || (loc.description ?? '').toLowerCase().includes(q)) return true;
        const subs = subLocations[loc.id] ?? [];
        return subs.some((s) => s.name.toLowerCase().includes(q));
      })
    : locations;

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setError('');
    setShowModal(true);
  };

  const openEdit = (loc: ClaimLocation) => {
    setEditing(loc);
    setForm({ code: loc.code, name: loc.name, description: loc.description ?? '', sortOrder: loc.sortOrder });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    const missing: string[] = [];
    if (isFieldRequired(fieldConfig, 'name') && !form.name.trim()) missing.push('Ad');
    if (isFieldRequired(fieldConfig, 'description') && !form.description) missing.push('Açıklama');
    if (missing.length > 0) {
      setError(`${missing.join(', ')} zorunludur`);
      return;
    }
    const code = editing ? form.code : form.code.trim() || suggestAutoCode('MAHAL', form.name);
    if (form.name) {
      const dupName = locations.find(
        (l) => l.name.trim().toLowerCase() === form.name.trim().toLowerCase() && (!editing || l.id !== editing.id),
      );
      if (dupName) {
        setError('Bu isimde bir mahal zaten mevcut!');
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await axios.put(
          `${API}/claim-locations/${editing.id}`,
          { name: form.name, description: form.description || undefined, sortOrder: form.sortOrder },
          { headers: authHeader() },
        );
      } else {
        await axios.post(
          `${API}/claim-locations`,
          { code, name: form.name.trim(), description: form.description || undefined, sortOrder: form.sortOrder },
          { headers: authHeader() },
        );
      }
      setShowModal(false);
      fetchLocations();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message ?? 'Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (loc: ClaimLocation) => {
    try {
      await axios.put(
        `${API}/claim-locations/${loc.id}`,
        { status: loc.status === 'active' ? 'inactive' : 'active' },
        { headers: authHeader() },
      );
      fetchLocations();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? 'Güncellenemedi');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/claim-locations/${deleteTarget.id}`, { headers: authHeader() });
      setDeleteTarget(null);
      fetchLocations();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? 'Silinemedi');
    } finally {
      setDeleting(false);
    }
  };

  const openCreateSub = (parentId: string) => {
    setEditingSub(null);
    setSubForm({ ...emptyForm, parentId });
    setSubError('');
    setShowSubModal(true);
  };

  const openEditSub = (sub: ClaimLocation) => {
    setEditingSub(sub);
    setSubForm({
      code: sub.code,
      name: sub.name,
      description: sub.description ?? '',
      sortOrder: sub.sortOrder,
      parentId: sub.parentId ?? '',
    });
    setSubError('');
    setShowSubModal(true);
  };

  const handleSaveSub = async () => {
    if (!subForm.parentId) {
      setSubError('Üst mahal seçimi zorunludur');
      return;
    }
    const missing: string[] = [];
    if (isFieldRequired(fieldConfig, 'name') && !subForm.name.trim()) missing.push('Ad');
    if (isFieldRequired(fieldConfig, 'description') && !subForm.description) missing.push('Açıklama');
    if (missing.length > 0) {
      setSubError(`${missing.join(', ')} zorunludur`);
      return;
    }
    const code = editingSub ? subForm.code : subForm.code.trim() || suggestAutoCode('BOLGE', subForm.name);
    setSubSaving(true);
    setSubError('');
    try {
      if (editingSub) {
        await axios.put(
          `${API}/claim-locations/${editingSub.id}`,
          { name: subForm.name, description: subForm.description || undefined, sortOrder: subForm.sortOrder },
          { headers: authHeader() },
        );
      } else {
        await axios.post(
          `${API}/claim-locations/${subForm.parentId}/sub-locations`,
          { code, name: subForm.name.trim(), description: subForm.description || undefined, sortOrder: subForm.sortOrder },
          { headers: authHeader() },
        );
      }
      setShowSubModal(false);
      fetchSubLocations(subForm.parentId);
      fetchLocations();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setSubError(err.response?.data?.message ?? 'Bir hata oluştu');
    } finally {
      setSubSaving(false);
    }
  };

  const handleToggleSubStatus = async (sub: ClaimLocation) => {
    try {
      await axios.put(
        `${API}/claim-locations/${sub.id}`,
        { status: sub.status === 'active' ? 'inactive' : 'active' },
        { headers: authHeader() },
      );
      if (sub.parentId) fetchSubLocations(sub.parentId);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? 'Güncellenemedi');
    }
  };

  const confirmDeleteSub = async () => {
    if (!deleteSubTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/claim-locations/${deleteSubTarget.id}`, { headers: authHeader() });
      if (deleteSubTarget.parentId) fetchSubLocations(deleteSubTarget.parentId);
      setDeleteSubTarget(null);
      fetchLocations();
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
      title="Mahal ve Bölgeler"
      description="Hasar raporunda hangi bölgede ne iş yapılacağını tanımlayın (ör. Salon zemin, Çocuk odası tavan)."
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
      headerExtra={
        <div className="flex items-center gap-2">
          <SettingsTableColumnPicker tableColumns={tableColumns} />
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Mahal Ekle
          </button>
        </div>
      }
    >
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Mahal veya alt bölge ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} pl-9`}
          />
        </div>
        <p className="text-xs text-slate-500">
          Hiyerarşi: <span className="font-medium text-slate-700">Mahal</span>
          {' → '}
          <span className="font-medium text-slate-700">Alt Bölge</span>
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredLocations.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
          <p className="text-sm font-medium text-slate-700 mb-1">
            {search ? 'Arama sonucu bulunamadı' : 'Henüz mahal tanımlanmamış'}
          </p>
          {!search && (
            <button type="button" onClick={openCreate} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
              İlk mahali ekle
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLocations.map((loc) => {
            const isOpen = expandedIds.has(loc.id);
            const subCount = loc._count?.children ?? subLocations[loc.id]?.length ?? 0;
            const subs = subLocations[loc.id] ?? [];
            const q = search.trim().toLowerCase();
            const visibleSubs = q
              ? subs.filter((s) => s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q))
              : subs;

            if (isOpen && !subLocations[loc.id] && !loadingSubs[loc.id]) {
              ensureSubsLoaded(loc.id);
            }

            return (
              <div key={loc.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => toggleExpand(loc.id)}
                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isOpen ? 'bg-blue-600' : 'bg-slate-100'}`}>
                      <svg
                        className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90 text-white' : 'text-slate-500'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{loc.name}</span>
                        <span className="text-xs text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded">{loc.code}</span>
                        {loc.status !== 'active' && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">Pasif</span>
                        )}
                      </div>
                      {loc.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{loc.description}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">{subCount} alt bölge</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openCreateSub(loc.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Alt Bölge Ekle
                    </button>
                    <button type="button" onClick={() => handleToggleStatus(loc)}>
                      <StatusBadge active={loc.status === 'active'} />
                    </button>
                    <EditButton onClick={() => openEdit(loc)} />
                    <DeleteButton onClick={() => setDeleteTarget(loc)} />
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100">
                    {loadingSubs[loc.id] ? (
                      <div className="px-6 py-8 text-center text-xs text-slate-400">Yükleniyor...</div>
                    ) : visibleSubs.length === 0 ? (
                      <div className="px-6 py-8 text-center">
                        <p className="text-xs text-slate-500 mb-1">
                          <span className="font-medium text-slate-700">{loc.name}</span> mahaline henüz alt bölge eklenmemiş.
                        </p>
                        <button type="button" onClick={() => openCreateSub(loc.id)} className="mt-2 text-xs text-blue-600 hover:underline font-medium">
                          İlk alt bölgeyi ekle
                        </button>
                      </div>
                    ) : (
                      <SettingsTable>
                        <SettingsTableHead>
                          <SettingsTableTh colId="subRegion">Alt Bölge</SettingsTableTh>
                          <SettingsTableTh colId="description">Açıklama</SettingsTableTh>
                          <SettingsTableTh colId="sort" className="text-center">Sıra</SettingsTableTh>
                          <SettingsTableTh colId="status">Durum</SettingsTableTh>
                          <SettingsTableTh>İşlemler</SettingsTableTh>
                        </SettingsTableHead>
                        <SettingsTableBody>
                          {visibleSubs.map((sub) => (
                            <SettingsTableRow key={sub.id}>
                              <SettingsTableTd colId="subRegion">
                                <div>
                                  <span className="text-sm font-medium text-slate-900">{sub.name}</span>
                                  <p className="text-xs text-slate-400 mt-0.5 font-mono">{sub.code}</p>
                                </div>
                              </SettingsTableTd>
                              <SettingsTableTd colId="description">
                                <span className="text-sm text-slate-500">{sub.description || '—'}</span>
                              </SettingsTableTd>
                              <SettingsTableTd colId="sort" className="text-center text-sm text-slate-600">{sub.sortOrder}</SettingsTableTd>
                              <SettingsTableTd colId="status">
                                <button type="button" onClick={() => handleToggleSubStatus(sub)}>
                                  <StatusBadge active={sub.status === 'active'} />
                                </button>
                              </SettingsTableTd>
                              <SettingsTableTd>
                                <SettingsTableActions>
                                  <EditButton onClick={() => openEditSub(sub)} />
                                  <DeleteButton onClick={() => setDeleteSubTarget(sub)} />
                                </SettingsTableActions>
                              </SettingsTableTd>
                            </SettingsTableRow>
                          ))}
                        </SettingsTableBody>
                      </SettingsTable>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Mahal Düzenle' : 'Yeni Mahal'}
        onSave={handleSave}
        saving={saving}
        error={error}
      >
        <LocationFormFields f={form} setF={setForm} fc={fieldConfig} isNew={!editing} codePrefix="MAHAL" />
      </SettingsModal>

      <SettingsModal
        isOpen={showSubModal}
        onClose={() => setShowSubModal(false)}
        title={editingSub ? 'Alt Bölge Düzenle' : 'Yeni Alt Bölge'}
        onSave={handleSaveSub}
        saving={subSaving}
        error={subError}
      >
        <div>
          <label className={labelCls}>Mahal *</label>
          <select
            className={`${inputCls} bg-white`}
            value={subForm.parentId}
            onChange={(e) => setSubForm((f) => ({ ...f, parentId: e.target.value }))}
          >
            <option value="">Mahal seçin...</option>
            {locations.filter((l) => l.status === 'active').map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1.5">Bu alt bölge hangi mahale bağlanacak? Örn: Salon Zemin → Salon</p>
        </div>

        {selectedParentForSubModal && (
          <DepartmentContextBand
            name={selectedParentForSubModal.name}
            color="#3B82F6"
            code={selectedParentForSubModal.code}
            suffix="mahaline bağlanacak"
          />
        )}

        <LocationFormFields
          f={subForm}
          setF={(updater) => {
            setSubForm((prev) => {
              const next = typeof updater === 'function' ? updater(prev) : updater;
              return { ...next, parentId: prev.parentId };
            });
          }}
          fc={fieldConfig}
          isNew={!editingSub}
          codePrefix={selectedParentForSubModal?.code ?? 'BOLGE'}
        />
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        deleting={deleting}
        itemName={deleteTarget?.name}
      />
      <DeleteConfirmDialog
        isOpen={deleteSubTarget !== null}
        onClose={() => setDeleteSubTarget(null)}
        onConfirm={confirmDeleteSub}
        deleting={deleting}
        itemName={deleteSubTarget?.name}
      />
    </SettingsPageLayout>
      )}
    </SettingsTableColumnsProvider>
  );
}
