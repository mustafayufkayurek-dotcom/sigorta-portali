'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { inputCls, labelCls } from '@/components/settings/SettingsUI';
import { redirectAfterSettingsSave } from '@/utils/settings-save-redirect';


type Security = 'SSL' | 'TLS' | 'None';
type ActiveTab = 'smtp' | 'rules';

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
  { key: 'field_visit_planned', label: 'Tespit Planlama', enabled: true },
  { key: 'repair_completed', label: 'Onarım Tamamlandı', enabled: true },
  { key: 'report_sent_for_approval', label: 'Rapor Onaya Gönderildi', enabled: true },
  { key: 'appointment_reminder', label: 'Randevu Hatırlatma', enabled: true },
  { key: 'report_approval', label: 'Rapor Onay Talep', enabled: true },
  { key: 'progress_payment_approval', label: 'Hakediş Onay', enabled: true },
  { key: 'payment_approval', label: 'Ödeme Onay', enabled: true },
  { key: 'invoice_notification', label: 'Fatura Bildirimi', enabled: true },
  { key: 'file_opened', label: 'Dosya Açıldı', enabled: false },
  { key: 'file_closed', label: 'Dosya Kapatıldı', enabled: false },
  { key: 'revision_requested', label: 'Revizyon Talep', enabled: true },
  { key: 'payment_received', label: 'Tahsilat Yapıldı', enabled: false },
];

const defaultNotificationSettings: NotificationSettings = {
  emailEnabled: true,
  notifications: DEFAULT_NOTIFICATION_ITEMS,
};

const tabs: { id: ActiveTab; label: string; description: string }[] = [
  { id: 'smtp', label: 'SMTP Kurulumu', description: 'E-postaların hangi sunucu üzerinden gönderileceğini belirler.' },
  { id: 'rules', label: 'E-posta Bildirim Kuralları', description: 'Hangi olaylarda e-posta bildirimi gönderileceğini belirler.' },
];

const SMTP_GUIDES = [
  { name: 'Google Workspace / Gmail', host: 'smtp.gmail.com', port: '587', security: 'TLS' as const, note: 'Hesap ayarlarından "Uygulama Şifresi" oluşturun (2FA aktifse gereklidir).' },
  { name: 'Yandex Mail', host: 'smtp.yandex.com', port: '465', security: 'SSL' as const, note: 'Yandex hesabı ayarlarından uygulama şifresi oluşturun.' },
  { name: 'Office 365 (Microsoft)', host: 'smtp.office365.com', port: '587', security: 'TLS' as const, note: 'Modern Auth aktifse app password veya OAuth2 kullanın.' },
  { name: 'Özel / cPanel', host: 'mail.alanadi.com', port: '587', security: 'TLS' as const, note: 'cPanel mail hesabı şifresi ile giriş yapabilirsiniz.' },
];

