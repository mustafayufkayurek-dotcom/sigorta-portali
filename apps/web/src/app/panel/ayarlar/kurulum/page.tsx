'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { toTitleCaseTR, sanitizeCode } from '@/utils/text-helpers';

// ── Types ────────────────────────────────────────────────────────────────────

interface CompanyInfo {
  name: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
  tradeRegistryNo?: string;
  website?: string;
}

interface SystemConfig {
  currency: string;
  dateFormat: string;
  language: string;
  maxFileSizeMb: number;
  timezone: string;
}

interface MailConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  security: 'SSL' | 'TLS' | 'None';
  fromName: string;
  fromEmail: string;
}

interface SmsConfig {
  provider: 'netgsm' | 'iletimerkezi' | 'other';
  apiKey: string;
  apiSecret?: string;
  senderId: string;
  active: boolean;
}

interface IntegrationConfig {
  logoWings: {
    apiUrl: string;
    apiKey: string;
    username: string;
    password: string;
    active: boolean;
  };
}

interface ThemeConfig {
  mode: 'light' | 'dark' | 'system';
  colorScheme: string;
}

const DEFAULT_THEME: ThemeConfig = { mode: 'light', colorScheme: 'blue' };

function applyThemePreference(nextTheme: ThemeConfig) {
  try {
    localStorage.setItem('app-theme', JSON.stringify(nextTheme));
    const html = document.documentElement;
    const shouldUseDark = nextTheme.mode === 'dark'
      || (nextTheme.mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    html.classList.toggle('dark', shouldUseDark);
    html.style.colorScheme = shouldUseDark ? 'dark' : 'light';
    html.setAttribute('data-color-scheme', nextTheme.colorScheme || DEFAULT_THEME.colorScheme);
    window.dispatchEvent(new Event('theme-changed'));
  } catch { /* ignore */ }
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  status: string;
  role?: { id: string; name: string; code: string } | null;
  lastLoginAt?: string | null;
  createdAt: string;
}

interface Role {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  _count?: { users: number };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1 dark:text-slate-400';

const PROTECTED_EMAIL = 'admin@meridyenassistance.com';

// ── Tab definitions ──────────────────────────────────────────────────────────

type TabId = 'genel' | 'kullanicilar' | 'roller' | 'alan-zorunluluklari' | 'mail' | 'sms' | 'entegrasyonlar' | 'sistem';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'genel',              label: 'Genel Bilgiler',     icon: '🏢' },
  { id: 'kullanicilar',       label: 'Kullanıcılar',       icon: '👥' },
  { id: 'roller',             label: 'Roller',             icon: '🔐' },
  { id: 'alan-zorunluluklari',label: 'Alan Zorunlulukları',icon: '📋' },
  { id: 'mail',               label: 'Mail Kurulum',       icon: '✉️' },
  { id: 'sms',                label: 'SMS Bildirimleri',   icon: '📱' },
  { id: 'entegrasyonlar',     label: 'Entegrasyonlar',     icon: '🔗' },
  { id: 'sistem',             label: 'Sistem Ayarları',    icon: '⚙️' },
];

// ── Main Component ───────────────────────────────────────────────────────────

