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
  inputCls,
  labelCls,
} from '@/components/settings/SettingsUI';
import { SettingsModal, DeleteConfirmDialog } from '@/components/settings/SettingsModal';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://app.meridyen-tr.com/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

const DEFAULT_UNIT_OPTIONS = ['m²', 'adet', 'metre', 'saat', 'kg', 'ton'];

type FieldRule = { required: boolean };
type FieldsConfig = Record<string, FieldRule>;

function isFieldRequired(fields: FieldsConfig, key: string): boolean {
  return fields[key]?.required ?? false;
}

function buildLabel(fields: FieldsConfig, label: string, key: string): string {
  return isFieldRequired(fields, key) ? `${label} *` : label;
}

function buildPlaceholder(fields: FieldsConfig, key: string): string {
  return isFieldRequired(fields, key) ? 'Zorunlu Alan' : 'Opsiyonel';
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
  unit?: string;
  sortOrder: number;
  isSystem: boolean;
  status: string;
  _count?: { workSubGroups: number };
};

const emptyGroupForm = { code: '', name: '', description: '', unit: '', sortOrder: 0 };
function makeEmptySubForm(unitOpts: string[]) {
  return { code: '', name: '', description: '', unitType: unitOpts[0] ?? 'm²', unitPrice: '', sortOrder: 0 };
}

