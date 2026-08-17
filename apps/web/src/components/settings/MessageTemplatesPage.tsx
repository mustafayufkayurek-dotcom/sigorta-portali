'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { MessageSquareText } from 'lucide-react';
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

/** WhatsApp markası — kanalın WhatsApp olduğu net görünsün */
function WhatsAppMark({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
      />
    </svg>
  );
}

function WhatsAppBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const pad = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]';
  const icon = size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 font-semibold text-emerald-800 ${pad}`}
    >
      <WhatsAppMark className={`${icon} text-[#25D366]`} />
      WhatsApp
    </span>
  );
}

/** WhatsApp kanalları + SMS. Özel Müşteri metinleri / tetik durumları ürün onayına bağlı. */
type TabKey = 'hasar' | 'acil' | 'ozel_musteri' | 'sms';

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
    type: 'whatsapp_hasar_randevu_sigortali',
    tab: 'hasar',
    recipient: 'Sigortalı',
    processStep: 'Tespit Randevusu',
    variables: [
      { key: '{musteriAdi}', label: 'Sigortalı Ad', sample: 'Ahmet Yılmaz' },
      { key: '{dosyaNo}', label: 'Dosya No', sample: 'HD-2026-0042' },
      { key: '{randevuTarih}', label: 'Randevu Tarihi', sample: '19.07.2026' },
      { key: '{randevuSaat}', label: 'Randevu Saati', sample: '10:30' },
      { key: '{hasarAdresi}', label: 'Hasar Adresi', sample: 'Kadıköy / İstanbul' },
      { key: '{tahminiSure}', label: 'Tahmini Süre', sample: '90 Dakika' },
    ],
  },
  {
    type: 'whatsapp_hasar_randevu_tespitci',
    tab: 'hasar',
    recipient: 'Tespitçi',
    processStep: 'Tespit Randevusu',
    variables: [
      { key: '{musteriAdi}', label: 'Sigortalı Ad', sample: 'Ahmet Yılmaz' },
      { key: '{dosyaNo}', label: 'Dosya No', sample: 'HD-2026-0042' },
      { key: '{randevuTarih}', label: 'Randevu Tarihi', sample: '19.07.2026' },
      { key: '{randevuSaat}', label: 'Randevu Saati', sample: '10:30' },
      { key: '{hasarAdresi}', label: 'Hasar Adresi', sample: 'Kadıköy / İstanbul' },
      { key: '{tahminiSure}', label: 'Tahmini Süre', sample: '90 Dakika' },
    ],
  },
  {
    type: 'whatsapp_hasar_randevu_tedarikci',
    tab: 'hasar',
    recipient: 'Tedarikçi',
    processStep: 'Hizmet Randevusu',
    variables: [
      { key: '{dosyaNo}', label: 'Dosya No', sample: 'HD-2026-0042' },
      { key: '{isTanimi}', label: 'İş Tanımı', sample: 'Su Hasarı Tespit' },
      { key: '{randevuTarih}', label: 'Randevu Tarihi', sample: '19.07.2026' },
      { key: '{randevuSaat}', label: 'Randevu Saati', sample: '10:30' },
      { key: '{hasarAdresi}', label: 'Hasar Adresi', sample: 'Kadıköy / İstanbul' },
      { key: '{tahminiSure}', label: 'Tahmini Süre', sample: '90 Dakika' },
    ],
  },
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

const TABS: Array<{
  key: TabKey;
  label: string;
  channel: 'WhatsApp' | 'SMS';
  hint: string;
}> = [
  {
    key: 'hasar',
    label: 'Hasar',
    channel: 'WhatsApp',
    hint: 'Hasar dosyası operasyon adımlarında kullanılan WhatsApp metinleri.',
  },
  {
    key: 'acil',
    label: 'Acil Yardım',
    channel: 'WhatsApp',
    hint: 'Acil Yardım dosyası bilgilendirme ve kapanış WhatsApp metinleri.',
  },
  {
    key: 'ozel_musteri',
    label: 'Özel Müşteri',
    channel: 'WhatsApp',
    hint: 'Özel müşteri WhatsApp metinleri. Metinler ve gönderim durumları ürün onayı ile eklenecek.',
  },
  {
    key: 'sms',
    label: 'SMS',
    channel: 'SMS',
    hint: 'SMS şablonları, test gönderimi ve gönderim geçmişi.',
  },
];

function previewText(content: string, variables: TemplateDefinition['variables']) {
  return variables.reduce(
    (text, variable) => text.split(variable.key).join(variable.sample),
    content,
  );
}

function tabCount(tab: TabKey, templates: MessageTemplate[]): number {
  if (tab === 'ozel_musteri') return 0;
  return DEFINITIONS.filter((d) => d.tab === tab).filter((d) =>
    templates.some((t) => t.type === d.type),
  ).length;
}

