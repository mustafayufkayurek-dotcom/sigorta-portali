'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { toTitleCaseTR } from '@/utils/text-helpers';

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
  kvkkEmail?: string;
  appUrl?: string;
  payrollEmployerName?: string;
  payrollEmployerAddress?: string;
  payrollEmployerTaxNumber?: string;
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

interface SignalRule {
  key: string;
  name: string;
  area: 'operasyon' | 'finans' | 'sistem' | 'gorev';
  level: 'bilgi' | 'uyari' | 'kritik';
  trigger: string;
  targetRoles: string[];
  channels: {
    inApp: boolean;
    telegram: boolean;
    email: boolean;
  };
  repeatPolicy: string;
  active: boolean;
}

interface NotificationSettings {
  emailEnabled: boolean;
  notifications: {
    key: string;
    label: string;
    enabled: boolean;
  }[];
  signalRules: SignalRule[];
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

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1 dark:text-slate-400';

type TabId = 'genel' | 'mail' | 'sms' | 'uyari-sinyalizasyon' | 'entegrasyonlar' | 'sistem';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'genel',              label: 'Tema ve Logo',       icon: '🎨' },
  { id: 'mail',               label: 'Mail Kurulum',       icon: '✉️' },
  { id: 'sms',                label: 'SMS Bildirimleri',   icon: '📱' },
  { id: 'uyari-sinyalizasyon',label: 'Uyarı ve Sinyalizasyon', icon: '🔔' },
  { id: 'entegrasyonlar',     label: 'Entegrasyonlar',     icon: '🔗' },
  { id: 'sistem',             label: 'Sistem Ayarları',    icon: '⚙️' },
];

// ── Main Component ───────────────────────────────────────────────────────────

export default function KurulumPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>('genel');

  useEffect(() => {
    const legacyTab = searchParams.get('tab');
    if (legacyTab === 'kullanicilar') {
      router.replace('/panel/kullanicilar');
      return;
    }
    if (legacyTab === 'roller') {
      router.replace('/panel/ayarlar/roller');
      return;
    }
    if (legacyTab === 'alan-zorunluluklari') {
      router.replace('/panel/ayarlar/alan-zorunluluklari');
    }
  }, [router, searchParams]);

  const selectTab = (tabId: TabId) => {
    setActiveTab(tabId);
  };

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
          <Link
            href="/panel/ayarlar"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-3"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            ← Ayarlar
          </Link>
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
                onClick={() => selectTab(tab.id)}
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
          {activeTab === 'mail'                 && <MailTab />}
          {activeTab === 'sms'                  && <SmsTab />}
          {activeTab === 'uyari-sinyalizasyon'  && <UyariSinyalizasyonTab />}
          {activeTab === 'entegrasyonlar'       && <EntegrasyonlarTab />}
          {activeTab === 'sistem'               && <SistemTab />}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Genel Bilgiler ───────────────────────────────────────────────────────

