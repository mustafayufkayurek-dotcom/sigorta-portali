'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://app.meridyen-tr.com/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

type Security = 'SSL' | 'TLS' | 'None';

interface MailConfig {
  host: string;
  port: string;
  username: string;
  password: string;
  security: Security;
  fromName: string;
  fromEmail: string;
}

const defaultConfig: MailConfig = {
  host: '',
  port: '587',
  username: '',
  password: '',
  security: 'TLS',
  fromName: '',
  fromEmail: '',
};

export default function MailKurulumPage() {
  const [config, setConfig] = useState<MailConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState('');
  const [testError, setTestError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/system-settings/mail-config`, { headers: authHeader() });
        if (res.data?.data) {
          const d = res.data.data;
          setConfig({
            host: d.host ?? '',
            port: String(d.port ?? '587'),
            username: d.username ?? '',
            password: d.password ?? '',
            security: d.security ?? 'TLS',
            fromName: d.fromName ?? '',
            fromEmail: d.fromEmail ?? '',
          });
        }
      } catch (e) {
        // Kayıt yoksa varsayılan kalır
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChange = (field: keyof MailConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
    setSaveError('');
  };

  const handleSave = async () => {
    if (!config.username || !config.password) {
      setSaveError('Kullanıcı Adı ve Şifre Zorunludur.');
      return;
    }
    setSaving(true);
    setSaveSuccess(false);
    setSaveError('');
    try {
      await axios.put(
        `${API}/system-settings/mail-config`,
        { ...config, port: Number(config.port) || 587 },
        { headers: authHeader() },
      );
      setSaveSuccess(true);
    } catch (e: any) {
      setSaveError(e.response?.data?.message ?? 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestMail = async () => {
    if (!testEmail) {
      setTestError('Alıcı E-Posta Adresi Giriniz.');
      return;
    }
    setTesting(true);
    setTestSuccess('');
    setTestError('');
    try {
      const res = await axios.post(
        `${API}/system-settings/mail-config/test`,
        { to: testEmail },
        { headers: authHeader() },
      );
      const detail = res.data?.data;
      const accepted = Array.isArray(detail?.accepted) ? detail.accepted.join(', ') : '';
      const rejected = Array.isArray(detail?.rejected) ? detail.rejected.join(', ') : '';
      const response = detail?.response ? ` SMTP cevabı: ${detail.response}` : '';
      const deliveryNote = accepted
        ? ` Kabul edilen alıcı: ${accepted}.`
        : '';
      const rejectionNote = rejected
        ? ` Reddedilen alıcı: ${rejected}.`
        : '';
      setTestSuccess(`${res.data?.message ?? 'Test e-postası SMTP sunucusuna iletildi.'}${deliveryNote}${rejectionNote}${response}`);
    } catch (e: any) {
      setTestError(e.response?.data?.message ?? 'Test Maili Gönderilemedi.');
    } finally {
      setTesting(false);
    }
  };

  const inputCls =
    'w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100';
  const labelCls = 'block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1';

  if (loading) {
    return <div className="text-center text-slate-400 dark:text-slate-500 py-12">Yükleniyor...</div>;
  }

  return (
    <SettingsPageLayout
      title="Mail Kurulum"
      description="SMTP sunucu ayarlarını yapılandırın ve test edin"
    >

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sol: SMTP Ayarları */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sunucu Bilgileri */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 pb-3 border-b border-slate-50 dark:border-slate-700">
              Sunucu Bilgileri
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>SMTP Sunucu</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="smtp.example.com"
                    value={config.host}
                    onChange={(e) => handleChange('host', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Port</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="587"
                    value={config.port}
                    onChange={(e) => handleChange('port', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Güvenlik</label>
                <select
                  className={inputCls}
                  value={config.security}
                  onChange={(e) => handleChange('security', e.target.value as Security)}
                >
                  <option value="TLS">TLS (STARTTLS)</option>
                  <option value="SSL">SSL</option>
                  <option value="None">None (Şifresiz)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Kimlik Doğrulama */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 pb-3 border-b border-slate-50 dark:border-slate-700">
              Kimlik Doğrulama
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Kullanıcı Adı (E-posta)</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Zorunlu Alan"
                  value={config.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Şifre</label>
                <input
                  type="password"
                  className={inputCls}
                  placeholder="Zorunlu Alan"
                  value={config.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          {/* Gönderen Bilgileri */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 pb-3 border-b border-slate-50 dark:border-slate-700">
              Gönderen Bilgileri
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Gönderen Adı</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Şirket Adı"
                  value={config.fromName}
                  onChange={(e) => handleChange('fromName', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Gönderen E-posta</label>
                <input
                  type="email"
                  className={inputCls}
                  placeholder="noreply@example.com"
                  value={config.fromEmail}
                  onChange={(e) => handleChange('fromEmail', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Kaydet */}
          <div className="flex items-center gap-4">
            <button type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white text-sm px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            {saveSuccess && (
              <span className="text-sm text-green-600 font-medium">Ayarlar Kaydedildi.</span>
            )}
            {saveError && (
              <span className="text-sm text-red-600">{saveError}</span>
            )}
          </div>
        </div>

        {/* Sağ: Test Mail */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-6 sticky top-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Test Mail Gönder</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
              Kayıtlı SMTP ayarları kullanılarak belirtilen adrese test maili gönderilir.
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Alıcı E-posta</label>
                <input
                  type="email"
                  className={inputCls}
                  placeholder="test@example.com"
                  value={testEmail}
                  onChange={(e) => {
                    setTestEmail(e.target.value);
                    setTestSuccess('');
                    setTestError('');
                  }}
                />
              </div>
              <button type="button"
                onClick={handleTestMail}
                disabled={testing}
                className="w-full border border-blue-600 text-blue-600 text-sm px-4 py-2.5 rounded-lg hover:bg-blue-50 disabled:opacity-50 font-medium transition-colors"
              >
                {testing ? 'Gönderiliyor...' : 'Test Maili Gönder'}
              </button>
              {testSuccess && (
                <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2">
                  <p className="text-xs text-green-700">{testSuccess}</p>
                  <p className="mt-1 text-[11px] text-green-700/80">
                    Bu sonuç SMTP sunucusunun kabul cevabıdır. Gelen kutusunda görünmüyorsa spam/karantina ve alıcı sunucu filtresi kontrol edilmelidir.
                  </p>
                </div>
              )}
              {testError && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                  <p className="text-xs text-red-600">{testError}</p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-50 dark:border-slate-700">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Yaygın Port Numaraları</p>
              <div className="space-y-1.5 text-xs text-slate-400 dark:text-slate-500">
                <div className="flex justify-between">
                  <span>25</span><span>SMTP (şifresiz)</span>
                </div>
                <div className="flex justify-between">
                  <span>465</span><span>SMTPS (SSL)</span>
                </div>
                <div className="flex justify-between">
                  <span>587</span><span>Submission (TLS)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SettingsPageLayout>
  );
}
