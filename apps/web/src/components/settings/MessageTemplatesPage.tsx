'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { SettingsModal } from '@/components/settings/SettingsModal';
import {
  EditButton,
  SettingsRowIndexTd,
  SettingsRowIndexTh,
  SettingsTable,
  SettingsTableActions,
  SettingsTableBody,
  SettingsTableHead,
  SettingsTableRow,
  SettingsTableTd,
  SettingsTableTh,
  StatusBadge,
  inputCls,
  labelCls,
} from '@/components/settings/SettingsUI';
import { SETTINGS_API as API, settingsAuthHeader as authHeader } from '@/utils/settings-api';

type TabKey = 'acil' | 'hasar' | 'sms';

interface MessageTemplate {
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
  createdAt: string;
}

interface TemplateDefinition {
  type: string;
  tab: TabKey;
  recipient: string;
  processStep: string;
  variables: Array<{ key: string; label: string; sample: string }>;
}

const ACIL_VARIABLES = [
  { key: '{Dosya No}', label: 'Dosya No', sample: 'AY-2026-0042' },
  { key: '{Dosya Sorumlusu}', label: 'Dosya Sorumlusu', sample: 'Ayşe Demir' },
  { key: '{Dosya Sorumlusu Telefon}', label: 'Dosya Sorumlusu Telefon', sample: '0532 000 00 00' },
  { key: '{Sigortalı Ad}', label: 'Sigortalı Ad', sample: 'Ahmet Yılmaz' },
  { key: '{Dosya Konusu}', label: 'Dosya Konusu', sample: 'Çekici Hizmeti' },
];

const DEFINITIONS: TemplateDefinition[] = [
  {
    type: 'whatsapp_acil_ilk_bilgilendirme',
    tab: 'acil',
    recipient: 'Sigortalı',
    processStep: 'İlk Bilgilendirme',
    variables: ACIL_VARIABLES,
  },
  {
    type: 'whatsapp_acil_kapanis_anket',
    tab: 'acil',
    recipient: 'Sigortalı',
    processStep: 'Dosya Kapanışı',
    variables: ACIL_VARIABLES,
  },
  {
    type: 'whatsapp_vendor_assignment',
    tab: 'hasar',
    recipient: 'Tedarikçi',
    processStep: 'Tedarikçi Atama',
    variables: [
      { key: '{tedarikciAdi}', label: 'Tedarikçi Adı', sample: 'Örnek Servis' },
      { key: '{dosyaNo}', label: 'Dosya No', sample: 'HD-2026-0042' },
      { key: '{musteriAdi}', label: 'Sigortalı Ad', sample: 'Ahmet Yılmaz' },
      { key: '{isTanimi}', label: 'Dosya Konusu', sample: 'Cam Değişimi' },
      { key: '{hasarAdresi}', label: 'Hasar Adresi', sample: 'Kadıköy / İstanbul' },
    ],
  },
  {
    type: 'sms_assignment',
    tab: 'sms',
    recipient: 'Sigortalı',
    processStep: 'Dosya Atama',
    variables: [
      { key: '{musteriAdi}', label: 'Sigortalı Ad', sample: 'Ahmet Yılmaz' },
      { key: '{dosyaNo}', label: 'Dosya No', sample: 'HD-2026-0042' },
      { key: '{sirketAdi}', label: 'Şirket Adı', sample: 'Meridyen Assistance' },
      { key: '{sirketTelefon}', label: 'Şirket Telefon', sample: '0212 000 00 00' },
    ],
  },
];

const TABS: Array<{ key: TabKey; label: string; hint: string }> = [
  {
    key: 'acil',
    label: 'Acil Yardım',
    hint: 'WhatsApp şablonları · Acil Yardım dosya ekranı · Manuel gönderim',
  },
  {
    key: 'hasar',
    label: 'Hasar',
    hint: 'WhatsApp şablonları · Hasar dosya ekranı · Manuel gönderim',
  },
  {
    key: 'sms',
    label: 'SMS',
    hint: 'SMS şablonları, test gönderimi ve geçmiş',
  },
];

function previewText(content: string, variables: TemplateDefinition['variables']) {
  return variables.reduce(
    (text, variable) => text.split(variable.key).join(variable.sample),
    content,
  );
}

