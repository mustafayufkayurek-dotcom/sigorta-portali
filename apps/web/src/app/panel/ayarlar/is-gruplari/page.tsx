'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
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
import { TANIMLAR_BACK_HREF, TANIMLAR_BACK_TEXT } from '@/utils/settings-definition-nav';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { suggestAutoCode, applyNameWithAutoCode, blurNameWithAutoCode } from '@/utils/auto-code';
import { normalizeFormFreeText } from '@/utils/text-helpers';
import { computeAlphabeticSortOrder } from '@/utils/definition-sort-order';


const DEFAULT_UNIT_OPTIONS = ['m²', 'adet', 'metre', 'saat', 'kg', 'ton'];

const UNIT_LABELS: Record<string, string> = {
  adet: 'Adet',
  'm²': 'm²',
  metre: 'Metre',
  saat: 'Saat',
  kg: 'KG',
  ton: 'Ton',
};

type FieldRule = { required: boolean };
type FieldsConfig = Record<string, FieldRule>;

function isFieldRequired(fields: FieldsConfig, key: string): boolean {
  return fields[key]?.required ?? false;
}

function buildLabel(fields: FieldsConfig, label: string, key: string): string {
  return isFieldRequired(fields, key) ? `${label} *` : label;
}

function buildPlaceholder(fields: FieldsConfig, key: string): string {
  return isFieldRequired(fields, key) ? 'Zorunlu alan' : 'Opsiyonel';
}

type WorkSubGroup = {
  id: string;
  workGroupId: string;
  code: string;
  name: string;
  description?: string;
  unitType: string;
  unitPrice?: number | null;
  sortOrder: number;
  status: string;
};

type WorkGroup = {
  id: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  isSystem: boolean;
  status: string;
  workSubGroups?: WorkSubGroup[];
  _count?: { workSubGroups: number };
};

const emptyGroupForm = { code: '', name: '', description: '' };

function makeEmptySubForm(unitOpts: string[]) {
  return {
    code: '',
    name: '',
    description: '',
    unitType: unitOpts[0] ?? 'm²',
    unitPrice: '',
    workGroupId: '',
  };
}

const fmt = (n?: number | null) =>
  n != null ? n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }) : '—';

