'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { inputCls, labelCls } from '@/components/settings/SettingsUI';
import { redirectAfterSettingsSave } from '@/utils/settings-save-redirect';

type IntegrationTab = 'sms' | 'turmob' | 'logo-wings' | 'm365' | 'google-places';

interface M365GraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  ihbarMailbox: string;
  hasarMailbox: string;
  active: boolean;
  lastTestAt?: string;
  lastTestSuccess?: boolean;
  lastTestMessage?: string;
}

interface SmsConfig {
  provider: 'netgsm' | 'iletimerkezi' | 'other';
  apiKey: string;
  apiSecret: string;
  senderId: string;
  active: boolean;
}

interface TurmobConfig {
  apiUrl: string;
  apiKey: string;
  username: string;
  password: string;
  active: boolean;
}

interface LogoWingsConfig {
  apiUrl: string;
  apiKey: string;
  username: string;
  password: string;
  active: boolean;
}

interface GooglePlacesConfig {
  apiKey: string;
  active: boolean;
}

const defaultSmsConfig: SmsConfig = {
  provider: 'netgsm',
  apiKey: '',
  apiSecret: '',
  senderId: '',
  active: false,
};

const defaultTurmobConfig: TurmobConfig = {
  apiUrl: '',
  apiKey: '',
  username: '',
  password: '',
  active: false,
};

const defaultLogoWingsConfig: LogoWingsConfig = {
  apiUrl: '',
  apiKey: '',
  username: '',
  password: '',
  active: false,
};

const defaultGooglePlacesConfig: GooglePlacesConfig = {
  apiKey: '',
  active: false,
};

const defaultM365Config: M365GraphConfig = {
  tenantId: '',
  clientId: '',
  clientSecret: '',
  ihbarMailbox: 'ihbar@safranbh.com',
  hasarMailbox: 'hasar@safranbh.com',
  active: false,
};

const TABS: { id: IntegrationTab; label: string; description: string }[] = [
  {
    id: 'sms',
    label: 'SMS Entegrasyonu',
    description: 'Netgsm / İleti Merkezi sağlayıcı bağlantısı',
  },
  {
    id: 'm365',
    label: 'Microsoft 365',
    description: 'ihbar@ / hasar@ paylaşımlı kutu gelen kutusu',
  },
  {
    id: 'turmob',
    label: 'TÜRMOB',
    description: 'Vergi numarasına bağlı ünvan sorgusu',
  },
  {
    id: 'logo-wings',
    label: 'Logo Wings ERP',
    description: 'Muhasebe ve ERP bağlantısı',
  },
  {
    id: 'google-places',
    label: 'Google Places',
    description: 'Tedarikçi dış kaynak arama (Places API)',
  },
];

function parseTab(value: string | null): IntegrationTab {
  if (value === 'sms' || value === 'turmob' || value === 'logo-wings' || value === 'm365' || value === 'google-places') return value;
  return 'sms';
}