/** Lokal önizleme: oturum / panel auth gerekmez. Kalıcı kayıt panel oturumu ile yapılır. */
const LOCAL_SEED: MessageTemplate[] = DEFINITIONS.map((definition, index) => ({
  id: `local-${index}`,
  type: definition.type,
  name:
    definition.type === 'whatsapp_vendor_assignment'
      ? 'Tedarikçi Atama WhatsApp Şablonu'
      : definition.type === 'whatsapp_hasar_randevu_sigortali'
        ? 'Sigortalı Randevu Bilgilendirme'
        : definition.type === 'whatsapp_hasar_randevu_tespitci'
          ? 'Tespitçi Randevu Bilgilendirme'
          : definition.type === 'whatsapp_hasar_randevu_tedarikci'
            ? 'Tedarikçi Randevu Bilgilendirme'
            : definition.type === 'whatsapp_acil_ilk_bilgilendirme'
              ? 'Sigortalıya İlk Bilgilendirme'
              : definition.type === 'whatsapp_acil_kapanis_anket'
                ? 'Kapanış / Anket Mesajı'
                : 'Atama SMS Şablonu',
  content: '',
  isActive: true,
}));

type MessageTemplatesPageProps = {
  /** true: /dev oturumsuz kontrol; metinleri kullanıcı tanımlar */
  localPreview?: boolean;
};