export default function IsGruplariPage() {
  const [groups, setGroups] = useState<WorkGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [seeding, setSeeding] = useState(false);

  const [groupModal, setGroupModal] = useState(false);
  const [editGroup, setEditGroup] = useState<WorkGroup | null>(null);
  const [groupForm, setGroupForm] = useState({ ...emptyGroupForm });
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupError, setGroupError] = useState('');
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<WorkGroup | null>(null);

  const [subModal, setSubModal] = useState(false);
  const [editSub, setEditSub] = useState<WorkSubGroup | null>(null);
  const [subForm, setSubForm] = useState(makeEmptySubForm(DEFAULT_UNIT_OPTIONS));
  const [subSaving, setSubSaving] = useState(false);
  const [subError, setSubError] = useState('');
  const [deleteSubTarget, setDeleteSubTarget] = useState<WorkSubGroup | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [groupFieldConfig, setGroupFieldConfig] = useState<FieldsConfig>({});
  const [subFieldConfig, setSubFieldConfig] = useState<FieldsConfig>({});
  const [unitOptions, setUnitOptions] = useState<string[]>(DEFAULT_UNIT_OPTIONS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/work-groups`, { headers: authHeader() });
      const data: WorkGroup[] = res.data.data ?? [];
      setGroups(data);
      setExpandedGroups((prev) => {
        if (prev.size > 0) return prev;
        return new Set(data.slice(0, 2).map((g) => g.id));
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    axios.get(`${API}/system-settings/work-group-fields`, { headers: authHeader() })
      .then((r) => setGroupFieldConfig(r.data.data ?? {}))
      .catch(console.error);
    axios.get(`${API}/system-settings/work-sub-group-fields`, { headers: authHeader() })
      .then((r) => setSubFieldConfig(r.data.data ?? {}))
      .catch(console.error);
    axios.get(`${API}/system-settings/unit-options`, { headers: authHeader() })
      .then((r) => { if (r.data.data?.length) setUnitOptions(r.data.data); })
      .catch(console.error);
  }, [load]);

  const toggleExpand = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredGroups = search.trim()
    ? groups.filter((g) =>
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.workSubGroups?.some((s) => s.name.toLowerCase().includes(search.toLowerCase())),
      )
    : groups;

  const parentGroup = (id: string) => groups.find((g) => g.id === id) ?? null;

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await axios.post(`${API}/work-groups/seed`, {}, { headers: authHeader() });
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? 'Varsayılan veriler yüklenemedi');
    } finally {
      setSeeding(false);
    }
  };

  // ── İş Grubu ───────────────────────────────────────────────────────────────

  const openAddGroup = () => {
    setEditGroup(null);
    setGroupForm({ ...emptyGroupForm });
    setGroupError('');
    setGroupModal(true);
  };

  const openEditGroup = (g: WorkGroup) => {
    setEditGroup(g);
    setGroupForm({
      code: g.code,
      name: g.name,
      description: g.description ?? '',
    });
    setGroupError('');
    setGroupModal(true);
  };

  const saveGroup = async () => {
    const name = normalizeFormFreeText(groupForm.name);
    const description = groupForm.description.trim() ? normalizeFormFreeText(groupForm.description) : '';
    const missing: string[] = [];
    if (isFieldRequired(groupFieldConfig, 'name') && !name) missing.push('Ad');
    if (isFieldRequired(groupFieldConfig, 'description') && !description) missing.push('Açıklama');
    if (missing.length > 0) {
      setGroupError(`${missing.join(', ')} zorunludur`);
      return;
    }
    const dupName = groups.find((g) =>
      g.name.trim().toLowerCase() === name.toLowerCase() && (!editGroup || g.id !== editGroup.id),
    );
    if (dupName) {
      setGroupError('Bu isimde bir iş grubu zaten mevcut');
      return;
    }
    setGroupSaving(true);
    setGroupError('');
    const code = editGroup ? groupForm.code : (groupForm.code.trim() || suggestAutoCode('WG', name));
    const sortOrder = computeAlphabeticSortOrder(name, groups, editGroup?.id);
    try {
      if (editGroup) {
        await axios.put(`${API}/work-groups/${editGroup.id}`, {
          name,
          description: description || undefined,
          sortOrder,
        }, { headers: authHeader() });
      } else {
        await axios.post(`${API}/work-groups`, {
          code,
          name,
          description: description || undefined,
          sortOrder,
        }, { headers: authHeader() });
      }
      setGroupModal(false);
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setGroupError(err.response?.data?.message ?? 'Bir hata oluştu');
    } finally {
      setGroupSaving(false);
    }
  };

  const toggleGroupStatus = async (g: WorkGroup) => {
    try {
      await axios.put(`${API}/work-groups/${g.id}`, {
        status: g.status === 'active' ? 'inactive' : 'active',
      }, { headers: authHeader() });
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? 'Güncellenemedi');
    }
  };

  const confirmDeleteGroup = async () => {
    if (!deleteGroupTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/work-groups/${deleteGroupTarget.id}`, { headers: authHeader() });
      setDeleteGroupTarget(null);
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? 'Silinemedi');
    } finally {
      setDeleting(false);
    }
  };

  // ── Alt Grup ───────────────────────────────────────────────────────────────

  const openAddSub = (workGroupId: string) => {
    setEditSub(null);
    setSubForm({ ...makeEmptySubForm(unitOptions), workGroupId });
    setSubError('');
    setSubModal(true);
    setExpandedGroups((prev) => new Set(prev).add(workGroupId));
  };

  const openEditSub = (sub: WorkSubGroup) => {
    setEditSub(sub);
    setSubForm({
      code: sub.code,
      name: sub.name,
      description: sub.description ?? '',
      unitType: sub.unitType,
      unitPrice: sub.unitPrice != null ? String(sub.unitPrice) : '',
      workGroupId: sub.workGroupId,
    });
    setSubError('');
    setSubModal(true);
  };

  const saveSub = async () => {
    const name = normalizeFormFreeText(subForm.name);
    const description = subForm.description.trim() ? normalizeFormFreeText(subForm.description) : '';
    const missing: string[] = [];
    if (!subForm.workGroupId) missing.push('İş Grubu');
    if (isFieldRequired(subFieldConfig, 'name') && !name) missing.push('Ad');
    if (isFieldRequired(subFieldConfig, 'description') && !description) missing.push('Açıklama');
    if (isFieldRequired(subFieldConfig, 'unitType') && !subForm.unitType) missing.push('Birim');
    if (missing.length > 0) {
      setSubError(`${missing.join(', ')} zorunludur`);
      return;
    }
    const parent = parentGroup(subForm.workGroupId);
    const siblings = parent?.workSubGroups ?? [];
    const dupName = siblings.find((s) =>
      s.name.trim().toLowerCase() === name.toLowerCase() && (!editSub || s.id !== editSub.id),
    );
    if (dupName) {
      setSubError('Seçili iş grubunda aynı isimde bir alt grup zaten mevcut');
      return;
    }
    setSubSaving(true);
    setSubError('');
    const sortOrder = computeAlphabeticSortOrder(name, siblings, editSub?.id);
    const payload = {
      code: subForm.code.trim() || suggestAutoCode(parent?.code ?? 'WSG', name),
      name,
      description: description || undefined,
      unitType: subForm.unitType,
      unitPrice: subForm.unitPrice ? parseFloat(subForm.unitPrice) : undefined,
      sortOrder,
      workGroupId: subForm.workGroupId,
    };
    try {
      if (editSub) {
        await axios.put(`${API}/work-groups/sub-groups/${editSub.id}`, payload, { headers: authHeader() });
      } else {
        await axios.post(`${API}/work-groups/${subForm.workGroupId}/sub-groups`, payload, { headers: authHeader() });
      }
      setSubModal(false);
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setSubError(err.response?.data?.message ?? 'Bir hata oluştu');
    } finally {
      setSubSaving(false);
    }
  };

  const toggleSubStatus = async (sub: WorkSubGroup) => {
    try {
      await axios.put(`${API}/work-groups/sub-groups/${sub.id}`, {
        status: sub.status === 'active' ? 'inactive' : 'active',
      }, { headers: authHeader() });
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? 'Güncellenemedi');
    }
  };

  const confirmDeleteSub = async () => {
    if (!deleteSubTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/work-groups/sub-groups/${deleteSubTarget.id}`, { headers: authHeader() });
      setDeleteSubTarget(null);
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message ?? 'Silinemedi');
    } finally {
      setDeleting(false);
    }
  };

  const selectedParentForModal = parentGroup(subForm.workGroupId);

  return (
    <SettingsPageLayout
      title="İş Grubu Yönetimi"
      description="Onarım maliyet kalemleri ve tedarikçi hasar hizmet kolları (Sıva, Boya, Mobilya). Tedarikçi kartında Hasar Onarım seçilince bu gruplar listelenir."
      backHref={TANIMLAR_BACK_HREF}
      backText={TANIMLAR_BACK_TEXT}
      headerExtra={
        <div className="flex items-center gap-2">
          {groups.length === 0 && (
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors"
            >
              {seeding ? 'Yükleniyor...' : 'Varsayılanları Yükle'}
            </button>
          )}
          <button
            type="button"
            onClick={openAddGroup}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            İş Grubu Ekle
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
            placeholder="İş grubu veya alt grup ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} pl-9`}
          />
        </div>
        <p className="text-xs text-slate-500">
          Hiyerarşi: <span className="font-medium text-slate-700">İş Grubu</span>
          {' → '}
          <span className="font-medium text-slate-700">Alt Grup</span>
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700 mb-1">Henüz iş grubu yok</p>
          <p className="text-xs text-slate-400 mb-4">İş grubu ekleyerek başlayın veya varsayılan seti yükleyin.</p>
          <button type="button" onClick={handleSeed} disabled={seeding} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
            {seeding ? 'Yükleniyor...' : 'Varsayılanları Yükle'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const isOpen = expandedGroups.has(group.id);
            const subCount = group.workSubGroups?.length ?? group._count?.workSubGroups ?? 0;
            const subs = group.workSubGroups ?? [];
            return (
              <div key={group.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => toggleExpand(group.id)}
                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isOpen ? 'bg-blue-600' : 'bg-slate-100'}`}>
                      <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90 text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{group.name}</span>
                        <span className="text-xs text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded">{group.code}</span>
                        {group.isSystem && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">Sistem</span>
                        )}
                        {group.status !== 'active' && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">Pasif</span>
                        )}
                      </div>
                      {group.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{group.description}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">{subCount} alt grup</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openAddSub(group.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Alt Grup Ekle
                    </button>
                    <button type="button" onClick={() => toggleGroupStatus(group)}>
                      <StatusBadge active={group.status === 'active'} />
                    </button>
                    <EditButton onClick={() => openEditGroup(group)} />
                    <DeleteButton onClick={() => setDeleteGroupTarget(group)} />
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100">
                    {subs.length === 0 ? (
                      <div className="px-6 py-8 text-center">
                        <p className="text-xs text-slate-500 mb-1">
                          <span className="font-medium text-slate-700">{group.name}</span> grubuna henüz alt grup eklenmemiş.
                        </p>
                        <button type="button" onClick={() => openAddSub(group.id)} className="mt-2 text-xs text-blue-600 hover:underline font-medium">
                          İlk alt grubu ekle
                        </button>
                      </div>
                    ) : (
                      <SettingsTable>
                        <SettingsTableHead>
                          <SettingsRowIndexTh />
                          <SettingsTableTh>Alt Grup</SettingsTableTh>
                          <SettingsTableTh>Birim</SettingsTableTh>
                          <SettingsTableTh>Birim Fiyat</SettingsTableTh>
                          <SettingsTableTh>Durum</SettingsTableTh>
                          <SettingsTableTh>İşlemler</SettingsTableTh>
                        </SettingsTableHead>
                        <SettingsTableBody>
                          {subs.map((sub, subIndex) => (
                            <SettingsTableRow key={sub.id}>
                              <SettingsRowIndexTd index={subIndex} />
                              <SettingsTableTd>
                                <div>
                                  <span className="text-sm font-medium text-slate-900">{sub.name}</span>
                                  {sub.description && (
                                    <p className="text-xs text-slate-400 mt-0.5">{sub.description}</p>
                                  )}
                                  <p className="text-xs text-slate-400 mt-0.5 font-mono">{sub.code}</p>
                                </div>
                              </SettingsTableTd>
                              <SettingsTableTd>
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                                  {UNIT_LABELS[sub.unitType] ?? sub.unitType}
                                </span>
                              </SettingsTableTd>
                              <SettingsTableTd>
                                <span className="text-sm font-semibold text-slate-900">{fmt(sub.unitPrice)}</span>
                              </SettingsTableTd>
                              <SettingsTableTd>
                                <button type="button" onClick={() => toggleSubStatus(sub)}>
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
        isOpen={groupModal}
        onClose={() => setGroupModal(false)}
        title={editGroup ? 'İş Grubu Düzenle' : 'Yeni İş Grubu'}
        onSave={saveGroup}
        saving={groupSaving}
        error={groupError}
      >
        {!editGroup && (
          <div>
            <label className={labelCls}>{buildLabel(groupFieldConfig, 'Kod', 'code')}</label>
            <input className={`${inputCls} disabled:bg-slate-50`} value={groupForm.code} disabled placeholder="Ad yazınca otomatik üretilir" />
          </div>
        )}
        <div>
          <label className={labelCls}>{buildLabel(groupFieldConfig, 'İş Grubu Adı', 'name')}</label>
          <input
            className={inputCls}
            value={groupForm.name}
            onChange={(e) => setGroupForm((f) => applyNameWithAutoCode(f, e.target.value, !!editGroup, 'WG'))}
            onBlur={() => setGroupForm((f) => blurNameWithAutoCode(f, !!editGroup, 'WG'))}
            placeholder={buildPlaceholder(groupFieldConfig, 'name')}
          />
        </div>
        <div>
          <label className={labelCls}>{buildLabel(groupFieldConfig, 'Açıklama', 'description')}</label>
          <input
            className={inputCls}
            value={groupForm.description}
            onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))}
            onBlur={(e) => {
              const v = normalizeFormFreeText(e.target.value);
              if (v !== e.target.value.trim()) setGroupForm((f) => ({ ...f, description: v }));
            }}
            placeholder={buildPlaceholder(groupFieldConfig, 'description')}
          />
        </div>
      </SettingsModal>

      <SettingsModal
        isOpen={subModal}
        onClose={() => setSubModal(false)}
        title={editSub ? 'Alt Grup Düzenle' : 'Yeni Alt Grup'}
        onSave={saveSub}
        saving={subSaving}
        error={subError}
      >
        <div>
          <label className={labelCls}>İş Grubu *</label>
          <select
            className={`${inputCls} bg-white`}
            value={subForm.workGroupId}
            onChange={(e) => setSubForm((f) => ({ ...f, workGroupId: e.target.value }))}
          >
            <option value="">İş grubu seçin...</option>
            {groups.filter((g) => g.status === 'active').map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1.5">
            Bu alt grup hangi iş grubuna bağlanacak? Örn: Musluk Değişimi → Tesisat
          </p>
        </div>

        {selectedParentForModal && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5">
            <p className="text-xs text-blue-800">
              <span className="font-semibold">{selectedParentForModal.name}</span>
              {' '}
              iş grubuna bağlanacak
            </p>
            <p className="text-[11px] text-blue-600/80 mt-0.5 font-mono">{selectedParentForModal.code}</p>
          </div>
        )}

        {!editSub && (
          <div>
            <label className={labelCls}>{buildLabel(subFieldConfig, 'Kod', 'code')}</label>
            <input className={`${inputCls} disabled:bg-slate-50`} value={subForm.code} disabled placeholder="Ad yazınca otomatik üretilir" />
          </div>
        )}
        <div>
          <label className={labelCls}>{buildLabel(subFieldConfig, 'Alt Grup Adı', 'name')}</label>
          <input
            className={inputCls}
            value={subForm.name}
            onChange={(e) =>
              setSubForm((f) =>
                applyNameWithAutoCode(
                  f,
                  e.target.value,
                  !!editSub,
                  selectedParentForModal?.code ?? 'WSG',
                ),
              )
            }
            onBlur={() =>
              setSubForm((f) =>
                blurNameWithAutoCode(f, !!editSub, selectedParentForModal?.code ?? 'WSG'),
              )
            }
            placeholder={buildPlaceholder(subFieldConfig, 'name')}
          />
        </div>
        <div>
          <label className={labelCls}>{buildLabel(subFieldConfig, 'Açıklama', 'description')}</label>
          <input
            className={inputCls}
            value={subForm.description}
            onChange={(e) => setSubForm((f) => ({ ...f, description: e.target.value }))}
            onBlur={(e) => {
              const v = normalizeFormFreeText(e.target.value);
              if (v !== e.target.value.trim()) setSubForm((f) => ({ ...f, description: v }));
            }}
            placeholder={buildPlaceholder(subFieldConfig, 'description')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{buildLabel(subFieldConfig, 'Birim', 'unitType')}</label>
            <select
              className={inputCls}
              value={subForm.unitType}
              onChange={(e) => setSubForm((f) => ({ ...f, unitType: e.target.value }))}
            >
              {unitOptions.map((u) => (
                <option key={u} value={u}>{UNIT_LABELS[u] ?? u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{buildLabel(subFieldConfig, 'Birim Fiyat (₺)', 'unitPrice')}</label>
            <input
              type="number"
              step="0.01"
              min={0}
              className={inputCls}
              value={subForm.unitPrice}
              onChange={(e) => setSubForm((f) => ({ ...f, unitPrice: e.target.value }))}
              placeholder={buildPlaceholder(subFieldConfig, 'unitPrice')}
            />
          </div>
        </div>
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={deleteGroupTarget !== null}
        onClose={() => setDeleteGroupTarget(null)}
        onConfirm={confirmDeleteGroup}
        deleting={deleting}
        itemName={deleteGroupTarget?.name}
        description={
          deleteGroupTarget && (deleteGroupTarget._count?.workSubGroups ?? deleteGroupTarget.workSubGroups?.length ?? 0) > 0
            ? 'Bu iş grubun alt grupları var. Silmeden önce alt grupları kaldırın.'
            : `"${deleteGroupTarget?.name}" iş grubunu silmek istediğinize emin misiniz?`
        }
      />
      <DeleteConfirmDialog
        isOpen={deleteSubTarget !== null}
        onClose={() => setDeleteSubTarget(null)}
        onConfirm={confirmDeleteSub}
        deleting={deleting}
        itemName={deleteSubTarget?.name}
      />
    </SettingsPageLayout>
  );
}
