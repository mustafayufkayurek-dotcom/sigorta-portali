'use client';

import { useEffect, useState } from 'react';
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
function authHeader() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }; }

interface Agreement {
  id: string; title: string; type: string; version: string;
  isActive: boolean; content: string; createdAt: string; updatedAt: string;
}

const typeLabels: Record<string, string> = {
  kvkk: 'KVKK Aydınlatma Metni',
  gizlilik: 'Gizlilik Taahhütnamesi',
  is_sozlesmesi: 'İş Sözleşmesi',
};

const KVKK_TEMPLATE = `<h2>KİŞİSEL VERİLERİN KORUNMASI KANUNU AYDINLATMA METNİ</h2>
<p>6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında, kişisel verilerinizin işlenmesine ilişkin bilgilendirme yapmak amacıyla bu aydınlatma metni hazırlanmıştır.</p>
<h3>1. Veri Sorumlusu</h3>
<p>Şirketimiz, kişisel verilerinizin işlenmesinde veri sorumlusu sıfatıyla hareket etmektedir.</p>
<h3>2. İşlenen Kişisel Veriler</h3>
<p>Kimlik bilgileri (ad, soyad, TC kimlik numarası), iletişim bilgileri (telefon, e-posta, adres), finansal bilgiler ve mesleki bilgiler işlenebilmektedir.</p>
<h3>3. Kişisel Veri İşlemenin Amaçları</h3>
<p>Kişisel verileriniz; hizmet sözleşmesinin ifası, yasal yükümlülüklerin yerine getirilmesi ve iş süreçlerinin yürütülmesi amacıyla işlenmektedir.</p>`;

const GIZLILIK_TEMPLATE = `<h2>GİZLİLİK TAAHHÜTNAME</h2>
<p>Bu taahhütname, çalışanlar/hizmet sağlayıcılar ile şirketimiz arasında gizlilik yükümlülüklerini düzenlemektedir.</p>
<h3>1. Gizli Bilgilerin Tanımı</h3>
<p>Şirkete ait müşteri verileri, finansal bilgiler, iş süreçleri, teknik bilgiler ve bu taahhütname kapsamında paylaşılan tüm bilgiler gizli kabul edilir.</p>`;

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SozlesmelerPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Agreement | null>(null);
  const [form, setForm] = useState({ title: '', type: 'kvkk', version: '1.0', content: '', isActive: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Agreement | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/agreements`, { headers: authHeader() });
      const json = await res.json();
      setAgreements(json?.data ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openNew() { setEditItem(null); setForm({ title: '', type: 'kvkk', version: '1.0', content: '', isActive: true }); setError(''); setShowModal(true); }
  function openEdit(item: Agreement) { setEditItem(item); setForm({ title: item.title, type: item.type, version: item.version, content: item.content, isActive: item.isActive }); setError(''); setShowModal(true); }

  function applyTemplate() {
    if (form.type === 'kvkk') setForm((f) => ({ ...f, content: KVKK_TEMPLATE }));
    if (form.type === 'gizlilik') setForm((f) => ({ ...f, content: GIZLILIK_TEMPLATE }));
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      const url = editItem ? `${API}/agreements/${editItem.id}` : `${API}/agreements`;
      const method = editItem ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(form) });
      if (!res.ok) { const json = await res.json(); throw new Error(json?.message ?? 'Kayıt başarısız'); }
      setShowModal(false); await load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`${API}/agreements/${deleteTarget.id}`, { method: 'DELETE', headers: authHeader() });
      setDeleteTarget(null); await load();
    } finally { setDeleting(false); }
  }

  async function toggleActive(item: Agreement) {
    await fetch(`${API}/agreements/${item.id}`, { method: 'PATCH', headers: authHeader(), body: JSON.stringify({ isActive: !item.isActive }) });
    await load();
  }

  return (
    <SettingsPageLayout
      title="Sözleşme Yönetimi"
      description="KVKK ve gizlilik belgelerini yönetin"
      addButtonText="+ Yeni Sözleşme"
      onAdd={openNew}
    >
      <SettingsTable loading={loading} empty={agreements.length === 0} emptyText="Henüz sözleşme eklenmemiş.">
        <SettingsTableHead>
          <SettingsTableTh>Başlık</SettingsTableTh>
          <SettingsTableTh>Tür</SettingsTableTh>
          <SettingsTableTh>Versiyon</SettingsTableTh>
          <SettingsTableTh>Durum</SettingsTableTh>
          <SettingsTableTh>Tarih</SettingsTableTh>
          <SettingsTableTh />
        </SettingsTableHead>
        <SettingsTableBody>
          {agreements.map((a) => (
            <SettingsTableRow key={a.id}>
              <SettingsTableTd><p className="text-sm font-medium text-slate-900">{a.title}</p></SettingsTableTd>
              <SettingsTableTd>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                  {typeLabels[a.type] ?? a.type}
                </span>
              </SettingsTableTd>
              <SettingsTableTd>v{a.version}</SettingsTableTd>
              <SettingsTableTd>
                <button type="button" onClick={() => toggleActive(a)}>
                  <StatusBadge active={a.isActive} />
                </button>
              </SettingsTableTd>
              <SettingsTableTd className="text-xs text-slate-400">{fmtDate(a.updatedAt)}</SettingsTableTd>
              <SettingsTableActions>
                <EditButton onClick={() => openEdit(a)} />
                <DeleteButton onClick={() => setDeleteTarget(a)} />
              </SettingsTableActions>
            </SettingsTableRow>
          ))}
        </SettingsTableBody>
      </SettingsTable>

      <SettingsModal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editItem ? 'Sözleşmeyi Düzenle' : 'Yeni Sözleşme'}
        onSave={handleSave} saving={saving} error={error} maxWidth="xl">
        <div>
          <label className={labelCls}>Başlık <span className="text-red-500">*</span></label>
          <input type="text" className={inputCls} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Sözleşme başlığı" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Tür <span className="text-red-500">*</span></label>
            <select className={`${inputCls} bg-white`} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="kvkk">KVKK Aydınlatma Metni</option>
              <option value="gizlilik">Gizlilik Taahhütnamesi</option>
              <option value="is_sozlesmesi">İş Sözleşmesi</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Versiyon</label>
            <input type="text" className={inputCls} value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} placeholder="1.0" />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={labelCls}>İçerik (HTML) <span className="text-red-500">*</span></label>
            {!editItem && (
              <button type="button" onClick={applyTemplate} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                Şablon Uygula
              </button>
            )}
          </div>
          <textarea className={`${inputCls} font-mono text-xs`} rows={12}
            value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder="Sözleşme HTML içeriğini girin..." />
        </div>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <button type="button" role="checkbox" aria-checked={form.isActive}
            onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
            className={`w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-all ${form.isActive ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300 hover:border-blue-400'}`}>
            {form.isActive && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <span className="text-sm text-slate-700">Aktif — kullanıcılardan onay istenir</span>
        </label>
      </SettingsModal>

      <DeleteConfirmDialog isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm} deleting={deleting} itemName={deleteTarget?.title} />
    </SettingsPageLayout>
  );
}
