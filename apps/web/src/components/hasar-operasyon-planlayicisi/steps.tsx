'use client';

import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  History,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquareText,
  Phone,
  PhoneCall,
  RefreshCcw,
  Send,
  Star,
  UserCog,
  UserRound,
  UserRoundCheck,
  WalletCards,
  Wrench,
} from 'lucide-react';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { openWhatsAppChat, toWhatsAppLink } from '@/utils/date-helpers';
import {
  isLegacyOpsCatchupBypassActive,
  LEGACY_OPS_CATCHUP_BYPASS_NOTE,
} from '@/utils/whatsapp-sent-confirm-gate';
import { isoToTrDateDisplay } from '@/utils/tr-date-input';
import type { StepId } from './types';
import FileDocumentPanel from '@/components/file-documents/FileDocumentPanel';
import { ClaimManualDocumentsPanel } from '@/components/file-documents/ClaimManualDocumentsPanel';
import { VendorRepairPhotosPanel } from '@/components/field-survey/VendorRepairPhotosPanel';
import SpeechToText from '@/components/SpeechToText';
import { openPlannerMap, plannerMapsHref } from './planner-maps';
import { usePlanner } from './planner-context';
import { sendPlannerApprovalMail } from './planner-send-approval-mail';
import { repairReportStatusLabel } from '@/utils/repair-report-status';
import {
  plannerApprovalPartyLabel,
  resolvePlannerApprovalParty,
} from './planner-approval-party';
import {
  HASAR_WA_TEMPLATE_TYPES,
  interpolateHasarTemplate,
  pickTemplate,
  templateTypeForRecipient,
  type HasarWaTemplateType,
} from './hasar-templates';

function openNativePicker(el: HTMLInputElement | null) {
  if (!el) return;
  try {
    if (typeof el.showPicker === 'function') {
      el.showPicker();
    } else {
      el.click();
    }
  } catch {
    el.click();
  }
}

