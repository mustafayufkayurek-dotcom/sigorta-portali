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

type ClaimLocation = {
  id: string; code: string; name: string; description?: string;
  sortOrder: number; status: string; parentId?: string | null;
  _count?: { children: number };
};
type FieldRule = { required: boolean };
type FieldsConfig = Record<string, FieldRule>;

function isFieldRequired(fields: FieldsConfig, key: string) { return fields[key]?.required ?? false; }
function buildLabel(fields: FieldsConfig, label: string, key: string) { return isFieldRequired(fields, key) ? `${label} *` : label; }
function buildPlaceholder(fields: FieldsConfig, key: string) { return isFieldRequired(fields, key) ? 'Zorunlu Alan' : 'Opsiyonel'; }

const emptyForm = { code: '', name: '', description: '', sortOrder: 0 };

export default function MahallerPage() {
  const [locations, setLocations] = useState<ClaimLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ClaimLocation | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldConfig, setFieldConfig] = useState<FieldsConfig>({});

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [subLocations, setSubLocations] = useState<Record<string, ClaimLocation[]>>({});
  const [loadingSubs, setLoadingSubs] = useState<Record<string, boolean>>({});
  const [showSubModal, setShowSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState<ClaimLocation | null>(null);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [subForm, setSubForm] = useState({ ...emptyForm });
  const [savingSub, setSavingSub] = useState(false);
  const [subError, setSubError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<ClaimLocation | null>(null);
  const [deleteSubTarget, setDeleteSubTarget] = useState<ClaimLocation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/claim-locations`, { headers: authHeader() });
      setLocations(res.data.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchLocations();
    axios.get(`${API}/system-settings/location-fields`, { headers: authHeader() })
      .then((r) => setFieldConfig(r.data.data ?? {}))
      .catch(console.error);
  }, [fetchLocations]);

  const fetchSubLocations = useCallback(async (parentId: string) => {
    setLoadingSubs((prev) => ({ ...prev, [parentId]: true }));
    try {
      const res = await axios.get(`${API}/claim-locations/${parentId}/sub-locations`, { headers: authHeader() });
      setSubLocations((prev) => ({ ...prev, [parentId]: res.data.data ?? [] }));
    } catch (e) { console.error(e); }
    finally { setLoadingSubs((prev) => ({ ...prev, [parentId]: false })); }
  }, []);

  const toggleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); }
    else { setExpandedId(id); if (!subLocations[id]) fetchSubLocations(id); }
  };

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setError(''); setShowModal(true); };
  const openEdit = (loc: ClaimLocation) => {
    setEditing(loc);
    setForm({ code: loc.code, name: loc.name, description: loc.description ?? '', sortOrder: loc.sortOrder });
    setError(''); setShowModal(true);
  };

  const handleSave = async () => {
    const missing: string[] = [];
    if (isFieldRequired(fieldConfig, 'code') && !form.code) missing.push('Kod');
    if (isFieldRequired(fieldConfig, 'name') && !form.name) missing.push('Ad');
    if (isFieldRequired(fieldConfig, 'description') && !form.description) missing.push('Açıklama');
    if (missing.length > 0) { setError(`${missing.join(', ')} zorunludur`); return; }
    if (form.name) {
      const dupName = locations.find((l) =>
        l.name.trim().toLowerCase() === form.name.trim().toLowerCase() && (!editing || l.id !== editing.id)
      );
      if (dupName) { setError('Bu isimde bir mahal zaten mevcut!'); return; }
    }
    setSaving(true); setError('');
    try {
      if (editing) {
        await axios.put(`${API}/claim-locations/${editing.id}`,
          { name: form.name, description: form.description || undefined, sortOrder: form.sortOrder }, { headers: authHeader() });
      } else {
        await axios.post(`${API}/claim-locations`, { ...form, description: form.description || undefined }, { headers: authHeader() });
      }
      setShowModal(false); fetchLocations();
    } catch (e: any) { setError(e.response?.data?.message ?? 'Bir hata oluştu'); }
    finally { setSaving(false); }
  };

  const handleToggleStatus = async (loc: ClaimLocation) => {
    try {
      await axios.put(`${API}/claim-locations/${loc.id}`,
        { status: loc.status === 'active' ? 'inactive' : 'active' }, { headers: authHeader() });
      fetchLocations();
    } catch (e: any) { alert(e.response?.data?.message ?? 'Güncellenemedi'); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/claim-locations/${deleteTarget.id}`, { headers: authHeader() });
      setDeleteTarget(null); fetchLocations();
    } catch (e: any) { alert(e.response?.data?.message ?? 'Silinemedi'); }
    finally { setDeleting(false); }
  };

  const openCreateSub = (parentId: string) => { setEditingSub(null); setCurrentParentId(parentId); setSubForm({ ...emptyForm }); setSubError(''); setShowSubModal(true); };
  const openEditSub = (sub: ClaimLocation) => {
    setEditingSub(sub); setCurrentParentId(sub.parentId ?? null);
    setSubForm({ code: sub.code, name: sub.name, description: sub.description ?? '', sortOrder: sub.sortOrder });
    setSubError(''); setShowSubModal(true);
  };

  const handleSaveSub = async () => {
    const missing: string[] = [];
    if (isFieldRequired(fieldConfig, 'code') && !subForm.code) missing.push('Kod');
    if (isFieldRequired(fieldConfig, 'name') && !subForm.name) missing.push('Ad');
    if (isFieldRequired(fieldConfig, 'description') && !subForm.description) missing.push('Açıklama');
    if (missing.length > 0) { setSubError(`${missing.join(', ')} zorunludur`); return; }
    setSavingSub(true); setSubError('');
    try {
      if (editingSub) {
        await axios.put(`${API}/claim-locations/${editingSub.id}`,
          { name: subForm.name, description: subForm.description || undefined, sortOrder: subForm.sortOrder }, { headers: authHeader() });
      } else {
        await axios.post(`${API}/claim-locations/${currentParentId}/sub-locations`,
          { ...subForm, description: subForm.description || undefined }, { headers: authHeader() });
      }
      setShowSubModal(false);
      if (currentParentId) fetchSubLocations(currentParentId);
      fetchLocations();
    } catch (e: any) { setSubError(e.response?.data?.message ?? 'Bir hata oluştu'); }
    finally { setSavingSub(false); }
  };

  const handleToggleSubStatus = async (sub: ClaimLocation) => {
    try {
      await axios.put(`${API}/claim-locations/${sub.id}`,
        { status: sub.status === 'active' ? 'inactive' : 'active' }, { headers: authHeader() });
      if (sub.parentId) fetchSubLocations(sub.parentId);
    } catch (e: any) { alert(e.response?.data?.message ?? 'Güncellenemedi'); }
  };

  const confirmDeleteSub = async () => {
    if (!deleteSubTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/claim-locations/${deleteSubTarget.id}`, { headers: authHeader() });
      if (deleteSubTarget.parentId) fetchSubLocations(deleteSubTarget.parentId);
      setDeleteSubTarget(null); fetchLocations();
    } catch (e: any) { alert(e.response?.data?.message ?? 'Silinemedi'); }
    finally { setDeleting(false); }
  };

  const LocationForm = ({ f, setF, fc }: { f: typeof emptyForm; setF: (v: typeof emptyForm) => void; fc: FieldsConfig }) => (
    <>
      <div>
        <label className={labelCls}>{buildLabel(fc, 'Kod', 'code')}</label>
        <input className={`${inputCls} disabled:bg-slate-50`}
          value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '_') })}
          placeholder={buildPlaceholder(fc, 'code')} disabled={!!(editing || editingSub)} />
      </div>
      <div>
        <label className={labelCls}>{buildLabel(fc, 'Ad', 'name')}</label>
        <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={buildPlaceholder(fc, 'name')} />
      </div>
      <div>
        <label className={labelCls}>{buildLabel(fc, 'Açıklama', 'description')}</label>
        <input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder={buildPlaceholder(fc, 'description')} />
      </div>
      <div>
        <label className={labelCls}>{buildLabel(fc, 'Sıra', 'sortOrder')}</label>
        <input type="number" min={0} className={inputCls} value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: parseInt(e.target.value) || 0 })} placeholder={buildPlaceholder(fc, 'sortOrder')} />
      </div>
    </>
  );

  return (
    <SettingsPageLayout
      title="Mahal Yönetimi"
      description="Hasar Raporu için Bölge ve Mahal Tanımlarını Yönetin"
      addButtonText="+ Yeni Mahal"
      onAdd={openCreate}
    >

      <SettingsTable loading={loading} empty={locations.length === 0} emptyText="Henüz mahal tanımlanmamış.">
        <SettingsTableHead>
          <SettingsTableTh>Kod</SettingsTableTh>
          <SettingsTableTh>Ad</SettingsTableTh>
          <SettingsTableTh>Açıklama</SettingsTableTh>
          <SettingsTableTh>Sıra</SettingsTableTh>
          <SettingsTableTh>Alt Bölgeler</SettingsTableTh>
          <SettingsTableTh>Durum</SettingsTableTh>
          <SettingsTableTh />
        </SettingsTableHead>
        <SettingsTableBody>
          {locations.map((loc) => (
            <>
              <SettingsTableRow key={loc.id}>
                <SettingsTableTd><code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{loc.code}</code></SettingsTableTd>
                <SettingsTableTd><p className="text-sm font-medium text-slate-800">{loc.name}</p></SettingsTableTd>
                <SettingsTableTd><p className="text-sm text-slate-500">{loc.description || <span className="text-slate-300">—</span>}</p></SettingsTableTd>
                <SettingsTableTd>{loc.sortOrder}</SettingsTableTd>
                <SettingsTableTd>
                  <button type="button" onClick={() => toggleExpand(loc.id)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <span>{loc._count?.children ?? 0} alt bölge</span>
                    <svg className={`w-3 h-3 transition-transform ${expandedId === loc.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </SettingsTableTd>
                <SettingsTableTd>
                  <button type="button" onClick={() => handleToggleStatus(loc)}>
                    <StatusBadge active={loc.status === 'active'} />
                  </button>
                </SettingsTableTd>
                <SettingsTableActions>
                  <EditButton onClick={() => openEdit(loc)} />
                  <DeleteButton onClick={() => setDeleteTarget(loc)} />
                </SettingsTableActions>
              </SettingsTableRow>

              {expandedId === loc.id && (
                <tr key={`${loc.id}-subs`}>
                  <td colSpan={7} className="px-0 py-0">
                    <div className="bg-blue-50/40 border-t border-blue-100 px-8 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{loc.name} — Alt Bölgeler</p>
                        <button type="button" onClick={() => openCreateSub(loc.id)}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
                          + Alt Bölge Ekle
                        </button>
                      </div>
                      {loadingSubs[loc.id] ? (
                        <p className="text-xs text-slate-400 py-2">Yükleniyor...</p>
                      ) : !subLocations[loc.id] || subLocations[loc.id].length === 0 ? (
                        <p className="text-xs text-slate-400 py-2">Henüz Alt Bölge Eklenmemiş.</p>
                      ) : (
                        <table className="w-full bg-white rounded-lg border border-slate-100 overflow-hidden text-sm">
                          <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                              {['Kod', 'Ad', 'Açıklama', 'Sıra', 'Durum', ''].map((h) => (
                                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {subLocations[loc.id].map((sub) => (
                              <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2.5"><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{sub.code}</code></td>
                                <td className="px-4 py-2.5 text-sm font-medium text-slate-800">{sub.name}</td>
                                <td className="px-4 py-2.5 text-sm text-slate-500">{sub.description || <span className="text-slate-300">—</span>}</td>
                                <td className="px-4 py-2.5 text-sm text-slate-500">{sub.sortOrder}</td>
                                <td className="px-4 py-2.5">
                                  <button type="button" onClick={() => handleToggleSubStatus(sub)}>
                                    <StatusBadge active={sub.status === 'active'} />
                                  </button>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center justify-end gap-1">
                                    <EditButton onClick={() => openEditSub(sub)} />
                                    <DeleteButton onClick={() => setDeleteSubTarget(sub)} />
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

      <SettingsModal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'Mahal Düzenle' : 'Yeni Mahal'} onSave={handleSave} saving={saving} error={error}>
        <LocationForm f={form} setF={setForm} fc={fieldConfig} />
      </SettingsModal>

      <SettingsModal isOpen={showSubModal} onClose={() => setShowSubModal(false)}
        title={editingSub ? 'Alt Bölge Düzenle' : 'Yeni Alt Bölge'} onSave={handleSaveSub} saving={savingSub} error={subError}>
        <LocationForm f={subForm} setF={setSubForm} fc={fieldConfig} />
      </SettingsModal>

      <DeleteConfirmDialog isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete} deleting={deleting} itemName={deleteTarget?.name} />
      <DeleteConfirmDialog isOpen={deleteSubTarget !== null} onClose={() => setDeleteSubTarget(null)}
        onConfirm={confirmDeleteSub} deleting={deleting} itemName={deleteSubTarget?.name} />
    </SettingsPageLayout>
  );
}
