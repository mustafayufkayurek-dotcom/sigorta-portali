'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { inputCls, labelCls } from '@/components/settings/SettingsUI';

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

interface NotificationItem {
  key: string;
  label: string;
  enabled: boolean;
}

interface NotificationSettings {
  emailEnabled: boolean;
  notifications: NotificationItem[];
}

const defaultMailConfig: MailConfig = {
  host: '',
  port: '587',
  username: '',
  password: '',
  security: 'TLS',
  fromName: '',
  fromEmail: '',
};

const DEFAULT_NOTIFICATION_ITEMS: NotificationItem[] = [
  { key: 'file_assigned', label: 'Dosya Atama', enabled: true },
  { key: 'appointment_reminder', label: 'Randevu Hatırlatma', enabled: true },
  { key: 'report_approval', label: 'Rapor Onay', enabled: true },
  { key: 'invoice_notification', label: 'Fatura Bildirimi', enabled: true },
  { key: 'file_opened', label: 'Dosya Açıldı', enabled: false },
  { key: 'file_closed', label: 'Dosya Kapatıldı', enabled: false },
  { key: 'revision_requested', label: 'Revizyon Talep', enabled: true },
  { key: 'payment_received', label: 'Ödeme Alındı', enabled: false },
];

const defaultNotificationSettings: NotificationSettings = {
  emailEnabled: true,
  notifications: DEFAULT_NOTIFICATION_ITEMS,
};