/** Eski model: mesaj hazır gelir; kopyala butonu yok. */
function WhatsAppOpenButton({
  phone,
  message,
  label = "WhatsApp'ta Aç Ve Gönder",
  className = '',
  onOpened,
}: {
  phone: string;
  message?: string;
  label?: string;
  className?: string;
  onOpened?: () => void;
}) {
  const url = toWhatsAppLink(phone, message);
  if (!url) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[10px] text-red-700">
        Telefon numarası bulunmadan WhatsApp açılamaz.
      </p>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault();
        openWhatsAppChat(phone, message);
        onOpened?.();
      }}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-emerald-700 ${className}`}
    >
      <MessageCircle className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}

function Field({
  label,
  children,
  icon: Icon,
}: {
  label: string;
  children: ReactNode;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-slate-600">
        {Icon ? <Icon className="h-3 w-3 text-slate-400" /> : null}
        {label}
      </p>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  readOnly,
  type = 'text',
}: {
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  type?: string;
}) {
  const shared =
    'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-blue-400 read-only:bg-slate-50';
  return (
    <input
      type={type}
      value={value}
      readOnly={readOnly || !onChange}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      className={shared}
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-blue-400"
    />
  );
}

function Btn({
  children,
  tone = 'secondary',
  onClick,
  disabled,
  className = '',
}: {
  children: ReactNode;
  tone?: 'primary' | 'secondary' | 'danger' | 'ghost';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const styles =
    tone === 'primary'
      ? 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-slate-300'
      : tone === 'danger'
        ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
        : tone === 'ghost'
          ? 'text-blue-700 hover:underline'
          : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title?: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      {title ? (
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
          {Icon ? <Icon className="h-3.5 w-3.5 text-slate-500" /> : null}
          {title}
        </p>
      ) : null}
      {children}
    </div>
  );
}

function ApiNote({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] leading-relaxed text-amber-800">
      {text}
    </p>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'green' | 'orange' | 'gray' | 'blue';
}) {
  const cls =
    tone === 'green'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : tone === 'orange'
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : tone === 'blue'
          ? 'bg-blue-50 text-blue-700 ring-blue-200'
          : 'bg-slate-100 text-slate-600 ring-slate-200';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  );
}

function VoiceNoteField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <TextArea value={value} onChange={onChange} placeholder={placeholder} rows={3} />
        </div>
        <SpeechToText
          size="sm"
          onTranscript={(t) => onChange([value, t].filter(Boolean).join(' ').trim())}
        />
      </div>
      <p className="mt-1 text-[10px] text-slate-500">Mikrofon metne çevirir; ses kaydı tutulmaz.</p>
    </Field>
  );
}

function TemplatePreview({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
      <p className="text-[10px] font-semibold text-slate-500">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-700">{text}</p>
    </div>
  );
}

/* ─── 1. Sigortalı ve Randevu ─── */
export function StepInsuredAppointment() {
  const {
    claim,
    setClaim,
    canEdit,
    mode,
    apptNote,
    setApptNote,
    insuredApproved,
    setInsuredApproved,
    buildInsuredApptMessage,
    templatesFromSettings,
    recordWhatsAppContact,
  } = usePlanner();
  const persistedSent = claim.contactWa.insured;
  const [sent, setSent] = useState(persistedSent);
  const apptDateWrapRef = useRef<HTMLDivElement>(null);
  const apptTimeRef = useRef<HTMLInputElement>(null);
  const waText = buildInsuredApptMessage();
  const apptEditable = canEdit;

  useEffect(() => {
    setSent(persistedSent);
  }, [persistedSent]);

  const focusAppointmentEditors = () => {
    const dateInput = apptDateWrapRef.current?.querySelector('input');
    if (dateInput instanceof HTMLInputElement) {
      dateInput.focus();
      dateInput.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    apptTimeRef.current?.focus();
  };

  return (
    <div className="mt-3 space-y-3">
      <Card title="Sigortalı Bilgileri" icon={UserRound}>
        <div className="space-y-2">
          <Field label="Sigortalı Adı Soyadı">
            <Input value={claim.insuredName} readOnly />
          </Field>
          <Field label="Telefon" icon={Phone}>
            <Input value={claim.insuredPhone} readOnly />
          </Field>
          <Field label="Adres" icon={MapPin}>
            <Input value={claim.address} readOnly />
          </Field>
          <Field label="Konum Bağlantısı" icon={Link2}>
            <div className="flex gap-2">
              <Input value={plannerMapsHref(claim.locationUrl, claim.address) || 'Adresten harita açılır'} readOnly />
              <Btn
                tone="secondary"
                className="shrink-0"
                onClick={() => openPlannerMap(claim.locationUrl, claim.address)}
              >
                <ExternalLink className="h-3 w-3" /> Aç
              </Btn>
            </div>
          </Field>
        </div>
      </Card>

      <Card title="Randevu" icon={CalendarDays}>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Randevu Tarihi" icon={CalendarDays}>
            <div ref={apptDateWrapRef}>
              {apptEditable ? (
                <TrDateInput
                  value={claim.appointmentDate}
                  onChange={(value) =>
                    setClaim((prev) => ({
                      ...prev,
                      appointmentDate: isoToTrDateDisplay(value) || value,
                      appointmentAt:
                        `${isoToTrDateDisplay(value) || value} ${prev.appointmentTime}`.trim() ||
                        prev.appointmentAt,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-blue-400"
                  aria-label="Randevu Tarihi"
                />
              ) : (
                <Input value={claim.appointmentDate} readOnly />
              )}
            </div>
          </Field>
          <Field label="Randevu Saati" icon={Clock3}>
            {apptEditable ? (
              <input
                ref={apptTimeRef}
                type="time"
                value={claim.appointmentTime}
                onChange={(e) =>
                  setClaim((prev) => ({
                    ...prev,
                    appointmentTime: e.target.value,
                    appointmentAt: `${prev.appointmentDate} ${e.target.value}`.trim() || prev.appointmentAt,
                  }))
                }
                onClick={(e) => openNativePicker(e.currentTarget)}
                onFocus={(e) => openNativePicker(e.currentTarget)}
                className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-blue-400"
                aria-label="Randevu Saati"
              />
            ) : (
              <Input value={claim.appointmentTime} readOnly />
            )}
          </Field>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <a href={claim.insuredPhone ? `tel:${claim.insuredPhone.replace(/\s/g, '')}` : undefined}>
            <Btn tone="secondary" disabled={!claim.insuredPhone}>
              <PhoneCall className="h-3 w-3" /> Ara
            </Btn>
          </a>
          <Btn tone="secondary" onClick={focusAppointmentEditors} disabled={!apptEditable}>
            Randevuyu Düzenle
          </Btn>
          <Btn tone="secondary" onClick={() => openPlannerMap(claim.locationUrl, claim.address)}>
            <MapPin className="h-3 w-3" /> Konumu Doğrula
          </Btn>
        </div>
        {mode === 'preview' ? (
          <ApiNote text="Lokal önizlemede Kaydet API’ye yazılmaz; sahte başarı gösterilmez." />
        ) : null}
      </Card>

      <Card title="Randevu Notu" icon={MessageSquareText}>
        <VoiceNoteField
          label="Randevu Notu"
          value={apptNote}
          onChange={setApptNote}
          placeholder="Kapı kodu, kat, ulaşım notu…"
        />
      </Card>

      <Card title="Sigortalı Onayı" icon={CheckCircle2}>
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={insuredApproved}
            onChange={(e) => setInsuredApproved(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Sigortalı randevuyu onayladı
        </label>
        <StatusPill
          label={insuredApproved ? 'Onaylandı' : 'Onay Bekleniyor'}
          tone={insuredApproved ? 'green' : 'orange'}
        />
      </Card>

      <Card title="WhatsApp Randevu Bildirimi" icon={MessageCircle}>
        <p className="mb-2 text-[10px] text-slate-500">
          Şablon: Ayarlar › Mesaj Şablonları › Hasar
          {templatesFromSettings ? ' (canlı şablon)' : ' (varsayılan)'}
        </p>
        <TemplatePreview title="Gönderilecek şablon" text={waText} />
        <p className="mt-2 text-[11px] font-medium text-amber-800">Sigortalıya WhatsApp gönderimi zorunlu.</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <WhatsAppOpenButton
            phone={claim.insuredPhone}
            message={waText}
            onOpened={() => {
              void recordWhatsAppContact({
                status: 'opened',
                recipientType: 'insured',
                recipientName: claim.insuredName,
                phone: claim.insuredPhone,
                message: waText,
                templateType: 'randevu',
              }).then((res) => {
                if (res.ok) setSent(true);
              });
            }}
          />
          <Btn
            tone="secondary"
            onClick={() => {
              void recordWhatsAppContact({
                status: 'sent',
                recipientType: 'insured',
                recipientName: claim.insuredName,
                phone: claim.insuredPhone,
                message: waText,
                templateType: 'randevu',
              }).then((res) => {
                if (res.ok) setSent(true);
              });
            }}
            disabled={sent}
          >
            <CheckCircle2 className="h-3 w-3" />
            {sent ? 'Gönderildi' : 'Gönderildi Olarak İşaretle'}
          </Btn>
        </div>
      </Card>
    </div>
  );
}

/* ─── 2. Tespitçi Ataması — ekran görüntüsü referansı ─── */
export function StepInspector() {
  const {
    claim,
    assignedInspectorId,
    setAssignedInspectorId,
    buildInspectorMessage,
    templatesFromSettings,
    inspectorNote,
    setInspectorNote,
    recordWhatsAppContact,
  } = usePlanner();
  const assigned = claim.inspectors.find((i) => i.id === assignedInspectorId) ?? null;
  const assignedWaMessage = buildInspectorMessage();
  const inspectorSent = claim.contactWa.inspector;

  return (
    <div className="mt-3 space-y-3">
      <Card title="Ana Randevu (Dosyadan)" icon={CalendarDays}>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
          <p>
            <span className="font-semibold text-slate-500">Tarih:</span> {claim.appointmentDate}
          </p>
          <p>
            <span className="font-semibold text-slate-500">Saat:</span> {claim.appointmentTime}
          </p>
        </div>
        <p className="mt-2 text-xs text-slate-700">
          <span className="font-semibold text-slate-500">Adres:</span> {claim.address}
        </p>
        <p className="mt-1 text-xs text-slate-700">
          <span className="font-semibold text-slate-500">Konum:</span>{' '}
          <a
            href={plannerMapsHref(claim.locationUrl, claim.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-medium text-brand-600 hover:underline"
          >
            {plannerMapsHref(claim.locationUrl, claim.address) || 'Harita yok'}
          </a>
        </p>
        <p className="mt-1 text-xs text-slate-700">
          <span className="font-semibold text-slate-500">Hasar Türü:</span> {claim.lossType}
        </p>
        <p className="mt-1 text-xs text-slate-700">
          <span className="font-semibold text-slate-500">Bölge:</span> {claim.district}
        </p>
        <p className="mt-2 text-[10px] text-slate-500">
          Yeni randevu oluşturulmaz; ana randevu kullanılır.
        </p>
      </Card>

      {assigned ? (
        <Card title="Atanan Tespitçi" icon={UserRoundCheck}>
          <p className="text-sm font-semibold text-slate-900">{assigned.name}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {assigned.region} · ★ {assigned.score} · {assigned.completedJobs} İş
          </p>
          <p className="mt-1 text-[11px] text-slate-600">{assigned.phone}</p>
          <div className="mt-2">
            <VoiceNoteField
              label="Tespitçiye not"
              value={inspectorNote}
              onChange={setInspectorNote}
              placeholder="Tespitçiye iletilecek not…"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Btn tone="secondary" onClick={() => setAssignedInspectorId(null)}>
              Değiştir
            </Btn>
            <Btn tone="danger" onClick={() => setAssignedInspectorId(null)}>
              Kaldır
            </Btn>
          </div>
          <div className="mt-2 space-y-2">
            <TemplatePreview title="Tespitçi WhatsApp şablonu" text={assignedWaMessage} />
            <p className="text-[11px] font-medium text-amber-800">Tespitçiye WhatsApp gönderimi zorunlu.</p>
            <WhatsAppOpenButton
              phone={assigned.phone}
              message={[assignedWaMessage, inspectorNote].filter(Boolean).join('\n\n')}
              label="Görev Ve Randevu Mesajı"
              className="w-full"
              onOpened={() => {
                void recordWhatsAppContact({
                  status: 'opened',
                  recipientType: 'adjuster',
                  recipientName: assigned.name,
                  phone: assigned.phone,
                  message: [assignedWaMessage, inspectorNote].filter(Boolean).join('\n\n'),
                  templateType: 'whatsapp_hasar_randevu_tespitci',
                });
              }}
            />
            {inspectorSent ? (
              <p className="text-[10px] text-emerald-700">WhatsApp kaydı var.</p>
            ) : null}
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            Şablon: Ayarlar › Mesaj Şablonları › Tespitçi Randevu
            {templatesFromSettings ? ' (canlı)' : ' (varsayılan)'}
          </p>
          <div className="mt-2">
            <ApiNote text="Kalıcı atama: claim-files inspector-vendor assign API. Lokal önizleme yalnızca UI durumudur." />
          </div>
        </Card>
      ) : (
        <ApiNote text="Zorunlu: Kaydet için bir tespitçi atanmalıdır." />
      )}

      <Card title="Kayıtlı Tespitçi Listesi" icon={UserCog}>
        <p className="mb-2 text-[10px] leading-relaxed text-slate-500">
          Önce Meridyen saha tespitçisi atanır. Saha personeli dosyaya gidemiyorsa, «Tespitçi Olarak
          Görevlendir» işaretli tedarikçi seçilir.
        </p>
        <div className="space-y-2">
          {claim.inspectors.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">
              Atanabilir tespitçi bulunamadı. Kullanıcılar’da saha personeli veya Tedarikçiler’de
              «Tespitçi Olarak Görevlendir» kayıtlarını kontrol edin.
            </p>
          ) : null}
          {claim.inspectors.map((ins) => {
            const wa = toWhatsAppLink(ins.phone);
            return (
              <div
                key={`${ins.source}-${ins.id}`}
                className="rounded-xl border border-slate-200 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">{ins.name}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {ins.region} · Son Çalışma: {ins.lastWork}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <StatusPill
                        label={ins.source === 'meridyen' ? 'Meridyen Saha' : 'Tedarikçi Tespitçi'}
                        tone={ins.source === 'meridyen' ? 'blue' : 'green'}
                      />
                      <StatusPill
                        label={ins.available ? 'Müsait' : 'Meşgul'}
                        tone={ins.available ? 'green' : 'orange'}
                      />
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-600">
                        <Star className="h-3 w-3 text-status-warning" /> {ins.score}
                      </span>
                      <span className="text-[10px] text-slate-500">{ins.completedJobs} İş</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-600">{ins.phone}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-1.5">
                    <Btn
                      tone="primary"
                      disabled={!ins.available}
                      onClick={() => setAssignedInspectorId(ins.id)}
                    >
                      Ata
                    </Btn>
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-blue-700 hover:underline"
                      >
                        WhatsApp
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ─── 3. Tedarikçi Ataması ─── */
export function StepSupplier() {
  const [sub, setSub] = useState<'kayitli' | 'alternatif'>('kayitli');
  const {
    claim,
    assignedSupplierIds: assigned,
    setAssignedSupplierIds: setAssigned,
    assignedInspectorId,
    supplierTasks: tasks,
    setSupplierTasks: setTasks,
    buildVendorTaskMessage,
    templatesFromSettings,
    recordWhatsAppContact,
  } = usePlanner();
  const [assignWarn, setAssignWarn] = useState('');
  const inspectorVendorId = assignedInspectorId || claim.preAssignedInspectorId || null;

  const assignedRows = useMemo(
    () => claim.suppliers.filter((s) => assigned.includes(s.id)),
    [assigned, claim.suppliers],
  );

  return (
    <div className="mt-3 space-y-3">
      <p className="text-[11px] text-slate-500">
        Hasar türüne uygun tedarikçileri seçin. Atanınca görev ve WhatsApp bu adımda iletilir.
        Tespitçi olan tedarikçi olamaz.
      </p>
      {assignedRows.length > 0 ? (
        <Card title="Atama Özeti" icon={Wrench}>
          <div className="space-y-3">
            {assignedRows.map((s) => {
              const key = s.id || s.name;
              const task = tasks[key] ?? '';
              const waText = buildVendorTaskMessage(s.name, task);
              const waHit = claim.waHistory.find(
                (h) =>
                  String(h.recipient).toLowerCase().includes(s.name.toLowerCase()) ||
                  /tedarikci|tedarikçi|vendor/i.test(String(h.template)),
              );
              return (
                <div key={key} className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
                  <p className="text-xs font-semibold text-slate-900">{s.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-600">İş grubu: {s.serviceGroup}</p>
                  {s.phone ? <p className="text-[11px] text-slate-600">Telefon: {s.phone}</p> : null}
                  <div className="mt-2">
                    <VoiceNoteField
                      label="Görev Notu *"
                      value={task}
                      onChange={(v) => setTasks((t) => ({ ...t, [key]: v }))}
                      placeholder="Bu tedarikçiye iletilecek görev notu…"
                    />
                  </div>
                  <div className="mt-2">
                    <TemplatePreview title="WhatsApp şablonu" text={waText} />
                  </div>
                  <div className="mt-2">
                    <WhatsAppOpenButton
                      phone={s.phone || ''}
                      message={waText}
                      label="WhatsApp Görev Mesajı"
                      onOpened={() => {
                        void recordWhatsAppContact({
                          status: 'opened',
                          recipientType: 'vendor',
                          recipientName: s.name,
                          phone: s.phone,
                          message: waText,
                          templateType: 'whatsapp_hasar_randevu_tedarikci',
                        });
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {waHit ? `WhatsApp: ${waHit.status} · ${waHit.when}` : 'Atanınca WhatsApp bu sayfadan gönderilir.'}
                    {templatesFromSettings ? ' · Canlı şablon' : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
      {assignWarn ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          {assignWarn}
        </p>
      ) : null}

      <>
          <div className="grid grid-cols-1 gap-2">
            <Field label="Randevu Tarih Ve Saati" icon={CalendarDays}>
              <Input value={`${claim.appointmentDate} - ${claim.appointmentTime}`} readOnly />
            </Field>
          </div>

          <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
            {(
              [
                ['kayitli', 'Kayıtlı Tedarikçiler'],
                ['alternatif', 'Alternatif Öneriler'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSub(id)}
                className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-semibold ${
                  sub === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {sub === 'kayitli' ? (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-700">Önerilen Tedarikçiler</p>
              {claim.suppliers.map((s) => {
                const isOn = assigned.includes(s.id);
                const isInspector = Boolean(inspectorVendorId && s.id === inspectorVendorId);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <Wrench className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900">{s.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {s.serviceGroup} · {s.place} · ★ {s.rating}
                        </p>
                        <StatusPill
                          label={isInspector ? 'Tespitçi — tedarikçi olamaz' : s.avail}
                          tone={isInspector ? 'orange' : s.avail === 'Müsait' ? 'green' : 'orange'}
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      {isInspector ? (
                        <Btn
                          tone="secondary"
                          onClick={() => {
                            setAssignWarn('Tespitçi olan tedarikçi olamaz. Bu kişi dosyada tespitçi olarak atanmış.');
                          }}
                        >
                          Ata
                        </Btn>
                      ) : isOn ? (
                        <>
                          <Btn tone="secondary" onClick={() => setAssigned((a) => a.filter((x) => x !== s.id))}>
                            Değiştir
                          </Btn>
                          <Btn tone="danger" onClick={() => setAssigned((a) => a.filter((x) => x !== s.id))}>
                            Kaldır
                          </Btn>
                        </>
                      ) : (
                        <Btn
                          tone="primary"
                          onClick={() => {
                            setAssignWarn('');
                            setAssigned((a) => [...a, s.id]);
                          }}
                        >
                          Ata
                        </Btn>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <ApiNote text="Harici isimler doğrudan dosyaya atanamaz. Önce Tedarikçiler’den kayıt açılır; sonra bu adımda Önerilen Tedarikçiler listesinde çıkar." />
              {claim.alternativeSuppliers.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  Bölgede kayıtlı aday yoksa tedarikçi kaydı{' '}
                  <a href="/panel/tedarikciler" className="font-semibold text-slate-800 underline">
                    Tedarikçiler
                  </a>{' '}
                  ekranından yapılır.
                </p>
              ) : (
                claim.alternativeSuppliers.map((g) => (
                  <div
                    key={g.name}
                    className="rounded-xl border border-dashed border-slate-300 px-3 py-2.5"
                  >
                    <p className="text-xs font-semibold text-slate-900">{g.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {g.place} · ★ {g.rating}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Bu satır havuza yazılmaz. Atamak için önce tedarikçi kaydı gerekir.
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </>
    </div>
  );
}

/* ─── 4. WhatsApp Bilgilendirme ─── */
export function StepWhatsApp({
  lockSentRecipients = [],
  purpose,
}: {
  lockSentRecipients?: string[];
  purpose?: 'inspection' | 'repair';
} = {}) {
  const {
    claim,
    waRecipientType: recipientType,
    setWaRecipientType: setRecipientType,
    waTemplateType: templateType,
    setWaTemplateType: setTemplateType,
    waBody: body,
    setWaBody: setBody,
    templates,
    templatesFromSettings,
    templatesLoading,
    applyWaTemplateForRecipient,
    assignedInspectorId,
    assignedSupplierIds,
    recordWhatsAppContact,
  } = usePlanner();
  const persistedMarked = claim.stepStatuses.whatsapp === 'done';
  const [marked, setMarked] = useState(persistedMarked);
  const currentLocked = lockSentRecipients.includes(recipientType);

  useEffect(() => {
    setMarked(persistedMarked);
  }, [persistedMarked]);

  useEffect(() => {
    if (!lockSentRecipients.includes(recipientType)) return;
    const next = ['Sigortalı', 'Tespitçi', 'Tedarikçi'].find((t) => !lockSentRecipients.includes(t));
    if (!next) return;
    setRecipientType(next);
    const type = templateTypeForRecipient(next);
    setTemplateType(type);
    setBody(applyWaTemplateForRecipient(next));
  }, [
    lockSentRecipients,
    recipientType,
    setRecipientType,
    setTemplateType,
    setBody,
    applyWaTemplateForRecipient,
  ]);

  const assignedInspector = claim.inspectors.find((i) => i.id === assignedInspectorId);
  const assignedSupplier = claim.suppliers.find((s) => assignedSupplierIds.includes(s.id));

  const recipientName =
    recipientType === 'Sigortalı'
      ? claim.insuredName
      : recipientType === 'Tespitçi'
        ? assignedInspector?.name ?? 'Tespitçi Seçilmedi'
        : recipientType === 'Tedarikçi'
          ? assignedSupplier?.name ?? 'Tedarikçi Seçilmedi'
          : recipientType === 'Eksper Ofisi'
            ? claim.expertOfficeName || 'Eksper Ofisi Tanımlanmamış'
            : claim.insurer;

  const phone =
    recipientType === 'Sigortalı'
      ? claim.insuredPhone
      : recipientType === 'Tespitçi'
        ? assignedInspector?.phone ?? ''
          : recipientType === 'Tedarikçi'
          ? assignedSupplier?.phone ?? ''
          : recipientType === 'Eksper Ofisi'
            ? claim.expertOfficePhone
            : '';

  const hasarTemplates = templates.length
    ? templates
    : Object.values(HASAR_WA_TEMPLATE_TYPES).map((type) => pickTemplate([], type));

  return (
    <div className="mt-3 space-y-3">
      <Card title="Alıcı" icon={UserRound}>
        <Field label="Alıcı Türü *">
          <select
            value={recipientType}
            onChange={(e) => {
              const next = e.target.value;
              if (lockSentRecipients.includes(next)) return;
              setRecipientType(next);
              const type = templateTypeForRecipient(next);
              setTemplateType(type);
              setBody(applyWaTemplateForRecipient(next));
            }}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
          >
            {['Sigortalı', 'Tespitçi', 'Tedarikçi'].map((t) => (
              <option key={t} value={t} disabled={lockSentRecipients.includes(t)}>
                {lockSentRecipients.includes(t) ? `${t} (gönderildi)` : t}
              </option>
            ))}
          </select>
        </Field>
        <div className="mt-2 grid grid-cols-1 gap-2">
          <Field label="Alıcı Adı">
            <Input value={recipientName} readOnly />
          </Field>
          <Field label="Telefon *" icon={Phone}>
            <Input value={phone} readOnly />
          </Field>
        </div>
      </Card>

      <Card title="Şablon Ve Mesaj" icon={MessageCircle}>
        <Field label="Şablon Seçimi *">
          <select
            value={templateType}
            onChange={(e) => {
              const type = e.target.value as HasarWaTemplateType;
              setTemplateType(type);
              const t = pickTemplate(templates, type);
              setBody(
                interpolateHasarTemplate(t.content, {
                  musteriAdi: claim.insuredName,
                  dosyaNo: claim.fileNo,
                  sirketAdi: claim.insurer,
                  hasarAdresi: claim.address,
                  randevuTarih: claim.appointmentDate,
                  randevuSaat: claim.appointmentTime,
                  tahminiSure: `${claim.durationMinutes} Dakika`,
                  isTanimi: claim.lossType,
                }),
              );
            }}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
            disabled={templatesLoading}
          >
            {hasarTemplates.map((t) => (
              <option key={t.type} value={t.type}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <p className="mt-1 text-[10px] text-slate-500">
          Kaynak: Ayarlar › Mesaj Şablonları › Hasar
          {templatesFromSettings
            ? ' — canlı şablon yüklendi.'
            : ' — oturum/API yok; Ayarlar varsayılanı kullanılıyor.'}
        </p>
        <div className="mt-2">
          <Field label="Mesaj Önizlemesi / Düzenleme *">
            <TextArea value={body} onChange={setBody} rows={4} />
          </Field>
        </div>
        {currentLocked ? (
          <p className="mt-2 text-[11px] font-medium text-amber-800">
            Bu alıcıya onarım mesajı gönderildi; yeniden seçilmez.
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {!currentLocked ? (
          <WhatsAppOpenButton
            phone={phone}
            message={body}
            onOpened={() => {
              void recordWhatsAppContact({
                status: 'opened',
                phone,
                message: body,
                purpose,
              }).then((res) => {
                if (res.ok) setMarked(true);
              });
            }}
          />
          ) : null}
          <Btn
            tone="secondary"
            onClick={() => {
              if (currentLocked) return;
              void recordWhatsAppContact({
                status: 'sent',
                phone,
                message: body,
                purpose,
              }).then((res) => {
                if (res.ok) setMarked(true);
              });
            }}
            disabled={marked || currentLocked}
          >
            <CheckCircle2 className="h-3 w-3" /> {marked ? 'Gönderildi' : 'Gönderildi Olarak İşaretle'}
          </Btn>
          <Btn tone="secondary">
            <RefreshCcw className="h-3 w-3" /> Tekrar Gönder
          </Btn>
        </div>
      </Card>

      <Card title="Gönderim Geçmişi" icon={History}>
        <div className="space-y-2">
          {claim.waHistory.map((h) => (
            <div key={h.when} className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
              <p className="text-[11px] font-semibold text-slate-800">{h.recipient}</p>
              <p className="text-[10px] text-slate-500">{h.template}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                {h.when} · {h.by} · {h.status}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ─── Dijital Onay — mutabakat / muvafakat tek belge ─── */
export function StepDigitalApproval() {
  const { claim } = usePlanner();
  if (!claim.claimId) {
    return <p className="mt-3 text-xs text-slate-500">Dosya bağlı değil.</p>;
  }
  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-slate-600">
        Mutabakat ve muvafakat aynı belgedir. Sigortalı WhatsApp linkinden dijital onaylar. Ayrı sayfa yok.
      </p>
      {claim.flowFlags.muvafakatApproved ? (
        <p className="text-xs font-medium text-emerald-800">Dijital onay alındı.</p>
      ) : (
        <p className="text-xs font-medium text-amber-800">Onay gelmeden onarım bitişi kaydedilmez.</p>
      )}
      <FileDocumentPanel
        entityType="claim_file"
        entityId={claim.claimId}
        documentKind="muvafakatname"
        defaultPhone={claim.insuredPhone}
      />
    </div>
  );
}

/* ─── 6. Rapor Yazım Aşamasında ─── */
export function StepReportWriting() {
  const { claim, onGoToReports, mode } = usePlanner();
  const r = claim.report;
  const catchup = isLegacyOpsCatchupBypassActive();
  const checksReady =
    r.readyChecks.reportComplete &&
    r.readyChecks.docsComplete &&
    r.readyChecks.photosComplete &&
    r.readyChecks.financeReady &&
    r.readyChecks.revisionOk;
  const ready = checksReady || catchup;

  const checks: { key: keyof typeof r.readyChecks; label: string }[] = [
    { key: 'reportComplete', label: 'Rapor tamam mı?' },
    { key: 'docsComplete', label: 'Zorunlu evraklar tamam mı?' },
    { key: 'photosComplete', label: 'Fotoğraflar tamam mı?' },
    { key: 'financeReady', label: 'Finansal özet hazır mı?' },
    { key: 'revisionOk', label: 'Revizyon durumu uygun mu?' },
  ];

  return (
    <div className="mt-3 space-y-3">
      <Card title="Rapor Kimliği" icon={FileText}>
        <div className="space-y-1 text-xs text-slate-700">
          <p>Rapor Numarası: <span className="font-semibold">{r.number}</span></p>
          <p>Aktif Revizyon: <span className="font-semibold">Revizyon {r.revision}</span></p>
          <p>Rapor Durumu: <StatusPill label={repairReportStatusLabel(r.status)} tone="orange" /></p>
          <p>Rapor Sorumlusu: {r.owner}</p>
          <p className="flex items-center gap-1">
            <Clock3 className="h-3 w-3" /> Son Güncelleme: {r.updatedAt}
          </p>
        </div>
      </Card>

      <Card title="Revizyon Takibi" icon={History}>
        <div className="space-y-2">
          {claim.revisions.map((rev) => (
            <div
              key={rev.n}
              className={`rounded-lg border px-2.5 py-2 ${
                rev.active ? 'border-blue-300 bg-blue-50/50 ring-1 ring-blue-200' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-900">Revizyon {rev.n}</p>
                {rev.active ? <StatusPill label="Aktif Sürüm" tone="blue" /> : null}
              </div>
              <p className="mt-1 text-[10px] text-slate-600">Tarih: {rev.date}</p>
              <p className="text-[10px] text-slate-600">İsteyen: {rev.by}</p>
              <p className="text-[10px] text-slate-600">Neden: {rev.reason}</p>
              <p className="text-[10px] text-slate-600">Not: {rev.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <Btn tone="secondary">
            <History className="h-3 w-3" /> Önceki Sürümleri Görüntüle
          </Btn>
        </div>
      </Card>

      <Card title="Finansal Özet" icon={WalletCards}>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <p className="rounded-lg bg-slate-50 px-2 py-1.5">
            <span className="block text-slate-500">Rapor Toplamı</span>
            <span className="font-bold text-slate-900">{r.total}</span>
          </p>
          <p className="rounded-lg bg-slate-50 px-2 py-1.5">
            <span className="block text-slate-500">Tedarikçi Maliyeti</span>
            <span className="font-bold text-slate-900">{r.supplierCost}</span>
          </p>
          <p className="rounded-lg bg-slate-50 px-2 py-1.5">
            <span className="block text-slate-500">Fiili Gider</span>
            <span className="font-bold text-slate-900">{r.actualExpense}</span>
          </p>
          <p className="rounded-lg bg-slate-50 px-2 py-1.5">
            <span className="block text-slate-500">Beklenen Gelir</span>
            <span className="font-bold text-slate-900">{r.expectedIncome}</span>
          </p>
          <p className="rounded-lg bg-emerald-50 px-2 py-1.5">
            <span className="block text-emerald-700">Kâr Tutarı</span>
            <span className="font-bold text-emerald-800">{r.profit}</span>
          </p>
          <p className="rounded-lg bg-emerald-50 px-2 py-1.5">
            <span className="block text-emerald-700">Kâr Marjı</span>
            <span className="font-bold text-emerald-800">{r.margin}</span>
          </p>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">{r.vatNote} · mevcut yapıdan okunur.</p>
        <Btn tone="ghost" className="mt-1 !px-0">
          Finans Detayına Git →
        </Btn>
      </Card>

      <Card title="Rapor İşlemleri" icon={FileText}>
        <ul className="space-y-1 text-xs text-slate-700">
          <li>Eksik Evraklar: <span className="font-semibold">{r.missingDocs}</span></li>
          <li>Fotoğraf Sayısı: <span className="font-semibold">{r.photoCount}</span></li>
          <li>Tespit Bulguları: Ön izleme notları hazır</li>
          <li>Rapor Notları: Yazım devam ediyor</li>
        </ul>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Btn tone="secondary">Rapor Önizleme</Btn>
          <Btn
            tone="primary"
            onClick={() => {
              if (onGoToReports) onGoToReports();
            }}
            disabled={!onGoToReports && mode === 'live'}
          >
            <FileText className="h-3 w-3" />
            Rapora Git
            <ArrowRight className="h-3 w-3" />
          </Btn>
        </div>
        <p className="mt-1 text-[10px] text-slate-400">
          {mode === 'live'
            ? 'Raporlar sekmesine yönlendirir. Rapor yazım sayfasına dokunulmaz.'
            : 'Lokal önizleme: canlıda Raporlar sekmesine gider (rapor yazım sayfasına dokunulmaz).'}
        </p>
      </Card>

      <Card title="Onaya Hazırlık Kontrolü" icon={CheckCircle2}>
        <ul className="space-y-1.5">
          {checks.map((c) => (
            <li key={c.key} className="flex items-center justify-between text-xs text-slate-700">
              <span>{c.label}</span>
              <StatusPill
                label={r.readyChecks[c.key] ? 'Evet' : 'Hayır'}
                tone={r.readyChecks[c.key] ? 'green' : 'orange'}
              />
            </li>
          ))}
          <li className="flex items-center justify-between text-xs font-semibold text-slate-800">
            <span>Onaya göndermeye hazır mı?</span>
            <StatusPill label={ready ? 'Evet' : 'Hayır'} tone={ready ? 'green' : 'orange'} />
          </li>
        </ul>
        <div className="mt-2">
          <Btn
            tone="primary"
            disabled={!ready}
            onClick={() => {
              if (onGoToReports) onGoToReports();
            }}
          >
            <Send className="h-3 w-3" /> Onaya Gönder
          </Btn>
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          Muvafakatname ve anket onaydan sonra istenir; onaya göndermeyi kilitlemez.
        </p>
        {catchup && !checksReady ? (
          <p className="mt-1 text-[10px] text-amber-700">
            {LEGACY_OPS_CATCHUP_BYPASS_NOTE}
          </p>
        ) : !ready ? (
          <p className="mt-1 text-[10px] text-amber-700">
            Eksikler giderilmeden Onaya Gönder aktif olmaz.
          </p>
        ) : null}
      </Card>
    </div>
  );
}

