'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocumentTemplate {
  id: string;
  name: string;
  type: 'tespit' | 'maliyet' | 'kesif' | 'hasar';
  description?: string;
  content: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ContractTemplate {
  id: string;
  name: string;
  type: 'tedarikci' | 'musteri' | 'gizlilik' | 'kvkk';
  description?: string;
  content: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  event: string;
  subject: string;
  body: string;
  isActive: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REPORT_TYPES = [
  { value: 'tespit', label: 'Tespit Raporu',  cls: 'bg-blue-50 text-blue-700 border-blue-100' },
  { value: 'maliyet',label: 'Maliyet Raporu', cls: 'bg-green-50 text-green-700 border-green-100' },
  { value: 'kesif',  label: 'Keşif Raporu',   cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  { value: 'hasar',  label: 'Hasar Raporu',   cls: 'bg-red-50 text-red-700 border-red-100' },
];

const CONTRACT_TYPES = [
  { value: 'tedarikci', label: 'Tedarikçi Sözleşmesi', cls: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { value: 'musteri',   label: 'Müşteri Sözleşmesi',   cls: 'bg-blue-50 text-blue-700 border-blue-100' },
  { value: 'gizlilik',  label: 'Gizlilik Sözleşmesi',  cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  { value: 'kvkk',      label: 'KVKK',                 cls: 'bg-purple-50 text-purple-700 border-purple-100' },
];

const EMAIL_EVENTS = [
  { value: 'file_assigned',      label: 'Dosya Atama' },
  { value: 'appointment_reminder',label: 'Randevu Hatırlatma' },
  { value: 'report_approval',    label: 'Rapor Onay' },
  { value: 'invoice_notification',label: 'Fatura Bildirimi' },
  { value: 'file_opened',        label: 'Dosya Açıldı' },
  { value: 'file_closed',        label: 'Dosya Kapatıldı' },
  { value: 'revision_requested', label: 'Revizyon Talep' },
  { value: 'payment_received',   label: 'Ödeme Alındı' },
];

const REPORT_PLACEHOLDERS = [
  '{dosyaNo}', '{musteriAdi}', '{hasarAdresi}', '{sigortaSirketi}',
  '{eksperAdi}', '{tarih}', '{hasarTarihi}', '{tespitBilgileri}',
  '{isKalemleri}', '{toplamTutar}', '{kesifTarihi}', '{kesifBulgulari}',
];

const CONTRACT_PLACEHOLDERS = [
  '{{sozlesme_no}}', '{{sozlesme_tarihi}}', '{{baslangic_tarihi}}',
  '{{teslim_tarihi}}', '{{dosya_no}}', '{{sigorta_sirketi}}',
  '{{hasar_adresi}}', '{{sigorta_musteri_ad}}', '{{tedarikci_ad}}',
  '{{tedarikci_vergi_no}}', '{{tedarikci_adres}}', '{{toplam_tutar}}',
];

const EMAIL_PLACEHOLDERS = [
  '{dosyaNo}', '{musteriAdi}', '{kullaniciAdi}', '{tarih}',
  '{hasarAdresi}', '{sigortaSirketi}', '{tutar}', '{sistemLink}',
];

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors';
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1';

type TabId = 'eposta' | 'rapor' | 'sozlesme';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'eposta',   label: 'E-Posta Şablonları',   icon: '✉️' },
  { id: 'rapor',    label: 'Rapor Şablonları',      icon: '📄' },
  { id: 'sozlesme', label: 'Sözleşme Şablonları',   icon: '📝' },
];

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SablonlarPage() {
  const [activeTab, setActiveTab] = useState<TabId>('eposta');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span>/</span>
        <a href="/panel/ayarlar" className="hover:text-blue-600 transition-colors">Ayarlar</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Sablonlar</span>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-3"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Geri
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Şablonlar</h1>
          <p className="text-sm text-slate-500 mt-1">E-posta, rapor ve sözleşme şablonlarını yönetin.</p>
        </div>

        {/* Tab Bar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6 overflow-x-auto">
          <div className="flex min-w-max">
            {TABS.map((tab, idx) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab.id ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                } ${idx > 0 ? 'border-l border-l-slate-100' : ''}`}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'eposta'   && <EmailSablonlarTab />}
        {activeTab === 'rapor'    && <RaporSablonlarTab />}
        {activeTab === 'sozlesme' && <SozlesmeSablonlarTab />}
      </div>
    </div>
  );
}

// ── E-Posta Şablonları ────────────────────────────────────────────────────────

function EmailSablonlarTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState({ name: '', event: 'file_assigned', subject: '', body: '', isActive: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  // E-posta şablonları system-settings üzerinden saklanıyor
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/system-settings/email-templates`, { headers: authHeader() });
      setTemplates(res.data.data ?? []);
    } catch {
      setTemplates([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', event: 'file_assigned', subject: '', body: '', isActive: true });
    setError('');
    setShowModal(true);
  };
  const openEdit = (t: EmailTemplate) => {
    setEditing(t);
    setForm({ name: t.name, event: t.event, subject: t.subject, body: t.body, isActive: t.isActive });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.subject.trim()) { setError('Ad ve konu zorunludur.'); return; }
    setSaving(true); setError('');
    try {
      let updated: EmailTemplate[];
      if (editing) {
        updated = templates.map(t => t.id === editing.id ? { ...t, ...form } : t);
      } else {
        const newT: EmailTemplate = { id: `etpl-${Date.now()}`, ...form };
        updated = [...templates, newT];
      }
      await axios.put(`${API}/system-settings/email-templates`, { values: updated }, { headers: authHeader() });
      setTemplates(updated);
      setShowModal(false);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'İşlem başarısız.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const updated = templates.filter(t => t.id !== deleteTarget.id);
      await axios.put(`${API}/system-settings/email-templates`, { values: updated }, { headers: authHeader() });
      setTemplates(updated);
      setDeleteTarget(null);
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const insertVar = (v: string) => {
    setForm(p => ({ ...p, body: p.body + v }));
  };

  return (
    <TabCard title="E-Posta Şablonları" description="Bildirim türleri için e-posta şablonları oluşturun ve yönetin.">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-slate-500">{templates.length} şablon</p>
        <button type="button" onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Yeni Şablon
        </button>
      </div>

      {loading ? <RowSkeleton /> : templates.length === 0 ? (
        <EmptyState msg="Henüz e-posta şablonu oluşturulmamış." />
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.id} className="flex items-start justify-between p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-slate-800">{t.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${t.isActive ? 'bg-green-50 text-green-700 border-green-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                    {t.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-600">{EMAIL_EVENTS.find(e => e.value === t.event)?.label ?? t.event}</span>
                  {' · '}Konu: {t.subject}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-3">
                <ActionBtn title="Düzenle" onClick={() => openEdit(t)}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </ActionBtn>
                <ActionBtn title="Sil" danger onClick={() => setDeleteTarget(t)}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </ActionBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Şablonu Düzenle' : 'Yeni E-Posta Şablonu'} onClose={() => setShowModal(false)} wide>
          {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelCls}>Şablon Adı <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input className={inputCls} value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Olay Türü</label>
              <select className={inputCls} value={form.event} onChange={(e) => setForm(p => ({ ...p, event: e.target.value }))}>
                {EMAIL_EVENTS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>E-posta Konusu <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input className={inputCls} value={form.subject} onChange={(e) => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="Konu satırı" />
            </div>
          </div>

          {/* Variable palette */}
          <div className="mb-3">
            <label className={labelCls}>Değişkenler — Tıklayarak ekleyin</label>
            <div className="flex flex-wrap gap-1.5">
              {EMAIL_PLACEHOLDERS.map(v => (
                <button key={v} type="button" onClick={() => insertVar(v)} className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-xs font-mono text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors">
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <label className={labelCls}>İçerik (HTML)</label>
            <textarea className={`${inputCls} font-mono text-xs`} rows={8} value={form.body} onChange={(e) => setForm(p => ({ ...p, body: e.target.value }))} placeholder="<p>Merhaba {musteriAdi},</p>" />
          </div>

          <div className="flex items-center gap-2 mb-4">
            <button type="button" onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}>
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
            <span className="text-xs text-slate-600">Aktif</span>
          </div>

          <div className="flex justify-end gap-2">
            <CancelBtn onClick={() => setShowModal(false)} />
            <SaveBtn loading={saving} onClick={handleSave} />
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Şablonu Sil"
          message={`"${deleteTarget.name}" şablonunu silmek istediğinize emin misiniz?`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </TabCard>
  );
}

// ── Rapor Şablonları ──────────────────────────────────────────────────────────

function RaporSablonlarTab() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);
  const [form, setForm] = useState({ name: '', type: 'tespit' as DocumentTemplate['type'], description: '', content: '', isActive: true, sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DocumentTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/system-settings/document-report-templates`, { headers: authHeader() });
      setTemplates(res.data.data ?? []);
    } catch { /* keep existing templates */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const filtered = filter === 'all' ? templates : templates.filter(t => t.type === filter);

  const openCreate = () => { setEditing(null); setForm({ name: '', type: 'tespit', description: '', content: '', isActive: true, sortOrder: templates.length + 1 }); setError(''); setShowModal(true); };
  const openEdit = (t: DocumentTemplate) => { setEditing(t); setForm({ name: t.name, type: t.type, description: t.description ?? '', content: t.content, isActive: t.isActive, sortOrder: t.sortOrder }); setError(''); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Şablon adı zorunludur.'); return; }
    setSaving(true); setError('');
    try {
      if (editing) {
        await axios.put(`${API}/system-settings/document-report-templates/${editing.id}`, form, { headers: authHeader() });
      } else {
        await axios.post(`${API}/system-settings/document-report-templates`, form, { headers: authHeader() });
      }
      setShowModal(false);
      fetchTemplates();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'İşlem başarısız.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/system-settings/document-report-templates/${deleteTarget.id}`, { headers: authHeader() });
      setDeleteTarget(null);
      fetchTemplates();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const insertVar = (v: string) => setForm(p => ({ ...p, content: p.content + v }));

  const typeMeta = (type: string) => REPORT_TYPES.find(t => t.value === type);

  return (
    <TabCard title="Rapor Şablonları" description="Hasar, tespit ve keşif raporu şablonlarını yönetin.">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>Tümü ({templates.length})</FilterBtn>
          {REPORT_TYPES.map(t => (
            <FilterBtn key={t.value} active={filter === t.value} onClick={() => setFilter(t.value)}>
              {t.label} ({templates.filter(x => x.type === t.value).length})
            </FilterBtn>
          ))}
        </div>
        <button type="button" onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Yeni Şablon
        </button>
      </div>

      {loading ? <RowSkeleton /> : filtered.length === 0 ? (
        <EmptyState msg="Bu kategoride şablon bulunamadı." />
      ) : (
        <div className="space-y-3">
          {filtered.map(t => {
            const meta = typeMeta(t.type);
            return (
              <div key={t.id} className="flex items-start justify-between p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {meta && <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${meta.cls}`}>{meta.label}</span>}
                    <span className="text-sm font-semibold text-slate-800">{t.name}</span>
                    {!t.isActive && <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-400 border border-slate-200">Pasif</span>}
                  </div>
                  {t.description && <p className="text-xs text-slate-500">{t.description}</p>}
                </div>
                <div className="flex items-center gap-1 ml-3">
                  <ActionBtn title="Düzenle" onClick={() => openEdit(t)}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </ActionBtn>
                  <ActionBtn title="Sil" danger onClick={() => setDeleteTarget(t)}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </ActionBtn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Şablonu Düzenle' : 'Yeni Rapor Şablonu'} onClose={() => setShowModal(false)} wide>
          {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelCls}>Şablon Adı <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input className={inputCls} value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Tür</label>
              <select className={inputCls} value={form.type} onChange={(e) => setForm(p => ({ ...p, type: e.target.value as DocumentTemplate['type'] }))}>
                {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Açıklama</label>
              <input className={inputCls} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <div className="mb-3">
            <label className={labelCls}>Değişkenler — Tıklayarak ekleyin</label>
            <div className="flex flex-wrap gap-1.5">
              {REPORT_PLACEHOLDERS.map(v => (
                <button key={v} type="button" onClick={() => insertVar(v)} className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-xs font-mono text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors">
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <label className={labelCls}>İçerik (HTML)</label>
            <textarea className={`${inputCls} font-mono text-xs`} rows={9} value={form.content} onChange={(e) => setForm(p => ({ ...p, content: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <button type="button" onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}>
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
            <span className="text-xs text-slate-600">Aktif</span>
          </div>
          <div className="flex justify-end gap-2">
            <CancelBtn onClick={() => setShowModal(false)} />
            <SaveBtn loading={saving} onClick={handleSave} />
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal title="Şablonu Sil" message={`"${deleteTarget.name}" şablonunu silmek istediğinize emin misiniz?`} loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} danger />
      )}
    </TabCard>
  );
}

// ── Sözleşme Şablonları ───────────────────────────────────────────────────────

function SozlesmeSablonlarTab() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ContractTemplate | null>(null);
  const [form, setForm] = useState({ name: '', type: 'tedarikci' as ContractTemplate['type'], description: '', content: '', isActive: true, sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ContractTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/system-settings/contract-templates`, { headers: authHeader() });
      setTemplates(res.data.data ?? []);
    } catch { /* keep existing templates */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const openCreate = () => { setEditing(null); setForm({ name: '', type: 'tedarikci', description: '', content: '', isActive: true, sortOrder: templates.length + 1 }); setError(''); setShowModal(true); };
  const openEdit = (t: ContractTemplate) => { setEditing(t); setForm({ name: t.name, type: t.type, description: t.description ?? '', content: t.content, isActive: t.isActive, sortOrder: t.sortOrder }); setError(''); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Şablon adı zorunludur.'); return; }
    setSaving(true); setError('');
    try {
      if (editing) {
        await axios.put(`${API}/system-settings/contract-templates/${editing.id}`, form, { headers: authHeader() });
      } else {
        await axios.post(`${API}/system-settings/contract-templates`, form, { headers: authHeader() });
      }
      setShowModal(false);
      fetchTemplates();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'İşlem başarısız.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/system-settings/contract-templates/${deleteTarget.id}`, { headers: authHeader() });
      setDeleteTarget(null);
      fetchTemplates();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const insertVar = (v: string) => setForm(p => ({ ...p, content: p.content + v }));
  const typeMeta = (type: string) => CONTRACT_TYPES.find(t => t.value === type);

  return (
    <TabCard title="Sözleşme Şablonları" description="Müşteri, tedarikçi ve gizlilik sözleşmesi şablonlarını yönetin.">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-slate-500">{templates.length} şablon</p>
        <button type="button" onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Yeni Şablon
        </button>
      </div>

      {loading ? <RowSkeleton /> : templates.length === 0 ? (
        <EmptyState msg="Henüz sözleşme şablonu oluşturulmamış." />
      ) : (
        <div className="space-y-3">
          {templates.map(t => {
            const meta = typeMeta(t.type);
            return (
              <div key={t.id} className="flex items-start justify-between p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {meta && <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${meta.cls}`}>{meta.label}</span>}
                    <span className="text-sm font-semibold text-slate-800">{t.name}</span>
                    {!t.isActive && <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-400 border border-slate-200">Pasif</span>}
                  </div>
                  {t.description && <p className="text-xs text-slate-500">{t.description}</p>}
                </div>
                <div className="flex items-center gap-1 ml-3">
                  <ActionBtn title="Düzenle" onClick={() => openEdit(t)}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </ActionBtn>
                  <ActionBtn title="Sil" danger onClick={() => setDeleteTarget(t)}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </ActionBtn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Şablonu Düzenle' : 'Yeni Sözleşme Şablonu'} onClose={() => setShowModal(false)} wide>
          {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelCls}>Şablon Adı <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input className={inputCls} value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Tür</label>
              <select className={inputCls} value={form.type} onChange={(e) => setForm(p => ({ ...p, type: e.target.value as ContractTemplate['type'] }))}>
                {CONTRACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Açıklama</label>
              <input className={inputCls} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <div className="mb-3">
            <label className={labelCls}>Değişkenler — Tıklayarak ekleyin</label>
            <div className="flex flex-wrap gap-1.5">
              {CONTRACT_PLACEHOLDERS.map(v => (
                <button key={v} type="button" onClick={() => insertVar(v)} className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-xs font-mono text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors">
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <label className={labelCls}>İçerik (HTML)</label>
            <textarea className={`${inputCls} font-mono text-xs`} rows={9} value={form.content} onChange={(e) => setForm(p => ({ ...p, content: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <button type="button" onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}>
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
            <span className="text-xs text-slate-600">Aktif</span>
          </div>
          <div className="flex justify-end gap-2">
            <CancelBtn onClick={() => setShowModal(false)} />
            <SaveBtn loading={saving} onClick={handleSave} />
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal title="Şablonu Sil" message={`"${deleteTarget.name}" şablonunu silmek istediğinize emin misiniz?`} loading={deleting} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} danger />
      )}
    </TabCard>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function TabCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{description}</p>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, loading, onConfirm, onCancel, danger }: { title: string; message: string; loading: boolean; onConfirm: () => void; onCancel: () => void; danger?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <CancelBtn onClick={onCancel} />
          <button type="button" onClick={onConfirm} disabled={loading} className={`px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {loading ? 'İşleniyor...' : 'Onayla'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
      {children}
    </button>
  );
}

function SaveBtn({ loading, onClick, label = 'Kaydet' }: { loading: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-2">
      {loading && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
      {loading ? 'Kaydediliyor...' : label}
    </button>
  );
}

function CancelBtn({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">İptal</button>;
}

function ActionBtn({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick} className={`p-1.5 rounded-lg transition-colors ${danger ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
      {children}
    </button>
  );
}

function RowSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      </div>
      <p className="text-sm text-slate-500">{msg}</p>
    </div>
  );
}

function ErrorAlert({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
      <span className="flex-1">{msg}</span>
      <button type="button" onClick={onClose} className="text-red-400 hover:text-red-600">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}
