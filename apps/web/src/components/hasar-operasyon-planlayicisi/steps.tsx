'use client';

import { useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileDown,
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
  isWhatsAppMarkSentBypassActive,
  isWhatsAppOpenRequiredBeforeMarkSent,
  WHATSAPP_MARK_SENT_BYPASS_NOTE,
} from '@/utils/whatsapp-sent-confirm-gate';
import { isoToTrDateDisplay } from '@/utils/tr-date-input';
import { API, authAxios } from '@/utils/api';
import type { StepId } from './types';
import { usePlanner } from './planner-context';
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
  if (onChange) {
    return (
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className={shared}
      />
    );
  }
  return <input type={type} defaultValue={value} readOnly={readOnly} className={shared} />;
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
  title,
}: {
  children: ReactNode;
  tone?: 'primary' | 'secondary' | 'danger' | 'ghost';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const styles =
    tone === 'primary'
      ? 'bg-brand-600 text-white hover:bg-blue-700 disabled:bg-slate-300'
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
      title={title}
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

/* ─── 1. Sigortalı ve Randevu ─── */
export function StepInsuredAppointment() {
  const {
    claim,
    setClaim,
    canEdit,
    mode,
    meetingNote,
    setMeetingNote,
    apptNote,
    setApptNote,
    insuredApproved,
    setInsuredApproved,
    buildInsuredApptMessage,
    templatesFromSettings,
  } = usePlanner();
  const [sent, setSent] = useState(false);
  const [waOpenedLocal, setWaOpenedLocal] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const apptDateWrapRef = useRef<HTMLDivElement>(null);
  const apptTimeRef = useRef<HTMLInputElement>(null);
  const waText = buildInsuredApptMessage();
  const apptEditable = canEdit;
  const bypassActive = isWhatsAppMarkSentBypassActive();
  const canMarkSentLocal = bypassActive || waOpenedLocal || sent;

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
              <Input value={claim.locationUrl} readOnly />
              <Btn tone="secondary" className="shrink-0">
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
        <div className="mt-2">
          <Field label="Tahmini Süre">
            {apptEditable ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={claim.durationMinutes}
                  onChange={(e) =>
                    setClaim((prev) => ({
                      ...prev,
                      durationMinutes: e.target.value.replace(/\D/g, '').slice(0, 4),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-blue-400"
                  aria-label="Tahmini Süre"
                />
                <span className="shrink-0 text-[11px] font-medium text-slate-500">Dakika</span>
              </div>
            ) : (
              <Input
                value={claim.durationMinutes ? `${claim.durationMinutes} Dakika` : ''}
                readOnly
              />
            )}
          </Field>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Btn tone="secondary">
            <PhoneCall className="h-3 w-3" /> Ara
          </Btn>
          <Btn tone="secondary" onClick={focusAppointmentEditors} disabled={!apptEditable}>
            Randevuyu Düzenle
          </Btn>
          <Btn tone="secondary">
            <MapPin className="h-3 w-3" /> Konumu Doğrula
          </Btn>
        </div>
        {mode === 'preview' ? (
          <ApiNote text="Lokal önizlemede Kaydet API’ye yazılmaz; sahte başarı gösterilmez." />
        ) : null}
      </Card>

      <Card title="Notlar" icon={MessageSquareText}>
        <Field label="Görüşme Notu *">
          <TextArea value={meetingNote} onChange={setMeetingNote} />
        </Field>
        <div className="mt-2">
          <Field label="Randevu Notu">
            <TextArea value={apptNote} onChange={setApptNote} />
          </Field>
        </div>
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
          {templatesFromSettings ? ' (canlı şablon)' : ' (varsayılan — oturum/API yok)'}
        </p>
        {bypassActive ? (
          <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] text-amber-900">
            {WHATSAPP_MARK_SENT_BYPASS_NOTE}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          <Btn tone="secondary" onClick={() => setPreviewOpen((v) => !v)}>
            Mesajı Önizle
          </Btn>
          <WhatsAppOpenButton
            phone={claim.insuredPhone}
            message={waText}
            onOpened={() => setWaOpenedLocal(true)}
          />
          <Btn
            tone="secondary"
            onClick={() => setSent(true)}
            disabled={!canMarkSentLocal || sent}
          >
            <CheckCircle2 className="h-3 w-3" />
            {sent ? 'Gönderildi' : 'Gönderildi Olarak İşaretle'}
          </Btn>
        </div>
        {previewOpen ? (
          <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap">
            {waText}
          </p>
        ) : null}
        {sent ? (
          <p className="mt-2 text-[10px] text-emerald-700">
            Lokal işaret: gönderildi · gerçek contact-events kaydı için API bağlanmalı.
          </p>
        ) : null}
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
  } = usePlanner();
  const assigned = claim.inspectors.find((i) => i.id === assignedInspectorId) ?? null;
  const assignedWaMessage = buildInspectorMessage();

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
            href={claim.locationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-medium text-brand-600 hover:underline"
          >
            {claim.locationUrl}
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
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Btn tone="secondary" onClick={() => setAssignedInspectorId(null)}>
              Değiştir
            </Btn>
            <Btn tone="danger" onClick={() => setAssignedInspectorId(null)}>
              Kaldır
            </Btn>
          </div>
          <div className="mt-2">
            <WhatsAppOpenButton
              phone={assigned.phone}
              message={assignedWaMessage}
              label="Görev Ve Randevu Mesajı"
              className="w-full"
            />
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
  const [tab, setTab] = useState<'secim' | 'gorev'>('secim');
  const [sub, setSub] = useState<'kayitli' | 'alternatif'>('kayitli');
  const {
    claim,
    assignedSupplierIds: assigned,
    setAssignedSupplierIds: setAssigned,
    supplierTasks: tasks,
    setSupplierTasks: setTasks,
    buildVendorTaskMessage,
    templatesFromSettings,
  } = usePlanner();
  const [poolExtra, setPoolExtra] = useState<
    { name: string; place: string; rating: string; serviceGroup: string }[]
  >([]);
  const [pendingAlt, setPendingAlt] = useState<string | null>(null);
  const [serviceGroupDraft, setServiceGroupDraft] = useState('Boyacı');

  const assignedRows = useMemo(
    () =>
      [...claim.suppliers, ...poolExtra.map((p, i) => ({
        id: `g${i}`,
        name: p.name,
        serviceGroup: p.serviceGroup,
        place: p.place,
        rating: p.rating,
        avail: 'Müsait' as const,
      }))].filter((s) => assigned.includes(s.id) || assigned.includes(s.name)),
    [assigned, poolExtra, claim.suppliers],
  );

  return (
    <div className="mt-3 space-y-3">
      <p className="text-[11px] text-slate-500">
        Hasar türüne uygun tedarikçileri seçin ve görevlerini tanımlayın. Birden fazla atama
        yapılabilir.
      </p>
      <div className="flex gap-1 border-b border-slate-100">
        {(
          [
            ['secim', 'Tedarikçi Seçimi'],
            ['gorev', 'Görev Tanımı'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-2.5 py-1.5 text-[11px] font-semibold ${
              tab === id ? 'border-b-2 border-brand-600 text-blue-700' : 'text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'secim' ? (
        <>
          <div className="grid grid-cols-1 gap-2">
            <Field label="Hizmet Grubu">
              <select className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs">
                <option>Boyacı</option>
                <option>Sıhhi Tesisat</option>
              </select>
            </Field>
            <Field label="Bölge">
              <select className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs">
                <option>Kadıköy</option>
                <option>Üsküdar</option>
              </select>
            </Field>
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
                          label={s.avail}
                          tone={s.avail === 'Müsait' ? 'green' : 'orange'}
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      {isOn ? (
                        <>
                          <Btn tone="secondary" onClick={() => setAssigned((a) => a.filter((x) => x !== s.id))}>
                            Değiştir
                          </Btn>
                          <Btn tone="danger" onClick={() => setAssigned((a) => a.filter((x) => x !== s.id))}>
                            Kaldır
                          </Btn>
                        </>
                      ) : (
                        <Btn tone="primary" onClick={() => setAssigned((a) => [...a, s.id])}>
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
              <ApiNote text="Harici öneriler doğrudan dosyaya atanamaz. Sıra: Bul → Tedarikçi Havuzuna Kaydet → Hizmet Grubu Tanımla → Dosyaya Ata." />
              {claim.alternativeSuppliers.map((g) => (
                <div
                  key={g.name}
                  className="rounded-xl border border-dashed border-slate-300 px-3 py-2.5"
                >
                  <p className="text-xs font-semibold text-slate-900">{g.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {g.place} · ★ {g.rating}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Btn tone="secondary" onClick={() => setPendingAlt(g.name)}>
                      Havuzuna Kaydet
                    </Btn>
                  </div>
                  {pendingAlt === g.name ? (
                    <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2">
                      <Field label="Hizmet Grubu Tanımla">
                        <select
                          value={serviceGroupDraft}
                          onChange={(e) => setServiceGroupDraft(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
                        >
                          <option>Boyacı</option>
                          <option>Sıhhi Tesisat</option>
                        </select>
                      </Field>
                      <Btn
                        tone="primary"
                        onClick={() => {
                          setPoolExtra((p) => [
                            ...p,
                            {
                              name: g.name,
                              place: g.place,
                              rating: g.rating,
                              serviceGroup: serviceGroupDraft,
                            },
                          ]);
                          setAssigned((a) => [...a, g.name]);
                          setPendingAlt(null);
                          setSub('kayitli');
                        }}
                      >
                        Dosyaya Ata
                      </Btn>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          {assignedRows.length === 0 ? (
            <p className="text-xs text-slate-500">Önce tedarikçi atayın.</p>
          ) : (
            assignedRows.map((s) => (
              <Card key={s.id || s.name} title={s.name} icon={Wrench}>
                <Field label="Görev Tanımı">
                  <TextArea
                    value={tasks[s.id || s.name] ?? ''}
                    onChange={(v) => setTasks((t) => ({ ...t, [s.id || s.name]: v }))}
                    placeholder="Yapılacak işi yazın..."
                  />
                </Field>
                <p className="mt-2 text-[11px] text-slate-600">
                  Randevu: {claim.appointmentDate} {claim.appointmentTime}
                </p>
                <div className="mt-2">
                  <WhatsAppOpenButton
                    phone="0532 000 00 00"
                    message={buildVendorTaskMessage(
                      s.name,
                      tasks[s.id || s.name] ?? '',
                    )}
                    label="WhatsApp Görev Mesajı"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    Şablon: Ayarlar › Mesaj Şablonları › Tedarikçi Atama
                    {templatesFromSettings ? ' (canlı)' : ' (varsayılan)'}
                  </p>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── 4. WhatsApp Bilgilendirme ─── */
export function StepWhatsApp() {
  const {
    claim,
    waRecipientType: recipientType,
    setWaRecipientType: setRecipientType,
    waTemplateType: templateType,
    setWaTemplateType: setTemplateType,
    waBody: body,
    setWaBody: setBody,
    waOpened,
    setWaOpened,
    waMarkedSent,
    setWaMarkedSent,
    templates,
    templatesFromSettings,
    templatesLoading,
    applyWaTemplateForRecipient,
    assignedInspectorId,
    assignedSupplierIds,
  } = usePlanner();
  const bypassActive = isWhatsAppMarkSentBypassActive();
  const openRequired = isWhatsAppOpenRequiredBeforeMarkSent();
  const canMarkSent = bypassActive || waOpened || waMarkedSent;

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
            ? 'Örnek Eksper Ofisi'
            : claim.insurer;

  const phone =
    recipientType === 'Sigortalı'
      ? claim.insuredPhone
      : recipientType === 'Tespitçi'
        ? assignedInspector?.phone ?? ''
        : recipientType === 'Tedarikçi'
          ? assignedSupplier?.phone ?? ''
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
              setRecipientType(next);
              const type = templateTypeForRecipient(next);
              setTemplateType(type);
              setBody(applyWaTemplateForRecipient(next));
            }}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
          >
            {['Sigortalı', 'Tespitçi', 'Tedarikçi', 'Eksper Ofisi', 'Sigorta Şirketi'].map((t) => (
              <option key={t}>{t}</option>
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
        {bypassActive ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] text-amber-900">
            {WHATSAPP_MARK_SENT_BYPASS_NOTE}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <WhatsAppOpenButton
            phone={phone}
            message={body}
            onOpened={() => setWaOpened(true)}
          />
          <Btn
            tone={waMarkedSent ? 'primary' : 'secondary'}
            disabled={!canMarkSent || waMarkedSent}
            onClick={() => setWaMarkedSent(true)}
            title={
              openRequired && !waOpened && !waMarkedSent
                ? 'Önce WhatsApp’ta Aç Ve Gönder’e tıklayın'
                : undefined
            }
          >
            <CheckCircle2 className="h-3 w-3" /> Gönderildi
          </Btn>
          <Btn
            tone="secondary"
            disabled={!waMarkedSent}
            onClick={() => {
              setWaMarkedSent(false);
              setWaOpened(false);
            }}
          >
            <RefreshCcw className="h-3 w-3" /> Tekrar Gönder
          </Btn>
        </div>
        {waMarkedSent ? (
          <p className="mt-2 text-[10px] text-emerald-700">
            Gönderildi işaretlendi. Kaydet ile kalıcı kayıt oluşur.
            {!waOpened && bypassActive ? ' (WhatsApp açılmadan — geçici muafiyet)' : ''}
          </p>
        ) : openRequired && !waOpened ? (
          <p className="mt-2 text-[10px] text-slate-500">
            «Gönderildi» için önce WhatsApp’ta Aç Ve Gönder’e tıklayın.
          </p>
        ) : null}
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

/* ─── 5. Dijital Onay ─── */
export function StepDigitalApproval() {
  const {
    claim,
    digitalFormType: formType,
    setDigitalFormType: setFormType,
    digitalApprovalStatus: status,
    setDigitalApprovalStatus: setStatus,
    digitalSentAt: sentAt,
    setDigitalSentAt: setSentAt,
    digitalApprovedAt: approvedAt,
    setDigitalApprovedAt: setApprovedAt,
  } = usePlanner();
  const link = `https://onay.meridyen.local/${claim.fileNo}`;
  const nowLabel = () => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
  };

  return (
    <div className="mt-3 space-y-3">
      <Card title="Form" icon={FileText}>
        <Field label="Form Türü">
          <select
            value={formType}
            onChange={(e) => setFormType(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
          >
            {['Mutabakat', 'Muvafakat', 'Tespit Onayı'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <div className="mt-2">
          <Field label="Sigortalı" icon={UserRound}>
            <Input value={claim.insuredName} readOnly />
          </Field>
        </div>
        <div className="mt-2 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600">
          Önizleme: {formType} formu — {claim.insuredName} · {claim.fileNo}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Btn
            tone="primary"
            onClick={() => {
              setStatus('Gönderildi');
              setSentAt(nowLabel());
            }}
          >
            <Send className="h-3 w-3" /> Gönder
          </Btn>
          <Btn
            tone="secondary"
            onClick={() => {
              setStatus('Gönderildi');
              setSentAt(nowLabel());
            }}
          >
            Yeniden Gönder
          </Btn>
        </div>
      </Card>

      <Card title="Durum" icon={CheckCircle2}>
        <div className="space-y-1 text-xs text-slate-700">
          <p>
            Onay Durumu:{' '}
            <StatusPill
              label={status}
              tone={status === 'Onaylandı' ? 'green' : status === 'Gönderildi' ? 'blue' : 'orange'}
            />
          </p>
          <p>Gönderim Tarihi: {sentAt ?? '—'}</p>
          <p>Onay Tarihi: {approvedAt ?? '—'}</p>
          <p className="flex items-center gap-1 break-all">
            <Link2 className="h-3 w-3 shrink-0" />
            Dijital Onay Bağlantısı: {link}
          </p>
        </div>
        <div className="mt-2">
          <Btn
            tone="secondary"
            onClick={() => {
              const t = nowLabel();
              setStatus('Onaylandı');
              if (!sentAt) setSentAt(t);
              setApprovedAt(t);
            }}
          >
            Onaylandı Olarak İşaretle
          </Btn>
        </div>
        <div className="mt-2">
          <ApiNote text="Durumu güncelleyip Kaydet’e basın; kayıt operasyon geçmişine yazılır ve adım tamamlanır." />
        </div>
      </Card>
    </div>
  );
}

/* ─── 6. Rapor Yazım Aşamasında ─── */
export function StepReportWriting() {
  const { claim, onGoToReports, mode } = usePlanner();
  const r = claim.report;
  const ready =
    r.readyChecks.reportComplete &&
    r.readyChecks.docsComplete &&
    r.readyChecks.photosComplete &&
    r.readyChecks.financeReady &&
    r.readyChecks.revisionOk;

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
          <p>Rapor Durumu: <StatusPill label={r.status} tone="orange" /></p>
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
          <li>
            Tespit Bulguları:{' '}
            {r.readyChecks.reportComplete ? 'Rapor hazır' : 'Yazım devam ediyor'}
          </li>
          <li>
            Rapor Notları:{' '}
            {r.readyChecks.reportComplete ? 'Tamamlandı' : 'Yazım devam ediyor'}
          </li>
        </ul>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Btn
            tone="secondary"
            onClick={() => {
              const reportId = claim.report.id;
              if (!reportId) {
                if (onGoToReports) onGoToReports();
                return;
              }
              void (async () => {
                try {
                  const res = await authAxios<Blob>({
                    method: 'GET',
                    url: `${API}/repair-reports/${reportId}/pdf?view=external`,
                    responseType: 'blob',
                  });
                  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                  window.open(url, '_blank', 'noopener,noreferrer');
                  setTimeout(() => URL.revokeObjectURL(url), 60_000);
                } catch {
                  if (onGoToReports) onGoToReports();
                }
              })();
            }}
          >
            Rapor Önizleme
          </Btn>
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
          <Btn tone="primary" disabled={!ready}>
            <Send className="h-3 w-3" /> Onaya Gönder
          </Btn>
        </div>
        {!ready ? (
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
  const [customer, setCustomer] = useState('Örnek Eksper Ofisi');
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [emailBody, setEmailBody] = useState(
    `Sayın yetkili,\n\n${claim.fileNo} dosyası rapor onayı için iletilmiştir.\nRevizyon: ${claim.report.revision}\n\nSaygılarımızla.`,
  );
  const setAuthority = (v: 'Eksper' | 'Sigorta şirketi') => {
    setApprovalAuthority(v);
    setCustomer(v === 'Eksper' ? 'Örnek Eksper Ofisi' : claim.insurer);
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
              setAuthority(v);
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
            <select
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
            >
              <option>Örnek Eksper Ofisi</option>
              <option>{claim.insurer}</option>
            </select>
          </Field>
          <Field label="Alıcı Kişi / Personel" icon={UserRound}>
            <Input value="Onay Birimi" />
          </Field>
          <Field label="E-posta Adresi *">
            <Input value={emailTo} onChange={setEmailTo} />
          </Field>
          <Field label="Cc">
            <Input value="dosya@meridyen.com" />
          </Field>
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
            onClick={() =>
              setEmailResult('Lokal önizleme: e-posta API bağlı değil — sahte başarı yok.')
            }
          >
            <Mail className="h-3 w-3" /> E-postayı Gönder
          </Btn>
          {emailResult ? (
            <p className="text-[10px] text-amber-800">{emailResult}</p>
          ) : null}
          <ApiNote text="E-posta gönderimi için mevcut bildirim/mail API bağlanmalı. Sonuç, tarih/saat ve gönderen kullanıcı operasyon geçmişine yazılacak." />
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
          <Btn tone="secondary">
            <RefreshCcw className="h-3 w-3" /> Yeniden Gönder
          </Btn>
          <Btn tone="secondary">Revizyon Talebi Geldi</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ─── 8. Onaylandı ─── */
export function StepApproved() {
  const {
    claim,
    approverType,
    setApproverType,
    approverName,
    setApproverName,
    meridyenNote: note,
    setMeridyenNote: setNote,
  } = usePlanner();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const needsNote = approverType === 'Meridyen personeli';

  return (
    <div className="mt-3 space-y-3">
      <Card title="Onay Bilgileri" icon={CheckCircle2}>
        <div className="space-y-1 text-xs text-slate-700">
          <p className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" /> Onaylanma Tarihi: —
          </p>
          <p className="flex items-center gap-1">
            <Clock3 className="h-3 w-3" /> Onaylanma Saati: —
          </p>
          <p>Onay Yöntemi: —</p>
          <p>Onaylanan Revizyon: Revizyon {claim.report.revision}</p>
          <p>Onaylanan Tutar: {claim.report.total}</p>
          <p className="flex items-center gap-1">
            <FileDown className="h-3 w-3" /> Onay Belgesi: Henüz yok
          </p>
        </div>
      </Card>

      <Card title="Onaylayan Taraf" icon={Building2}>
        <Field label="Onaylayan Taraf Türü">
          <select
            value={approverType}
            onChange={(e) => {
              setApproverType(e.target.value);
              setSavedMsg(null);
            }}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
          >
            {[
              'Müşteri personeli',
              'Eksper',
              'Sigorta şirketi personeli',
              'Meridyen personeli',
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
      </Card>

      <Card title="Onaylayan Kişi" icon={UserRound}>
        <div className="space-y-2">
          <Field label="Kurum" icon={Building2}>
            <Input value={approverType === 'Sigorta şirketi personeli' ? claim.insurer : 'Örnek Eksper Ofisi'} />
          </Field>
          <Field label="Ad Soyad *">
            <Input value={approverName} onChange={setApproverName} />
          </Field>
          <Field label="Unvan">
            <Input value="Onay Yetkilisi" />
          </Field>
          <Field label="Telefon" icon={Phone}>
            <Input value="0212 000 00 00" />
          </Field>
          <Field label="E-posta" icon={Mail}>
            <Input value="ali.onay@ornek.com" />
          </Field>
        </div>
      </Card>

      {needsNote ? (
        <Card title="Meridyen Personeli Onayı — Açıklama Zorunlu" icon={MessageSquareText}>
          <Field label="Açıklama">
            <TextArea
              value={note}
              onChange={setNote}
              rows={3}
              placeholder="Örn: Eksper tarafından telefonla verilen onay, görüşme kaydına istinaden sisteme işlendi."
            />
          </Field>
          <p className="mt-1 text-[10px] text-amber-700">
            Açıklama olmadan kayıt yapılamaz. İşlemi yapan kullanıcı, tarih ve saat kaydedilir.
          </p>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <Btn
          tone="primary"
          disabled={needsNote && note.trim().length < 10}
          onClick={() => {
            if (needsNote && note.trim().length < 10) return;
            setSavedMsg(
              needsNote
                ? 'Lokal önizleme: açıklama ile kayıt UI doğrulandı — onay API bağlı değil.'
                : 'Lokal önizleme: onay kaydı UI hazır — onay API bağlı değil.',
            );
          }}
        >
          <CheckCircle2 className="h-3 w-3" /> Onayı Kaydet
        </Btn>
      </div>
      {savedMsg ? <ApiNote text={savedMsg} /> : null}

      <Card title="Sonraki İşlem" icon={ArrowRight}>
        <div className="flex flex-col gap-1.5">
          {[
            'Onarım Sürecine Geç',
            'Tedarikçileri Bilgilendir',
            'Sigortalıyı Bilgilendir',
            'Finans İşlemini Başlat',
            'Onay Mesajlarını Hazırla',
          ].map((label) => (
            <Btn key={label} tone="secondary" className="!justify-start">
              {label}
            </Btn>
          ))}
        </div>
      </Card>
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
    default:
      return null;
  }
}