export function MessageTemplatesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('acil');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [content, setContent] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const response = await axios.get(`${API}/notifications/sms/logs?limit=50`, {
        headers: authHeader(),
      });
      setLogs(Array.isArray(response.data) ? response.data : []);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      DEFINITIONS.map((definition) =>
        axios.get(`${API}/notifications/sms/templates/${definition.type}`, {
          headers: authHeader(),
        }),
      ),
    )
      .then((responses) => {
        if (!cancelled) setTemplates(responses.map((response) => response.data));
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    loadLogs();
    return () => { cancelled = true; };
  }, []);

  const visibleRows = useMemo(
    () => DEFINITIONS
      .filter((definition) => definition.tab === activeTab)
      .map((definition) => ({
        definition,
        template: templates.find((template) => template.type === definition.type),
      }))
      .filter((row): row is { definition: TemplateDefinition; template: MessageTemplate } => Boolean(row.template)),
    [activeTab, templates],
  );

  const editingDefinition = editing
    ? DEFINITIONS.find((definition) => definition.type === editing.type)
    : undefined;

  const openEdit = (template: MessageTemplate) => {
    setEditing(template);
    setContent(template.content);
    setIsActive(template.isActive);
    setSaveError('');
    setSaveNotice('');
  };

  const saveTemplate = async () => {
    if (!editing || !content.trim()) {
      setSaveError('Mesaj içeriği boş olamaz.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const response = await axios.patch(
        `${API}/notifications/sms/templates/${editing.type}`,
        { content: content.trim(), isActive },
        { headers: authHeader() },
      );
      setTemplates((current) =>
        current.map((template) => template.type === editing.type ? response.data : template),
      );
      setEditing(null);
      setSaveNotice('Şablon kaydedildi.');
    } catch (error: any) {
      setSaveError(error?.response?.data?.message ?? 'Şablon kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const sendTestSms = async () => {
    if (!testPhone.trim()) {
      setTestResult({ ok: false, text: 'Telefon numarası giriniz.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const response = await axios.post(
        `${API}/notifications/sms/test`,
        { to: testPhone, message: testMessage || undefined },
        { headers: authHeader() },
      );
      if (response.data?.success) {
        setTestResult({ ok: true, text: 'Test SMS başarıyla gönderildi.' });
        await loadLogs();
      } else {
        setTestResult({ ok: false, text: response.data?.error ?? 'SMS gönderilemedi.' });
      }
    } catch (error: any) {
      setTestResult({ ok: false, text: error?.response?.data?.message ?? 'SMS gönderilemedi.' });
    } finally {
      setTesting(false);
    }
  };

  const activeTabMeta = TABS.find((tab) => tab.key === activeTab) ?? TABS[0];

  return (
    <SettingsPageLayout
      title="Mesaj Şablonları"
      description="Operasyon adımlarında kullanılan mesaj metinlerini yönetin."
    >
      <div className="mb-3 border-b border-slate-200">
        <div className="flex gap-6 overflow-x-auto">
          {TABS.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setSaveNotice('');
                }}
                className={`relative -mb-px whitespace-nowrap pb-3 text-sm font-medium transition-colors ${
                  selected
                    ? 'border-b-2 border-blue-600 text-blue-700'
                    : 'border-b-2 border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mb-5 text-sm text-slate-500">
        {activeTabMeta.hint}
        {activeTab === 'hasar' ? ' · İlk bilgilendirme ve kapanış sonraki fazda eklenecek.' : ''}
      </p>

      {saveNotice && (
        <div className="mb-4 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {saveNotice}
        </div>
      )}

      <SettingsTable loading={loading} empty={visibleRows.length === 0} emptyText="Bu sekmede mesaj şablonu bulunamadı.">
        <SettingsTableHead>
          <SettingsRowIndexTh />
          <SettingsTableTh>Şablon Adı</SettingsTableTh>
          <SettingsTableTh>Alıcı Türü</SettingsTableTh>
          <SettingsTableTh>Süreç Adımı</SettingsTableTh>
          <SettingsTableTh>Mesaj Önizlemesi</SettingsTableTh>
          <SettingsTableTh>Durum</SettingsTableTh>
          <SettingsTableTh />
        </SettingsTableHead>
        <SettingsTableBody>
          {visibleRows.map(({ definition, template }, index) => (
            <SettingsTableRow key={template.type}>
              <SettingsRowIndexTd index={index} />
              <SettingsTableTd>
                <p className="font-medium text-slate-800">{template.name}</p>
              </SettingsTableTd>
              <SettingsTableTd>{definition.recipient}</SettingsTableTd>
              <SettingsTableTd>{definition.processStep}</SettingsTableTd>
              <SettingsTableTd className="max-w-sm">
                <p className="line-clamp-2 whitespace-pre-line text-xs leading-relaxed text-slate-500">
                  {previewText(template.content, definition.variables)}
                </p>
              </SettingsTableTd>
              <SettingsTableTd><StatusBadge active={template.isActive} /></SettingsTableTd>
              <SettingsTableActions>
                <EditButton onClick={() => openEdit(template)} />
              </SettingsTableActions>
            </SettingsTableRow>
          ))}
        </SettingsTableBody>
      </SettingsTable>

      {activeTab === 'sms' && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-1">
            <h2 className="text-sm font-semibold text-slate-800">Test SMS Gönder</h2>
            <p className="mt-1 text-xs text-slate-400">Kayıtlı sağlayıcı üzerinden test mesajı gönderin.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className={labelCls}>Telefon Numarası</label>
                <input className={inputCls} value={testPhone} onChange={(event) => setTestPhone(event.target.value)} placeholder="05XX XXX XX XX" />
              </div>
              <div>
                <label className={labelCls}>Mesaj</label>
                <textarea className={`${inputCls} resize-none`} rows={3} value={testMessage} onChange={(event) => setTestMessage(event.target.value)} placeholder="Boş bırakılırsa varsayılan test mesajı gönderilir." />
              </div>
              <button type="button" onClick={sendTestSms} disabled={testing} className="w-full rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50">
                {testing ? 'Gönderiliyor...' : 'Test SMS Gönder'}
              </button>
              {testResult && (
                <p className={`rounded-lg px-3 py-2 text-xs ${testResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {testResult.text}
                </p>
              )}
              <p className="text-xs leading-relaxed text-slate-500">
                Sağlayıcı ayarları için{' '}
                <Link href="/panel/ayarlar/entegrasyonlar?sekme=sms" className="font-medium text-blue-700 hover:underline">
                  Entegrasyon Merkezi
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm lg:col-span-2">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-800">Gönderim Geçmişi</h2>
            </div>
            {logsLoading ? (
              <p className="py-10 text-center text-sm text-slate-400">Yükleniyor...</p>
            ) : logs.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Henüz SMS gönderimi yapılmamış.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Tarih</th>
                      <th className="px-4 py-3 text-left font-medium">Numara</th>
                      <th className="px-4 py-3 text-left font-medium">Durum</th>
                      <th className="px-4 py-3 text-left font-medium">Mesaj</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(log.createdAt).toLocaleString('tr-TR')}</td>
                        <td className="px-4 py-3 font-mono text-slate-700">{log.to}</td>
                        <td className="px-4 py-3 text-slate-600">{log.status === 'sent' ? 'Gönderildi' : log.status === 'failed' ? 'Başarısız' : 'Beklemede'}</td>
                        <td className="max-w-xs px-4 py-3 text-slate-500"><p className="line-clamp-2">{log.message}</p></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <SettingsModal
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `${editing.name} Düzenle` : 'Mesaj Şablonunu Düzenle'}
        onSave={saveTemplate}
        saving={saving}
        error={saveError}
        maxWidth="xl"
      >
        <div>
          <label className={labelCls}>Mesaj İçeriği</label>
          <textarea
            rows={9}
            className={`${inputCls} resize-y`}
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              setSaveError('');
            }}
          />
          <p className="mt-1 text-right text-xs text-slate-400">{content.length} Karakter</p>
        </div>

        <div>
          <p className={labelCls}>Değişken Ekle</p>
          <div className="flex flex-wrap gap-2">
            {editingDefinition?.variables.map((variable) => (
              <button
                key={variable.key}
                type="button"
                onClick={() => setContent((current) => current + variable.key)}
                className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                {variable.key}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
          <span className="text-sm font-medium text-slate-700">Şablon Aktif</span>
        </label>

        <div>
          <p className={labelCls}>Canlı Önizleme</p>
          <div className="min-h-28 whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            {editingDefinition && content.trim()
              ? previewText(content, editingDefinition.variables)
              : <span className="italic text-slate-400">Önizleme için mesaj içeriği giriniz.</span>}
          </div>
        </div>
      </SettingsModal>
    </SettingsPageLayout>
  );
}