export function MessageTemplatesPage({ localPreview = false }: MessageTemplatesPageProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('hasar');
  const [templates, setTemplates] = useState<MessageTemplate[]>(
    localPreview ? LOCAL_SEED : [],
  );
  const [loading, setLoading] = useState(!localPreview);
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
    if (localPreview) {
      setLoading(false);
      setLogsLoading(false);
      return;
    }
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
    return () => {
      cancelled = true;
    };
  }, [localPreview]);

  const visibleRows = useMemo(
    () =>
      DEFINITIONS.filter((definition) => definition.tab === activeTab)
        .map((definition) => ({
          definition,
          template: templates.find((template) => template.type === definition.type),
        }))
        .filter(
          (row): row is { definition: TemplateDefinition; template: MessageTemplate } =>
            Boolean(row.template),
        ),
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
    if (localPreview) {
      setTemplates((current) =>
        current.map((template) =>
          template.type === editing.type
            ? { ...template, content: content.trim(), isActive }
            : template,
        ),
      );
      setEditing(null);
      setSaveNotice(
        'Lokal önizleme: metin bu oturumda güncellendi. Kalıcı kayıt Ayarlar panel oturumu ile yapılır.',
      );
      setSaving(false);
      return;
    }
    try {
      const response = await axios.patch(
        `${API}/notifications/sms/templates/${editing.type}`,
        { content: content.trim(), isActive },
        { headers: authHeader() },
      );
      setTemplates((current) =>
        current.map((template) =>
          template.type === editing.type ? response.data : template,
        ),
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
      setTestResult({
        ok: false,
        text: error?.response?.data?.message ?? 'SMS gönderilemedi.',
      });
    } finally {
      setTesting(false);
    }
  };

  const activeTabMeta = TABS.find((tab) => tab.key === activeTab) ?? TABS[0];
  const showTemplateTable = activeTab !== 'ozel_musteri';

  return (
    <SettingsPageLayout
      title="Mesaj Şablonları"
      description="Operasyon adımlarında kullanılan WhatsApp ve SMS metinlerini tek yerden yönetin. Metinleri siz tanımlarsınız."
    >
      {localPreview ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Lokal kontrol — oturum gerekmez. Hasar / Acil / SMS metinlerini buradan yazıp düzenleyebilirsiniz.
          Özel Müşteri metinleri ve gönderim durumları sizin onayınızla eklenecek. Canlıya alma ayrı talimatla.
        </div>
      ) : null}

      {/* Sekme çubuğu — enterprise */}
      <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 pt-3 sm:px-5">
          <div className="flex gap-1 overflow-x-auto pb-0">
            {TABS.map((tab) => {
              const selected = activeTab === tab.key;
              const count = tabCount(tab.key, templates);
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    setSaveNotice('');
                  }}
                  className={`relative inline-flex shrink-0 items-center gap-2 rounded-t-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    selected
                      ? 'bg-white text-slate-900 shadow-[0_-1px_0_0_#fff]'
                      : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
                  }`}
                >
                  {tab.channel === 'WhatsApp' ? (
                    <WhatsAppMark
                      className={`h-4 w-4 shrink-0 ${selected ? 'text-[#25D366]' : 'text-slate-400'}`}
                    />
                  ) : (
                    <MessageSquareText
                      className={`h-3.5 w-3.5 shrink-0 ${selected ? 'text-brand-600' : 'text-slate-400'}`}
                    />
                  )}
                  <span>{tab.label}</span>
                  {tab.channel === 'WhatsApp' ? (
                    <span
                      className={`hidden rounded-md px-1.5 py-0.5 text-[10px] font-semibold sm:inline ${
                        selected
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      WhatsApp
                    </span>
                  ) : (
                    <span
                      className={`hidden rounded-md px-1.5 py-0.5 text-[10px] font-semibold sm:inline ${
                        selected ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      SMS
                    </span>
                  )}
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                      selected
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-slate-100/80 text-slate-400'
                    }`}
                  >
                    {tab.key === 'ozel_musteri' ? '—' : count}
                  </span>
                  {selected ? (
                    <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-4 sm:px-5 sm:py-5">
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-sm font-semibold text-slate-900">{activeTabMeta.label}</h2>
                {activeTabMeta.channel === 'WhatsApp' ? (
                  <WhatsAppBadge size="md" />
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                    <MessageSquareText className="h-3.5 w-3.5" />
                    SMS
                  </span>
                )}
              </div>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
                {activeTabMeta.channel === 'WhatsApp'
                  ? `WhatsApp mesaj şablonları · ${activeTabMeta.hint}`
                  : activeTabMeta.hint}
              </p>
            </div>
          </div>

          {saveNotice ? (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
              {saveNotice}
            </div>
          ) : null}

          {activeTab === 'ozel_musteri' ? (
            <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 px-6 py-12 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-200 bg-white text-[#25D366] shadow-sm">
                <WhatsAppMark className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-800">
                Özel Müşteri · WhatsApp Mesajları
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                Metinleri siz tanımlayacaksınız. Hangi durumda gönderileceği de sizin onayınızla
                netleşecek. Onay gelmeden şablon eklenmez.
              </p>
              <p className="mt-4 text-xs font-medium text-slate-400">
                Beklenen: Sizin Metinleriniz · Gönderim Durumu · Alıcı Türü
              </p>
            </div>
          ) : (
            <SettingsTable
              loading={loading && showTemplateTable}
              empty={visibleRows.length === 0}
              emptyText="Bu sekmede mesaj şablonu bulunamadı."
            >
              <SettingsTableHead>
                <SettingsRowIndexTh />
                <SettingsTableTh>Kanal</SettingsTableTh>
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
                      {definition.tab === 'sms' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700">
                          <MessageSquareText className="h-3.5 w-3.5" />
                          SMS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                          <WhatsAppMark className="h-3.5 w-3.5 text-[#25D366]" />
                          WhatsApp
                        </span>
                      )}
                    </SettingsTableTd>
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
                    <SettingsTableTd>
                      <StatusBadge active={template.isActive} />
                    </SettingsTableTd>
                    <SettingsTableActions>
                      <EditButton onClick={() => openEdit(template)} />
                    </SettingsTableActions>
                  </SettingsTableRow>
                ))}
              </SettingsTableBody>
            </SettingsTable>
          )}

          {activeTab === 'sms' ? (
            <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-1">
                <h3 className="text-sm font-semibold text-slate-900">Test SMS Gönder</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Kayıtlı sağlayıcı üzerinden test mesajı gönderin.
                </p>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className={labelCls}>Telefon Numarası</label>
                    <input
                      className={inputCls}
                      value={testPhone}
                      onChange={(event) => setTestPhone(event.target.value)}
                      placeholder="05XX XXX XX XX"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Mesaj</label>
                    <textarea
                      className={`${inputCls} resize-none`}
                      rows={3}
                      value={testMessage}
                      onChange={(event) => setTestMessage(event.target.value)}
                      placeholder="Boş bırakılırsa varsayılan test mesajı gönderilir."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={sendTestSms}
                    disabled={testing}
                    className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {testing ? 'Gönderiliyor...' : 'Test SMS Gönder'}
                  </button>
                  {testResult ? (
                    <p
                      className={`rounded-lg px-3 py-2 text-xs ${
                        testResult.ok
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border border-red-200 bg-red-50 text-red-700'
                      }`}
                    >
                      {testResult.text}
                    </p>
                  ) : null}
                  <p className="text-xs leading-relaxed text-slate-500">
                    Sağlayıcı ayarları için{' '}
                    <Link
                      href="/panel/ayarlar/entegrasyonlar?sekme=sms"
                      className="font-medium text-blue-700 hover:underline"
                    >
                      Entegrasyon Merkezi
                    </Link>
                    .
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-2">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="text-sm font-semibold text-slate-900">Gönderim Geçmişi</h3>
                </div>
                {logsLoading ? (
                  <p className="py-10 text-center text-sm text-slate-400">Yükleniyor...</p>
                ) : logs.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-400">
                    Henüz SMS gönderimi yapılmamış.
                  </p>
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
                      <tbody className="divide-y divide-slate-100">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/80">
                            <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                              {new Date(log.createdAt).toLocaleString('tr-TR')}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-700">{log.to}</td>
                            <td className="px-4 py-3 text-slate-600">
                              {log.status === 'sent'
                                ? 'Gönderildi'
                                : log.status === 'failed'
                                  ? 'Başarısız'
                                  : 'Beklemede'}
                            </td>
                            <td className="max-w-xs px-4 py-3 text-slate-500">
                              <p className="line-clamp-2">{log.message}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

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
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                {variable.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          <span className="text-sm font-medium text-slate-700">Şablon Aktif</span>
        </label>

        <div>
          <p className={labelCls}>Canlı Önizleme</p>
          <div className="min-h-28 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            {editingDefinition && content.trim() ? (
              previewText(content, editingDefinition.variables)
            ) : (
              <span className="italic text-slate-400">Önizleme için mesaj içeriği giriniz.</span>
            )}
          </div>
        </div>
      </SettingsModal>
    </SettingsPageLayout>
  );
}