export default function EPostaBildirimleriPage() {
  const [mailConfig, setMailConfig] = useState<MailConfig>(defaultMailConfig);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(defaultNotificationSettings);
  const [loading, setLoading] = useState(true);

  // Mail config save state
  const [savingMail, setSavingMail] = useState(false);
  const [mailSuccess, setMailSuccess] = useState('');
  const [mailError, setMailError] = useState('');

  // Test email state
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState('');
  const [testError, setTestError] = useState('');

  // Notification save state
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState('');
  const [notifError, setNotifError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [mailRes, notifRes] = await Promise.all([
          axios.get(`${API}/system-settings/mail-config`, { headers: authHeader() }).catch(() => null),
          axios.get(`${API}/system-settings/notification-settings`, { headers: authHeader() }).catch(() => null),
        ]);
        if (mailRes?.data?.data) {
          const d = mailRes.data.data;
          setMailConfig({
            host: d.host ?? '',
            port: String(d.port ?? '587'),
            username: d.username ?? '',
            password: d.password ?? '',
            security: d.security ?? 'TLS',
            fromName: d.fromName ?? '',
            fromEmail: d.fromEmail ?? '',
          });
        }
        if (notifRes?.data?.data) {
          const d = notifRes.data.data as NotificationSettings;
          setNotifSettings({
            emailEnabled: d.emailEnabled ?? true,
            notifications: Array.isArray(d.notifications) && d.notifications.length > 0
              ? d.notifications
              : DEFAULT_NOTIFICATION_ITEMS,
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleMailChange = (field: keyof MailConfig, value: string) => {
    setMailConfig((prev) => ({ ...prev, [field]: value }));
    setMailSuccess('');
    setMailError('');
  };

  const handleSaveMail = async () => {
    if (!mailConfig.host) { setMailError('SMTP Sunucu adresi zorunludur.'); return; }
    if (!mailConfig.username) { setMailError('Kullanıcı adı zorunludur.'); return; }
    setSavingMail(true);
    setMailSuccess('');
    setMailError('');
    try {
      await axios.put(
        `${API}/system-settings/mail-config`,
        { ...mailConfig, port: Number(mailConfig.port) || 587 },
        { headers: authHeader() },
      );
      setMailSuccess('SMTP ayarları başarıyla kaydedildi.');
    } catch (e: any) {
      setMailError(e.response?.data?.message ?? 'Kaydedilemedi.');
    } finally {
      setSavingMail(false);
    }
  };

  const handleTestMail = async () => {
    if (!testEmail) { setTestError('Alıcı e-posta adresi giriniz.'); return; }
    setTesting(true);
    setTestSuccess('');
    setTestError('');
    try {
      const res = await axios.post(
        `${API}/system-settings/mail-config/test`,
        { to: testEmail },
        { headers: authHeader() },
      );
      setTestSuccess(res.data?.message ?? 'Test e-postası gönderildi.');
    } catch (e: any) {
      setTestError(e.response?.data?.message ?? 'Test e-postası gönderilemedi.');
    } finally {
      setTesting(false);
    }
  };

  const toggleNotification = (key: string) => {
    setNotifSettings((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.key === key ? { ...n, enabled: !n.enabled } : n
      ),
    }));
    setNotifSuccess('');
    setNotifError('');
  };

  const handleSaveNotifications = async () => {
    setSavingNotif(true);
    setNotifSuccess('');
    setNotifError('');
    try {
      // Bildirimler boşsa kaydetme — veri kaybını önle
      const payload: NotificationSettings = {
        ...notifSettings,
        notifications: notifSettings.notifications.length > 0
          ? notifSettings.notifications
          : DEFAULT_NOTIFICATION_ITEMS,
      };
      await axios.put(`${API}/system-settings/notification-settings`, payload, { headers: authHeader() });
      setNotifSettings(payload);
      setNotifSuccess('Bildirim ayarları başarıyla kaydedildi.');
    } catch (e: any) {
      setNotifError(e.response?.data?.message ?? 'Kaydedilemedi.');
    } finally {
      setSavingNotif(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <SettingsPageLayout
      title="E-posta Bildirimleri"
      description="SMTP yapılandırması ve bildirim türlerini yönetin."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sol: SMTP + Bildirimler */}
        <div className="lg:col-span-2 space-y-6">

          {/* SMTP Ayarları */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">SMTP Sunucu Ayarları</h3>
            <p className="text-xs text-slate-400 mb-5">Sistem e-postalarının gönderileceği SMTP sunucusunu yapılandırın.</p>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>SMTP Sunucu <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="smtp.example.com"
                    value={mailConfig.host}
                    onChange={(e) => handleMailChange('host', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Port</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="587"
                    value={mailConfig.port}
                    onChange={(e) => handleMailChange('port', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Güvenlik</label>
                <select
                  className={`${inputCls} bg-white`}
                  value={mailConfig.security}
                  onChange={(e) => handleMailChange('security', e.target.value as Security)}
                >
                  <option value="TLS">TLS (STARTTLS)</option>
                  <option value="SSL">SSL</option>
                  <option value="None">None (Şifresiz)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Kullanıcı Adı (E-posta) <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="kullanici@example.com"
                    value={mailConfig.username}
                    onChange={(e) => handleMailChange('username', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Şifre</label>
                  <input
                    type="password"
                    className={inputCls}
                    placeholder="••••••••"
                    value={mailConfig.password}
                    onChange={(e) => handleMailChange('password', e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Gönderen Adı</label>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Şirket Adı"
                    value={mailConfig.fromName}
                    onChange={(e) => handleMailChange('fromName', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Gönderen E-posta</label>
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="noreply@example.com"
                    value={mailConfig.fromEmail}
                    onChange={(e) => handleMailChange('fromEmail', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-5 pt-4 border-t border-slate-50">
              <button
                type="button"
                onClick={handleSaveMail}
                disabled={savingMail}
                className="bg-blue-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {savingMail ? 'Kaydediliyor…' : 'SMTP Ayarlarını Kaydet'}
              </button>
              {mailSuccess && <span className="text-sm text-green-600 font-medium">{mailSuccess}</span>}
              {mailError && <span className="text-sm text-red-600">{mailError}</span>}
            </div>
          </div>

          {/* Bildirim Türleri */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Bildirim Türleri</h3>
                <p className="text-xs text-slate-400 mt-0.5">Hangi olaylar için e-posta bildirimi gönderileceğini seçin.</p>
              </div>
              <button
                type="button"
                onClick={() => setNotifSettings((prev) => ({ ...prev, emailEnabled: !prev.emailEnabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifSettings.emailEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                title={notifSettings.emailEnabled ? 'E-posta bildirimlerini devre dışı bırak' : 'E-posta bildirimlerini etkinleştir'}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${notifSettings.emailEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {!notifSettings.emailEnabled && (
              <div className="mb-4 mt-3 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-xs text-amber-800">
                E-posta bildirimleri genel olarak devre dışı bırakılmış. Hiçbir bildirim e-postası gönderilmeyecek.
              </div>
            )}

            <div className={`mt-4 space-y-2 ${!notifSettings.emailEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              {notifSettings.notifications.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Bildirim türleri yüklenemedi.</p>
              ) : (
                notifSettings.notifications.map((n) => (
                  <div key={n.key} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{n.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{n.key}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleNotification(n.key)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${n.enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${n.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-4 mt-5 pt-4 border-t border-slate-50">
              <button
                type="button"
                onClick={handleSaveNotifications}
                disabled={savingNotif}
                className="bg-blue-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {savingNotif ? 'Kaydediliyor…' : 'Bildirimleri Kaydet'}
              </button>
              {notifSuccess && <span className="text-sm text-green-600 font-medium">{notifSuccess}</span>}
              {notifError && <span className="text-sm text-red-600">{notifError}</span>}
            </div>
          </div>
        </div>

        {/* Sağ: Test Email */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 sticky top-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Test E-postası Gönder</h3>
            <p className="text-xs text-slate-400 mb-4">
              Kayıtlı SMTP ayarlarını test etmek için belirtilen adrese test e-postası gönderilir.
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Alıcı E-posta</label>
                <input
                  type="email"
                  className={inputCls}
                  placeholder="test@example.com"
                  value={testEmail}
                  onChange={(e) => { setTestEmail(e.target.value); setTestSuccess(''); setTestError(''); }}
                />
              </div>
              <button
                type="button"
                onClick={handleTestMail}
                disabled={testing}
                className="w-full border border-blue-600 text-blue-600 text-sm px-4 py-2.5 rounded-lg hover:bg-blue-50 disabled:opacity-50 font-medium transition-colors"
              >
                {testing ? 'Gönderiliyor…' : 'Test E-postası Gönder'}
              </button>
              {testSuccess && (
                <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2">
                  <p className="text-xs text-green-700">{testSuccess}</p>
                </div>
              )}
              {testError && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                  <p className="text-xs text-red-600">{testError}</p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-50">
              <p className="text-xs font-medium text-slate-500 mb-2">Yaygın Port Numaraları</p>
              <div className="space-y-1.5 text-xs text-slate-400">
                <div className="flex justify-between"><span>25</span><span>SMTP (şifresiz)</span></div>
                <div className="flex justify-between"><span>465</span><span>SMTPS (SSL)</span></div>
                <div className="flex justify-between"><span>587</span><span>Submission (TLS)</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SettingsPageLayout>
  );
}