export default function IsGruplariPage() {
  const [groups, setGroups] = useState<WorkGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<WorkGroup | null>(null);
  const [groupForm, setGroupForm] = useState({ ...emptyGroupForm });
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupError, setGroupError] = useState('');
  const [groupFieldConfig, setGroupFieldConfig] = useState<FieldsConfig>({});
  const [unitOptions, setUnitOptions] = useState<string[]>(DEFAULT_UNIT_OPTIONS);

  // Alt grup state
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [subGroups, setSubGroups] = useState<Record<string, WorkSubGroup[]>>({});
  const [loadingSubGroups, setLoadingSubGroups] = useState<Record<string, boolean>>({});
  const [showSubModal, setShowSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState<WorkSubGroup | null>(null);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [subForm, setSubForm] = useState(makeEmptySubForm(DEFAULT_UNIT_OPTIONS));
  const [savingSub, setSavingSub] = useState(false);
  const [subError, setSubError] = useState('');

  // Delete confirm state
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<WorkGroup | null>(null);
  const [deleteSubTarget, setDeleteSubTarget] = useState<WorkSubGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [subFieldConfig, setSubFieldConfig] = useState<FieldsConfig>({});

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/work-groups`, { headers: authHeader() });
      setGroups(res.data.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchGroups();
    axios.get(`${API}/system-settings/work-group-fields`, { headers: authHeader() })
      .then((r) => setGroupFieldConfig(r.data.data ?? {}))
      .catch(console.error);
    axios.get(`${API}/system-settings/work-sub-group-fields`, { headers: authHeader() })
      .then((r) => setSubFieldConfig(r.data.data ?? {}))
      .catch(console.error);
    axios.get(`${API}/system-settings/unit-options`, { headers: authHeader() })
      .then((r) => { if (r.data.data?.length) setUnitOptions(r.data.data); })
      .catch(console.error);
  }, [fetchGroups]);

  const fetchSubGroups = useCallback(async (groupId: string) => {
    setLoadingSubGroups((prev) => ({ ...prev, [groupId]: true }));
    try {
      const res = await axios.get(`${API}/work-groups/${groupId}/sub-groups`, { headers: authHeader() });
      setSubGroups((prev) => ({ ...prev, [groupId]: res.data.data ?? [] }));
    } catch (e) { console.error(e); }
    finally { setLoadingSubGroups((prev) => ({ ...prev, [groupId]: false })); }
  }, []);

  const toggleExpand = (groupId: string) => {
    if (expandedGroupId === groupId) {
      setExpandedGroupId(null);
    } else {
      setExpandedGroupId(groupId);
      if (!subGroups[groupId]) fetchSubGroups(groupId);
    }
  };

  // İş Grubu CRUD
  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupForm({ ...emptyGroupForm });
    setGroupError('');
    setShowGroupModal(true);
  };

  const openEditGroup = (g: WorkGroup) => {
    setEditingGroup(g);
    setGroupForm({ code: g.code, name: g.name, description: g.description ?? '', unit: g.unit ?? '', sortOrder: g.sortOrder });
    setGroupError('');
    setShowGroupModal(true);
  };

  const handleSaveGroup = async () => {
    const missing: string[] = [];
    if (isFieldRequired(groupFieldConfig, 'code') && !groupForm.code) missing.push('Kod');
    if (isFieldRequired(groupFieldConfig, 'name') && !groupForm.name) missing.push('Ad');
    if (isFieldRequired(groupFieldConfig, 'description') && !groupForm.description) missing.push('Açıklama');
    if (missing.length > 0) { setGroupError(`${missing.join(', ')} zorunludur`); return; }
    const dupName = groups.find((g) =>
      g.name.trim().toLowerCase() === groupForm.name.trim().toLowerCase() && (!editingGroup || g.id !== editingGroup.id)
    );
    if (dupName) { setGroupError('Bu isimde bir iş grubu zaten mevcut!'); return; }

    setSavingGroup(true);
    setGroupError('');
    try {
      if (editingGroup) {
        await axios.put(`${API}/work-groups/${editingGroup.id}`, {
          name: groupForm.name,
          description: groupForm.description || undefined,
          unit: groupForm.unit || undefined,
          sortOrder: groupForm.sortOrder,
        }, { headers: authHeader() });
      } else {
        await axios.post(`${API}/work-groups`, {
          ...groupForm,
          description: groupForm.description || undefined,
        }, { headers: authHeader() });
      }
      setShowGroupModal(false);
      fetchGroups();
    } catch (e: any) {
      setGroupError(e.response?.data?.message ?? 'Bir hata oluştu');
    } finally { setSavingGroup(false); }
  };

  const handleToggleGroupStatus = async (g: WorkGroup) => {
    try {
      await axios.put(`${API}/work-groups/${g.id}`, {
        status: g.status === 'active' ? 'inactive' : 'active',
      }, { headers: authHeader() });
      fetchGroups();
    } catch (e: any) { alert(e.response?.data?.message ?? 'Güncellenemedi'); }
  };

  const handleDeleteGroup = async (g: WorkGroup) => {
    setDeleteGroupTarget(g);
  };

  const confirmDeleteGroup = async () => {
    if (!deleteGroupTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/work-groups/${deleteGroupTarget.id}`, { headers: authHeader() });
      setDeleteGroupTarget(null);
      fetchGroups();
    } catch (e: any) { alert(e.response?.data?.message ?? 'Silinemedi'); }
    finally { setDeleting(false); }
  };

  // Alt Grup CRUD
  const openCreateSub = (groupId: string) => {
    setEditingSub(null);
    setCurrentGroupId(groupId);
    setSubForm(makeEmptySubForm(unitOptions));
    setSubError('');
    setShowSubModal(true);
  };

  const openEditSub = (sub: WorkSubGroup) => {
    setEditingSub(sub);
    setCurrentGroupId(sub.workGroupId);
    setSubForm({
      code: sub.code,
      name: sub.name,
      description: sub.description ?? '',
      unitType: sub.unitType,
      unitPrice: sub.unitPrice != null ? String(sub.unitPrice) : '',
      sortOrder: sub.sortOrder,
    });
    setSubError('');
    setShowSubModal(true);
  };

  const handleSaveSub = async () => {
    const missing: string[] = [];
    if (isFieldRequired(subFieldConfig, 'code') && !subForm.code) missing.push('Kod');
    if (isFieldRequired(subFieldConfig, 'name') && !subForm.name) missing.push('Ad');
    if (isFieldRequired(subFieldConfig, 'description') && !subForm.description) missing.push('Açıklama');
    if (isFieldRequired(subFieldConfig, 'unitType') && !subForm.unitType) missing.push('Birim Tipi');
    if (missing.length > 0) { setSubError(`${missing.join(', ')} zorunludur`); return; }

    setSavingSub(true);
    setSubError('');
    try {
      const payload = {
        code: subForm.code,
        name: subForm.name,
        description: subForm.description || undefined,
        unitType: subForm.unitType,
        unitPrice: subForm.unitPrice ? parseFloat(subForm.unitPrice) : undefined,
        sortOrder: subForm.sortOrder,
      };
      if (editingSub) {
        await axios.put(`${API}/work-sub-groups/${editingSub.id}`, payload, { headers: authHeader() });
      } else {
        await axios.post(`${API}/work-groups/${currentGroupId}/sub-groups`, payload, { headers: authHeader() });
      }
      setShowSubModal(false);
      if (currentGroupId) fetchSubGroups(currentGroupId);
      fetchGroups();
    } catch (e: any) {
      setSubError(e.response?.data?.message ?? 'Bir hata oluştu');
    } finally { setSavingSub(false); }
  };

  const handleToggleSubStatus = async (sub: WorkSubGroup) => {
    try {
      await axios.put(`${API}/work-sub-groups/${sub.id}`, {
        status: sub.status === 'active' ? 'inactive' : 'active',
      }, { headers: authHeader() });
      fetchSubGroups(sub.workGroupId);
    } catch (e: any) { alert(e.response?.data?.message ?? 'Güncellenemedi'); }
  };

  const handleDeleteSub = async (sub: WorkSubGroup) => {
    setDeleteSubTarget(sub);
  };

  const confirmDeleteSub = async () => {
    if (!deleteSubTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/work-sub-groups/${deleteSubTarget.id}`, { headers: authHeader() });
      setDeleteSubTarget(null);
      fetchSubGroups(deleteSubTarget.workGroupId);
      fetchGroups();
    } catch (e: any) { alert(e.response?.data?.message ?? 'Silinemedi'); }
    finally { setDeleting(false); }
  };

  return (
    <SettingsPageLayout
      title="İş Grubu Yönetimi"
      description="Hasar Raporu için İş Grupları ve Alt Grup Tanımlarını Yönetin"
      addButtonText="+ Yeni İş Grubu"
      onAdd={openCreateGroup}
    >


      <SettingsTable loading={loading} empty={groups.length === 0} emptyText="Henüz İş Grubu Tanımlanmamış.">
        <SettingsTableHead>
          <SettingsTableTh>Kod</SettingsTableTh>
          <SettingsTableTh>Ad</SettingsTableTh>
          <SettingsTableTh>Açıklama</SettingsTableTh>
          <SettingsTableTh>Birim</SettingsTableTh>
          <SettingsTableTh>Alt Grup</SettingsTableTh>
          <SettingsTableTh>Durum</SettingsTableTh>
          <SettingsTableTh />
        </SettingsTableHead>
        <SettingsTableBody>
          {groups.map((g) => (
            <>
              <SettingsTableRow key={g.id}>
                <SettingsTableTd>
                  <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{g.code}</code>
                </SettingsTableTd>
                <SettingsTableTd>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800">{g.name}</p>
                    {g.isSystem && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Sistem</span>}
                  </div>
                </SettingsTableTd>
                <SettingsTableTd>
                  <p className="text-sm text-slate-500">{g.description || <span className="text-slate-300">—</span>}</p>
                </SettingsTableTd>
                <SettingsTableTd>
                  {g.unit ? (
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{g.unit}</span>
                  ) : <span className="text-slate-300 text-sm">—</span>}
                </SettingsTableTd>
                <SettingsTableTd>
                  <button type="button"
                    onClick={() => toggleExpand(g.id)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <span>{g._count?.workSubGroups ?? 0} alt grup</span>
                    <svg className={`w-3 h-3 transition-transform ${expandedGroupId === g.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </SettingsTableTd>
                <SettingsTableTd>
                  <button type="button" onClick={() => handleToggleGroupStatus(g)}>
                    <StatusBadge active={g.status === 'active'} />
                  </button>
                </SettingsTableTd>
                <SettingsTableActions>
                  <EditButton onClick={() => openEditGroup(g)} />
                  {!g.isSystem && <DeleteButton onClick={() => handleDeleteGroup(g)} />}
                </SettingsTableActions>
              </SettingsTableRow>

              {/* Alt gruplar paneli */}
              {expandedGroupId === g.id && (
                <tr key={`${g.id}-sub`}>
                  <td colSpan={7} className="px-0 py-0">
                    <div className="bg-blue-50/40 border-t border-blue-100 px-8 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{g.name} — Alt Gruplar</p>
                        <button type="button" onClick={() => openCreateSub(g.id)}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
                          + Alt Grup Ekle
                        </button>
                      </div>
                      {loadingSubGroups[g.id] ? (
                        <p className="text-xs text-slate-400 py-2">Yükleniyor...</p>
                      ) : !subGroups[g.id] || subGroups[g.id].length === 0 ? (
                        <p className="text-xs text-slate-400 py-2">Henüz Alt Grup Eklenmemiş.</p>
                      ) : (
                        <table className="w-full bg-white rounded-lg border border-slate-100 overflow-hidden text-sm">
                          <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Kod</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Ad</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Açıklama</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Birim Tipi</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Birim Fiyat</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Durum</th>
                              <th className="px-4 py-2" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {subGroups[g.id].map((sub) => (
                              <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2.5"><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{sub.code}</code></td>
                                <td className="px-4 py-2.5 text-sm font-medium text-slate-800">{sub.name}</td>
                                <td className="px-4 py-2.5 text-sm text-slate-500">{sub.description || <span className="text-slate-300">—</span>}</td>
                                <td className="px-4 py-2.5"><span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{sub.unitType}</span></td>
                                <td className="px-4 py-2.5 text-sm text-slate-600">
                                  {sub.unitPrice != null ? `₺${Number(sub.unitPrice).toFixed(2)}` : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-4 py-2.5">
                                  <button type="button" onClick={() => handleToggleSubStatus(sub)}>
                                    <StatusBadge active={sub.status === 'active'} />
                                  </button>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center justify-end gap-1">
                                    <EditButton onClick={() => openEditSub(sub)} />
                                    <DeleteButton onClick={() => handleDeleteSub(sub)} />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </SettingsTableBody>
      </SettingsTable>

      {/* İş Grubu Modal */}
      <SettingsModal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        title={editingGroup ? 'İş Grubu Düzenle' : 'Yeni İş Grubu'}
        onSave={handleSaveGroup}
        saving={savingGroup}
        error={groupError}
      >
        <div>
          <label className={labelCls}>{buildLabel(groupFieldConfig, 'Kod', 'code')}</label>
          <input className={`${inputCls} disabled:bg-slate-50`}
            value={groupForm.code}
            onChange={(e) => setGroupForm({ ...groupForm, code: e.target.value.toUpperCase().replace(/\s/g, '_') })}
            placeholder={buildPlaceholder(groupFieldConfig, 'code')}
            disabled={!!editingGroup}
          />
        </div>
        <div>
          <label className={labelCls}>{buildLabel(groupFieldConfig, 'Ad', 'name')}</label>
          <input className={inputCls}
            value={groupForm.name}
            onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
            placeholder={buildPlaceholder(groupFieldConfig, 'name')}
          />
        </div>
        <div>
          <label className={labelCls}>{buildLabel(groupFieldConfig, 'Açıklama', 'description')}</label>
          <input className={inputCls}
            value={groupForm.description}
            onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
            placeholder={buildPlaceholder(groupFieldConfig, 'description')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{buildLabel(groupFieldConfig, 'Varsayılan Birim', 'unit')}</label>
            <select className={inputCls}
              value={groupForm.unit}
              onChange={(e) => setGroupForm({ ...groupForm, unit: e.target.value })}
            >
              <option value="">Opsiyonel</option>
              {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>{buildLabel(groupFieldConfig, 'Sıra', 'sortOrder')}</label>
            <input type="number" className={inputCls} min={0}
              value={groupForm.sortOrder}
              onChange={(e) => setGroupForm({ ...groupForm, sortOrder: parseInt(e.target.value) || 0 })}
              placeholder={buildPlaceholder(groupFieldConfig, 'sortOrder')}
            />
          </div>
        </div>
      </SettingsModal>

      {/* Alt Grup Modal */}
      <SettingsModal
        isOpen={showSubModal}
        onClose={() => setShowSubModal(false)}
        title={editingSub ? 'Alt Grup Düzenle' : 'Yeni Alt Grup'}
        onSave={handleSaveSub}
        saving={savingSub}
        error={subError}
      >
        <div>
          <label className={labelCls}>{buildLabel(subFieldConfig, 'Kod', 'code')}</label>
          <input className={`${inputCls} disabled:bg-slate-50`}
            value={subForm.code}
            onChange={(e) => setSubForm({ ...subForm, code: e.target.value.toUpperCase().replace(/\s/g, '_') })}
            placeholder={buildPlaceholder(subFieldConfig, 'code')}
            disabled={!!editingSub}
          />
        </div>
        <div>
          <label className={labelCls}>{buildLabel(subFieldConfig, 'Ad', 'name')}</label>
          <input className={inputCls}
            value={subForm.name}
            onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
            placeholder={buildPlaceholder(subFieldConfig, 'name')}
          />
        </div>
        <div>
          <label className={labelCls}>{buildLabel(subFieldConfig, 'Açıklama', 'description')}</label>
          <input className={inputCls}
            value={subForm.description}
            onChange={(e) => setSubForm({ ...subForm, description: e.target.value })}
            placeholder={buildPlaceholder(subFieldConfig, 'description')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{buildLabel(subFieldConfig, 'Birim Tipi', 'unitType')}</label>
            <select className={inputCls}
              value={subForm.unitType}
              onChange={(e) => setSubForm({ ...subForm, unitType: e.target.value })}
            >
              {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>{buildLabel(subFieldConfig, 'Birim Fiyat (₺)', 'unitPrice')}</label>
            <input type="number" step="0.01" min={0} className={inputCls}
              value={subForm.unitPrice}
              onChange={(e) => setSubForm({ ...subForm, unitPrice: e.target.value })}
              placeholder={buildPlaceholder(subFieldConfig, 'unitPrice')}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>{buildLabel(subFieldConfig, 'Sıra', 'sortOrder')}</label>
          <input type="number" min={0} className={inputCls}
            value={subForm.sortOrder}
            onChange={(e) => setSubForm({ ...subForm, sortOrder: parseInt(e.target.value) || 0 })}
            placeholder={buildPlaceholder(subFieldConfig, 'sortOrder')}
          />
        </div>
      </SettingsModal>

      <DeleteConfirmDialog
        isOpen={deleteGroupTarget !== null}
        onClose={() => setDeleteGroupTarget(null)}
        onConfirm={confirmDeleteGroup}
        deleting={deleting}
        itemName={deleteGroupTarget?.name}
        description={`"${deleteGroupTarget?.name}" iş grubunu silmek istediğinize emin misiniz? Alt gruplar da silinecektir.`}
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