export default function KurulumPage() {
  const [activeTab, setActiveTab] = useState<TabId>('genel');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span>/</span>
        <a href="/panel/ayarlar" className="hover:text-blue-600 transition-colors">Ayarlar</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Kurulum</span>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
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
          <h1 className="text-2xl font-bold text-slate-900">Kurulum Sihirbazı</h1>
          <p className="text-sm text-slate-500 mt-1">Sistem ayarlarını yapılandırın ve yönetin.</p>
        </div>

        {/* Tab Bar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6 overflow-x-auto">
          <div className="flex min-w-max">
            {TABS.map((tab, idx) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                } ${idx > 0 ? 'border-l border-l-slate-100' : ''}`}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div>
          {activeTab === 'genel'               && <GenelBilgilerTab />}
          {activeTab === 'kullanicilar'         && <KullanicilarTab />}
          {activeTab === 'roller'               && <RollerTab />}
          {activeTab === 'alan-zorunluluklari'  && <AlanZorunluluklariTab />}
          {activeTab === 'mail'                 && <MailTab />}
          {activeTab === 'sms'                  && <SmsTab />}
          {activeTab === 'entegrasyonlar'       && <EntegrasyonlarTab />}
          {activeTab === 'sistem'               && <SistemTab />}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Genel Bilgiler ───────────────────────────────────────────────────────

function GenelBilgilerTab() {
  const [form, setForm] = useState<CompanyInfo>({ name: '', logoUrl: '', address: '', phone: '', email: '', taxNumber: '', tradeRegistryNo: '', website: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    axios.get(`${API}/system-settings/company-info`, { headers: authHeader() })
      .then((r) => {
        const d = r.data.data ?? {};
        setForm({ name: d.name ?? '', logoUrl: d.logoUrl ?? '', address: d.address ?? '', phone: d.phone ?? '', email: d.email ?? '', taxNumber: d.taxNumber ?? '', tradeRegistryNo: d.tradeRegistryNo ?? '', website: d.website ?? '' });
        if (d.logoUrl) setLogoPreview(d.logoUrl);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleFileChange = (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Sadece resim dosyaları yüklenebilir.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Dosya boyutu 5 MB\'ı geçemez.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setLogoPreview(url);
      setForm((p) => ({ ...p, logoUrl: url }));
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Şirket adı zorunludur.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      await axios.put(`${API}/system-settings/company-info`, form, { headers: authHeader() });
      setSuccess('Şirket bilgileri kaydedildi.');
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Kayıt sırasında hata oluştu.'); }
    finally { setSaving(false); }
  };

  if (loading) return <CardSkeleton />;

  return (
    <TabCard title="Genel Bilgiler" description="Şirketinize ait temel bilgileri ve logonuzu yönetin.">
      {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
      {success && <SuccessAlert msg={success} />}

      {/* Logo Upload */}
      <div className="mb-6">
        <label className={labelCls}>Şirket Logosu</label>
        <div className="flex items-start gap-5">
          <div
            className={`relative w-28 h-28 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileChange(f); }}
          >
            {logoPreview ? (
              <img src={logoPreview} alt="Logo önizleme" className="w-full h-full object-contain rounded-xl p-2" />
            ) : (
              <div className="text-center px-2">
                <svg className="w-8 h-8 text-slate-300 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-[10px] text-slate-400">Logo yükle</p>
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-500 mb-2">PNG, JPG veya SVG — Maks. 5 MB</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Dosya Seç
            </button>
            {logoPreview && (
              <button
                type="button"
                onClick={() => { setLogoPreview(null); setForm((p) => ({ ...p, logoUrl: '' })); }}
                className="ml-2 px-3 py-2 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                Kaldır
              </button>
            )}
            <p className="text-[10px] text-slate-400 mt-2">Sürükle & Bırak da desteklenir</p>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={labelCls}>Şirket Adı <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
          <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Meridyen Assistance Ltd. Şti." />
        </div>
        <div>
          <label className={labelCls}>Telefon</label>
          <input className={inputCls} value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+90 212 000 00 00" />
        </div>
        <div>
          <label className={labelCls}>E-posta</label>
          <input className={inputCls} type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="info@sirket.com" />
        </div>
        <div>
          <label className={labelCls}>Vergi No</label>
          <input className={inputCls} value={form.taxNumber ?? ''} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })} placeholder="1234567890" />
        </div>
        <div>
          <label className={labelCls}>Ticaret Sicil No</label>
          <input className={inputCls} value={form.tradeRegistryNo ?? ''} onChange={(e) => setForm({ ...form, tradeRegistryNo: e.target.value })} placeholder="12345" />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Adres</label>
          <textarea className={inputCls} rows={2} value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Şirket adresi" />
        </div>
        <div>
          <label className={labelCls}>Web Sitesi</label>
          <input className={inputCls} value={form.website ?? ''} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://www.sirket.com" />
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <SaveBtn loading={saving} onClick={handleSave} />
      </div>
    </TabCard>
  );
}

// ── Tab: Kullanıcılar ─────────────────────────────────────────────────────────

function KullanicilarTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', roleId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showResetPwd, setShowResetPwd] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ur, rr] = await Promise.all([
        axios.get(`${API}/users`, { headers: authHeader() }),
        axios.get(`${API}/roles`, { headers: authHeader() }),
      ]);
      setUsers(ur.data.data ?? []);
      setRoles(rr.data.data ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = users.filter(u =>
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => { setEditUser(null); setForm({ firstName: '', lastName: '', email: '', phone: '', password: '', roleId: roles[0]?.id ?? '' }); setError(''); setShowPwd(false); setShowModal(true); };
  const openEdit = (u: User) => { setEditUser(u); setForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone ?? '', password: '', roleId: u.role?.id ?? '' }); setError(''); setShowPwd(false); setShowModal(true); };

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) { setError('Ad, soyad ve e-posta zorunludur.'); return; }
    if (!editUser && !form.password.trim()) { setError('Yeni kullanıcı için şifre zorunludur.'); return; }
    setSaving(true); setError('');
    try {
      const payload: any = { firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone || undefined, roleId: form.roleId || undefined };
      if (form.password.trim()) payload.password = form.password;
      if (editUser) {
        await axios.put(`${API}/users/${editUser.id}`, payload, { headers: authHeader() });
      } else {
        await axios.post(`${API}/users`, payload, { headers: authHeader() });
      }
      setShowModal(false);
      fetchAll();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'İşlem başarısız.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/users/${deleteTarget.id}`, { headers: authHeader() });
      setDeleteTarget(null);
      fetchAll();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const handleReset = async () => {
    if (!resetTarget || !newPassword.trim()) return;
    setResetting(true);
    try {
      await axios.post(`${API}/users/${resetTarget.id}/reset-password`, { newPassword }, { headers: authHeader() });
      setResetTarget(null);
      setNewPassword('');
    } catch { /* ignore */ }
    finally { setResetting(false); }
  };

  const fmtDate = (d?: string | null) => !d ? '—' : new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <TabCard title="Kullanıcılar" description="Sistem kullanıcılarını yönetin.">
      <div className="flex items-center justify-between gap-3 mb-4">
        <input
          className={`${inputCls} max-w-xs`}
          placeholder="Ad, soyad veya e-posta ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Yeni Kullanıcı
        </button>
      </div>

      {loading ? <RowSkeleton /> : filtered.length === 0 ? (
        <EmptyState msg={search ? 'Arama sonucu bulunamadı.' : 'Henüz kullanıcı eklenmemiş.'} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-5 py-3">Kullanıcı</th>
                <th className="text-left px-5 py-3 hidden md:table-cell">E-posta</th>
                <th className="text-left px-5 py-3 hidden lg:table-cell">Rol</th>
                <th className="text-center px-5 py-3">Durum</th>
                <th className="text-left px-5 py-3 hidden lg:table-cell">Son Giriş</th>
                <th className="px-5 py-3 w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {(u.firstName[0] ?? '') + (u.lastName[0] ?? '')}
                      </div>
                      <span className="font-medium text-slate-800">{u.firstName} {u.lastName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-500 hidden md:table-cell">{u.email}</td>
                  <td className="px-5 py-3 hidden lg:table-cell">
                    {u.role ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">{u.role.name}</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.status === 'active' ? 'bg-green-100 text-green-700' : u.status === 'suspended' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                      {u.status === 'active' ? 'Aktif' : u.status === 'suspended' ? 'Askıya Alındı' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-xs hidden lg:table-cell">{fmtDate(u.lastLoginAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <ActionBtn title="Düzenle" onClick={() => openEdit(u)}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </ActionBtn>
                      <ActionBtn title="Şifre Sıfırla" onClick={() => { setResetTarget(u); setNewPassword(''); }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                      </ActionBtn>
                      {u.email !== PROTECTED_EMAIL && (
                        <ActionBtn title="Sil" danger onClick={() => setDeleteTarget(u)}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </ActionBtn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal title={editUser ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı'} onClose={() => setShowModal(false)}>
          {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Ad <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input className={inputCls} value={form.firstName} onChange={(e) => setForm(p => ({ ...p, firstName: e.target.value }))} onBlur={(e) => setForm(p => ({ ...p, firstName: toTitleCaseTR(e.target.value) }))} />
            </div>
            <div>
              <label className={labelCls}>Soyad <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input className={inputCls} value={form.lastName} onChange={(e) => setForm(p => ({ ...p, lastName: e.target.value }))} onBlur={(e) => setForm(p => ({ ...p, lastName: toTitleCaseTR(e.target.value) }))} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>E-posta <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Telefon</label>
              <input className={inputCls} value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Rol</label>
              <select className={inputCls} value={form.roleId} onChange={(e) => setForm(p => ({ ...p, roleId: e.target.value }))}>
                <option value="">— Rol Seç —</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>{editUser ? 'Yeni Şifre' : 'Şifre'} <span className="text-xs font-normal text-slate-400 ml-1">{editUser ? '(Boş bırakılırsa değişmez)' : '(Zorunlu)'}</span></label>
              <div className="relative">
                <input className={inputCls} type={showPwd ? 'text' : 'password'} style={{ paddingRight: 40 }} placeholder={editUser ? 'Değiştirmek için yeni şifre girin' : ''} value={form.password} onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))} />
                <button type="button" tabIndex={-1} onClick={() => setShowPwd(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  <EyeIcon show={showPwd} />
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <CancelBtn onClick={() => setShowModal(false)} />
            <SaveBtn loading={saving} onClick={handleSave} />
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmModal
          title="Kullanıcıyı Sil"
          message={`"${deleteTarget.firstName} ${deleteTarget.lastName}" kullanıcısını silmek istediğinize emin misiniz?`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}

      {/* Reset Password */}
      {resetTarget && (
        <Modal title="Şifre Sıfırla" onClose={() => setResetTarget(null)}>
          <p className="text-sm text-slate-600 mb-3">{resetTarget.firstName} {resetTarget.lastName} için yeni şifre belirleyin.</p>
          <label className={labelCls}>Yeni Şifre <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
          <div className="relative">
            <input className={inputCls} type={showResetPwd ? 'text' : 'password'} style={{ paddingRight: 40 }} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <button type="button" tabIndex={-1} onClick={() => setShowResetPwd(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
              <EyeIcon show={showResetPwd} />
            </button>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <CancelBtn onClick={() => setResetTarget(null)} />
            <SaveBtn loading={resetting} onClick={handleReset} label="Sıfırla" />
          </div>
        </Modal>
      )}
    </TabCard>
  );
}

// ── Tab: Roller ───────────────────────────────────────────────────────────────

function RollerTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/roles`, { headers: authHeader() });
      setRoles(res.data.data ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const filtered = roles.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.code.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => { setEditing(null); setForm({ name: '', code: '', description: '' }); setError(''); setShowModal(true); };
  const openEdit = (r: Role) => { setEditing(r); setForm({ name: r.name, code: r.code, description: r.description ?? '' }); setError(''); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Rol adı zorunludur.'); return; }
    if (!form.code.trim()) { setError('Kod zorunludur.'); return; }
    if (!/^[A-Z_]+$/.test(form.code)) { setError('Kod yalnızca büyük harf ve alt çizgi (_) içerebilir.'); return; }
    const dupName = roles.find(r => r.name.trim().toLowerCase() === form.name.trim().toLowerCase() && (!editing || r.id !== editing.id));
    if (dupName) { setError('Bu isimde bir rol zaten mevcut.'); return; }
    const dupCode = roles.find(r => r.code.trim().toUpperCase() === form.code.trim().toUpperCase() && (!editing || r.id !== editing.id));
    if (dupCode) { setError('Bu kodda bir rol zaten mevcut.'); return; }
    setSaving(true); setError('');
    try {
      if (editing) {
        await axios.put(`${API}/roles/${editing.id}`, form, { headers: authHeader() });
      } else {
        await axios.post(`${API}/roles`, form, { headers: authHeader() });
      }
      setShowModal(false);
      fetchRoles();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'İşlem başarısız.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/roles/${deleteTarget.id}`, { headers: authHeader() });
      setDeleteTarget(null);
      fetchRoles();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  return (
    <TabCard title="Roller" description="Sistem rollerini ve izinleri yönetin.">
      <div className="flex items-center justify-between gap-3 mb-4">
        <input className={`${inputCls} max-w-xs`} placeholder="Rol ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="button" onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Yeni Rol
        </button>
      </div>

      {loading ? <RowSkeleton /> : filtered.length === 0 ? (
        <EmptyState msg={search ? 'Arama sonucu bulunamadı.' : 'Henüz rol tanımlanmamış.'} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-5 py-3">Rol Adı</th>
                <th className="text-left px-5 py-3">Kod</th>
                <th className="text-left px-5 py-3 hidden md:table-cell">Açıklama</th>
                <th className="text-center px-5 py-3 hidden lg:table-cell">Kullanıcı</th>
                <th className="px-5 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-800">{r.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500 bg-slate-50/50">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">{r.code}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-500 hidden md:table-cell">{r.description ?? '—'}</td>
                  <td className="px-5 py-3 text-center hidden lg:table-cell">
                    <span className="text-xs font-medium text-slate-600">{r._count?.users ?? 0}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <ActionBtn title="Düzenle" onClick={() => openEdit(r)}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </ActionBtn>
                      <ActionBtn title="Sil" danger onClick={() => setDeleteTarget(r)}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </ActionBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Rolü Düzenle' : 'Yeni Rol'} onClose={() => setShowModal(false)}>
          {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Rol Adı <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
              <input className={inputCls} value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Kod <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu — büyük harf ve _ )</span></label>
              <input
                className={`${inputCls} font-mono uppercase`}
                value={form.code}
                onChange={(e) => setForm(p => ({ ...p, code: sanitizeCode(e.target.value) }))}
                onInput={(e) => { const t = e.currentTarget; t.value = sanitizeCode(t.value); }}
                placeholder="ADMIN_ROLE"
              />
              <p className="text-xs text-slate-400 mt-1">Sadece büyük İngilizce harf, rakam ve alt çizgi (_) kullanın</p>
            </div>
            <div>
              <label className={labelCls}>Açıklama</label>
              <input className={inputCls} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <CancelBtn onClick={() => setShowModal(false)} />
            <SaveBtn loading={saving} onClick={handleSave} />
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Rolü Sil"
          message={`"${deleteTarget.name}" rolünü silmek istediğinize emin misiniz?`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </TabCard>
  );
}

// ── Tab: Alan Zorunlulukları (Gömülü redirect) ────────────────────────────────

function AlanZorunluluklariTab() {
  return (
    <TabCard title="Alan Zorunlulukları" description="Form alanlarının zorunluluk durumlarını yapılandırın.">
      <div className="py-4">
        <p className="text-sm text-slate-600 mb-4">Alan zorunlulukları, form doldurma sırasında hangi alanların zorunlu olduğunu belirler.</p>
        <a
          href="/panel/ayarlar/alan-zorunluluklari"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Alan Zorunlulukları Sayfasını Aç
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
        </a>
      </div>
    </TabCard>
  );
}

// ── Tab: Mail Kurulum ─────────────────────────────────────────────────────────

function MailTab() {
  const [form, setForm] = useState<MailConfig>({ host: '', port: 587, username: '', password: '', security: 'TLS', fromName: '', fromEmail: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSmtpPwd, setShowSmtpPwd] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const SMTP_GUIDES = [
    { name: 'Google Workspace / Gmail', host: 'smtp.gmail.com', port: 587, security: 'TLS' as const, note: 'Hesap ayarlarından "Uygulama Şifresi" oluşturun (2FA aktifse gereklidir).' },
    { name: 'Yandex Mail', host: 'smtp.yandex.com', port: 465, security: 'SSL' as const, note: 'Yandex hesabı ayarlarından uygulama şifresi oluşturun.' },
    { name: 'Office 365 (Microsoft)', host: 'smtp.office365.com', port: 587, security: 'TLS' as const, note: 'Modern Auth aktifse app password veya OAuth2 kullanın.' },
    { name: 'Özel / cPanel', host: 'mail.alanadi.com', port: 587, security: 'TLS' as const, note: 'cPanel mail hesabı şifresi ile giriş yapabilirsiniz.' },
  ];

  useEffect(() => {
    axios.get(`${API}/system-settings/mail-config`, { headers: authHeader() })
      .then((r) => { const d = r.data.data; if (d) setForm({ host: d.host ?? '', port: d.port ?? 587, username: d.username ?? '', password: d.password ?? '', security: d.security ?? 'TLS', fromName: d.fromName ?? '', fromEmail: d.fromEmail ?? '' }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!form.host || !form.username) { setError('SMTP sunucu ve kullanıcı adı zorunludur.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      await axios.put(`${API}/system-settings/mail-config`, form, { headers: authHeader() });
      setSuccess('E-posta ayarları kaydedildi.');
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Kayıt sırasında hata oluştu.'); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    if (!testEmail) { setError('Test e-posta adresi girin.'); return; }
    setTesting(true); setError(''); setSuccess('');
    try {
      const response = await axios.post(`${API}/system-settings/mail-config/test`, { to: testEmail }, { headers: authHeader() });
      setSuccess(response.data?.message ?? `Test e-postası ${testEmail} adresine gönderildi.`);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Test e-postası gönderilemedi.');
    } finally { setTesting(false); }
  };

  if (loading) return <CardSkeleton />;

  return (
    <TabCard title="Mail Kurulum" description="SMTP sunucu bilgilerini girerek e-posta bildirimlerini etkinleştirin.">
      {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
      {success && <SuccessAlert msg={success} />}

      {/* SMTP Provider Guide */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setShowGuide(v => !v)}
          className="flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {showGuide ? 'Sağlayıcı rehberini kapat' : 'Sağlayıcı rehberini göster (Yandex, Google, Office 365...)'}
        </button>
        {showGuide && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {SMTP_GUIDES.map((g) => (
              <div
                key={g.name}
                className="p-3 rounded-xl border border-blue-100 bg-blue-50/40 cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => setForm(p => ({ ...p, host: g.host, port: g.port, security: g.security }))}
              >
                <p className="text-xs font-semibold text-slate-800 mb-0.5">{g.name}</p>
                <p className="text-xs text-slate-500 font-mono">{g.host} · Port {g.port} · {g.security}</p>
                <p className="text-xs text-slate-400 mt-1">{g.note}</p>
                <p className="text-xs text-blue-500 mt-1">Tıklayarak otomatik doldur</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>SMTP Sunucu <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
          <input className={inputCls} value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="smtp.gmail.com" />
        </div>
        <div>
          <label className={labelCls}>Port</label>
          <input className={inputCls} type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} />
        </div>
        <div>
          <label className={labelCls}>Kullanıcı Adı <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
          <input className={inputCls} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="user@domain.com" />
        </div>
        <div>
          <label className={labelCls}>Şifre</label>
          <div className="relative">
            <input className={inputCls} type={showSmtpPwd ? 'text' : 'password'} style={{ paddingRight: 40 }} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button type="button" tabIndex={-1} onClick={() => setShowSmtpPwd(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
              <EyeIcon show={showSmtpPwd} />
            </button>
          </div>
        </div>
        <div>
          <label className={labelCls}>Güvenlik</label>
          <select className={inputCls} value={form.security} onChange={(e) => setForm({ ...form, security: e.target.value as MailConfig['security'] })}>
            <option value="TLS">TLS</option>
            <option value="SSL">SSL</option>
            <option value="None">Yok</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Gönderen Ad</label>
          <input className={inputCls} value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} placeholder="Meridyen Sistemi" />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>Gönderen E-posta</label>
          <input className={inputCls} value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} placeholder="no-reply@sirket.com" />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-600 mb-2">Test E-postası Gönder</p>
        <div className="flex gap-2">
          <input className={`${inputCls} flex-1 max-w-xs`} value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@domain.com" />
          <button type="button" onClick={handleTest} disabled={testing} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors">
            {testing ? 'Gönderiliyor...' : 'Test Et'}
          </button>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <SaveBtn loading={saving} onClick={handleSave} />
      </div>
    </TabCard>
  );
}

// ── Tab: SMS Bildirimleri ─────────────────────────────────────────────────────

function SmsTab() {
  const [form, setForm] = useState<SmsConfig>({ provider: 'netgsm', apiKey: '', apiSecret: '', senderId: '', active: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    axios.get(`${API}/system-settings/sms-config`, { headers: authHeader() })
      .then((r) => { const d = r.data.data; if (d) setForm({ provider: d.provider ?? 'netgsm', apiKey: d.apiKey ?? '', apiSecret: d.apiSecret ?? '', senderId: d.senderId ?? '', active: d.active ?? false }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!form.apiKey || !form.senderId) { setError('API Key ve Sender ID zorunludur.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      await axios.put(`${API}/system-settings/sms-config`, form, { headers: authHeader() });
      setSuccess('SMS ayarları kaydedildi.');
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Kayıt sırasında hata oluştu.'); }
    finally { setSaving(false); }
  };

  if (loading) return <CardSkeleton />;

  return (
    <TabCard title="SMS Bildirimleri" description="SMS servis sağlayıcısını yapılandırın.">
      {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
      {success && <SuccessAlert msg={success} />}

      <div className="flex items-center gap-3 mb-5 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <label className="text-sm font-medium text-slate-700">SMS Bildirimleri</label>
        <button
          type="button"
          onClick={() => setForm(p => ({ ...p, active: !p.active }))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.active ? 'bg-blue-600' : 'bg-slate-300'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.active ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className={`text-xs font-medium ${form.active ? 'text-green-600' : 'text-slate-400'}`}>{form.active ? 'Aktif' : 'Pasif'}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={labelCls}>SMS Sağlayıcı</label>
          <select className={inputCls} value={form.provider} onChange={(e) => setForm(p => ({ ...p, provider: e.target.value as SmsConfig['provider'] }))}>
            <option value="netgsm">Netgsm</option>
            <option value="iletimerkezi">İleti Merkezi</option>
            <option value="other">Diğer</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>API Key <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
          <input className={inputCls} value={form.apiKey} onChange={(e) => setForm(p => ({ ...p, apiKey: e.target.value }))} placeholder="API anahtarınız" />
        </div>
        <div>
          <label className={labelCls}>API Secret</label>
          <input className={inputCls} value={form.apiSecret ?? ''} onChange={(e) => setForm(p => ({ ...p, apiSecret: e.target.value }))} placeholder="API gizli anahtarı" />
        </div>
        <div>
          <label className={labelCls}>Sender ID <span className="text-xs font-normal text-slate-400 ml-1">(Zorunlu)</span></label>
          <input className={inputCls} value={form.senderId} onChange={(e) => setForm(p => ({ ...p, senderId: e.target.value }))} placeholder="MERIDYEN" />
          <p className="text-xs text-slate-400 mt-1">Gönderen adı — max 11 karakter</p>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <SaveBtn loading={saving} onClick={handleSave} />
      </div>
    </TabCard>
  );
}

// ── Tab: Entegrasyonlar ───────────────────────────────────────────────────────

function EntegrasyonlarTab() {
  const [form, setForm] = useState<IntegrationConfig>({ logoWings: { apiUrl: '', apiKey: '', username: '', password: '', active: false } });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    axios.get(`${API}/system-settings/integration-config`, { headers: authHeader() })
      .then((r) => { const d = r.data.data; if (d) setForm(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      await axios.put(`${API}/system-settings/integration-config`, form, { headers: authHeader() });
      setSuccess('Entegrasyon ayarları kaydedildi.');
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Kayıt sırasında hata oluştu.'); }
    finally { setSaving(false); }
  };

  const lw = form.logoWings;
  const setLw = (partial: Partial<typeof lw>) => setForm(p => ({ ...p, logoWings: { ...p.logoWings, ...partial } }));

  if (loading) return <CardSkeleton />;

  return (
    <TabCard title="Entegrasyonlar" description="Üçüncü taraf servis entegrasyonlarını yapılandırın.">
      {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
      {success && <SuccessAlert msg={success} />}

      {/* Logo Wings ERP */}
      <div className="mb-6 p-4 border border-slate-200 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Logo Wings ERP</p>
              <p className="text-xs text-slate-400">Muhasebe ve ERP entegrasyonu</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLw({ active: !lw.active })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${lw.active ? 'bg-blue-600' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${lw.active ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className={labelCls}>API URL</label>
            <input className={inputCls} value={lw.apiUrl} onChange={(e) => setLw({ apiUrl: e.target.value })} placeholder="https://api.logo.com.tr/v1" />
          </div>
          <div>
            <label className={labelCls}>API Key</label>
            <input className={inputCls} value={lw.apiKey} onChange={(e) => setLw({ apiKey: e.target.value })} placeholder="API anahtarı" />
          </div>
          <div>
            <label className={labelCls}>Kullanıcı Adı</label>
            <input className={inputCls} value={lw.username} onChange={(e) => setLw({ username: e.target.value })} placeholder="logo_user" />
          </div>
          <div>
            <label className={labelCls}>Şifre</label>
            <input className={inputCls} type="password" value={lw.password} onChange={(e) => setLw({ password: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Hazır slot — gelecek entegrasyonlar */}
      <div className="p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-center text-sm text-slate-400">
        Yeni entegrasyonlar burada eklenecek
      </div>

      <div className="mt-6 flex justify-end">
        <SaveBtn loading={saving} onClick={handleSave} />
      </div>
    </TabCard>
  );
}

// ── Tab: Sistem Ayarları ──────────────────────────────────────────────────────

function SistemTab() {
  const [form, setForm] = useState<SystemConfig>({ currency: 'TRY', dateFormat: 'DD.MM.YYYY', language: 'tr', maxFileSizeMb: 10, timezone: 'Europe/Istanbul' });
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [themeHydrated, setThemeHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/system-settings/system-config`, { headers: authHeader() }),
      axios.get(`${API}/system-settings/theme-config`, { headers: authHeader() }),
    ]).then(([sr, tr]) => {
      if (sr.data.data) setForm(sr.data.data);
      if (tr.data.data) {
        setTheme({ ...DEFAULT_THEME, ...tr.data.data });
      } else {
        // localStorage'dan oku fallback
        try {
          const saved = localStorage.getItem('app-theme');
          if (saved) setTheme({ ...DEFAULT_THEME, ...JSON.parse(saved) });
        } catch { /* ignore */ }
      }
    }).catch(() => {
      // localStorage fallback on error
      try {
        const saved = localStorage.getItem('app-theme');
        if (saved) setTheme({ ...DEFAULT_THEME, ...JSON.parse(saved) });
      } catch { /* ignore */ }
    }).finally(() => {
      setLoading(false);
      setThemeHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!themeHydrated) return;
    applyThemePreference(theme);
  }, [theme, themeHydrated]);

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      await Promise.all([
        axios.put(`${API}/system-settings/system-config`, form, { headers: authHeader() }),
        axios.put(`${API}/system-settings/theme-config`, theme, { headers: authHeader() }),
      ]);
      applyThemePreference(theme);
      setSuccess('Sistem ayarları kaydedildi.');
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Kayıt sırasında hata oluştu.'); }
    finally { setSaving(false); }
  };

  const COLOR_SCHEMES = [
    { value: 'blue', label: 'Mavi', cls: 'bg-blue-500' },
    { value: 'green', label: 'Yeşil', cls: 'bg-green-500' },
    { value: 'purple', label: 'Mor', cls: 'bg-purple-500' },
    { value: 'orange', label: 'Turuncu', cls: 'bg-orange-500' },
    { value: 'slate', label: 'Koyu Gri', cls: 'bg-slate-600' },
  ];

  if (loading) return <CardSkeleton />;

  return (
    <TabCard title="Sistem Ayarları" description="Para birimi, tarih formatı, dil ve görünüm tercihleri.">
      {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
      {success && <SuccessAlert msg={success} />}

      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Bölgesel Ayarlar</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className={labelCls}>Para Birimi</label>
          <select className={inputCls} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            <option value="TRY">TRY — Türk Lirası</option>
            <option value="USD">USD — ABD Doları</option>
            <option value="EUR">EUR — Euro</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Tarih Formatı</label>
          <select className={inputCls} value={form.dateFormat} onChange={(e) => setForm({ ...form, dateFormat: e.target.value })}>
            <option value="DD.MM.YYYY">DD.MM.YYYY (Türkiye)</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY (ABD)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Dil</label>
          <select className={inputCls} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Saat Dilimi</label>
          <select className={inputCls} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
            <option value="Europe/Istanbul">Europe/Istanbul (UTC+3)</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Maks. Dosya Boyutu (MB)</label>
          <input className={inputCls} type="number" min={1} max={100} value={form.maxFileSizeMb} onChange={(e) => setForm({ ...form, maxFileSizeMb: Number(e.target.value) })} />
        </div>
      </div>

      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tema ve Görünüm</h3>
      <div className="space-y-4 mb-6">
        <div className="flex gap-3">
          {(['light', 'dark', 'system'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setTheme(p => ({ ...p, mode: m }))}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                theme.mode === m
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-100'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500'
              }`}
            >
              <span>{m === 'light' ? '☀️' : m === 'dark' ? '🌙' : '🖥️'}</span>
              {m === 'light' ? 'Açık Mod' : m === 'dark' ? 'Koyu Mod' : 'Sistem'}
            </button>
          ))}
        </div>
        <div>
          <label className={labelCls}>Renk Şeması</label>
          <div className="flex flex-wrap gap-3 mt-1">
            {COLOR_SCHEMES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setTheme(p => ({ ...p, colorScheme: c.value }))}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                  theme.colorScheme === c.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-100'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500'
                }`}
              >
                <span className={`w-4 h-4 rounded-full ${c.cls}`} />
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <SaveBtn loading={saving} onClick={handleSave} />
      </div>
    </TabCard>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function TabCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5 dark:text-slate-400">{description}</p>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
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

function SaveBtn({ loading, onClick, label = 'Kaydet' }: { loading: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-2">
      {loading && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
      {loading ? 'Kaydediliyor...' : label}
    </button>
  );
}

function CancelBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
      İptal
    </button>
  );
}

function ActionBtn({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick} className={`p-1.5 rounded-lg transition-colors ${danger ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
      {children}
    </button>
  );
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse dark:border-slate-700 dark:bg-slate-900">
      <div className="h-4 bg-slate-200 rounded w-48 mb-2 dark:bg-slate-700" />
      <div className="h-3 bg-slate-100 rounded w-64 mb-6 dark:bg-slate-800" />
      <div className="grid grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg dark:bg-slate-800" />)}
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg" />)}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4" /></svg>
      </div>
      <p className="text-sm text-slate-500">{msg}</p>
    </div>
  );
}

function ErrorAlert({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="sticky top-0 z-40 mb-4 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 shadow-sm">
      <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="flex-1">{msg}</span>
      <button type="button" onClick={onClose} className="text-red-400 hover:text-red-600">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

function SuccessAlert({ msg }: { msg: string }) {
  return (
    <div className="sticky top-0 z-40 mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2 shadow-sm">
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      <span>{msg}</span>
    </div>
  );
}

function EyeIcon({ show }: { show: boolean }) {
  return show ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