function GenelBilgilerTab() {
  const emptyForm: CompanyInfo = {
    name: '', logoUrl: '', address: '', phone: '', email: '', taxNumber: '', tradeRegistryNo: '', website: '',
    kvkkEmail: '', appUrl: 'https://app.meridyen-tr.com',
    payrollEmployerName: '', payrollEmployerAddress: '', payrollEmployerTaxNumber: '',
  };
  const [form, setForm] = useState<CompanyInfo>(emptyForm);
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
        setForm({
          name: d.name ?? '', logoUrl: d.logoUrl ?? '', address: d.address ?? '', phone: d.phone ?? '',
          email: d.email ?? '', taxNumber: d.taxNumber ?? '', tradeRegistryNo: d.tradeRegistryNo ?? '',
          website: d.website ?? '', kvkkEmail: d.kvkkEmail ?? '', appUrl: d.appUrl ?? 'https://app.meridyen-tr.com',
          payrollEmployerName: d.payrollEmployerName ?? '', payrollEmployerAddress: d.payrollEmployerAddress ?? '',
          payrollEmployerTaxNumber: d.payrollEmployerTaxNumber ?? '',
        });
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
    setSaving(true); setError(''); setSuccess('');
    try {
      await axios.put(
        `${API}/system-settings/company-info`,
        { logoUrl: form.logoUrl ?? '' },
        { headers: authHeader() },
      );
      setSuccess('Logo kaydedildi.');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Kayıt sırasında hata oluştu. Dosya boyutu 5 MB\'ı geçmemelidir.');
    } finally { setSaving(false); }
  };

  if (loading) return <CardSkeleton />;

  return (
    <TabCard title="Tema ve Logo" description="Şirket logosu panelde ve belgelerde kullanılır. Unvan, vergi, KVKK ve sözleşme alanları Şirket Bilgileri sayfasındadır.">
      {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
      {success && <SuccessAlert msg={success} />}

      <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-blue-800">
        Şirket unvanı, vergi no, KVKK e-postası ve Safran bilgileri için{' '}
        <Link href="/panel/ayarlar/sirket-bilgileri" className="font-semibold underline">Şirket Bilgileri</Link>
        {' '}sayfasını kullanın. Kullanıcı ve rol yönetimi{' '}
        <Link href="/panel/kullanicilar" className="font-semibold underline">Kullanıcılar</Link>
        {' '}ve{' '}
        <Link href="/panel/ayarlar/roller" className="font-semibold underline">Roller</Link>
        {' '}sayfalarındadır.
      </div>

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

      <div className="mt-6 flex justify-end">
        <SaveBtn loading={saving} onClick={handleSave} label="Logoyu Kaydet" />
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

// ── Tab: Uyarı ve Sinyalizasyon ──────────────────────────────────────────────

const DEFAULT_SIGNAL_RULES: SignalRule[] = [
  {
    key: 'disk_critical',
    name: 'Disk alanı kritik seviyede',
    area: 'sistem',
    level: 'kritik',
    trigger: 'Disk kullanımı yüzde 95 ve üzerine çıktığında',
    targetRoles: ['Sistem Yöneticisi'],
    channels: { inApp: false, telegram: true, email: false },
    repeatPolicy: 'Durum değişince ve günlük özet içinde',
    active: true,
  },
  {
    key: 'api_unhealthy',
    name: 'API sağlık kontrolü başarısız',
    area: 'sistem',
    level: 'kritik',
    trigger: 'API sağlık kontrolü başarısız olduğunda',
    targetRoles: ['Sistem Yöneticisi'],
    channels: { inApp: false, telegram: true, email: false },
    repeatPolicy: 'Durum değişince',
    active: true,
  },
  {
    key: 'sla_risk',
    name: 'SLA riski oluştu',
    area: 'operasyon',
    level: 'uyari',
    trigger: 'Dosya hedef süresine yaklaştığında',
    targetRoles: ['Operasyon', 'Sistem Yöneticisi'],
    channels: { inApp: true, telegram: false, email: false },
    repeatPolicy: 'Günlük özet ve dosya kartı üzerinde',
    active: true,
  },
  {
    key: 'overdue_collection',
    name: 'Geciken tahsilat',
    area: 'finans',
    level: 'uyari',
    trigger: 'Vadesi geçen tahsilat kaydı oluştuğunda',
    targetRoles: ['Finans', 'Sistem Yöneticisi'],
    channels: { inApp: true, telegram: false, email: false },
    repeatPolicy: 'Günlük özet ve finans ekranı üzerinde',
    active: true,
  },
  {
    key: 'pending_task',
    name: 'Bekleyen görev veya aksiyon',
    area: 'gorev',
    level: 'bilgi',
    trigger: 'Sorumlu kişiye atanmış açık görev bulunduğunda',
    targetRoles: ['Operasyon', 'Sistem Yöneticisi'],
    channels: { inApp: true, telegram: false, email: false },
    repeatPolicy: 'Kullanıcı ekranında sürekli görünür',
    active: true,
  },
];

function UyariSinyalizasyonTab() {
  const [form, setForm] = useState<NotificationSettings>({ emailEnabled: true, notifications: [], signalRules: DEFAULT_SIGNAL_RULES });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    axios.get(`${API}/system-settings/notification-settings`, { headers: authHeader() })
      .then((r) => {
        const data = r.data.data ?? {};
        setForm({
          emailEnabled: data.emailEnabled ?? true,
          notifications: Array.isArray(data.notifications) ? data.notifications : [],
          signalRules: Array.isArray(data.signalRules) && data.signalRules.length > 0 ? data.signalRules : DEFAULT_SIGNAL_RULES,
        });
      })
      .catch(() => setError('Uyarı kuralları yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  const updateRule = (key: string, patch: Partial<SignalRule>) => {
    setForm((prev) => ({
      ...prev,
      signalRules: prev.signalRules.map((rule) => rule.key === key ? { ...rule, ...patch } : rule),
    }));
  };

  const updateRuleChannels = (key: string, channel: keyof SignalRule['channels'], checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      signalRules: prev.signalRules.map((rule) => rule.key === key
        ? { ...rule, channels: { ...rule.channels, [channel]: checked } }
        : rule),
    }));
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      await axios.put(`${API}/system-settings/notification-settings`, form, { headers: authHeader() });
      setSuccess('Uyarı ve sinyalizasyon kuralları kaydedildi.');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Kayıt sırasında hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const levelCls = (level: SignalRule['level']) => {
    if (level === 'kritik') return 'bg-red-50 text-red-700 border-red-200';
    if (level === 'uyari') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  if (loading) return <CardSkeleton />;

  return (
    <TabCard title="Uyarı ve Sinyalizasyon Kuralları" description="Yazılım içi kullanıcı sinyalleri, Telegram operasyon alarmları ve e-posta bildirimlerini tek merkezden yönetin.">
      {error && <ErrorAlert msg={error} onClose={() => setError('')} />}
      {success && <SuccessAlert msg={success} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        {[
          { title: 'Yazılım İçi Sinyal', text: 'Kullanıcıların panelde göreceği görev, risk ve aksiyon uyarılarıdır.', tone: 'blue' },
          { title: 'Telegram Operasyon Alarmı', text: 'Sistem yöneticisine giden teknik ve kritik servis alarmlarıdır.', tone: 'red' },
          { title: 'E-posta Bildirimi', text: 'Dış iletişim veya resmi bilgilendirme gerektiren bildirimler için kullanılır.', tone: 'emerald' },
        ].map((item) => (
          <div key={item.title} className={`rounded-lg border p-4 ${item.tone === 'red' ? 'border-red-100 bg-red-50/60' : item.tone === 'emerald' ? 'border-emerald-100 bg-emerald-50/60' : 'border-blue-100 bg-blue-50/60'}`}>
            <p className="text-sm font-semibold text-slate-800">{item.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{item.text}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Kural</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Seviye</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tetikleyici</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Kanallar</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Roller</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {form.signalRules.map((rule) => (
              <tr key={rule.key} className={!rule.active ? 'bg-slate-50/70' : ''}>
                <td className="px-4 py-4 align-top">
                  <div className="font-semibold text-slate-800">{rule.name}</div>
                  <div className="mt-1 text-xs text-slate-400">{rule.area === 'gorev' ? 'Görev' : toTitleCaseTR(rule.area)}</div>
                </td>
                <td className="px-4 py-4 align-top">
                  <select
                    className={`${inputCls} min-w-[110px]`}
                    value={rule.level}
                    onChange={(e) => updateRule(rule.key, { level: e.target.value as SignalRule['level'] })}
                  >
                    <option value="bilgi">Bilgi</option>
                    <option value="uyari">Uyarı</option>
                    <option value="kritik">Kritik</option>
                  </select>
                  <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${levelCls(rule.level)}`}>
                    {rule.level === 'uyari' ? 'Uyarı' : toTitleCaseTR(rule.level)}
                  </span>
                </td>
                <td className="px-4 py-4 align-top min-w-[260px]">
                  <textarea
                    className={`${inputCls} min-h-[76px] resize-y`}
                    value={rule.trigger}
                    onChange={(e) => updateRule(rule.key, { trigger: e.target.value })}
                  />
                  <input
                    className={`${inputCls} mt-2`}
                    value={rule.repeatPolicy}
                    onChange={(e) => updateRule(rule.key, { repeatPolicy: e.target.value })}
                    placeholder="Tekrar kuralı"
                  />
                </td>
                <td className="px-4 py-4 align-top min-w-[170px]">
                  {[
                    { key: 'inApp', label: 'Yazılım içi' },
                    { key: 'telegram', label: 'Telegram' },
                    { key: 'email', label: 'E-posta' },
                  ].map((channel) => (
                    <label key={channel.key} className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={rule.channels[channel.key as keyof SignalRule['channels']]}
                        onChange={(e) => updateRuleChannels(rule.key, channel.key as keyof SignalRule['channels'], e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {channel.label}
                    </label>
                  ))}
                </td>
                <td className="px-4 py-4 align-top min-w-[190px]">
                  <input
                    className={inputCls}
                    value={rule.targetRoles.join(', ')}
                    onChange={(e) => updateRule(rule.key, { targetRoles: e.target.value.split(',').map((role) => role.trim()).filter(Boolean) })}
                    placeholder="Rol adları"
                  />
                </td>
                <td className="px-4 py-4 align-top">
                  <button
                    type="button"
                    onClick={() => updateRule(rule.key, { active: !rule.active })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${rule.active ? 'bg-blue-600' : 'bg-slate-300'}`}
                    aria-label={`${rule.name} durumunu değiştir`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${rule.active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <p className={`mt-2 text-xs font-semibold ${rule.active ? 'text-green-600' : 'text-slate-400'}`}>{rule.active ? 'Aktif' : 'Pasif'}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Kritik teknik olaylarda Telegram açık kalmalı; kullanıcı iş akışını ilgilendiren konularda yazılım içi sinyal tercih edilmelidir. Böylece operasyon ekibi gereksiz teknik mesajlarla yorulmaz.
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

function SaveBtn({ loading, onClick, label = 'Kaydet' }: { loading: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-2">
      {loading && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
      {loading ? 'Kaydediliyor...' : label}
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
