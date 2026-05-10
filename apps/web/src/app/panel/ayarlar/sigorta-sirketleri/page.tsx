'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { EntityDocumentsTab } from '@/components/EntityDocumentsTab';
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

type InsuranceCompany = {
  id: string; code: string; name: string; taxNumber: string; contactEmail: string;
  contactPhone: string; address: string; status: 'active' | 'inactive'; notes: string;
  createdAt: string; updatedAt: string;
};

type FormState = {
  name: string; taxNumber: string; contactEmail: string; contactPhone: string;
  address: string; status: 'active' | 'inactive'; notes: string;
};

const emptyForm: FormState = { name: '', taxNumber: '', contactEmail: '', contactPhone: '', address: '', status: 'active', notes: '' };

export default function SigortaSirketleriPage() {
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InsuranceCompany | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<InsuranceCompany | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [drawerCompany, setDrawerCompany] = useState<InsuranceCompany | null>(null);
  const [drawerTab, setDrawerTab] = useState<'bilgi' | 'evraklar'>('bilgi');

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/insurance-companies`, { headers: authHeader() });
      setCompanies(res.data.data ?? res.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const filtered = companies.filter((c) => statusFilter === 'all' ? true : c.status === statusFilter);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setError(''); setShowModal(true); };
  const openEdit = (c: InsuranceCompany) => {
    setEditing(c);
    setForm({ name: c.name, taxNumber: c.taxNumber ?? '', contactEmail: c.contactEmail ?? '',
      contactPhone: c.contactPhone ?? '', address: c.address ?? '', status: c.status, notes: c.notes ?? '' });
    setError(''); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Şirket Adı Zorunludur.'); return; }
    const duplicate = companies.find((c) =>
      c.name.trim().toLowerCase() === form.name.trim().toLowerCase() && (!editing || c.id !== editing.id)
    );
    if (duplicate) { setError('Bu isimde bir sigorta şirketi zaten mevcut!'); return; }
    setSaving(true); setError('');
    try {
      if (editing) {
        await axios.patch(`${API}/insurance-companies/${editing.id}`, form, { headers: authHeader() });
      } else {
        await axios.post(`${API}/insurance-companies`, form, { headers: authHeader() });
      }
      setShowModal(false); fetchCompanies();
    } catch (e: unknown) {
      setError(axios.isAxiosError(e) ? (e.response?.data?.message ?? 'Bir Hata Oluştu.') : 'Bir Hata Oluştu.');
    } finally { setSaving(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/insurance-companies/${deleteTarget.id}`, { headers: authHeader() });
      setDeleteTarget(null); fetchCompanies();
    } catch (e: unknown) {
      alert(axios.isAxiosError(e) ? (e.response?.data?.message ?? 'Silinemedi.') : 'Silinemedi.');
    } finally { setDeleting(false); }
  };

  return (
    <SettingsPageLayout
      title="Sigorta Şirketleri"
      description="Sistemdeki Sigorta Şirketlerini Görüntüleyin ve Yönetin"
      addButtonText="+ Yeni Şirket"
      onAdd={openCreate}
    >
      {/* Filters */}
      <div className="mb-4 flex gap-2">
        {(['all', 'active', 'inactive'] as const).map((s) => (
          <button type="button" key={s} onClick={() => setStatusFilter(s)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              statusFilter === s ? 'border-blue-500 bg-blue-50 text-blue-600 font-medium' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}>
            {s === 'all' ? 'Tümü' : s === 'active' ? 'Aktif' : 'Pasif'}
            {s !== 'all' && (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                {companies.filter((c) => c.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <SettingsTable loading={loading} empty={filtered.length === 0}
        emptyText={statusFilter === 'all' ? 'Henüz sigorta şirketi eklenmemiş.' : `${statusFilter === 'active' ? 'Aktif' : 'Pasif'} şirket bulunamadı.`}>
        <SettingsTableHead>
          <SettingsTableTh>Şirket</SettingsTableTh>
          <SettingsTableTh>Kod</SettingsTableTh>
          <SettingsTableTh>Vergi No</SettingsTableTh>
          <SettingsTableTh>İletişim</SettingsTableTh>
          <SettingsTableTh>Durum</SettingsTableTh>
          <SettingsTableTh>Kayıt Tarihi</SettingsTableTh>
          <SettingsTableTh />
        </SettingsTableHead>
        <SettingsTableBody>
          {filtered.map((c) => (
            <SettingsTableRow key={c.id} onClick={() => { setDrawerCompany(c); setDrawerTab('bilgi'); }}>
              <SettingsTableTd>
                <p className="text-sm font-medium text-slate-800">{c.name}</p>
                {c.address && <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">{c.address}</p>}
              </SettingsTableTd>
              <SettingsTableTd><code className="rounded bg-slate-100 px-2 py-0.5 text-xs">{c.code}</code></SettingsTableTd>
              <SettingsTableTd>{c.taxNumber || '—'}</SettingsTableTd>
              <SettingsTableTd>
                <div className="space-y-0.5">
                  {c.contactEmail && <p className="text-xs text-slate-600">{c.contactEmail}</p>}
                  {c.contactPhone && <p className="text-xs text-slate-400">{c.contactPhone}</p>}
                  {!c.contactEmail && !c.contactPhone && <span className="text-xs text-slate-300">—</span>}
                </div>
              </SettingsTableTd>
              <SettingsTableTd><StatusBadge active={c.status === 'active'} /></SettingsTableTd>
              <SettingsTableTd className="text-slate-400">{new Date(c.createdAt).toLocaleDateString('tr-TR')}</SettingsTableTd>
              <SettingsTableActions>
                <button type="button" onClick={() => { setDrawerCompany(c); setDrawerTab('evraklar'); }}
                  className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-xs">
                  Evrak
                </button>
                <EditButton onClick={() => openEdit(c)} />
                <DeleteButton onClick={() => setDeleteTarget(c)} />
              </SettingsTableActions>
            </SettingsTableRow>
          ))}
        </SettingsTableBody>
      </SettingsTable>

      <SettingsModal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'Şirket Düzenle' : 'Yeni Sigorta Şirketi'}
        onSave={handleSave} saving={saving} error={error} maxWidth="lg">
        <div>
          <label className={labelCls}>Durum</label>
          <select className={`${inputCls} bg-white`} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Şirket Adı *</label>
          <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Zorunlu Alan" />
        </div>
        <div>
          <label className={labelCls}>Vergi No</label>
          <input className={inputCls} value={form.taxNumber} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })} placeholder="Opsiyonel" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>E-posta</label>
            <input type="email" className={inputCls} value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="Opsiyonel" />
          </div>
          <div>
            <label className={labelCls}>Telefon</label>
            <input className={inputCls} value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="Opsiyonel" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Adres</label>
          <textarea className={`${inputCls} resize-none`} rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Opsiyonel" />
        </div>
        <div>
          <label className={labelCls}>Notlar</label>
          <textarea className={`${inputCls} resize-none`} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opsiyonel" />
        </div>
      </SettingsModal>

      <DeleteConfirmDialog isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm} deleting={deleting} itemName={deleteTarget?.name} />

      {/* Company Detail Drawer */}
      {drawerCompany && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" onClick={() => setDrawerCompany(null)} />
          <div className="w-full max-w-lg bg-white shadow-2xl border-l border-slate-100 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{drawerCompany.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  <code className="bg-slate-100 rounded px-1.5 py-0.5">{drawerCompany.code}</code>
                  <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${drawerCompany.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {drawerCompany.status === 'active' ? 'Aktif' : 'Pasif'}
                  </span>
                </p>
              </div>
              <button type="button" onClick={() => setDrawerCompany(null)} className="text-slate-400 hover:text-slate-700 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex border-b border-slate-100">
              {(['bilgi', 'evraklar'] as const).map((t) => (
                <button type="button" key={t} onClick={() => setDrawerTab(t)}
                  className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${drawerTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                  {t === 'bilgi' ? 'Şirket Bilgileri' : 'Evraklar'}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {drawerTab === 'bilgi' && (
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Vergi No', value: drawerCompany.taxNumber || '—' },
                    { label: 'E-posta', value: drawerCompany.contactEmail || '—' },
                    { label: 'Telefon', value: drawerCompany.contactPhone || '—' },
                    { label: 'Kayıt Tarihi', value: new Date(drawerCompany.createdAt).toLocaleDateString('tr-TR') },
                  ].map((f) => (
                    <div key={f.label}>
                      <p className="text-xs text-slate-400 mb-0.5">{f.label}</p>
                      <p className="text-sm font-medium text-slate-800">{f.value}</p>
                    </div>
                  ))}
                  {drawerCompany.address && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-400 mb-0.5">Adres</p>
                      <p className="text-sm text-slate-800">{drawerCompany.address}</p>
                    </div>
                  )}
                  {drawerCompany.notes && (
                    <div className="col-span-2 bg-yellow-50 rounded-lg p-3 border border-yellow-100">
                      <p className="text-xs text-slate-500 mb-0.5">Notlar</p>
                      <p className="text-sm text-slate-700">{drawerCompany.notes}</p>
                    </div>
                  )}
                  <div className="col-span-2 flex gap-2 pt-2">
                    <button type="button" onClick={() => { openEdit(drawerCompany); setDrawerCompany(null); }}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700">
                      Düzenle
                    </button>
                  </div>
                </div>
              )}
              {drawerTab === 'evraklar' && (
                <EntityDocumentsTab mode="entity" entityType="insurance_company" entityId={drawerCompany.id} title="Sigorta Şirketi Evrakları" />
              )}
            </div>
          </div>
        </div>
      )}
    </SettingsPageLayout>
  );
}