export default function EntegrasyonlarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<IntegrationTab>(() => parseTab(searchParams.get('sekme')));

  const [smsConfig, setSmsConfig] = useState<SmsConfig>(defaultSmsConfig);
  const [turmobConfig, setTurmobConfig] = useState<TurmobConfig>(defaultTurmobConfig);
  const [logoWingsConfig, setLogoWingsConfig] = useState<LogoWingsConfig>(defaultLogoWingsConfig);
  const [googlePlacesConfig, setGooglePlacesConfig] = useState<GooglePlacesConfig>(defaultGooglePlacesConfig);
  const [googlePlacesKeyConfigured, setGooglePlacesKeyConfigured] = useState(false);
  const [googlePlacesTesting, setGooglePlacesTesting] = useState(false);
  const [googlePlacesTestMsg, setGooglePlacesTestMsg] = useState('');
  const [googlePlacesTestError, setGooglePlacesTestError] = useState('');
  const [m365Config, setM365Config] = useState<M365GraphConfig>(defaultM365Config);
  const [m365SecretConfigured, setM365SecretConfigured] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState('');
  const [testError, setTestError] = useState('');

  const [m365TestResult, setM365TestResult] = useState<{
    success: boolean;
    message: string;
    mailboxes?: { label: string; address: string; ok: boolean; totalItems?: number; error?: string }[];
  } | null>(null);

  useEffect(() => {
    setActiveTab(parseTab(searchParams.get('sekme')));
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      try {
        const [smsRes, turmobRes, integrationRes, m365Res] = await Promise.all([
          axios.get(`${API}/system-settings/sms-config`, { headers: authHeader() }),
          axios.get(`${API}/system-settings/turmob-config`, { headers: authHeader() }),
          axios.get(`${API}/system-settings/integration-config`, { headers: authHeader() }),
          axios.get(`${API}/system-settings/m365-graph-config`, { headers: authHeader() }),
        ]);

        const smsData = smsRes.data?.data;
        if (smsData) {
          setSmsConfig({
            provider: smsData.provider ?? 'netgsm',
            apiKey: smsData.apiKey ?? '',
            apiSecret: smsData.apiSecret ?? '',
            senderId: smsData.senderId ?? '',
            active: smsData.active ?? false,
          });
        }

        const turmobData = turmobRes.data?.data;
        if (turmobData) {
          setTurmobConfig({
            apiUrl: turmobData.apiUrl ?? '',
            apiKey: turmobData.apiKey ?? '',
            username: turmobData.username ?? '',
            password: turmobData.password ?? '',
            active: turmobData.active ?? false,
          });
        }

        const lw = integrationRes.data?.data?.logoWings;
        if (lw) {
          setLogoWingsConfig({
            apiUrl: lw.apiUrl ?? '',
            apiKey: lw.apiKey ?? '',
            username: lw.username ?? '',
            password: lw.password ?? '',
            active: lw.active ?? false,
          });
        }

        const gp = integrationRes.data?.data?.googlePlaces;
        if (gp) {
          setGooglePlacesKeyConfigured(Boolean(gp.apiKey));
          setGooglePlacesConfig({
            apiKey: '',
            active: gp.active ?? false,
          });
        }

        const m365Data = m365Res.data?.data;
        if (m365Data) {
          setM365SecretConfigured(Boolean(m365Data.clientSecretConfigured));
          setM365Config({
            tenantId: m365Data.tenantId ?? '',
            clientId: m365Data.clientId ?? '',
            clientSecret: '',
            ihbarMailbox: m365Data.ihbarMailbox ?? 'ihbar@safranbh.com',
            hasarMailbox: m365Data.hasarMailbox ?? 'hasar@safranbh.com',
            active: m365Data.active ?? false,
            lastTestAt: m365Data.lastTestAt,
            lastTestSuccess: m365Data.lastTestSuccess,
            lastTestMessage: m365Data.lastTestMessage,
          });
        }
      } catch {
        /* varsayılanlar kalır */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const switchTab = (tab: IntegrationTab) => {
    setActiveTab(tab);
    setSaveError('');
    router.replace(`/panel/ayarlar/entegrasyonlar?sekme=${tab}`, { scroll: false });
  };

  const handleSaveSms = async () => {
    if (!smsConfig.apiKey.trim() || !smsConfig.senderId.trim()) {
      setSaveError('SMS için API Key ve Sender ID zorunludur.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await axios.put(`${API}/system-settings/sms-config`, smsConfig, { headers: authHeader() });
      redirectAfterSettingsSave(router, 'entegrasyonlar-sms');
    } catch (e: any) {
      setSaveError(e.response?.data?.message ?? 'SMS ayarları kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTurmob = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await axios.put(`${API}/system-settings/turmob-config`, turmobConfig, { headers: authHeader() });
      redirectAfterSettingsSave(router, 'entegrasyonlar-turmob');
    } catch (e: any) {
      setSaveError(e.response?.data?.message ?? 'TÜRMOB ayarları kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveM365 = async () => {
    if (!m365Config.tenantId.trim() || !m365Config.clientId.trim()) {
      setSaveError('Kiracı kimliği ve uygulama kimliği zorunludur.');
      return;
    }
    if (!m365SecretConfigured && !m365Config.clientSecret.trim()) {
      setSaveError('Gizli anahtar zorunludur.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const res = await axios.put(`${API}/system-settings/m365-graph-config`, m365Config, { headers: authHeader() });
      if (res.data?.data?.clientSecretConfigured) {
        setM365SecretConfigured(true);
        setM365Config((prev) => ({ ...prev, clientSecret: '' }));
      }
      redirectAfterSettingsSave(router, 'entegrasyonlar-m365');
    } catch (e: any) {
      setSaveError(e.response?.data?.message ?? 'Microsoft 365 ayarları kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestM365 = async () => {
    if (!m365Config.tenantId.trim() || !m365Config.clientId.trim()) {
      setTestError('Test için kiracı kimliği ve uygulama kimliği girin.');
      return;
    }
    if (!m365SecretConfigured && !m365Config.clientSecret.trim()) {
      setTestError('Test için gizli anahtar girin veya önce kaydedilmiş bir secret olmalı.');
      return;
    }
    setTesting(true);
    setM365TestResult(null);
    setTestSuccess('');
    setTestError('');
    try {
      const res = await axios.post(
        `${API}/operation-inbox/test-connection`,
        m365Config,
        { headers: authHeader() },
      );
      const data = res.data?.data;
      setM365TestResult(data ?? null);
      if (res.data?.success) {
        setTestSuccess(data?.message ?? 'Bağlantı başarılı.');
        setM365Config((prev) => ({
          ...prev,
          lastTestAt: new Date().toISOString(),
          lastTestSuccess: true,
          lastTestMessage: data?.message,
        }));
      } else {
        setTestError(data?.message ?? 'Bağlantı testi başarısız.');
        setM365Config((prev) => ({
          ...prev,
          lastTestAt: new Date().toISOString(),
          lastTestSuccess: false,
          lastTestMessage: data?.message,
        }));
      }
    } catch (e: any) {
      setTestError(e.response?.data?.message ?? 'Bağlantı testi yapılamadı.');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveLogoWings = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await axios.put(
        `${API}/system-settings/integration-config`,
        { logoWings: logoWingsConfig },
        { headers: authHeader() },
      );
      redirectAfterSettingsSave(router, 'entegrasyonlar-logo-wings');
    } catch (e: any) {
      setSaveError(e.response?.data?.message ?? 'Logo Wings ayarları kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGooglePlaces = async () => {
    if (googlePlacesConfig.active && !googlePlacesKeyConfigured && !googlePlacesConfig.apiKey.trim()) {
      setSaveError('Google Places için API key zorunludur.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await axios.put(
        `${API}/system-settings/integration-config`,
        { googlePlaces: googlePlacesConfig },
        { headers: authHeader() },
      );
      if (googlePlacesConfig.apiKey.trim()) {
        setGooglePlacesKeyConfigured(true);
        setGooglePlacesConfig((prev) => ({ ...prev, apiKey: '' }));
      }
      redirectAfterSettingsSave(router, 'entegrasyonlar-google-places');
    } catch (e: any) {
      setSaveError(e.response?.data?.message ?? 'Google Places ayarları kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestGooglePlaces = async () => {
    setGooglePlacesTesting(true);
    setGooglePlacesTestMsg('');
    setGooglePlacesTestError('');
    try {
      const res = await axios.post(`${API}/vendor-discovery/test-google`, {}, { headers: authHeader() });
      const data = res.data?.data;
      if (res.data?.success && data?.ok) {
        setGooglePlacesTestMsg(data.message ?? 'Bağlantı başarılı.');
      } else {
        setGooglePlacesTestError(data?.message ?? 'Bağlantı testi başarısız.');
      }
    } catch (e: any) {
      setGooglePlacesTestError(e.response?.data?.data?.message ?? e.response?.data?.message ?? 'Bağlantı testi yapılamadı.');
    } finally {
      setGooglePlacesTesting(false);
    }
  };

  const handleTestSms = async () => {
    if (!testPhone.trim()) {
      setTestError('Telefon numarası giriniz.');
      return;
    }
    setTesting(true);
    setTestSuccess('');
    setTestError('');
    try {
      const res = await axios.post(
        `${API}/notifications/sms/test`,
        { to: testPhone, message: testMsg || 'Meridyen Assistance SMS entegrasyon testi.' },
        { headers: authHeader() },
      );
      if (res.data?.success) {
        setTestSuccess('Test SMS başarıyla gönderildi.');
      } else {
        setTestError(res.data?.error ?? 'SMS gönderilemedi.');
      }
    } catch (e: any) {
      setTestError(e.response?.data?.message ?? 'SMS gönderilemedi.');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-slate-400">Yükleniyor...</div>;
  }

  return (
    <SettingsPageLayout
      title="Entegrasyon Merkezi"
      description="SMS, Microsoft 365 gelen kutusu, TÜRMOB ünvan sorgusu, Logo Wings ERP ve Google Places bağlantılarını yapılandırın"
    >
      <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3">
        <p className="text-sm text-slate-600">
          Dış servis bağlantıları bu merkezden yönetilir. SMS şablonları ve gönderim geçmişi için{' '}
          <Link href="/panel/ayarlar/sms-bildirimler" className="font-medium text-blue-700 hover:underline">
            SMS Bildirimleri
          </Link>{' '}
          sayfasını kullanın.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col sm:flex-row">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={`border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${
                activeTab === tab.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="block text-sm font-semibold">{tab.label}</span>
              <span className="mt-0.5 block max-w-xs text-xs text-slate-400">{tab.description}</span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'sms' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-slate-50 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">SMS Sağlayıcı Bağlantısı</h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Netgsm veya İleti Merkezi üzerinden sistem SMS gönderimini etkinleştirin
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSmsConfig((prev) => ({ ...prev, active: !prev.active }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    smsConfig.active ? 'bg-brand-600' : 'bg-slate-200'
                  }`}
                  role="switch"
                  aria-checked={smsConfig.active}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                      smsConfig.active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={labelCls}>SMS Sağlayıcı</label>
                  <select
                    className={`${inputCls} bg-white`}
                    value={smsConfig.provider}
                    onChange={(e) =>
                      setSmsConfig((prev) => ({
                        ...prev,
                        provider: e.target.value as SmsConfig['provider'],
                      }))
                    }
                  >
                    <option value="netgsm">Netgsm</option>
                    <option value="iletimerkezi">İleti Merkezi</option>
                    <option value="other">Diğer (manuel yapılandırma)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    API Key <span className="ml-1 text-xs font-normal text-slate-400">(Zorunlu)</span>
                  </label>
                  <input
                    type="password"
                    className={inputCls}
                    placeholder="API kullanıcı kodu"
                    value={smsConfig.apiKey}
                    onChange={(e) => setSmsConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className={labelCls}>API Secret</label>
                  <input
                    type="password"
                    className={inputCls}
                    placeholder="API şifresi / anahtar"
                    value={smsConfig.apiSecret}
                    onChange={(e) => setSmsConfig((prev) => ({ ...prev, apiSecret: e.target.value }))}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Sender ID (Başlık) <span className="ml-1 text-xs font-normal text-slate-400">(Zorunlu)</span>
                  </label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="MERIDYEN"
                    maxLength={11}
                    value={smsConfig.senderId}
                    onChange={(e) => setSmsConfig((prev) => ({ ...prev, senderId: e.target.value.toUpperCase() }))}
                  />
                  <p className="mt-1 text-xs text-slate-400">Gönderen adı — en fazla 11 karakter</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-50 pt-4">
                <button
                  type="button"
                  onClick={handleSaveSms}
                  disabled={saving}
                  className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Kaydediliyor...' : 'SMS Entegrasyonunu Kaydet'}
                </button>
                {saveError && <span className="text-sm text-red-600">{saveError}</span>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="sticky top-6 rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="mb-1 text-sm font-semibold text-slate-700">Bağlantı Durumu</h3>
              <div
                className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                  smsConfig.active ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-500'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${smsConfig.active ? 'bg-green-500' : 'bg-slate-400'}`} />
                {smsConfig.active ? 'SMS entegrasyonu aktif' : 'SMS entegrasyonu pasif'}
              </div>
              {smsConfig.active && (!smsConfig.apiKey || !smsConfig.senderId) && (
                <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  API Key ve Sender ID girilmeden SMS gönderilemez.
                </div>
              )}

              <div className="mt-5 border-t border-slate-50 pt-4">
                <h4 className="mb-2 text-xs font-semibold text-slate-600">Test SMS Gönder</h4>
                <div className="space-y-2">
                  <input
                    type="tel"
                    className={inputCls}
                    placeholder="05XX XXX XX XX"
                    value={testPhone}
                    onChange={(e) => {
                      setTestPhone(e.target.value);
                      setTestSuccess('');
                      setTestError('');
                    }}
                  />
                  <textarea
                    rows={2}
                    className={`${inputCls} resize-none`}
                    placeholder="İsteğe bağlı test mesajı"
                    value={testMsg}
                    onChange={(e) => setTestMsg(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleTestSms}
                    disabled={testing}
                    className="w-full rounded-lg border border-brand-600 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-blue-50 disabled:opacity-50"
                  >
                    {testing ? 'Gönderiliyor...' : 'Test SMS Gönder'}
                  </button>
                  {testSuccess && <p className="text-xs text-green-600">{testSuccess}</p>}
                  {testError && <p className="text-xs text-red-600">{testError}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'turmob' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">TÜRMOB Entegrasyonu</h3>
                  <p className="mt-0.5 text-xs text-slate-400">Vergi numarasına bağlı ünvan sorgulaması</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTurmobConfig((prev) => ({ ...prev, active: !prev.active }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    turmobConfig.active ? 'bg-brand-600' : 'bg-slate-200'
                  }`}
                  role="switch"
                  aria-checked={turmobConfig.active}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                      turmobConfig.active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={labelCls}>API URL</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="https://api.turmob.org.tr/sorgu?vkn={taxNumber}"
                    value={turmobConfig.apiUrl}
                    onChange={(e) => setTurmobConfig((prev) => ({ ...prev, apiUrl: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelCls}>API Key / Token</label>
                  <input
                    type="password"
                    className={inputCls}
                    value={turmobConfig.apiKey}
                    onChange={(e) => setTurmobConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                    autoComplete="new-password"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className={labelCls}>Kullanıcı Adı (opsiyonel)</label>
                    <input
                      type="text"
                      className={inputCls}
                      value={turmobConfig.username}
                      onChange={(e) => setTurmobConfig((prev) => ({ ...prev, username: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Şifre (opsiyonel)</label>
                    <input
                      type="password"
                      className={inputCls}
                      value={turmobConfig.password}
                      onChange={(e) => setTurmobConfig((prev) => ({ ...prev, password: e.target.value }))}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-50 pt-4">
                <button
                  type="button"
                  onClick={handleSaveTurmob}
                  disabled={saving}
                  className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Kaydediliyor...' : 'TÜRMOB Ayarlarını Kaydet'}
                </button>
                {saveError && <span className="text-sm text-red-600">{saveError}</span>}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-1">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">TÜRMOB Hakkında</h3>
            <p className="text-xs leading-relaxed text-slate-500">
              TÜRMOB vergi numarasına bağlı ünvan sorgulama servisidir. API bilgilerini yetkili sağlayıcıdan temin edin.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'm365' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-slate-50 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Microsoft 365 Gelen Kutusu</h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Azure uygulama kaydı bilgileri ile ihbar@ ve hasar@ paylaşımlı kutularına erişim
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setM365Config((prev) => ({ ...prev, active: !prev.active }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    m365Config.active ? 'bg-brand-600' : 'bg-slate-200'
                  }`}
                  role="switch"
                  aria-checked={m365Config.active}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                      m365Config.active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Kiracı Kimliği (Tenant ID)</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="849fe7c7-c0e2-44a2-9b61-066caa5c3a75"
                    value={m365Config.tenantId}
                    onChange={(e) => setM365Config((prev) => ({ ...prev, tenantId: e.target.value.trim() }))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Uygulama Kimliği (Client ID)</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="bc13c71e-0396-4a96-8552-5f2b0312c3e0"
                    value={m365Config.clientId}
                    onChange={(e) => setM365Config((prev) => ({ ...prev, clientId: e.target.value.trim() }))}
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className={labelCls}>Gizli Anahtar (Client Secret)</label>
                    {m365SecretConfigured && (
                      <span className="badge badge-green text-[11px]">Kayıtlı</span>
                    )}
                  </div>
                  <input
                    type="password"
                    className={inputCls}
                    placeholder={
                      m365SecretConfigured
                        ? 'Değiştirmek için yeni secret yapıştırın'
                        : 'Azure’da oluşturduğunuz secret değeri'
                    }
                    value={m365Config.clientSecret}
                    onChange={(e) => setM365Config((prev) => ({ ...prev, clientSecret: e.target.value }))}
                    autoComplete="new-password"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    {m365SecretConfigured
                      ? 'Güvenlik nedeniyle kayıtlı secret gösterilmez.'
                      : 'Azure Sertifikalar ve gizli diziler → Değer sütununu kopyalayın.'}
                  </p>
                  {m365SecretConfigured && !m365Config.clientSecret && (
                    <p className="mt-1 text-xs text-amber-700">
                      Test başarısızsa Azure Değer sütununu tekrar yapıştırın (Secret ID değil).
                    </p>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className={labelCls}>İhbar Paylaşımlı Kutu</label>
                    <input
                      type="email"
                      className={inputCls}
                      value={m365Config.ihbarMailbox}
                      onChange={(e) => setM365Config((prev) => ({ ...prev, ihbarMailbox: e.target.value.trim() }))}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Hasar Paylaşımlı Kutu</label>
                    <input
                      type="email"
                      className={inputCls}
                      value={m365Config.hasarMailbox}
                      onChange={(e) => setM365Config((prev) => ({ ...prev, hasarMailbox: e.target.value.trim() }))}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-50 pt-4">
                <button
                  type="button"
                  onClick={handleSaveM365}
                  disabled={saving}
                  className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Kaydediliyor...' : 'Microsoft 365 Ayarlarını Kaydet'}
                </button>
                <button
                  type="button"
                  onClick={handleTestM365}
                  disabled={testing}
                  className="rounded-lg border border-brand-600 px-5 py-2.5 text-sm font-medium text-brand-600 hover:bg-blue-50 disabled:opacity-50"
                >
                  {testing ? 'Test Ediliyor...' : 'Bağlantıyı Test Et'}
                </button>
                {saveError && <span className="text-sm text-red-600">{saveError}</span>}
              </div>

              {(testSuccess || testError) && (
                <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${testSuccess ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  {testSuccess || testError}
                </div>
              )}

              {m365TestResult?.mailboxes && m365TestResult.mailboxes.length > 0 && (
                <div className="mt-4 space-y-2">
                  {m365TestResult.mailboxes.map((mb) => (
                    <div
                      key={mb.address}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                        mb.ok ? 'border-green-100 bg-green-50/50' : 'border-red-100 bg-red-50/50'
                      }`}
                    >
                      <span className="font-medium text-slate-700">{mb.label} — {mb.address}</span>
                      <span className={mb.ok ? 'text-green-700' : 'text-red-600'}>
                        {mb.ok
                          ? `Okunuyor (${mb.totalItems ?? 0} gelen)`
                          : (mb.error ?? 'Erişim yok')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 lg:col-span-1">
            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Bağlantı Durumu</h3>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    m365Config.active && m365Config.lastTestSuccess
                      ? 'bg-green-500'
                      : m365Config.active
                        ? 'bg-amber-400'
                        : 'bg-slate-300'
                  }`}
                />
                <span className="text-sm text-slate-600">
                  {m365Config.active
                    ? m365Config.lastTestSuccess
                      ? 'Aktif — son test başarılı'
                      : 'Aktif — test bekleniyor'
                    : 'Pasif'}
                </span>
              </div>
              {m365Config.lastTestAt && (
                <p className="mt-2 text-xs text-slate-400">
                  Son test: {new Date(m365Config.lastTestAt).toLocaleString('tr-TR')}
                </p>
              )}
              {m365Config.lastTestMessage && (
                <p className="mt-2 text-xs text-slate-500">{m365Config.lastTestMessage}</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Azure Bilgileri Nereden?</h3>
              <p className="text-xs leading-relaxed text-slate-500">
                Azure Portal → Uygulama kayıtları → Meridyen Gelen Kutusu → Genel bakış ve Sertifikalar
                sekmesinden Tenant ID, Client ID ve Client Secret alın. Mail.Read (Uygulama) izni okuma için;
                gelen kutusundan yanıt göndermek için ek olarak Mail.Send (Uygulama) izni ve yönetici onayı gerekir.
              </p>
              <Link
                href="/panel/operasyon/gelen-kutusu"
                className="mt-3 inline-block text-xs font-medium text-brand-600 hover:underline"
              >
                Operasyon Gelen Kutusuna Git →
              </Link>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logo-wings' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Logo Wings ERP</h3>
                  <p className="mt-0.5 text-xs text-slate-400">Muhasebe ve ERP entegrasyonu</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLogoWingsConfig((prev) => ({ ...prev, active: !prev.active }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    logoWingsConfig.active ? 'bg-brand-600' : 'bg-slate-200'
                  }`}
                  role="switch"
                  aria-checked={logoWingsConfig.active}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                      logoWingsConfig.active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={labelCls}>API URL</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="https://api.logo.com.tr/v1"
                    value={logoWingsConfig.apiUrl}
                    onChange={(e) => setLogoWingsConfig((prev) => ({ ...prev, apiUrl: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelCls}>API Key</label>
                  <input
                    type="password"
                    className={inputCls}
                    value={logoWingsConfig.apiKey}
                    onChange={(e) => setLogoWingsConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className={labelCls}>Kullanıcı Adı</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={logoWingsConfig.username}
                    onChange={(e) => setLogoWingsConfig((prev) => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Şifre</label>
                  <input
                    type="password"
                    className={inputCls}
                    value={logoWingsConfig.password}
                    onChange={(e) => setLogoWingsConfig((prev) => ({ ...prev, password: e.target.value }))}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-50 pt-4">
                <button
                  type="button"
                  onClick={handleSaveLogoWings}
                  disabled={saving}
                  className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Kaydediliyor...' : 'Logo Wings Ayarlarını Kaydet'}
                </button>
                {saveError && <span className="text-sm text-red-600">{saveError}</span>}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-1">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Logo Wings</h3>
            <p className="text-xs leading-relaxed text-slate-500">
              Logo Wings ERP bağlantı bilgilerini Logo yetkilisinden veya IT ekibinizden alın. Entegrasyon pasifken
              dış sistem çağrıları yapılmaz.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'google-places' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-slate-50 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Google Places API</h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Tedarikçiler sayfasındaki dış kaynak arama için Places API (New) Text Search
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGooglePlacesConfig((prev) => ({ ...prev, active: !prev.active }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    googlePlacesConfig.active ? 'bg-brand-600' : 'bg-slate-200'
                  }`}
                  role="switch"
                  aria-checked={googlePlacesConfig.active}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                      googlePlacesConfig.active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className={labelCls}>API Key</label>
                  <input
                    type="password"
                    className={inputCls}
                    placeholder={googlePlacesKeyConfigured ? 'Kayıtlı key mevcut — değiştirmek için yeni key girin' : 'GCP Places API key'}
                    value={googlePlacesConfig.apiKey}
                    onChange={(e) => setGooglePlacesConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                    autoComplete="new-password"
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    Key yalnızca sunucuda kullanılır. Ortam değişkeni <code className="text-slate-500">GOOGLE_PLACES_API_KEY</code> ayarlıysa ve burada aktif değilse env değeri kullanılır.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-50 pt-4">
                <button
                  type="button"
                  onClick={handleSaveGooglePlaces}
                  disabled={saving}
                  className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Kaydediliyor...' : 'Google Places Ayarlarını Kaydet'}
                </button>
                <button
                  type="button"
                  onClick={handleTestGooglePlaces}
                  disabled={googlePlacesTesting}
                  className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {googlePlacesTesting ? 'Test Ediliyor...' : 'Bağlantıyı Test Et'}
                </button>
                {saveError && <span className="text-sm text-red-600">{saveError}</span>}
              </div>
              {(googlePlacesTestMsg || googlePlacesTestError) && (
                <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${googlePlacesTestMsg ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  {googlePlacesTestMsg || googlePlacesTestError}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-1">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Google Places</h3>
            <p className="text-xs leading-relaxed text-slate-500">
              GCP konsolunda Places API (New) etkinleştirin ve sunucu tarafı kısıtlaması uygulayın.
              Entegrasyon pasifken veya key yoksa tedarikçi araması mock sonuç döner.
            </p>
          </div>
        </div>
      )}
    </SettingsPageLayout>
  );
}
