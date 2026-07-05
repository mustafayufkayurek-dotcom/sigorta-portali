'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { redirectAfterSettingsSave } from '@/utils/settings-save-redirect';


const PLACEHOLDERS = [
  { key: '{musteriAdi}', desc: 'Sigortalının adı soyadı' },
  { key: '{dosyaNo}', desc: 'Hasar dosya numarası' },
  { key: '{sirketAdi}', desc: 'Şirket adı' },
  { key: '{sirketTelefon}', desc: 'Şirket telefon numarası' },
];

interface SmsTemplate {
  id: string;
  type: string;
  name: string;
  content: string;
  isActive: boolean;
}

interface SmsLog {
  id: string;
  to: string;
  message: string;
  status: string;
  provider: string;
  claimFileId: string | null;
  errorMsg: string | null;
  sentAt: string | null;
  createdAt: string;
}

export default function SmsBildirimleriPage() {
  const router = useRouter();
  const [_template, setTemplate] = useState<SmsTemplate | null>(null);
  const [content, setContent] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState('');
  const [testError, setTestError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/notifications/sms/templates/sms_assignment`, {
          headers: authHeader(),
        });
        const t: SmsTemplate = res.data;
        setTemplate(t);
        setContent(t.content);
        setIsActive(t.isActive);
      } catch {
        // Şablon bulunamadıysa varsayılan içerik
        setContent(
          'Sayın {musteriAdi}, {sirketAdi} olarak hasar dosyanız ({dosyaNo}) ile ilgili onarım süreciniz başlamıştır. Süreç boyunca bizimle iletişime geçebilirsiniz: {sirketTelefon}. İyi günler dileriz.',
        );
      } finally {
        setLoading(false);
      }
    })();

    (async () => {
      try {
        const res = await axios.get(`${API}/notifications/sms/logs?limit=50`, {
          headers: authHeader(),
        });
        setLogs(Array.isArray(res.data) ? res.data : []);
      } catch {
        setLogs([]);
      } finally {
        setLogsLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!content.trim()) {
      setSaveError('Şablon içeriği boş olamaz.');
      return;
    }
    setSaving(true);
    setSaveSuccess(false);
    setSaveError('');
    try {
      await axios.patch(
        `${API}/notifications/sms/templates/sms_assignment`,
        { content, isActive },
        { headers: authHeader() },
      );
      redirectAfterSettingsSave(router, 'sms-bildirimler');
    } catch (e: any) {
      setSaveError(e.response?.data?.message ?? 'Kaydedilemedi.');
    } finally {
      setSaving(false);
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
        { to: testPhone, message: testMsg || undefined },
        { headers: authHeader() },
      );
      if (res.data?.success) {
        setTestSuccess('Test SMS başarıyla gönderildi.');
        // Logları yenile
        const logsRes = await axios.get(`${API}/notifications/sms/logs?limit=50`, {
          headers: authHeader(),
        });
        setLogs(Array.isArray(logsRes.data) ? logsRes.data : []);
      } else {
        setTestError(res.data?.error ?? 'SMS gönderilemedi.');
      }
    } catch (e: any) {
      setTestError(e.response?.data?.message ?? 'SMS gönderilemedi.');
    } finally {
      setTesting(false);
    }
  };

  const insertPlaceholder = (key: string) => {
    setContent((prev) => prev + key);
    setSaveSuccess(false);
  };

  const statusBadge = (status: string) => {
    if (status === 'sent')
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">

          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          Gönderildi
        </span>
      );
    if (status === 'failed')
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
          Başarısız
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
        Beklemede
      </span>
    );
  };

  const inputCls =
    'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors bg-white';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  if (loading) {
    return <div className="text-center text-slate-400 py-12">Yükleniyor...</div>;
  }

  return (
    <SettingsPageLayout
      title="SMS / Mesaj Bildirimleri"
      description="Atama bildirim şablonları, test SMS ve gönderim geçmişi"
    >
      <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3">
        <p className="text-sm text-slate-600">
          SMS sağlayıcı bağlantısı (Netgsm / İleti Merkezi){' '}
          <Link
            href="/panel/ayarlar/entegrasyonlar?sekme=sms"
            className="font-medium text-blue-700 hover:underline"
          >
            Entegrasyon Merkezi → SMS Entegrasyonu
          </Link>{' '}
          sekmesinden yapılandırılır.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sol: Şablon + Loglar */}
        <div className="lg:col-span-2 space-y-6">
          {/* Atama SMS Şablonu */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-start justify-between mb-4 pb-3 border-b border-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Atama Bildirim Şablonu</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Dosya saha personeline ilk kez atandığında sigortalıya gönderilir
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-slate-500">Aktif</span>
                <div
                  onClick={() => setIsActive((v) => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${isActive ? 'bg-blue-500' : 'bg-slate-200'}`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0'}`}
                  />
                </div>
              </label>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelCls}>Mesaj İçeriği</label>
                <textarea
                  rows={5}
                  className={`${inputCls} resize-none`}
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setSaveSuccess(false);
                    setSaveError('');
                  }}
                />
                <p className="text-xs text-slate-400 mt-1">{content.length} karakter</p>
              </div>

              <div>
                <p className={labelCls}>Placeholder Ekle</p>
                <div className="flex flex-wrap gap-2">
                  {PLACEHOLDERS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => insertPlaceholder(p.key)}
                      title={p.desc}
                      className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors font-mono"
                    >
                      {p.key}
                    </button>
                  ))}
                </div>
                <div className="mt-2 space-y-1">
                  {PLACEHOLDERS.map((p) => (
                    <div key={p.key} className="text-xs text-slate-400 flex gap-2">
                      <span className="font-mono text-blue-600 shrink-0">{p.key}</span>
                      <span>→ {p.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className={labelCls}>Önizleme</p>
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm text-slate-700 leading-relaxed">
                  {content
                    .replace(/\{musteriAdi\}/g, 'Ahmet Yılmaz')
                    .replace(/\{dosyaNo\}/g, 'HD-2026-0042')
                    .replace(/\{sirketAdi\}/g, 'Şirket Adı')
                    .replace(/\{sirketTelefon\}/g, '0212 000 00 00') || (
                    <span className="text-slate-400 italic">Önizleme için şablon içeriği giriniz</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-5 pt-5 border-t border-slate-50">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white text-sm px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              {saveSuccess && (
                <span className="text-sm text-green-600 font-medium">Şablon kaydedildi.</span>
              )}
              {saveError && <span className="text-sm text-red-600">{saveError}</span>}
            </div>
          </div>

          {/* SMS Gönderim Logları */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 pb-3 border-b border-slate-50">
              Gönderim Geçmişi (Son 50)
            </h3>

            {logsLoading ? (
              <p className="text-center text-slate-400 text-sm py-6">Yükleniyor...</p>
            ) : logs.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-6">Henüz SMS gönderimi yapılmamış.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-50">
                      <th className="text-center font-medium text-slate-500 pb-2 pr-3">Tarih</th>
                      <th className="text-center font-medium text-slate-500 pb-2 pr-3">Numara</th>
                      <th className="text-center font-medium text-slate-500 pb-2 pr-3">Durum</th>
                      <th className="text-center font-medium text-slate-500 pb-2 pr-3">Provider</th>
                      <th className="text-center font-medium text-slate-500 pb-2">Mesaj</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                        <td className="py-2 pr-3 whitespace-nowrap text-slate-500">
                          {new Date(log.createdAt).toLocaleString('tr-TR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2 pr-3 font-mono text-slate-700">{log.to}</td>
                        <td className="py-2 pr-3">{statusBadge(log.status)}</td>
                        <td className="py-2 pr-3 text-slate-500 capitalize">{log.provider}</td>
                        <td className="py-2 max-w-xs">
                          <span className="line-clamp-2 text-slate-600">{log.message}</span>
                          {log.errorMsg && (
                            <p className="text-red-500 mt-0.5">{log.errorMsg}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sağ: Test SMS + Bilgi */}
        <div className="lg:col-span-1 space-y-4">
          {/* Test SMS */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Test SMS Gönder</h3>
            <p className="text-xs text-slate-400 mb-4">
              Belirlediğiniz numaraya anlık test SMS&apos;i gönderin
            </p>

            <div className="space-y-3">
              <div>
                <label className={labelCls}>Telefon Numarası</label>
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
              </div>
              <div>
                <label className={labelCls}>Mesaj (boş bırakılırsa varsayılan)</label>
                <textarea
                  rows={2}
                  className={`${inputCls} resize-none`}
                  placeholder="İsteğe bağlı özel mesaj..."
                  value={testMsg}
                  onChange={(e) => setTestMsg(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={handleTestSms}
                disabled={testing}
                className="w-full border border-blue-600 text-blue-600 text-sm px-4 py-2.5 rounded-lg hover:bg-blue-50 disabled:opacity-50 font-medium transition-colors"
              >
                {testing ? 'Gönderiliyor...' : 'Test SMS Gönder'}
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
          </div>

          {/* Bilgi */}
          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Sağlayıcı Ayarları</h3>
            <p className="text-xs leading-relaxed text-slate-500">
              SMS gönderimi için sağlayıcı bilgilerini{' '}
              <Link href="/panel/ayarlar/entegrasyonlar?sekme=sms" className="font-medium text-blue-700 hover:underline">
                Entegrasyon Merkezi
              </Link>{' '}
              üzerinden kaydedin. Test SMS buradan veya entegrasyon sekmesinden gönderilebilir.
            </p>
          </div>
        </div>
      </div>
    </SettingsPageLayout>
  );
}