/* ─── 7. Onaya Gönderildi ─── */
export function StepSentForApproval() {
  const {
    claim,
    approvalAuthority: authority,
    setApprovalAuthority,
    emailTo,
    setEmailTo,
    emailSubject,
    setEmailSubject,
  } = usePlanner();
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const party = resolvePlannerApprovalParty(authority, {
    expertOfficeName: claim.expertOfficeName,
    expertOfficeEmail: claim.expertOfficeEmail,
    insurerName: claim.insurer === '—' ? '' : claim.insurer,
    insurerEmail: claim.insurerEmail,
  });
  const relatedCustomer = plannerApprovalPartyLabel(party);
  const [emailBody, setEmailBody] = useState(
    `Sayın yetkili,\n\n${claim.fileNo} dosyası rapor onayı için iletilmiştir.\nRevizyon: ${claim.report.revision}\n\nSaygılarımızla.`,
  );

  const sendApprovalMail = async () => {
    setEmailBusy(true);
    setEmailResult(null);
    const result = await sendPlannerApprovalMail({
      reportId: String(claim.report.id ?? ''),
      to: emailTo,
      subject: emailSubject,
      approverType: party.kind === 'insurer' ? 'insurance_company' : 'expert',
      approverName: relatedCustomer,
    });
    setEmailResult(result.message);
    setEmailBusy(false);
  };

  return (
    <div className="mt-3 space-y-3">
      <Card title="Gönderim Bilgileri" icon={Send}>
        <div className="space-y-1 text-xs text-slate-700">
          <p className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" /> Onaya Gönderim Tarihi: 20.07.2026
          </p>
          <p className="flex items-center gap-1">
            <Clock3 className="h-3 w-3" /> Onaya Gönderim Saati: 09:15
          </p>
          <p className="flex items-center gap-1">
            <UserCog className="h-3 w-3" /> Gönderen: Ayşe Operatör
          </p>
          <p>Onay Mercii: {authority}</p>
          <p>Gönderilen Revizyon: Revizyon {claim.report.revision}</p>
          <p>Gönderim Yöntemi: E-posta + Panel</p>
          <p>Bekleme Süresi: 1 gün 4 saat</p>
        </div>
      </Card>

      <Card title="Onay Mercii" icon={Building2}>
        <Field label="Seçim (Dosya Ayarına Göre)">
          <select
            value={authority}
            onChange={(e) => {
              const v = e.target.value as 'Eksper' | 'Sigorta şirketi';
              setApprovalAuthority(v);
            }}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
          >
            <option value="Eksper">Eksper</option>
            <option value="Sigorta şirketi">Sigorta Şirketi</option>
          </select>
        </Field>
      </Card>

      <Card title="E-posta Gönderimi" icon={Mail}>
        <div className="space-y-2">
          <Field label="İlgili Müşteri" icon={Building2}>
            <Input value={relatedCustomer} readOnly />
          </Field>
          <Field label="Alıcı Kişi / Personel" icon={UserRound}>
            <Input value="Onay Birimi" readOnly />
          </Field>
          <Field label="E-posta Adresi *">
            <Input value={emailTo} onChange={setEmailTo} />
          </Field>
          {!emailTo.includes('@') ? (
            <p className="text-[10px] text-amber-700">
              {party.kind === 'expert_office'
                ? 'Eksper ofisi kartında e-posta yok. Ofis kaydına e-posta eklenince burası otomatik dolar.'
                : 'Sigorta şirketi kartında e-posta yok.'}
            </p>
          ) : null}
          <Field label="Konu *">
            <Input value={emailSubject} onChange={setEmailSubject} />
          </Field>
          <Field label="Mesaj Önizlemesi">
            <TextArea value={emailBody} onChange={setEmailBody} rows={4} />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            <StatusPill label="Rapor Pdf Eki" tone="blue" />
            <StatusPill label="Ek Belgeler (2)" tone="gray" />
          </div>
          <Btn
            tone="primary"
            disabled={emailBusy}
            onClick={() => void sendApprovalMail()}
          >
            <Mail className="h-3 w-3" /> {emailBusy ? 'Gönderiliyor…' : 'E-postayı Gönder'}
          </Btn>
          {emailResult ? (
            <p className={`text-[10px] ${emailResult.startsWith('E-posta') ? 'text-emerald-800' : 'text-amber-800'}`}>
              {emailResult}
            </p>
          ) : null}
        </div>
      </Card>

      <Card title="Hatırlatma" icon={Bell}>
        <Field label="Hatırlatma Tarihi" icon={CalendarDays}>
          <Input value="21.07.2026" />
        </Field>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Btn tone="secondary">
            <Bell className="h-3 w-3" /> Tekrar Hatırlat
          </Btn>
          <Btn tone="secondary">Onay Gecikme Uyarısı</Btn>
          <Btn
            tone="secondary"
            disabled={emailBusy}
            onClick={() => void sendApprovalMail()}
          >
            <RefreshCcw className="h-3 w-3" /> Yeniden Gönder
          </Btn>
          <Btn tone="secondary">Revizyon Talebi Geldi</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ─── Dosya Onaylandı — rapor onayının yansıması ─── */
export function StepApproved() {
  const { claim, onGoToReports } = usePlanner();
  const approved = claim.stepStatuses.approved === 'done';
  return (
    <div className="mt-3 space-y-3">
      <Card title="Dosya Onayı" icon={CheckCircle2}>
        <p className="text-xs text-slate-600">
          Onay ve red, Raporlar’daki rapor onayında işlenir. Bu ekrandan kişi seçilmez; yanlış taraf yazılamaz.
        </p>
        <div className="mt-2 space-y-1 text-xs text-slate-700">
          <p>
            Durum:{' '}
            <StatusPill
              label={approved ? 'Dosya onaylandı' : repairReportStatusLabel(claim.report.status)}
              tone={approved ? 'green' : 'orange'}
            />
          </p>
          <p>Rapor: {claim.report.number}</p>
          <p>Revizyon: {claim.report.revision}</p>
          <p>Kayıtlı taraf: {claim.report.owner || '—'}</p>
          <p>Tutar: {claim.report.total}</p>
        </div>
        {onGoToReports ? (
          <div className="mt-2">
            <Btn tone="primary" onClick={onGoToReports}>
              Raporlar’da Onayı Aç
            </Btn>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function StepRepairWhatsApp() {
  const { claim } = usePlanner();
  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-slate-600">
        Onarım planı: tarih, iş ve kim gidecek. Bir alıcıya gönderilince aynı alıcı yeniden seçilmez.
      </p>
      <StepWhatsApp lockSentRecipients={claim.contactWa.repairTypes} purpose="repair" />
    </div>
  );
}

function StepRepairComplete() {
  const { claim, assignedSupplierIds } = usePlanner();
  const ids = assignedSupplierIds.length ? assignedSupplierIds : claim.preAssignedSupplierIds;
  const suppliers = claim.suppliers.filter((s) => ids.includes(s.id));
  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-slate-600">
        Onarım bitiş resimleri bu dosyada toplanır. Anket burada alınır. Kaydet: yönetici ve finansa mail.
      </p>
      {claim.claimId
        ? suppliers.map((s) => (
            <VendorRepairPhotosPanel key={s.id} claimId={claim.claimId!} vendorId={s.id} vendorName={s.name} />
          ))
        : null}
      {suppliers.length === 0 ? <p className="text-xs text-slate-500">Önce tedarikçi atayın.</p> : null}
      {!claim.flowFlags.muvafakatApproved ? (
        <p className="text-xs text-amber-800">Dijital onay yok — onarım bitişi kaydedilmez.</p>
      ) : null}
      <Card title="Kapanış Anketi" icon={MessageCircle}>
        <p className="mb-2 text-xs text-slate-600">Anket onarım bitişinde alınır.</p>
        <StepClosureSurvey />
      </Card>
    </div>
  );
}

function StepClosureSurvey() {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-600">Sigortalıya anket WhatsApp’ı Kaydet ile kayda alınır.</p>
      <StepWhatsApp />
    </div>
  );
}

function StepDocsUpload() {
  const { claim } = usePlanner();
  if (!claim.claimId) {
    return <p className="mt-3 text-xs text-slate-500">Dosya bağlı değil.</p>;
  }
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-slate-600">
        Manuel evrak buradan yüklenir. Yüklenen evrak ve resimler Evraklar → Tespit Ve Onarım’da birikir. Evraklar özetindeki yükleme de durur.
      </p>
      <ClaimManualDocumentsPanel claimId={claim.claimId} />
    </div>
  );
}

export function renderStepContent(step: StepId) {
  switch (step) {
    case 'insured_appointment':
      return <StepInsuredAppointment />;
    case 'inspector':
      return <StepInspector />;
    case 'supplier':
      return <StepSupplier />;
    case 'whatsapp':
      return <StepWhatsApp />;
    case 'digital_approval':
      return <StepDigitalApproval />;
    case 'report_writing':
      return <StepReportWriting />;
    case 'sent_for_approval':
      return <StepSentForApproval />;
    case 'approved':
      return <StepApproved />;
    case 'repair_whatsapp':
      return <StepRepairWhatsApp />;
    case 'muvafakat':
      return <StepDigitalApproval />;
    case 'repair_complete':
      return <StepRepairComplete />;
    case 'closure_survey':
      return <StepClosureSurvey />;
    case 'docs_upload':
      return <StepDocsUpload />;
    default:
      return null;
  }
}