export default function EPostaBildirimleriPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('smtp');
  const [mailConfig, setMailConfig] = useState<MailConfig>(defaultMailConfig);
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [showMailPassword, setShowMailPassword] = useState(false);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(defaultNotificationSettings);
  const [loading, setLoading] = useState(true);
  const [showSmtpGuide, setShowSmtpGuide] = useState(false);

  const [savingMail, setSavingMail] = useState(false);
  const [mailSuccess, setMailSuccess] = useState('');
  const [mailError, setMailError] = useState('');

  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState('');
  const [testError, setTestError] = useState('');

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
          const legacyMasked = d.password === '***' || d.password === '••••••••';
          setPasswordConfigured(Boolean(d.passwordConfigured) || legacyMasked);
          setMailConfig({
            host: d.host ?? '',
            port: String(d.port ?? '587'),
            username: d.username ?? '',
            password: legacyMasked ? '' : (d.password ?? ''),
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
    if (!mailConfig.host) { setMailError('SMTP sunucu adresi zorunludur.'); return; }
    if (!mailConfig.username) { setMailError('Kullanıcı adı zorunludur.'); return; }
    if (!passwordConfigured && !mailConfig.password.trim()) {
      setMailError('İlk kurulumda SMTP şifresi zorunludur.');
      return;
    }
    setSavingMail(true);
    setMailSuccess('');
    setMailError('');
    try {
      await axios.put(
        `${API}/system-settings/mail-config`,
        {
          ...mailConfig,
          port: Number(mailConfig.port) || 587,
          password: mailConfig.password.trim(),
        },
        { headers: authHeader() },
      );
      if (mailConfig.password.trim()) {
        setPasswordConfigured(true);
      }
      setMailConfig((prev) => ({ ...prev, password: '' }));
      setShowMailPassword(false);
      setMailSuccess('SMTP ayarları kaydedildi.');
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
      const detail = res.data?.data;
      const accepted = Array.isArray(detail?.accepted) ? detail.accepted.join(', ') : '';
      const rejected = Array.isArray(detail?.rejected) ? detail.rejected.join(', ') : '';
      const response = detail?.response ? ` SMTP cevabı: ${detail.response}` : '';
      const deliveryNote = accepted ? ` Kabul edilen alıcı: ${accepted}.` : '';
      const rejectionNote = rejected ? ` Reddedilen alıcı: ${rejected}.` : '';
      setTestSuccess(`${res.data?.message ?? 'Test e-postası SMTP sunucusuna iletildi.'}${deliveryNote}${rejectionNote}${response}`);
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
      const payload: NotificationSettings = {
        ...notifSettings,
        notifications: notifSettings.notifications.length > 0
          ? notifSettings.notifications
          : DEFAULT_NOTIFICATION_ITEMS,
      };
      await axios.put(`${API}/system-settings/notification-settings`, payload, { headers: authHeader() });
      setNotifSettings(payload);
      redirectAfterSettingsSave(router, 'e-posta-bildirimleri-kurallar');
    } catch (e: any) {
      setNotifError(e.response?.data?.message ?? 'Kaydedilemedi.');
    } finally {
      setSavingNotif(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <SettingsPageLayout
      title="Mail ve Bildirim Merkezi"
      description="Mail gönderimi ve bildirim ayarları bu merkezden yönetilir."
    >
      <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3">
        <p className="text-sm text-slate-600">
          Mail gönderimi ve bildirim ayarları bu merkezden yönetilir. Mail şablonları Şablon Merkezi altında yönetilir.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col sm:flex-row">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
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

      {activeTab === 'smtp' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="mb-1 text-sm font-semibold text-slate-700">SMTP Kurulumu</h3>
            <p className="mb-5 text-xs text-slate-400">E-postaların hangi sunucu üzerinden gönderileceğini belirleyin.</p>

            <div className="mb-5">
              <button
                type="button"
                onClick={() => setShowSmtpGuide((value) => !value)}
                className="flex items-center gap-2 text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {showSmtpGuide ? 'Sağlayıcı rehberini kapat' : 'Sağlayıcı rehberini göster (Yandex, Google, Office 365...)'}
              </button>
              {showSmtpGuide && (
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {SMTP_GUIDES.map((guide) => (
                    <button
                      key={guide.name}
                      type="button"
                      onClick={() => {
                        setMailConfig((prev) => ({
                          ...prev,
                          host: guide.host,
                          port: guide.port,
                          security: guide.security,
                        }));
                        setMailSuccess('');
                        setMailError('');
                      }}
                      className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 text-left transition-colors hover:bg-blue-50"
                    >
                      <p className="mb-0.5 text-xs font-semibold text-slate-800">{guide.name}</p>
                      <p className="font-mono text-xs text-slate-500">{guide.host} · Port {guide.port} · {guide.security}</p>
                      <p className="mt-1 text-xs text-slate-400">{guide.note}</p>
                      <p className="mt-1 text-xs text-blue-500">Tıklayarak otomatik doldur</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className={labelCls}>SMTP Sunucu <span className="ml-1 text-xs font-normal text-slate-400">(Zorunlu)</span></label>
                <input type="text" className={inputCls} placeholder="smtp.example.com" value={mailConfig.host} onChange={(e) => handleMailChange('host', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Port</label>
                <input type="text" className={inputCls} placeholder="587" value={mailConfig.port} onChange={(e) => handleMailChange('port', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>TLS/SSL</label>
                <select className={`${inputCls} bg-white`} value={mailConfig.security} onChange={(e) => handleMailChange('security', e.target.value as Security)}>
                  <option value="TLS">TLS (STARTTLS)</option>
                  <option value="SSL">SSL</option>
                  <option value="None">None (Şifresiz)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Kullanıcı</label>
                <input type="text" className={inputCls} placeholder="kullanici@example.com" value={mailConfig.username} onChange={(e) => handleMailChange('username', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Şifre</label>
                <div className="relative">
                  <input
                    type={showMailPassword ? 'text' : 'password'}
                    className={`${inputCls} pr-10`}
                    placeholder={passwordConfigured ? 'Kayıtlı — değiştirmek için yazın' : 'SMTP şifresi'}
                    value={mailConfig.password}
                    onChange={(e) => handleMailChange('password', e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMailPassword((value) => !value)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                    aria-label={showMailPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  >
                    {showMailPassword ? (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {passwordConfigured && !mailConfig.password && (
                  <p className="mt-1 text-xs text-emerald-700">Kayıtlı SMTP şifresi korunuyor. Yalnızca değiştirmek istediğinizde yeni şifre girin.</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Gönderen Adı</label>
                <input type="text" className={inputCls} placeholder="Şirket Adı" value={mailConfig.fromName} onChange={(e) => handleMailChange('fromName', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Gönderen E-posta</label>
                <input type="email" className={inputCls} placeholder="noreply@example.com" value={mailConfig.fromEmail} onChange={(e) => handleMailChange('fromEmail', e.target.value)} />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-50 pt-4">
              <button type="button" onClick={handleSaveMail} disabled={savingMail} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {savingMail ? 'Kaydediliyor...' : 'SMTP Ayarlarını Kaydet'}
              </button>
              {mailSuccess && <span className="text-sm font-medium text-green-600">{mailSuccess}</span>}
              {mailError && <span className="text-sm text-red-600">{mailError}</span>}
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <h4 className="text-sm font-semibold text-slate-700">Test Maili Gönder</h4>
              <p className="mt-1 text-xs text-slate-400">
                SMTP ayarlarını kaydettikten sonra test adresine e-posta göndererek bağlantıyı doğrulayın.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,320px)_auto] md:items-end">
                <div>
                  <label className={labelCls}>Test adresi</label>
                  <input
                    type="email"
                    className={inputCls}
                    placeholder="test@example.com"
                    value={testEmail}
                    onChange={(e) => { setTestEmail(e.target.value); setTestSuccess(''); setTestError(''); }}
                  />
                </div>
                <button type="button" onClick={handleTestMail} disabled={testing} className="w-fit rounded-lg border border-blue-600 px-5 py-2.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50">
                  {testing ? 'Gönderiliyor...' : 'Test Maili Gönder'}
                </button>
              </div>
              <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-600">Sonuç</p>
                {testSuccess ? (
                  <>
                    <p className="mt-1 text-xs text-green-700">{testSuccess}</p>
                    <p className="mt-1 text-[11px] text-green-700/80">Bu sonuç SMTP sunucusunun kabul cevabıdır. Gelen kutusunda görünmüyorsa spam/karantina ve alıcı sunucu filtresi kontrol edilmelidir.</p>
                  </>
                ) : testError ? (
                  <p className="mt-1 text-xs text-red-600">{testError}</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">Henüz test maili gönderilmedi.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="rounded-lg border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">E-posta Bildirim Kuralları</h3>
              <p className="mt-0.5 text-xs text-slate-400">Hangi olaylar için e-posta bildirimi gönderileceğini seçin.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Bildirim aktif/pasif</span>
              <button
                type="button"
                onClick={() => setNotifSettings((prev) => ({ ...prev, emailEnabled: !prev.emailEnabled }))}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${notifSettings.emailEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                title={notifSettings.emailEnabled ? 'E-posta bildirimlerini devre dışı bırak' : 'E-posta bildirimlerini etkinleştir'}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${notifSettings.emailEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          {!notifSettings.emailEnabled && (
            <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              E-posta bildirimleri genel olarak devre dışı bırakılmış. Hiçbir bildirim e-postası gönderilmeyecek.
            </div>
          )}

          <div className={`grid gap-2 md:grid-cols-2 ${!notifSettings.emailEnabled ? 'pointer-events-none opacity-50' : ''}`}>
            {notifSettings.notifications.map((n) => (
              <div key={n.key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-700">{n.label}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{n.key}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleNotification(n.key)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${n.enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${n.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-50 pt-4">
            <button type="button" onClick={handleSaveNotifications} disabled={savingNotif} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {savingNotif ? 'Kaydediliyor...' : 'Bildirim Kurallarını Kaydet'}
            </button>
            {notifSuccess && <span className="text-sm font-medium text-green-600">{notifSuccess}</span>}
            {notifError && <span className="text-sm text-red-600">{notifError}</span>}
          </div>
        </div>
      )}

    </SettingsPageLayout>
  );
}
