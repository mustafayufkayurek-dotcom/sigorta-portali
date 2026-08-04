'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import type { LucideIcon } from 'lucide-react';
import {
  CheckCircle2,
  ClipboardList,
  Files,
  History,
  Landmark,
  Mail,
  MessageCircle,
  Play,
  Send,
  Wallet,
} from 'lucide-react';
import {
  getCase, updateCase, updateCaseStatus, addCostEntry, getCostEntries, deleteCostEntry, updateCostEntry,
  getEmergencyVendors, createVendorQuick, getRecommendedVendors,
  previewClosureEmail, sendClosureEmail,
  EmergencyCase, EmergencyCostEntry, EmergencyStatus, VendorOption, VendorRecommendation,
  type ClosureEmailPreview,
} from '@/utils/emergencyApi';
import FileDocumentPanel from '@/components/file-documents/FileDocumentPanel';
import ClosureConditionsPanel from '@/components/file-documents/ClosureConditionsPanel';
import ClosurePhotosPanel from '@/components/file-documents/ClosurePhotosPanel';
import { InboundEmailCorrespondencePanel } from '@/components/operation-inbox/InboundEmailCorrespondencePanel';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { DelegationBanner } from '@/components/delegation/DelegationBanner';
import {
  isHistoricalEmergencyFile,
  readHistoricalFinanceOptIn,
  writeHistoricalFinanceOptIn,
} from './historical-file';
import { RecommendedVendorsTabs } from '@/components/vendor-discovery/RecommendedVendorsTabs';
import SpeechToText from '@/components/SpeechToText';
import { getApiErrorMessage } from '@/utils/api-error';
import { reportCaughtError } from '@/utils/report-caught-error';
import { toWhatsAppLink } from '@/utils/date-helpers';
import {
  ACIL_STAGES,
  AcilLocalFlow,
  appendFlowHistory,
  appendMessageLog,
  appendPriceChange,
  buildCustomerGroupWhatsAppText,
  buildInsuredClosureSurveyWhatsAppText,
  buildInsuredInitialWhatsAppText,
  buildVendorWhatsAppText,
  buildWorkStartWhatsAppText,
  deriveAcilStageIndex,
  emptyAcilLocalFlow,
  evaluateCloseFinanceGate,
  isValidVendorPhone,
  readAcilLocalFlow,
  stageTaskTitle,
  validateInsuredWhatsAppGuard,
  validateVendorMessageGuard,
  writeAcilLocalFlow,
} from './acil-workflow';
import {
  STANDARD_VAT_RATE,
  VatMode,
  MarginWarning,
  calcMarginPercent,
  calcVatBreakdown,
  canSeeAcilOpsCostFields,
  convertPriceForVatMode,
  formatMarginPercent,
  getMarginWarning,
  priceToNet,
} from './acil-price-helpers';
import { usePanelRoleCode } from '@/hooks/usePanelRole';
import { resolveClaimDosyaKonusu } from '@/utils/text-helpers';
import { SETTINGS_API, settingsAuthHeader } from '@/utils/settings-api';

const INVOICE_STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  approved: 'Onaylandı',
  invoiced: 'Faturalandı',
  cancelled: 'İptal',
  draft: 'Taslak',
};

type ApprovalChannel = 'whatsapp' | 'email' | 'both';
type WhatsAppPanelTab = 'sigortali' | 'tedarikci' | 'musteri' | 'gecmis';
type AltBolumTab = 'belgeler' | 'whatsapp' | 'gecmis' | 'finans';
type ConfirmAction = 'dosya_kapat_finansa' | null;
type InsuredWhatsAppKind = 'initial' | 'closure_survey';

const ICON_SM = 'h-4 w-4 shrink-0';

function SectionTitle({
  icon: Icon,
  title,
  iconClassName = 'text-slate-500',
  testId,
}: {
  icon: LucideIcon;
  title: string;
  iconClassName?: string;
  testId?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0" data-testid={testId}>
      <Icon className={`${ICON_SM} ${iconClassName}`} strokeWidth={1.75} aria-hidden />
      <p className="text-sm font-semibold text-slate-800 truncate">{title}</p>
    </div>
  );
}

type QuickActionVisualState = 'completed' | 'next' | 'waiting' | 'idle';

function QuickActionCard({
  icon: Icon,
  label,
  onClick,
  disabled,
  busy,
  variant = 'secondary',
  visualState = 'idle',
  title,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  /** completed=yeşil · next=vurgulu · waiting=pasif · idle=nötr */
  visualState?: QuickActionVisualState;
  /** Pasif / kilit nedeni (native tooltip) */
  title?: string;
  testId?: string;
}) {
  const resolvedState: QuickActionVisualState =
    visualState !== 'idle'
      ? visualState
      : disabled
        ? 'waiting'
        : variant === 'primary'
          ? 'next'
          : variant === 'success'
            ? 'completed'
            : 'idle';

  const shellCls =
    resolvedState === 'completed'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-50/90 focus-visible:ring-emerald-400'
      : resolvedState === 'next'
        ? 'border-blue-400 bg-blue-50 text-blue-900 shadow-sm ring-2 ring-blue-100 hover:bg-blue-50/90 focus-visible:ring-blue-500'
        : resolvedState === 'waiting'
          ? 'border-slate-200 bg-slate-50 text-slate-400 opacity-55'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400';

  const iconCls =
    resolvedState === 'completed'
      ? 'text-emerald-600'
      : resolvedState === 'next'
        ? 'text-brand-600'
        : resolvedState === 'waiting'
          ? 'text-slate-400'
          : variant === 'danger'
            ? 'text-rose-600'
            : variant === 'success'
              ? 'text-emerald-600'
              : variant === 'primary'
                ? 'text-brand-600'
                : 'text-slate-600';

  return (
    <button
      type="button"
      disabled={disabled || busy || resolvedState === 'waiting'}
      onClick={onClick}
      title={title}
      data-testid={testId}
      data-visual-state={resolvedState}
      className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-lg border px-1.5 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed ${shellCls}`}
    >
      <Icon className={`${ICON_SM} ${iconCls}`} strokeWidth={1.75} aria-hidden />
      <span className="text-[10px] font-semibold leading-tight max-w-full px-0.5">{busy ? 'Bekleyin...' : label}</span>
    </button>
  );
}

function fmtCurrency(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTimeHm(d: string) {
  try {
    return new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function mapWhatsAppThreadRow(h: { at: string; text: string }): { title: string; detail: string; at: string } {
  const raw = (h.text || '').trim();
  const sep = raw.indexOf(' — ');
  if (sep > 0) {
    return { title: raw.slice(0, sep).trim(), detail: raw.slice(sep + 3).trim(), at: h.at };
  }
  const colon = raw.indexOf(': ');
  if (colon > 0 && colon < 48) {
    return { title: raw.slice(0, colon).trim(), detail: raw.slice(colon + 2).trim(), at: h.at };
  }
  return { title: raw || 'WhatsApp Yazışması', detail: '', at: h.at };
}

function WhatsAppBrandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function WhatsAppThreadAvatar() {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/70"
      aria-hidden
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4z" />
      </svg>
    </span>
  );
}

function WhatsAppReadCheck({ read = false }: { read?: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 ${read ? 'text-sky-500' : 'text-slate-400'}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 13l4 4L16 7" />
      <path d="M8 13l4 4L22 7" />
    </svg>
  );
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatTurkishList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ve ${items.at(-1)}`;
}
function currentOperator(): { name: string; identity: string } {
  try {
    const raw = localStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
    return {
      name: name || user?.email || 'Kullanıcı',
      identity: String(user?.id || user?.email || 'Kimlik bilgisi alınamadı'),
    };
  } catch {
    return { name: 'Kullanıcı', identity: 'Kimlik bilgisi alınamadı' };
  }
}
function fmtElapsedDuration(fromIso: string): string {
  const start = new Date(fromIso).getTime();
  if (Number.isNaN(start)) return '—';
  const mins = Math.max(0, Math.floor((Date.now() - start) / 60000));
  if (mins < 60) return `${mins} dk`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return rem > 0 ? `${hours} saat ${rem} dk` : `${hours} saat`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH > 0 ? `${days} gün ${remH} saat` : `${days} gün`;
}
/** Fiyat girişi input: 1.250,00 ↔ sayı */
function formatPriceInput(n: number): string {
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parsePriceInput(raw: string): number {
  const s = (raw || '').trim();
  if (!s) return NaN;
  const normalized = s.includes(',')
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(/,/g, '');
  return Number(normalized);
}

function VatModeToggle({
  value,
  onChange,
  testId,
}: {
  value: VatMode;
  onChange: (next: VatMode) => void;
  testId: string;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
      role="group"
      aria-label="KDV Modu"
      data-testid={testId}
    >
      {([
        { id: 'haric' as const, label: 'KDV Hariç' },
        { id: 'dahil' as const, label: 'KDV Dahil' },
      ]).map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
              active
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            aria-pressed={active}
            data-testid={`${testId}-${opt.id}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Net / KDV / KDV Dahil — KDV tutarı ayrı satırda (kayıp KDV okunurluğu). */
function VatBreakdownRows({
  amount,
  mode,
  testIdPrefix,
}: {
  amount: number;
  mode: VatMode;
  testIdPrefix: string;
}) {
  const parts = calcVatBreakdown(amount, mode);
  if (!parts) {
    return (
      <p className="mt-1.5 text-[10px] text-slate-400">
        KDV %{STANDARD_VAT_RATE}
      </p>
    );
  }
  const rows: { key: string; label: string; value: number; emphasize?: boolean }[] = [
    { key: 'net', label: 'KDV Hariç', value: parts.net },
    { key: 'vat', label: `KDV (%${STANDARD_VAT_RATE})`, value: parts.vat, emphasize: true },
    { key: 'gross', label: 'KDV Dahil', value: parts.gross },
  ];
  return (
    <dl
      className="mt-1.5 space-y-0.5 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1.5"
      data-testid={`${testIdPrefix}-kdv-satirlari`}
    >
      {rows.map((row) => (
        <div
          key={row.key}
          className="flex items-center justify-between gap-2"
          data-testid={`${testIdPrefix}-kdv-${row.key}`}
        >
          <dt
            className={`text-[10px] ${
              row.emphasize ? 'font-medium text-slate-600' : 'text-slate-500'
            }`}
          >
            {row.label}
          </dt>
          <dd
            className={`text-[10px] tabular-nums ${
              row.emphasize ? 'font-semibold text-slate-700' : 'font-medium text-slate-600'
            }`}
          >
            {formatPriceInput(row.value)} TL
          </dd>
        </div>
      ))}
    </dl>
  );
}

function personInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('tr-TR');
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toLocaleUpperCase('tr-TR');
}

function customerLabel(vaka: EmergencyCase): string {
  const c = vaka.customer;
  if (!c) return vaka.customerName;
  return (
    c.companyName
    || c.fullName
    || [c.firstName, c.lastName].filter(Boolean).join(' ')
    || vaka.customerName
  );
}

function insuredLabel(vaka: EmergencyCase): string {
  // Acil dosyada sigortalı adı soyadı `customerName` alanına yazılır
  // (yeni dosya formu + gelen kutusu openEmergencyFile → customerName).
  // Asistans firması ayrı: customerId → customer.companyName (Müşteri satırı).
  const fromField = (vaka.customerName || '').trim();
  if (fromField) return fromField;
  const note = (vaka.notes || '').trim();
  const m = note.match(/sigortal[ıi]\s*[:：]\s*(.+)/i);
  if (m?.[1]) return m[1].split(/[\n|]/)[0].trim().slice(0, 80);
  return '—';
}

function insuredPhoneLabel(vaka: EmergencyCase): string {
  // Sigortalı telefonu: customerPhone (backend inbound backfill) → müşteri kaydı → notlar.
  // Yanlış alan eşlemesi yüzünden veri varken "—" gösterilmesin.
  const directCandidates = [
    vaka.customerPhone,
    vaka.customer?.phone,
    (vaka as { phone?: string | null }).phone,
    (vaka as { insuredPhone?: string | null }).insuredPhone,
  ];
  for (const candidate of directCandidates) {
    const phone = (candidate || '').trim();
    if (phone && phone !== '—') return phone;
  }
  const note = (vaka.notes || '').trim();
  const m = note.match(/(?:sigortal[ıi]\s*)?(?:telefon|tel|gsm|cep)\s*[:：]\s*([+\d\s()\-/]{7,})/i)
    || note.match(/(?:\+90|0)?\s*\(?\d{3}\)?[\s\-./]?\d{3}[\s\-./]?\d{2}[\s\-./]?\d{2}/);
  if (m?.[0] || m?.[1]) {
    const raw = (m[1] || m[0] || '').replace(/[^\d+]/g, '');
    if (raw.replace(/\D/g, '').length >= 10) return (m[1] || m[0]).trim();
  }
  return '—';
}

function fileOwnerContact(vaka: EmergencyCase): { name: string; phone: string; email: string } {
  const u = vaka.assignedUser;
  if (!u) return { name: '—', phone: '', email: '' };
  const name =
    `${u.firstName || ''} ${u.lastName || ''}`.trim()
    || (u as { fullName?: string | null }).fullName?.trim()
    || '—';
  return {
    name,
    phone: (u.phone || '').trim(),
    email: (u.email || '').trim(),
  };
}

function statusLabel(status: EmergencyStatus): string {
  const map: Record<EmergencyStatus, string> = {
    GELEN: 'İhbar',
    ATANDI: 'Tedarikçi Atandı',
    SAHADA: 'Saha',
    COZULDU: 'Dosya Kapatıldı',
    FATURALANDILDI: 'Finansa Aktarıldı',
  };
  return map[status];
}

function openWhatsApp(phone: string | null | undefined, text: string) {
  const url = toWhatsAppLink(phone, text) ?? `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ─── Inline Vendor Selector (Finans sekmesi) ─────────────────────────────────

interface VendorSelectorProps {
  value: VendorOption | null;
  onChange: (v: VendorOption | null) => void;
}

function VendorSelector({ value, onChange }: VendorSelectorProps) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<VendorOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', phone: '', identityNo: '', address: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchOptions = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await getEmergencyVendors(q || undefined);
      setOptions(res.data);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchOptions(search);
  }, [open, search, fetchOptions]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowAddForm(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleAddVendor(e?: React.SyntheticEvent) {
    if (e) e.preventDefault();
    if (!addForm.name.trim()) { setAddError('Bu alan zorunludur'); return; }
    if (!addForm.phone.trim()) { setAddError('Bu alan zorunludur'); return; }
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await createVendorQuick({
        name: addForm.name.trim(),
        phone: addForm.phone.trim(),
        identityNo: addForm.identityNo.trim() || undefined,
        address: addForm.address.trim() || undefined,
        type: 'hizmet',
        category: 'acil',
      });
      onChange(res.data);
      setOpen(false);
      setShowAddForm(false);
      setSearch('');
      setAddForm({ name: '', phone: '', identityNo: '', address: '' });
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setShowAddForm(false); }}
        className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-left flex items-center justify-between"
      >
        <span className={value ? 'text-slate-900' : 'text-slate-400'}>
          {value ? value.name : 'Tedarikçi Seçin (Opsiyonel)'}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onChange(null)}
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="text-slate-400 hover:text-status-danger text-xs ml-2 cursor-pointer"
          >
            ✕
          </span>
        ) : (
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-auto">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ara..."
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {showAddForm ? (
            <div className="p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600">Yeni Tedarikçi Ekle</p>
              {addError && <p className="text-xs text-red-600">{addError}</p>}
              <input
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ad *"
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
              />
              <input
                type="tel"
                value={addForm.phone}
                onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="Telefon *"
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
              />
              <div className="flex gap-2">
                <button type="button" onClick={handleAddVendor} disabled={addLoading} className="flex-1 py-1.5 bg-brand-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                  {addLoading ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
                <button type="button" onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg">
                  Geri
                </button>
              </div>
            </div>
          ) : (
            <>
              {loading ? (
                <div className="py-4 text-center text-xs text-slate-400">Yükleniyor...</div>
              ) : options.length === 0 ? (
                <div className="py-3 px-3 space-y-2 text-center">
                  <p className="text-xs text-slate-500">Sonuç bulunamadı</p>
                  <a
                    href="/panel/tedarikciler"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-xs font-semibold text-brand-600 hover:text-brand-700 underline-offset-2 hover:underline"
                  >
                    Tedarikçiler Sayfasından Ekleyin
                  </a>
                </div>
              ) : (
                options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { onChange(opt); setOpen(false); setSearch(''); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                  >
                    <span className="font-medium">{opt.name}</span>
                    {opt.phone && <span className="text-xs text-slate-400 ml-2">{opt.phone}</span>}
                  </button>
                ))
              )}
              <div className="border-t border-slate-100 p-2 space-y-1">
                <a
                  href="/panel/tedarikciler"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center text-xs font-semibold text-brand-600 hover:bg-blue-50 rounded-lg px-2 py-1.5"
                >
                  Tedarikçiler Sayfasına Git
                </a>
                <button type="button" onClick={() => setShowAddForm(true)} className="w-full text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg px-2 py-1.5">
                  Hızlı Tedarikçi Ekle
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const EMPTY_COST_FORM = { description: '', amount: '', entryDate: new Date().toISOString().slice(0, 10) };

export default function AcilDosyaDetayPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const roleCode = usePanelRoleCode();
  const canSeeOpsCost = canSeeAcilOpsCostFields(roleCode);

  const [vaka, setVaka] = useState<EmergencyCase | null>(null);
  const [costs, setCosts] = useState<EmergencyCostEntry[]>([]);
  const [costSummary, setCostSummary] = useState({ totalGelir: 0, totalGider: 0, netKar: 0 });
  const [loading, setLoading] = useState(true);

  const [vendorRecs, setVendorRecs] = useState<VendorRecommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);

  const [alisFiyati, setAlisFiyati] = useState('');
  const [satisFiyati, setSatisFiyati] = useState('');
  const [alisVatMode, setAlisVatMode] = useState<VatMode>('haric');
  const [satisVatMode, setSatisVatMode] = useState<VatMode>('haric');
  const [draftAlis, setDraftAlis] = useState('');
  const [draftSatis, setDraftSatis] = useState('');
  const [draftAlisVat, setDraftAlisVat] = useState<VatMode>('haric');
  const [draftSatisVat, setDraftSatisVat] = useState<VatMode>('haric');
  const [priceFormError, setPriceFormError] = useState<string | null>(null);
  const priceFormRef = useRef<HTMLDivElement | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalChannel, setApprovalChannel] = useState<ApprovalChannel>('whatsapp');
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalMsg, setApprovalMsg] = useState<string | null>(null);

  const [flow, setFlow] = useState<AcilLocalFlow>(emptyAcilLocalFlow);
  const [costEditDraft, setCostEditDraft] = useState('');
  const [showClosureEmail, setShowClosureEmail] = useState(false);
  const [closurePreview, setClosurePreview] = useState<ClosureEmailPreview | null>(null);
  const [closurePreviewLoading, setClosurePreviewLoading] = useState(false);
  const [closureSendBusy, setClosureSendBusy] = useState(false);
  const [closureSendError, setClosureSendError] = useState<string | null>(null);
  const [financeResult, setFinanceResult] = useState<string | null>(null);
  const [closeBusy, setCloseBusy] = useState(false);
  const [financeBusy, setFinanceBusy] = useState(false);
  const closeSubmitRef = useRef(false);
  const [opsActionBusy, setOpsActionBusy] = useState<'work_start' | 'service' | null>(null);
  const [actionFlash, setActionFlash] = useState<string | null>(null);

  const [showGelirForm, setShowGelirForm] = useState(false);
  const [gelirForm, setGelirForm] = useState(EMPTY_COST_FORM);
  const [gelirLoading, setGelirLoading] = useState(false);
  const [gelirError, setGelirError] = useState<string | null>(null);

  const [showGiderForm, setShowGiderForm] = useState(false);
  const [giderForm, setGiderForm] = useState(EMPTY_COST_FORM);
  const [giderVendor, setGiderVendor] = useState<VendorOption | null>(null);
  const [giderLoading, setGiderLoading] = useState(false);
  const [giderError, setGiderError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ description: '', amount: '', entryDate: '' });
  const [editVendor, setEditVendor] = useState<VendorOption | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [financeOptIn, setFinanceOptIn] = useState(false);
  const [showFileNotes, setShowFileNotes] = useState(false);

  const [whatsAppTab, setWhatsAppTab] = useState<WhatsAppPanelTab>('sigortali');
  const [altTab, setAltTab] = useState<AltBolumTab>('belgeler');
  /** Dosya Kapanış Resimleri — Fotoğraflar kapısı ile senkron */
  const [closurePhotoCount, setClosurePhotoCount] = useState(0);

  useEffect(() => {
    setClosurePhotoCount(0);
  }, [id]);
  const [vendorMsgPreview, setVendorMsgPreview] = useState<string | null>(null);
  const [vendorMsgErrors, setVendorMsgErrors] = useState<string[]>([]);
  const [customerMsgPreview, setCustomerMsgPreview] = useState<string | null>(null);
  const [customerMsgError, setCustomerMsgError] = useState<string | null>(null);
  const [insuredMsgPreview, setInsuredMsgPreview] = useState<{
    kind: InsuredWhatsAppKind;
    text: string;
  } | null>(null);
  const [insuredMessageTemplates, setInsuredMessageTemplates] = useState<{
    initial: string | null;
    closureSurvey: string | null;
  }>({ initial: null, closureSurvey: null });
  const [insuredMsgErrors, setInsuredMsgErrors] = useState<string[]>([]);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [forceAltVendor, setForceAltVendor] = useState(false);
  const [marginToast, setMarginToast] = useState<MarginWarning>(null);
  const marginToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showVatDetail, setShowVatDetail] = useState(false);
  /** Kayıtlı bütçe varken özet; Düzelt ile düzenleme açılır. */
  const [budgetEditing, setBudgetEditing] = useState(true);
  const [draftFindings, setDraftFindings] = useState('');
  const [findingsError, setFindingsError] = useState<string | null>(null);
  const [findingsSaving, setFindingsSaving] = useState(false);
  const findingsFormRef = useRef<HTMLDivElement | null>(null);
  const findingsTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const alisRef = useRef<number | null>(null);
  const satisRef = useRef<number | null>(null);

  const flashMarginWarning = useCallback((warning: MarginWarning) => {
    if (!warning) return;
    setMarginToast(warning);
    if (marginToastTimerRef.current) clearTimeout(marginToastTimerRef.current);
    marginToastTimerRef.current = setTimeout(() => {
      setMarginToast(null);
      marginToastTimerRef.current = null;
    }, 4500);
  }, []);

  useEffect(() => () => {
    if (marginToastTimerRef.current) clearTimeout(marginToastTimerRef.current);
  }, []);

  const persistFlow = useCallback((next: AcilLocalFlow) => {
    setFlow(next);
    if (id) writeAcilLocalFlow(id, next);
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [caseRes, costRes] = await Promise.all([getCase(id), getCostEntries(id)]);
      setVaka(caseRes.data);
      setDraftFindings(caseRes.data.findingsText ?? '');
      setFindingsError(null);
      setCosts(costRes.data);
      setCostSummary(costRes.summary);
      const gelir = costRes.data.find((c) => c.entryType === 'gelir');
      const gider = costRes.data.find((c) => c.entryType === 'gider');
      if (gelir) {
        const n = Number(gelir.amount);
        setSatisFiyati((prev) => prev || formatPriceInput(n));
        if (Number.isFinite(n)) satisRef.current = n;
      }
      if (gider) {
        const n = Number(gider.amount);
        setAlisFiyati((prev) => prev || formatPriceInput(n));
        if (Number.isFinite(n)) alisRef.current = n;
      }
    } catch {
      // sessiz
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (loading) return;
    setDraftAlis(alisFiyati);
    setDraftSatis(satisFiyati);
    setDraftAlisVat(alisVatMode);
    setDraftSatisVat(satisVatMode);
    const hasSaved =
      parsePriceInput(alisFiyati) > 0 || parsePriceInput(satisFiyati) > 0;
    setBudgetEditing(!hasSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca yükleme bitince taslağı doldur
  }, [loading, id]);

  useEffect(() => {
    if (!id) return;
    setFinanceOptIn(readHistoricalFinanceOptIn(id));
    const saved = readAcilLocalFlow(id);
    setFlow(saved);
    if (saved.detectedCostTl != null) setCostEditDraft(String(saved.detectedCostTl));
    if (saved.vendorProcess === 'reddedildi') setForceAltVendor(true);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      axios.get(`${SETTINGS_API}/notifications/sms/templates/whatsapp_acil_ilk_bilgilendirme`, {
        headers: settingsAuthHeader(),
      }),
      axios.get(`${SETTINGS_API}/notifications/sms/templates/whatsapp_acil_kapanis_anket`, {
        headers: settingsAuthHeader(),
      }),
    ])
      .then(([initialRes, closureRes]) => {
        if (cancelled) return;
        setInsuredMessageTemplates({
          initial: initialRes.data?.isActive ? initialRes.data.content : null,
          closureSurvey: closureRes.data?.isActive ? closureRes.data.content : null,
        });
      })
      .catch(() => {
        if (!cancelled) setInsuredMessageTemplates({ initial: null, closureSurvey: null });
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!id) return;
    setRecsLoading(true);
    getRecommendedVendors(id, 5)
      .then((res) => setVendorRecs(res.data ?? []))
      .catch(() => setVendorRecs([]))
      .finally(() => setRecsLoading(false));
  }, [id]);

  async function refreshCosts() {
    const res = await getCostEntries(id);
    setCosts(res.data);
    setCostSummary(res.summary);
  }

  async function handleAssignVendor(vendorId: string) {
    setAssignLoading(true);
    try {
      const res = await updateCase(id, { assignedVendorId: vendorId } as Partial<EmergencyCase>);
      setVaka(res.data);
      if (res.data.status === 'GELEN') {
        const statusRes = await updateCaseStatus(id, 'ATANDI');
        setVaka(statusRes.data);
      } else {
        await load();
      }
      setForceAltVendor(false);
      persistFlow(appendFlowHistory(
        { ...flow, vendorProcess: 'atama_gonderildi' },
        `Tedarikçi atandı: ${res.data.assignedVendor?.name ?? vendorId}`,
      ));
      setActionFlash('Tedarikçi atandı. WhatsApp ile gönderebilirsiniz.');
      setWhatsAppTab('tedarikci');
    } catch {
      // sessiz
    } finally {
      setAssignLoading(false);
    }
  }

  function syncPriceDraftsFromSaved() {
    setDraftAlis(alisFiyati);
    setDraftSatis(satisFiyati);
    setDraftAlisVat(alisVatMode);
    setDraftSatisVat(satisVatMode);
    setPriceFormError(null);
  }

  function applyDraftVatModeChange(field: 'alis' | 'satis', nextMode: VatMode) {
    if (field === 'alis') {
      const prev = draftAlisVat;
      if (prev === nextMode) return;
      const n = parsePriceInput(draftAlis);
      if (Number.isFinite(n) && n > 0) {
        setDraftAlis(formatPriceInput(convertPriceForVatMode(n, prev, nextMode)));
      }
      setDraftAlisVat(nextMode);
      return;
    }
    const prev = draftSatisVat;
    if (prev === nextMode) return;
    const n = parsePriceInput(draftSatis);
    if (Number.isFinite(n) && n > 0) {
      setDraftSatis(formatPriceInput(convertPriceForVatMode(n, prev, nextMode)));
    }
    setDraftSatisVat(nextMode);
  }

  function openBudgetEdit() {
    if (!ensureFindingsBeforeBudget()) return;
    syncPriceDraftsFromSaved();
    setBudgetEditing(true);
    setPriceFormError(null);
  }

  function cancelBudgetEdit() {
    syncPriceDraftsFromSaved();
    setBudgetEditing(false);
    setPriceFormError(null);
    setMarginToast(null);
  }

  function focusFindingsForm() {
    requestAnimationFrame(() => {
      findingsFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      findingsTextareaRef.current?.focus();
    });
  }

  function ensureFindingsBeforeBudget(): boolean {
    const text = draftFindings.trim() || (vaka?.findingsText || '').trim();
    if (!text) {
      setFindingsError('Tespit Bulguları zorunludur. Önce bulguları girin, sonra maliyet girin.');
      setPriceFormError('Önce Tespit Bulguları girilmelidir.');
      focusFindingsForm();
      return false;
    }
    setFindingsError(null);
    if (draftFindings.trim() && draftFindings.trim() !== (vaka?.findingsText || '').trim()) {
      void saveFindingsText();
    }
    return true;
  }

  async function saveFindingsText(): Promise<boolean> {
    const text = draftFindings.trim();
    if (!text) {
      setFindingsError('Tespit Bulguları zorunludur.');
      return false;
    }
    if (!id) return false;
    if ((vaka?.findingsText || '').trim() === text) {
      setFindingsError(null);
      return true;
    }
    setFindingsSaving(true);
    try {
      const res = await updateCase(id, { findingsText: text } as Partial<EmergencyCase>);
      setVaka(res.data);
      setDraftFindings(res.data.findingsText ?? text);
      setFindingsError(null);
      return true;
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Tespit Bulguları kaydedilemedi.');
      reportCaughtError(err, msg);
      setFindingsError(msg);
      return false;
    } finally {
      setFindingsSaving(false);
    }
  }

  function focusPriceForm() {
    if (!ensureFindingsBeforeBudget()) return;
    openBudgetEdit();
    requestAnimationFrame(() => {
      priceFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const preferAlis = canSeeOpsCost
        ? priceFormRef.current?.querySelector<HTMLInputElement>('[data-testid="alis-fiyati"]')
        : null;
      const el = preferAlis
        ?? priceFormRef.current?.querySelector<HTMLInputElement>('[data-testid="satis-fiyati"]');
      el?.focus();
    });
  }

  /** @returns true if fiyat kaydı geçerli ve uygulandı (veya değişiklik yok ama form geçerli) */
  function savePriceForm(): boolean {
    if (!ensureFindingsBeforeBudget()) {
      return false;
    }
    if (!requireAssignedVendor()) {
      setPriceFormError('İlerlemek İçin Tedarikçi Seçimi Zorunludur.');
      return false;
    }
    const alisN = parsePriceInput(draftAlis);
    const satisN = parsePriceInput(draftSatis);
    const hasAlisInput = Boolean(draftAlis.trim());
    const hasSatisInput = Boolean(draftSatis.trim());

    if (canSeeOpsCost && hasAlisInput && (!Number.isFinite(alisN) || alisN <= 0)) {
      setPriceFormError('Geçerli bir alış fiyatı girin.');
      return false;
    }
    if (hasSatisInput && (!Number.isFinite(satisN) || satisN <= 0)) {
      setPriceFormError('Geçerli bir satış fiyatı girin.');
      return false;
    }
    if (canSeeOpsCost && !hasAlisInput && !hasSatisInput) {
      setPriceFormError('En az bir fiyat girin.');
      return false;
    }
    if (!canSeeOpsCost && !hasSatisInput) {
      setPriceFormError('Geçerli bir satış fiyatı girin.');
      return false;
    }

    let nextFlow = flow;
    let changed = false;

    if (canSeeOpsCost && hasAlisInput && Number.isFinite(alisN) && alisN > 0) {
      setAlisFiyati(formatPriceInput(alisN));
      setAlisVatMode(draftAlisVat);
      const prev = alisRef.current;
      if (prev == null || Math.abs(prev - alisN) >= 0.005) {
        nextFlow = appendPriceChange(nextFlow, 'alis', prev, alisN);
        changed = true;
      }
      alisRef.current = alisN;
    } else if (canSeeOpsCost) {
      setAlisVatMode(draftAlisVat);
    }

    if (hasSatisInput && Number.isFinite(satisN) && satisN > 0) {
      setSatisFiyati(formatPriceInput(satisN));
      setSatisVatMode(draftSatisVat);
      const prev = satisRef.current;
      if (prev == null || Math.abs(prev - satisN) >= 0.005) {
        nextFlow = appendPriceChange(nextFlow, 'satis', prev, satisN);
        changed = true;
      }
      satisRef.current = satisN;
    } else {
      setSatisVatMode(draftSatisVat);
    }

    if (changed) {
      persistFlow(nextFlow);
      setActionFlash('Fiyat kaydedildi.');
    }
    if (canSeeOpsCost) {
      const warn = getMarginWarning(
        calcMarginPercent(alisN, draftAlisVat, satisN, draftSatisVat),
      );
      if (warn) flashMarginWarning(warn);
    }
    setPriceFormError(null);
    setBudgetEditing(false);
    return true;
  }

  function savePriceFormAndClose() {
    if (!savePriceForm()) return;
    router.push('/panel/acil-yardim');
  }

  function requestVendorWhatsAppSend() {
    if (!vaka) return;
    setVendorMsgErrors([]);
    setVendorMsgPreview(null);
    const vendorPhone = vaka.assignedVendor?.phone;
    const guard = validateVendorMessageGuard({
      hasVendor: Boolean(vaka.assignedVendorId),
      vendorPhone,
      address: vaka.address,
      issueType: vaka.issueType,
    });
    if (!guard.ok) {
      setVendorMsgErrors(guard.errors);
      setWhatsAppTab('tedarikci');
      setActionFlash(guard.errors[0] ?? 'Mesaj gönderilemedi');
      return;
    }
    const fileNo = vaka.fileNo || vaka.caseNo;
    const insuredPhone = insuredPhoneLabel(vaka);
    const text = buildVendorWhatsAppText({
      fileNo,
      issueType: vaka.issueType,
      insuredLabel: insuredLabel(vaka),
      phone: insuredPhone === '—' ? '' : insuredPhone,
      address: vaka.address,
      city: vaka.city,
      district: vaka.district,
      notes: vaka.notes,
    });
    setVendorMsgPreview(text);
    setWhatsAppTab('tedarikci');
  }

  function confirmVendorWhatsAppSend() {
    if (!vaka || !vendorMsgPreview) return;
    const vendorPhone = vaka.assignedVendor?.phone;
    openWhatsApp(vendorPhone, vendorMsgPreview);
    let next = appendMessageLog(flow, 'vendor', vendorMsgPreview);
    if (next.vendorProcess == null || next.vendorProcess === 'atama_gonderildi') {
      next = { ...next, vendorProcess: 'atama_gonderildi' };
    }
    if (next.detectedCostTl == null && !next.costConfirmed) {
      next = { ...next, detectedCostTl: 2500 };
      setCostEditDraft('2500');
    }
    persistFlow(next);
    setVendorMsgPreview(null);
    setActionFlash('WhatsApp mesajı hazırlandı. Geçmişe kaydedildi.');
  }

  function requestCustomerGroupWhatsAppSend() {
    if (!vaka) return;
    setCustomerMsgError(null);
    setCustomerMsgPreview(null);
    try {
      const fileNo = vaka.fileNo || vaka.caseNo;
      const sale = parsePriceInput(satisFiyati) || costSummary.totalGelir || null;
      const text = buildCustomerGroupWhatsAppText({
        fileNo,
        issueType: vaka.issueType,
        insuredLabel: insuredLabel(vaka),
        salePrice: sale && sale > 0 ? sale : null,
        statusLabel: ACIL_STAGES[deriveAcilStageIndex({
          status: vaka.status,
          hasVendor: Boolean(vaka.assignedVendorId),
          hasAlis: costSummary.totalGider > 0 || flow.costConfirmed || parsePriceInput(alisFiyati) > 0,
          flow,
        })]?.label ?? statusLabel(vaka.status),
      });
      setCustomerMsgPreview(text);
      setWhatsAppTab('musteri');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Müşteri mesajı oluşturulamadı';
      setCustomerMsgError(msg);
      setActionFlash(msg);
    }
  }

  function confirmCustomerGroupWhatsAppSend() {
    if (!vaka || !customerMsgPreview) return;
    const insuredPhone = insuredPhoneLabel(vaka);
    const groupPhone = insuredPhone === '—' ? undefined : insuredPhone;
    openWhatsApp(groupPhone, customerMsgPreview);
    persistFlow(appendMessageLog(flow, 'customer', customerMsgPreview));
    setCustomerMsgPreview(null);
    setActionFlash('Müşteri grubu mesajı hazırlandı. Alış / kâr gönderilmez.');
  }

  function requestInsuredWhatsAppSend(kind: InsuredWhatsAppKind) {
    if (!vaka) return;
    setInsuredMsgErrors([]);
    setInsuredMsgPreview(null);
    const owner = fileOwnerContact(vaka);
    const insuredPhone = insuredPhoneLabel(vaka);
    const phoneRaw = insuredPhone === '—' ? '' : insuredPhone;
    const guard = validateInsuredWhatsAppGuard({
      insuredPhone: phoneRaw,
      assignedUserPhone: owner.phone,
      requireAssignedPhone: kind === 'initial',
    });
    if (!guard.ok) {
      setInsuredMsgErrors(guard.errors);
      setWhatsAppTab('sigortali');
      setAltTab('whatsapp');
      setActionFlash(guard.errors[0] ?? 'Mesaj gönderilemedi');
      return;
    }
    const fileNo = vaka.fileNo || vaka.caseNo;
    try {
      const text = kind === 'initial'
        ? buildInsuredInitialWhatsAppText({
          assignedUserPhone: owner.phone,
          assignedUserName: owner.name,
          fileNo,
          insuredLabel: insuredLabel(vaka),
          issueType: vaka.issueType,
          template: insuredMessageTemplates.initial,
        })
        : buildInsuredClosureSurveyWhatsAppText({
          fileNo,
          insuredLabel: insuredLabel(vaka),
          assignedUserName: owner.name,
          assignedUserPhone: owner.phone,
          issueType: vaka.issueType,
          surveyUrl: null,
          template: insuredMessageTemplates.closureSurvey,
        });
      setInsuredMsgPreview({ kind, text });
      setWhatsAppTab('sigortali');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sigortalı mesajı oluşturulamadı';
      setInsuredMsgErrors([msg]);
      setActionFlash(msg);
    }
  }

  function confirmInsuredWhatsAppSend() {
    if (!vaka || !insuredMsgPreview) return;
    const insuredPhone = insuredPhoneLabel(vaka);
    const phoneRaw = insuredPhone === '—' ? undefined : insuredPhone;
    openWhatsApp(phoneRaw, insuredMsgPreview.text);
    const logKind = insuredMsgPreview.kind === 'initial' ? 'insured_initial' : 'insured_closure';
    let next = appendMessageLog(flow, logKind, insuredMsgPreview.text);
    if (insuredMsgPreview.kind === 'initial') {
      next = { ...next, insuredInitialWhatsAppSent: true };
    } else {
      next = { ...next, insuredClosureSurveyWhatsAppSent: true };
    }
    persistFlow(next);
    setInsuredMsgPreview(null);
    setInsuredMsgErrors([]);
    setActionFlash(
      insuredMsgPreview.kind === 'initial'
        ? 'İlk bilgilendirme mesajı hazırlandı. Geçmişe kaydedildi.'
        : 'Kapanış / anket mesajı hazırlandı. Geçmişe kaydedildi.',
    );
  }

  /** Eski tek tık — guard + önizleme akışına yönlendirir */
  function handleWhatsAppSend() {
    requestVendorWhatsAppSend();
  }

  async function confirmDetectedCost() {
    const amount = Number(costEditDraft || flow.detectedCostTl || 0);
    if (!amount || amount <= 0) {
      setActionFlash('Geçerli bir tutar girin');
      return;
    }
    setAlisFiyati(formatPriceInput(amount));
    const hasGider = costs.some((c) => c.entryType === 'gider');
    if (!hasGider) {
      try {
        await addCostEntry(id, {
          entryType: 'gider',
          description: 'Tedarikçi Alış Fiyatı',
          amount,
          entryDate: new Date().toISOString().slice(0, 10),
          vendorId: vaka?.assignedVendorId ?? undefined,
        });
        await refreshCosts();
      } catch {
        /* lokal alan yine set */
      }
    }
    persistFlow(appendFlowHistory(
      { ...flow, costConfirmed: true, detectedCostTl: amount },
      `Tedarikçi maliyeti onaylandı: ${fmtCurrency(amount)}`,
    ));
    setActionFlash('Tedarikçi maliyeti onaylandı.');
  }

  function rejectDetectedCost() {
    setCostEditDraft(String(flow.detectedCostTl ?? ''));
    setActionFlash('Tutarı düzeltip onaylayın. Aşama otomatik değişmez.');
  }

  function requireAssignedVendor(): boolean {
    if (vaka?.assignedVendorId) return true;
    setActionFlash('İlerlemek İçin Tedarikçi Seçimi Zorunludur.');
    return false;
  }

  function openApprovalModal() {
    if (!requireAssignedVendor()) return;
    setShowApprovalModal(true);
    setApprovalMsg(null);
  }

  async function handleApprovalSubmit() {
    if (!requireAssignedVendor()) {
      setShowApprovalModal(false);
      return;
    }
    setApprovalBusy(true);
    setApprovalMsg(null);
    try {
      const alis = parsePriceInput(alisFiyati);
      const satis = parsePriceInput(satisFiyati);
      if (!alisFiyati || isNaN(alis) || alis <= 0) {
        setApprovalMsg('Tedarikçi alış fiyatı girin');
        return;
      }
      if (!satisFiyati || isNaN(satis) || satis <= 0) {
        setApprovalMsg('Meridyen satış fiyatı girin');
        return;
      }

      const hasGider = costs.some((c) => c.entryType === 'gider');
      const hasGelir = costs.some((c) => c.entryType === 'gelir');
      const today = new Date().toISOString().slice(0, 10);

      if (!hasGider) {
        await addCostEntry(id, {
          entryType: 'gider',
          description: 'Tedarikçi Alış Fiyatı',
          amount: alis,
          entryDate: today,
          vendorId: vaka?.assignedVendorId ?? undefined,
        });
      }
      if (!hasGelir) {
        await addCostEntry(id, {
          entryType: 'gelir',
          description: 'Meridyen Satış Fiyatı',
          amount: satis,
          entryDate: today,
        });
      }
      await refreshCosts();
      await load();

      const channelLabel =
        approvalChannel === 'whatsapp' ? 'WhatsApp'
        : approvalChannel === 'email' ? 'E-posta'
        : 'WhatsApp + E-posta';
      const next = appendFlowHistory(
        {
          ...flow,
          costConfirmed: true,
          approvalRequested: true,
          approvalDetected: true,
        },
        `Onay talebi oluşturuldu (${channelLabel})`,
      );
      persistFlow(next);
      setApprovalMsg(`Onay talebi oluşturuldu (${channelLabel}).`);
      setShowApprovalModal(false);
      setActionFlash(`Onay talebi: ${channelLabel}`);
    } catch (err: any) {
      setApprovalMsg(err.message ?? 'Onay talebi oluşturulamadı');
    } finally {
      setApprovalBusy(false);
    }
  }

  function handleCustomerApproval(accept: boolean) {
    if (!requireAssignedVendor()) return;
    if (accept) {
      persistFlow(appendFlowHistory(
        { ...flow, customerApproved: true, approvalDetected: false },
        'Müşteri onayı kaydedildi',
      ));
      setActionFlash('Müşteri onayı kaydedildi. İşe başlama mesajı hazırlayabilirsiniz.');
    } else {
      persistFlow(appendFlowHistory(
        { ...flow, approvalDetected: false, approvalRequested: true },
        'Onay reddedildi / düzeltme bekleniyor',
      ));
      setActionFlash('Onay kaydedilmedi. Gerekirse yeni onay talebi oluşturun.');
    }
  }

  async function handleWorkStartMessage() {
    if (!vaka || opsActionBusy) return;
    if (!requireAssignedVendor()) return;
    if (!flow.customerApproved) {
      setActionFlash('Önce müşteri onayını kaydedin.');
      return;
    }
    if (flow.workStartPrepared) {
      setActionFlash('İşe başlama mesajı zaten hazırlandı.');
      return;
    }
    setOpsActionBusy('work_start');
    try {
      const fileNo = vaka.fileNo || vaka.caseNo;
      const text = buildWorkStartWhatsAppText(fileNo, vaka.issueType);
      const vendorPhone = vaka.assignedVendor?.phone ?? null;
      openWhatsApp(vendorPhone, text);
      if (vaka.status === 'ATANDI' || vaka.status === 'GELEN') {
        try {
          const res = await updateCaseStatus(id, 'SAHADA');
          setVaka(res.data);
        } catch {
          /* yerel akış yine ilerler */
        }
      }
      persistFlow(appendFlowHistory(
        { ...flow, workStartPrepared: true },
        'İşe başlama mesajı hazırlandı',
      ));
      setActionFlash('İşe başlama mesajı hazırlandı.');
      await load();
    } finally {
      setOpsActionBusy(null);
    }
  }

  async function handleServiceComplete() {
    if (!vaka || opsActionBusy) return;
    if (!requireAssignedVendor()) return;
    if (flow.serviceCompleted) {
      setActionFlash('Hizmet zaten tamamlandı olarak işaretli.');
      return;
    }
    if (!flow.workStartPrepared && deriveAcilStageIndex({
      status: vaka.status,
      hasVendor: Boolean(vaka.assignedVendorId),
      hasAlis: true,
      flow,
    }) < 4) {
      setActionFlash('Önce işe başlama adımını tamamlayın.');
      return;
    }
    setOpsActionBusy('service');
    try {
      if (vaka.status === 'ATANDI' || vaka.status === 'GELEN') {
        try {
          const res = await updateCaseStatus(id, 'SAHADA');
          setVaka(res.data);
        } catch {
          /* yerel akış yine ilerler */
        }
      }
      persistFlow(appendFlowHistory(
        { ...flow, serviceCompleted: true, workStartPrepared: true },
        'Hizmet tamamlandı',
      ));
      setActionFlash('Hizmet tamamlandı olarak işaretlendi.');
      await load();
    } finally {
      setOpsActionBusy(null);
    }
  }

  async function openClosureEmailModal() {
    setShowClosureEmail(true);
    setClosureSendError(null);
    setClosurePreviewLoading(true);
    try {
      const res = await previewClosureEmail(id);
      setClosurePreview(res.data);
    } catch (err: any) {
      setClosurePreview(null);
      setClosureSendError(err?.message ?? 'Kapanış e-postası hazırlanamadı');
    } finally {
      setClosurePreviewLoading(false);
    }
  }

  async function handleSendClosureEmail() {
    setClosureSendBusy(true);
    setClosureSendError(null);
    try {
      const res = await sendClosureEmail(id);
      if (!res.data.sent) {
        setClosureSendError(res.data.errorMsg || 'E-posta gönderilemedi');
        return;
      }
      const sentTo =
        (res.data.recipients?.length ? res.data.recipients.join(', ') : res.data.to) || '—';
      persistFlow(appendFlowHistory(
        { ...flow, closureEmailSent: true },
        `Kapanış e-postası gönderildi → ${sentTo}`,
      ));
      setShowClosureEmail(false);
      setActionFlash(`Kapanış e-postası asistans firmasına gönderildi (${sentTo}).`);
    } catch (err: any) {
      setClosureSendError(err?.message ?? 'E-posta gönderilemedi');
    } finally {
      setClosureSendBusy(false);
    }
  }

  async function handleCloseAndFinance(allowIncomplete = false) {
    if (closeSubmitRef.current || closeBusy || financeBusy) return;
    if (!requireAssignedVendor()) {
      setConfirmAction(null);
      return;
    }
    const saleOk = parsePriceInput(satisFiyati) > 0 || costSummary.totalGelir > 0;
    const needsClose = !(
      flow.fileClosed || vaka?.status === 'COZULDU' || vaka?.status === 'FATURALANDILDI'
    );
    const gate = evaluateCloseFinanceGate({
      docs: vaka?.operationChain?.documents,
      inbox: vaka?.operationChain?.inbox,
      uploadedPhotoCount: closurePhotoCount,
      flow,
      saleReady: saleOk,
    });
    const skippedLabels = gate.missingLabels;
    if (!gate.closeReady && !allowIncomplete) {
      setActionFlash(
        skippedLabels.length
          ? `Eksik işlemler: ${skippedLabels.join(', ')}.`
          : 'Kapanış öncesi kontroller tamamlanmadan dosya kapatılamaz.',
      );
      setConfirmAction(null);
      return;
    }

    closeSubmitRef.current = true;
    setCloseBusy(true);
    setFinanceBusy(true);
    setFinanceResult(null);
    try {
      if (needsClose) {
        const closeRes = await updateCaseStatus(id, 'COZULDU');
        setVaka(closeRes.data);
        persistFlow(appendFlowHistory(
          { ...flow, fileClosed: true, serviceCompleted: true },
          'Dosya kapatıldı',
        ));
      }

      const financeRes = await updateCaseStatus(id, 'FATURALANDILDI');
      setVaka(financeRes.data);
      const claimBlocked = Boolean(financeRes.data.operationChain?.constraints?.vendorStatementRequiresClaimFile);
      const blockers = financeRes.data.operationChain?.blockerReasons ?? [];
      const hakedisBlocked = claimBlocked || blockers.some((b) => /hakediş|claimFile|cari/i.test(b));
      const result = hakedisBlocked
        ? 'Dosya kapatıldı ve finansa gönderildi. Tedarikçi hakedişi ve cari bağlantısı bu dosya için henüz tamamlanamadı.'
        : 'Dosya kapatıldı ve finansa gönderildi.';
      setFinanceResult(result);
      let auditText: string | null = null;
      let auditSaved = true;
      if (allowIncomplete && skippedLabels.length > 0) {
        const operator = currentOperator();
        const at = new Date().toISOString();
        const action = needsClose
          ? 'dosya kapanışını gerçekleştirdi ve dosyayı finansa gönderdi'
          : 'dosyayı finansa gönderdi';
        auditText = `${fmtDateTime(at)} — ${operator.name} (${operator.identity}), ${formatTurkishList(skippedLabels)} işlemlerini tamamlamadan ${action}.`;
        try {
          const existingNotes = (financeRes.data.notes || '').trim();
          const auditRes = await updateCase(id, {
            notes: [existingNotes, auditText].filter(Boolean).join('\n\n'),
          });
          setVaka(auditRes.data);
        } catch {
          auditSaved = false;
        }
      }
      persistFlow(appendFlowHistory(
        {
          ...flow,
          fileClosed: true,
          serviceCompleted: true,
          financeTransferred: true,
          vendorProcess: 'fatura_bekleniyor',
        },
        auditText || result,
      ));
      setConfirmAction(null);
      setActionFlash(
        auditSaved
          ? auditText
            ? `${result} Eksik işlem onayı dosya geçmişine kaydedildi.`
            : result
          : `${result} Dosya geçmişi kaydı eklenemedi.`,
      );
      await load();
    } catch (err: any) {
      const msg = err?.message ?? 'Dosya kapatma / finansa gönderme başarısız';
      setFinanceResult(msg);
      setActionFlash(msg);
      setConfirmAction(null);
    } finally {
      closeSubmitRef.current = false;
      setCloseBusy(false);
      setFinanceBusy(false);
    }
  }

  async function handleAddGelir(e: React.FormEvent) {
    e.preventDefault();
    if (!gelirForm.description.trim()) { setGelirError('Açıklama zorunludur'); return; }
    if (!gelirForm.amount || isNaN(Number(gelirForm.amount)) || Number(gelirForm.amount) <= 0) { setGelirError('Geçerli bir tutar girin'); return; }
    setGelirLoading(true);
    setGelirError(null);
    try {
      await addCostEntry(id, {
        entryType: 'gelir',
        description: gelirForm.description.trim(),
        amount: Number(gelirForm.amount),
        entryDate: gelirForm.entryDate,
      });
      setGelirForm(EMPTY_COST_FORM);
      setShowGelirForm(false);
      await refreshCosts();
    } catch (err: any) {
      setGelirError(err.message ?? 'Bir hata oluştu');
    } finally {
      setGelirLoading(false);
    }
  }

  async function handleAddGider(e: React.FormEvent) {
    e.preventDefault();
    if (!giderForm.description.trim()) { setGiderError('Açıklama zorunludur'); return; }
    if (!giderForm.amount || isNaN(Number(giderForm.amount)) || Number(giderForm.amount) <= 0) { setGiderError('Geçerli bir tutar girin'); return; }
    setGiderLoading(true);
    setGiderError(null);
    try {
      await addCostEntry(id, {
        entryType: 'gider',
        description: giderForm.description.trim(),
        amount: Number(giderForm.amount),
        entryDate: giderForm.entryDate,
        vendorId: giderVendor?.id,
      });
      setGiderForm(EMPTY_COST_FORM);
      setGiderVendor(null);
      setShowGiderForm(false);
      await refreshCosts();
    } catch (err: any) {
      setGiderError(err.message ?? 'Bir hata oluştu');
    } finally {
      setGiderLoading(false);
    }
  }

  async function handleDeleteCost(costId: string) {
    if (!confirm('Bu kaydı silmek istiyor musunuz?')) return;
    try {
      await deleteCostEntry(id, costId);
      await refreshCosts();
    } catch { /* sessiz */ }
  }

  function handleStartEdit(c: EmergencyCostEntry) {
    setEditingId(c.id);
    setEditForm({
      description: c.description,
      amount: String(c.amount),
      entryDate: c.entryDate.slice(0, 10),
    });
    setEditVendor(c.vendor ? { id: c.vendor.id, name: c.vendor.name } : null);
    setEditError(null);
  }

  async function handleSaveEdit(e: React.FormEvent, c: EmergencyCostEntry) {
    e.preventDefault();
    if (!editForm.description.trim()) { setEditError('Açıklama zorunludur'); return; }
    if (!editForm.amount || isNaN(Number(editForm.amount)) || Number(editForm.amount) <= 0) { setEditError('Geçerli bir tutar girin'); return; }
    setEditLoading(true);
    setEditError(null);
    try {
      await updateCostEntry(id, c.id, {
        description: editForm.description.trim(),
        amount: Number(editForm.amount),
        entryDate: editForm.entryDate,
        vendorId: c.entryType === 'gider' ? (editVendor?.id ?? null) : undefined,
      });
      setEditingId(null);
      await refreshCosts();
    } catch (err: any) {
      setEditError(err.message ?? 'Bir hata oluştu');
    } finally {
      setEditLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!vaka) {
    return <div className="text-center py-20 text-slate-500">Dosya bulunamadı.</div>;
  }

  const isHistorical = isHistoricalEmergencyFile(vaka.createdAt, vaka.fileDate);
  const historicalExempt = isHistorical && !financeOptIn;
  const hasAlis = costSummary.totalGider > 0 || flow.costConfirmed || parsePriceInput(alisFiyati) > 0;
  const stageIdx = deriveAcilStageIndex({
    status: vaka.status,
    hasVendor: Boolean(vaka.assignedVendorId),
    hasAlis,
    flow,
  });
  const task = historicalExempt
    ? { title: 'Dosya Takibi', detail: 'Yeni finans akışı, hakediş ve cari zorunlu değildir.' }
    : stageTaskTitle(stageIdx);
  const owner = fileOwnerContact(vaka);
  const assigneeName = owner.name;
  const assigneeInitials = assigneeName !== '—' ? personInitials(assigneeName) : '—';
  const assigneeContact = [owner.phone, owner.email].filter(Boolean).join(' · ');
  const addressDisplay = [
    vaka.address,
    vaka.city || null,
  ].filter(Boolean).join(', ') + (vaka.district ? ` / ${vaka.district}` : '') || '—';
  const karOrani = costSummary.totalGelir > 0
    ? ((costSummary.netKar / costSummary.totalGelir) * 100)
    : 0;
  const displayAlis = budgetEditing ? draftAlis : alisFiyati;
  const displaySatis = budgetEditing ? draftSatis : satisFiyati;
  const displayAlisVat = budgetEditing ? draftAlisVat : alisVatMode;
  const displaySatisVat = budgetEditing ? draftSatisVat : satisVatMode;
  const draftKarPct = calcMarginPercent(
    parsePriceInput(displayAlis),
    displayAlisVat,
    parsePriceInput(displaySatis),
    displaySatisVat,
  );
  const draftAlisNet = priceToNet(parsePriceInput(displayAlis), displayAlisVat);
  const draftSatisNet = priceToNet(parsePriceInput(displaySatis), displaySatisVat);
  const draftKarTutari =
    Number.isFinite(draftAlisNet) && Number.isFinite(draftSatisNet) && draftAlisNet > 0
      ? draftSatisNet - draftAlisNet
      : null;
  // Kâr uyarısı formda sürekli değil; yalnızca Kaydet’te (limit aşımında) geçici toast.
  const fileNo = vaka.fileNo || vaka.caseNo;
  const phone = insuredPhoneLabel(vaka);
  const insured = insuredLabel(vaka);
  const guncelDurum = ACIL_STAGES[stageIdx]?.label ?? statusLabel(vaka.status);
  const showCostDetect = Boolean(vaka.assignedVendorId) && flow.detectedCostTl != null && !flow.costConfirmed;
  const showApprovalDetect = flow.approvalDetected && !flow.customerApproved;
  const vendorPhoneRaw = vaka.assignedVendor?.phone ?? '';
  const vendorPhoneOk = isValidVendorPhone(vendorPhoneRaw);
  const messageHistory = (flow.messageLog?.length
    ? flow.messageLog
    : flow.history.map((h) => ({ at: h.at, kind: 'system' as const, text: h.text }))
  );
  const docs = vaka.operationChain?.documents;
  const inbox = vaka.operationChain?.inbox;
  const saleReady = parsePriceInput(satisFiyati) > 0 || costSummary.totalGelir > 0;
  const closeGate = evaluateCloseFinanceGate({
    docs,
    inbox,
    uploadedPhotoCount: closurePhotoCount,
    flow,
    saleReady,
  });
  const requiredOps = closeGate.requiredOps;
  const requiredOpsComplete = closeGate.requiredOpsComplete;
  const fileAlreadyClosed =
    flow.fileClosed || vaka.status === 'COZULDU' || vaka.status === 'FATURALANDILDI';
  const financeDone = flow.financeTransferred || vaka.status === 'FATURALANDILDI';
  const showCloseFinanceBlock =
    (!fileAlreadyClosed && (flow.workStartPrepared || flow.serviceCompleted || stageIdx >= 4))
    || (fileAlreadyClosed && !financeDone);
  /** Eksik kapanış işlemleri onayla geçilebilir; tedarikçi seçimi hiçbir zaman geçilemez. */
  const closeFinanceReady =
    !financeDone && showCloseFinanceBlock && Boolean(vaka.assignedVendorId);
  const closeFinanceBusy = closeBusy || financeBusy;
  const dosyaKonusuLabel = resolveClaimDosyaKonusu({ lossType: vaka.issueType }) || '—';
  const requiredOpsItems = closeGate.items;
  const missingCloseLabels = closeGate.missingLabels;

  const approvalDone = flow.approvalRequested || flow.customerApproved;
  const workStartDone = flow.workStartPrepared;
  const serviceDone = flow.serviceCompleted || fileAlreadyClosed;
  const initialNotifyDone = requiredOps.insuredInitialNotify;
  const closureSurveyDone = requiredOps.insuredClosureSurvey;
  /** Kapanış anketi: hizmet tamamlandıktan sonra (kapanış kapısı öncesi) */
  const closureSurveyUnlocked = serviceDone || stageIdx >= 5;
  const opsVisual = {
    initialNotify: (initialNotifyDone
      ? 'completed'
      : 'next') as QuickActionVisualState,
    approval: (approvalDone
      ? 'completed'
      : !vaka.assignedVendorId
        ? 'waiting'
        : 'next') as QuickActionVisualState,
    workStart: (workStartDone
      ? 'completed'
      : flow.customerApproved
        ? 'next'
        : 'waiting') as QuickActionVisualState,
    service: (serviceDone
      ? 'completed'
      : workStartDone || stageIdx >= 4
        ? 'next'
        : 'waiting') as QuickActionVisualState,
    closureSurvey: (closureSurveyDone
      ? 'completed'
      : closureSurveyUnlocked
        ? 'next'
        : 'waiting') as QuickActionVisualState,
  };

  function handleHistoricalFinanceOptIn() {
    writeHistoricalFinanceOptIn(id, true);
    setFinanceOptIn(true);
  }

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/panel/operasyon?filter=acil');
  }

  return (
    <div className="max-w-7xl mx-auto space-y-2 pb-24 sm:pb-8 overflow-x-hidden" data-testid="acil-dosya-detay">
      {/* Üst menü (Hızlı İşlem / Yardım / Tema / kullanıcı) layout’ta — sayfa içi chrome yok */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={handleBack}
          className="shrink-0 text-slate-400 hover:text-slate-700 text-sm"
          data-testid="acil-dosya-geri"
        >
          ← Geri
        </button>
        <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate" data-testid="acil-dosya-sayfa-basligi">
          Acil Yardım - Dosya Detayı
        </h1>
      </div>

      {/* 1. Dosya Bilgileri — yalnızca üst bilgi */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-2.5 sm:p-3" data-testid="dosya-basligi">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Müşteri</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900 truncate" title={customerLabel(vaka)}>
              {customerLabel(vaka)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Sigortalı</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800 truncate" title={insured}>{insured}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Dosya No</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800 font-mono truncate">{fileNo}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Dosya Konusu</p>
            <p className="mt-0.5 text-sm font-semibold text-brand-600 truncate" title={dosyaKonusuLabel}>
              {dosyaKonusuLabel}
            </p>
          </div>
          <div className="min-w-0 col-span-2 sm:col-span-1 lg:col-span-2">
            <p className="text-xs text-slate-400">Adres</p>
            <p className="mt-0.5 text-sm font-medium text-slate-800 leading-snug line-clamp-2" title={addressDisplay}>
              {addressDisplay}
            </p>
          </div>
          <div className="min-w-0" data-testid="sigortali-telefon">
            <p className="text-xs text-slate-400">Sigortalı Telefon</p>
            {phone !== '—' ? (
              <a
                href={`tel:${phone.replace(/\s/g, '')}`}
                className="mt-0.5 block text-sm font-medium text-slate-800 truncate hover:text-blue-700 hover:underline tabular-nums"
                title={phone}
              >
                {phone}
              </a>
            ) : (
              <p className="mt-0.5 text-sm font-medium text-slate-800 truncate" title={phone}>{phone}</p>
            )}
          </div>
          <div className="min-w-0" data-testid="dosya-sorumlusu">
            <p className="text-xs text-slate-400">Dosya Sorumlusu</p>
            <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
              {assigneeName !== '—' ? (
                <span
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[8px] font-bold text-white"
                  aria-hidden
                >
                  {assigneeInitials}
                </span>
              ) : null}
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{assigneeName}</p>
                {assigneeContact ? (
                  <p className="text-[10px] text-slate-500 truncate" title={assigneeContact}>
                    {assigneeContact}
                  </p>
                ) : assigneeName !== '—' ? (
                  <p className="text-[10px] text-slate-400">—</p>
                ) : null}
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Güncel Durum</p>
            <p className="mt-0.5 text-sm font-bold text-brand-600 leading-snug" data-testid="guncel-durum">
              {guncelDurum}
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFileNotes(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            data-testid="dosya-notlari-btn"
          >
            Dosya Notları
          </button>
        </div>

        {isHistorical && historicalExempt && (
          <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="tarihsel-dosya-muafiyet">
            <p className="text-[11px] text-slate-500">
              01.07.2026 öncesi dosya — yeni finans akışı zorunlu değil.
            </p>
            <button
              type="button"
              onClick={handleHistoricalFinanceOptIn}
              className="text-[11px] font-medium text-blue-700 hover:text-blue-800 underline-offset-2 hover:underline"
              data-testid="tarihsel-finans-optin"
            >
              Yeni Finans Dönemine Dahil Et
            </button>
          </div>
        )}
        {isHistorical && financeOptIn && (
          <p className="mt-2 text-[11px] text-emerald-700" data-testid="tarihsel-finans-optin-active">
            Yeni finans dönemine dahil edildi.
          </p>
        )}
        {vaka.activeDelegation && (
          <div className="mt-3">
            <DelegationBanner delegation={vaka.activeDelegation} />
          </div>
        )}
      </div>

      {/* Dosya Özeti — tek satır kompakt şerit */}
      <div
        className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600 leading-tight"
        data-testid="dosya-ozeti"
      >
        <span className="font-semibold text-slate-500 shrink-0">Dosya Özeti</span>
        <span className="text-slate-300 hidden sm:inline" aria-hidden>|</span>
        <span className="truncate">
          <span className="text-slate-400">Tedarikçi:</span>{' '}
          <span className="font-semibold text-slate-800">
            {vaka.assignedVendorId ? (vaka.assignedVendor?.name || 'Atandı') : 'Atanmadı'}
          </span>
        </span>
        <span className="truncate">
          <span className="text-slate-400">Onay:</span>{' '}
          <span className={`font-semibold ${
            flow.customerApproved ? 'text-emerald-700'
              : flow.approvalRequested ? 'text-blue-700' : 'text-amber-600'
          }`}
          >
            {flow.customerApproved ? 'Onaylandı'
              : flow.approvalRequested ? 'Talep Gönderildi' : 'Bekleniyor'}
          </span>
        </span>
        <span className="truncate">
          <span className="text-slate-400">Süre:</span>{' '}
          <span className="font-semibold text-slate-800">
            {fmtElapsedDuration(vaka.fileDate ?? vaka.createdAt)}
          </span>
        </span>
      </div>

      {/* 2. Dosya Aşamaları — Hasar Dosyaları'ndaki ClaimStageStrip ile aynı ince/soluk görünüm */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-3 py-2.5" data-testid="surec-strip">
        <SectionTitle icon={History} title="Dosya Aşamaları" iconClassName="text-brand-600" />
        <div className="mt-2 min-w-0 overflow-x-auto pb-0.5 scroll-smooth [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
          <div className="relative flex w-full min-w-0 items-start py-1">
            {ACIL_STAGES.map((s, i) => {
              const isActive = i === stageIdx;
              const isDone = i < stageIdx;
              const isLast = i === ACIL_STAGES.length - 1;
              const doneUpToHere = i <= stageIdx;
              const dotClass = isActive
                ? 'h-5 w-5 border-2 border-red-600 bg-white ring-2 ring-red-100 shadow-sm'
                : isDone
                  ? 'h-5 w-5 border-2 border-slate-300 bg-slate-300'
                  : 'h-5 w-5 border-2 border-slate-200 bg-white';
              const labelClass = isActive
                ? 'text-slate-800 font-semibold'
                : isDone
                  ? 'text-slate-400'
                  : 'text-slate-300';
              const stemConnectorClass = doneUpToHere ? 'bg-slate-300' : 'bg-slate-100';
              const prevConnectorClass = i > 0 && i - 1 < stageIdx ? 'bg-slate-300' : 'bg-slate-100';
              return (
                <div key={s.key} className={`flex items-start ${i > 0 ? 'min-w-0 flex-1' : 'shrink-0'}`}>
                  {i === 0 && (
                    <div
                      className={`relative z-0 mt-2.5 h-0.5 w-3 shrink-0 rounded-full sm:w-5 ${stemConnectorClass}`}
                      aria-hidden
                    />
                  )}
                  {i > 0 && (
                    <div
                      className={`relative z-0 mt-2.5 h-0.5 min-w-[0.75rem] flex-1 rounded-full ${prevConnectorClass}`}
                      aria-hidden
                    />
                  )}
                  <div className="group relative z-10 flex shrink-0 flex-col items-center" title={s.label}>
                    <div className={`rounded-full ${dotClass}`} aria-hidden />
                    <span
                      className={`mt-1.5 max-w-[4.75rem] text-center text-[9px] leading-tight sm:max-w-[5.5rem] sm:text-[10px] ${labelClass}`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {isLast && (
                    <div
                      className={`relative z-0 mt-2.5 h-0.5 w-3 shrink-0 rounded-full sm:w-5 ${stemConnectorClass}`}
                      aria-hidden
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Güncel İşlem / Dosya Takibi — ince bilgi satırı (kart değil) */}
      <div
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-100 px-0.5 py-1"
        data-testid="guncel-islem"
      >
        <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-tight">
          <span className="font-semibold text-slate-500 shrink-0">
            {historicalExempt ? 'Dosya Takibi' : 'Güncel İşlem'}
          </span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden>|</span>
          {!historicalExempt && (
            <span className="font-semibold text-slate-900 truncate">{task.title}</span>
          )}
          {task.detail && (
            <span className={`text-slate-500 truncate ${historicalExempt ? 'font-medium' : 'hidden md:inline'}`}>
              {historicalExempt ? task.detail : `· ${task.detail}`}
            </span>
          )}
          {actionFlash && (
            <span
              className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5"
              data-testid="aksiyon-bildirim"
            >
              {actionFlash}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 shrink-0">
          <button
            type="button"
            onClick={focusPriceForm}
            className="inline-flex items-center justify-center rounded-md bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
            data-testid="guncel-alis-satis-gir"
          >
            Dosya Bütçesi Gir
          </button>
          <button
            type="button"
            onClick={openApprovalModal}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            data-testid="guncel-onay-talebi"
          >
            Onay Talebi
          </button>
        </div>
      </div>

      {/* 3–6. Sol: Tedarikçi (esnek) + Operasyon · Sağ: Bütçe + Kapanış — xl’de kolon yüksekliği eşit */}
      <div
        className="grid grid-cols-1 xl:grid-cols-2 gap-2 items-stretch"
        data-testid="operasyon-iki-kolon"
      >
        <div
          className="flex flex-col gap-2 min-w-0 max-xl:contents xl:h-full"
          data-testid="sol-tedarikci-kolon"
        >
          <div className="min-w-0 order-1 xl:flex-1 xl:flex xl:flex-col xl:min-h-0">
            <RecommendedVendorsTabs
              assignedBadge={Boolean(vaka.assignedVendor)}
              loading={recsLoading}
              vendors={vendorRecs}
              assignedVendorId={vaka.assignedVendorId}
              assignLoading={assignLoading}
              onAssign={handleAssignVendor}
              preferAlternatif={forceAltVendor || flow.vendorProcess === 'reddedildi'}
              city={vaka.city ?? undefined}
              district={vaka.district ?? undefined}
              serviceType={vaka.issueType ?? undefined}
              category="acil"
              onAlternativeAssigned={async (vendor) => {
                await handleAssignVendor(vendor.id);
              }}
            />
          </div>
<div
          id="hizli-islemler"
          className="bg-white rounded-xl border border-slate-100 shadow-sm p-2 space-y-1.5 min-w-0 order-5 xl:shrink-0"
          data-testid="hizli-islemler"
        >
          <SectionTitle icon={Send} title="Operasyon İşlemleri" iconClassName="text-brand-600" />
          <div
            className="grid grid-cols-2 sm:grid-cols-3 gap-1.5"
            data-testid="hizli-islem-kartlari"
          >
              <QuickActionCard
                icon={MessageCircle}
                label="İlk Bilgilendirme"
                onClick={() => requestInsuredWhatsAppSend('initial')}
                disabled={initialNotifyDone}
                variant="primary"
                visualState={opsVisual.initialNotify}
                title={
                  initialNotifyDone
                    ? 'Sigortalıya ilk bilgilendirme gönderildi.'
                    : 'Sigortalıya ilk bilgilendirme WhatsApp mesajı (manuel)'
                }
                testId="ops-ilk-bilgilendirme"
              />
              <QuickActionCard
                icon={Send}
                label="Onay Talebi"
                onClick={openApprovalModal}
                disabled={!vaka.assignedVendorId || approvalBusy}
                busy={approvalBusy}
                variant="primary"
                visualState={opsVisual.approval}
                title={
                  approvalDone
                    ? 'Onay talebi oluşturuldu.'
                    : !vaka.assignedVendorId
                      ? 'Önce tedarikçi atayın.'
                      : 'Asistans onay talebi oluştur'
                }
                testId="hizli-onay-talebi"
              />
              <QuickActionCard
                icon={Play}
                label="İşe Başlama"
                onClick={() => void handleWorkStartMessage()}
                disabled={!flow.customerApproved || flow.workStartPrepared || opsActionBusy === 'work_start'}
                busy={opsActionBusy === 'work_start'}
                variant="success"
                visualState={opsVisual.workStart}
                title={
                  flow.workStartPrepared
                    ? 'İşe başlama mesajı hazırlandı.'
                    : !flow.customerApproved
                      ? 'Önce müşteri onayını kaydedin.'
                      : 'Tedarikçiye işe başlama mesajı gönder'
                }
                testId="ise-baslama-mesaji"
              />
              <QuickActionCard
                icon={CheckCircle2}
                label="Hizmeti Tamamla"
                onClick={() => void handleServiceComplete()}
                disabled={
                  fileAlreadyClosed
                  || flow.serviceCompleted
                  || (!flow.workStartPrepared && stageIdx < 4)
                  || opsActionBusy === 'service'
                }
                busy={opsActionBusy === 'service'}
                variant="success"
                visualState={opsVisual.service}
                title={
                  flow.serviceCompleted || fileAlreadyClosed
                    ? 'Hizmet tamamlandı.'
                    : !flow.workStartPrepared && stageIdx < 4
                      ? 'Önce işe başlama adımını tamamlayın.'
                      : 'Hizmeti tamamlandı olarak işaretle'
                }
                testId="hizmet-tamamla-btn"
              />
              <QuickActionCard
                icon={MessageCircle}
                label="Kapanış / Anket"
                onClick={() => requestInsuredWhatsAppSend('closure_survey')}
                disabled={!closureSurveyUnlocked || closureSurveyDone}
                variant="success"
                visualState={opsVisual.closureSurvey}
                title={
                  closureSurveyDone
                    ? 'Kapanış / anket mesajı gönderildi.'
                    : !closureSurveyUnlocked
                      ? 'Önce hizmeti tamamlayın veya işe başlama sonrası aşamaya geçin.'
                      : 'Sigortalıya kapanış / anket WhatsApp mesajı (manuel)'
                }
                testId="ops-kapanis-anket"
              />
          </div>
          {financeDone ? (
            <div
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-center"
              data-testid="dosya-kapali-finansa-badge"
              data-visual-state="completed"
            >
              <Landmark className="h-5 w-5 text-emerald-600 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="text-sm font-semibold text-emerald-800 leading-tight">Finansa Gönderildi</span>
            </div>
          ) : (
            <button
              type="button"
              disabled={closeFinanceBusy || !closeFinanceReady}
              onClick={() => {
                if (!requireAssignedVendor()) return;
                if (missingCloseLabels.length > 0) {
                  setConfirmAction('dosya_kapat_finansa');
                  return;
                }
                void handleCloseAndFinance();
              }}
              title={
                !vaka.assignedVendorId
                  ? 'İlerlemek İçin Tedarikçi Seçimi Zorunludur.'
                  : closeFinanceReady
                  ? fileAlreadyClosed
                    ? 'Dosyayı finansa gönder'
                    : 'Dosyayı kapat ve finansa gönder'
                  : missingCloseLabels.length
                    ? `Eksik: ${missingCloseLabels.join(', ')}`
                    : !showCloseFinanceBlock
                      ? 'Kapatma için işe başlama veya sonraki aşama gerekir.'
                      : 'Kapanış öncesi kontroller tamamlanmalı'
              }
              data-testid="dosyayi-kapat-finansa-btn"
              data-visual-state={closeFinanceReady ? 'next' : 'waiting'}
              className={`w-full inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
                closeFinanceReady
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25 ring-2 ring-blue-200 ring-offset-1 hover:bg-blue-700 focus-visible:ring-blue-500'
                  : 'border border-slate-200 bg-slate-100 text-slate-500 opacity-80'
              }`}
            >
              <Landmark
                className={`h-5 w-5 shrink-0 ${closeFinanceReady ? 'text-white' : 'text-slate-400'}`}
                strokeWidth={2}
                aria-hidden
              />
              <span className="leading-tight">
                {closeFinanceBusy
                  ? 'İşleniyor...'
                  : 'Dosyayı Kapat Ve Finansa Gönder'}
              </span>
            </button>
          )}
            {financeDone && (financeResult || vaka.operationChain?.constraints?.vendorStatementRequiresClaimFile) && (
              <p className="text-[10px] text-emerald-700" data-testid="finans-sonuc">
                {financeResult
                  || 'Finansa Gönderildi. Tedarikçi hakedişi ve cari bağlantısı bu dosya için henüz tamamlanamadı.'}
              </p>
            )}
            {!closeFinanceReady && !financeDone && (
              <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 leading-snug" data-testid="dosya-kapat-kilit-bilgi">
                {!vaka.assignedVendorId
                  ? 'İlerlemek İçin Tedarikçi Seçimi Zorunludur.'
                  : missingCloseLabels.length > 0
                  ? `Dosyayı Kapat Ve Finansa Gönder pasif. Eksik: ${missingCloseLabels.join(', ')}.`
                  : !showCloseFinanceBlock
                    ? 'Dosyayı Kapat Ve Finansa Gönder, işe başlama veya sonraki aşamadan sonra aktif olur.'
                    : 'Dosyayı Kapat Ve Finansa Gönder, kapanış kontrolleri ve satış fiyatı tamamlanınca aktif olur.'}
              </p>
            )}
        </div>
        </div>

        <div
          className="flex flex-col gap-2 min-w-0 max-xl:contents xl:h-full"
          data-testid="sag-operasyon-kolon"
        >
          <div
            ref={findingsFormRef}
            className="rounded-xl border border-slate-100 bg-white shadow-sm p-2.5 space-y-1.5 min-w-0 order-2"
            data-testid="tespit-bulgulari-section"
            id="tespit-bulgulari-section"
          >
            <SectionTitle icon={ClipboardList} title="Tespit Bulguları *" iconClassName="text-slate-600" />
            <div
              className={`border rounded-lg overflow-hidden ${
                findingsError ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-200'
              }`}
            >
              <div className="px-3 pt-2 pb-0.5 bg-slate-50 border-b border-slate-100">
                <span className="text-sm font-bold italic text-slate-800 select-none">
                  Riziko adreste yapılan incelemeler sonucunda;
                </span>
              </div>
              <div className="relative">
                <textarea
                  ref={findingsTextareaRef}
                  rows={3}
                  className="w-full px-3 py-2 pr-12 text-sm text-slate-800 focus:outline-none resize-y min-h-[72px] bg-white"
                  placeholder="bulgular buraya yazılır..."
                  value={draftFindings}
                  onChange={(e) => {
                    setDraftFindings(e.target.value);
                    if (findingsError) setFindingsError(null);
                    if (priceFormError?.includes('Tespit Bulguları')) setPriceFormError(null);
                  }}
                  onBlur={() => { void saveFindingsText(); }}
                  data-testid="tespit-bulgulari-input"
                  aria-required
                  aria-invalid={Boolean(findingsError)}
                />
                <div className="absolute bottom-2 right-2">
                  <SpeechToText
                    size="sm"
                    onTranscript={(text) => {
                      const next = draftFindings.trim()
                        ? `${draftFindings.trim()} ${text}`
                        : text;
                      setDraftFindings(next);
                      if (next.trim()) setFindingsError(null);
                    }}
                  />
                </div>
              </div>
            </div>
            {findingsError ? (
              <p className="text-xs text-status-danger" data-testid="tespit-bulgulari-error">{findingsError}</p>
            ) : (
              <p className="text-[11px] text-slate-400">
                {findingsSaving ? 'Kaydediliyor…' : 'Önce tespit bulguları, sonra dosya bütçesi girilir.'}
              </p>
            )}
          </div>

          <div
            ref={priceFormRef}
            className="rounded-xl border border-slate-100 bg-white shadow-sm p-2.5 space-y-1.5 min-w-0 order-3"
            data-testid="fiyat-giris"
            id="maliyet-onay"
          >
            <div className="flex items-center justify-between gap-2">
              <SectionTitle icon={Wallet} title="Dosya Bütçesi" iconClassName="text-slate-600" />
              <div className="flex items-center gap-2 shrink-0">
                {!budgetEditing && (
                  <button
                    type="button"
                    onClick={openBudgetEdit}
                    className="text-[11px] font-semibold text-blue-700 hover:text-blue-800 underline underline-offset-2 inline-flex items-center py-1"
                    data-testid="butce-duzelt"
                  >
                    Düzelt
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowVatDetail((v) => !v)}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-700 underline underline-offset-2 inline-flex items-center py-1"
                  data-testid="kdv-detayi-toggle"
                  aria-expanded={showVatDetail}
                >
                  {showVatDetail ? 'Gizle' : 'Detay'}
                </button>
              </div>
            </div>

            {canSeeOpsCost && (
              <div data-testid="alis-ozet">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <label className="block text-xs font-medium text-slate-600" htmlFor="inline-alis-fiyati">
                    Tedarikçi Maliyeti
                  </label>
                  {budgetEditing ? (
                    <VatModeToggle
                      value={draftAlisVat}
                      onChange={(m) => applyDraftVatModeChange('alis', m)}
                      testId="alis-kdv-modu"
                    />
                  ) : (
                    <span className="text-[10px] font-medium text-slate-500" data-testid="alis-kdv-modu-ozet">
                      {alisVatMode === 'dahil' ? 'KDV Dahil' : 'KDV Hariç'}
                    </span>
                  )}
                </div>
                {budgetEditing ? (
                  <div className="relative">
                    <input
                      id="inline-alis-fiyati"
                      type="text"
                      inputMode="decimal"
                      value={draftAlis}
                      onChange={(e) => setDraftAlis(e.target.value)}
                      placeholder="0,00"
                      className="w-full h-9 px-2.5 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      data-testid="alis-fiyati"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">TL</span>
                  </div>
                ) : (
                  <p
                    className="h-9 flex items-center px-2.5 rounded-lg border border-slate-100 bg-slate-50 text-sm font-semibold text-slate-800 tabular-nums"
                    data-testid="alis-fiyati-ozet"
                  >
                    {alisFiyati.trim() ? `${alisFiyati} TL` : '—'}
                  </p>
                )}
                {showVatDetail && (
                  <VatBreakdownRows
                    amount={parsePriceInput(budgetEditing ? draftAlis : alisFiyati)}
                    mode={budgetEditing ? draftAlisVat : alisVatMode}
                    testIdPrefix="alis"
                  />
                )}
              </div>
            )}

            <div data-testid="satis-ozet">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <label className="block text-xs font-medium text-slate-600" htmlFor="inline-satis-fiyati">
                  Müşteri Satış Bedeli
                </label>
                {budgetEditing ? (
                  <VatModeToggle
                    value={draftSatisVat}
                    onChange={(m) => applyDraftVatModeChange('satis', m)}
                    testId="satis-kdv-modu"
                  />
                ) : (
                  <span className="text-[10px] font-medium text-slate-500" data-testid="satis-kdv-modu-ozet">
                    {satisVatMode === 'dahil' ? 'KDV Dahil' : 'KDV Hariç'}
                  </span>
                )}
              </div>
              {budgetEditing ? (
                <div className="relative">
                  <input
                    id="inline-satis-fiyati"
                    type="text"
                    inputMode="decimal"
                    value={draftSatis}
                    onChange={(e) => setDraftSatis(e.target.value)}
                    placeholder="0,00"
                    className="w-full h-9 px-2.5 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-testid="satis-fiyati"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">TL</span>
                </div>
              ) : (
                <p
                  className="h-9 flex items-center px-2.5 rounded-lg border border-slate-100 bg-slate-50 text-sm font-semibold text-slate-800 tabular-nums"
                  data-testid="satis-fiyati-ozet"
                >
                  {satisFiyati.trim() ? `${satisFiyati} TL` : '—'}
                </p>
              )}
              {showVatDetail && (
                <VatBreakdownRows
                  amount={parsePriceInput(budgetEditing ? draftSatis : satisFiyati)}
                  mode={budgetEditing ? draftSatisVat : satisVatMode}
                  testIdPrefix="satis"
                />
              )}
            </div>

            {marginToast && (
              <div
                className={`rounded-lg border px-2 py-1 ${
                  marginToast.level === 'high'
                    ? 'border-rose-200 bg-rose-50'
                    : 'border-amber-200 bg-amber-50'
                }`}
                data-testid="kar-uyari-banner"
                role="status"
              >
                <p className={`text-[11px] leading-snug ${
                  marginToast.level === 'high' ? 'text-rose-800' : 'text-amber-900'
                }`}
                >
                  <span className="font-semibold">Uyarı: </span>
                  {marginToast.message}
                </p>
              </div>
            )}

            {priceFormError && (
              <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1" data-testid="fiyat-form-hata">
                {priceFormError}
              </p>
            )}

            {canSeeOpsCost && (
              <div
                className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 border-t border-slate-50"
                data-testid="kar-ozet"
              >
                <div className="flex items-center gap-1.5 min-w-0" data-testid="kar-tutari">
                  <span className="text-xs font-medium text-slate-600 shrink-0">Kâr Tutarı</span>
                  <span className={`text-sm font-semibold tabular-nums ${
                    draftKarTutari == null
                      ? 'text-slate-400'
                      : draftKarTutari >= 0
                        ? 'text-emerald-700'
                        : 'text-rose-600'
                  }`}
                  >
                    {draftKarTutari == null ? '—' : `${formatPriceInput(draftKarTutari)} TL`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0" data-testid="kar-orani">
                  <span className="text-xs font-medium text-slate-600 shrink-0">Kâr Oranı</span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      draftKarPct == null
                        ? 'text-slate-400'
                        : draftKarPct < 10 || draftKarPct > 80
                          ? 'text-amber-700'
                          : draftKarPct >= 0
                            ? 'text-emerald-700'
                            : 'text-rose-600'
                    }`}
                  >
                    {draftKarPct == null ? '—' : `%${formatMarginPercent(draftKarPct)}`}
                  </span>
                </div>
              </div>
            )}

            {budgetEditing ? (
              <div className="flex items-center justify-end gap-1.5 pt-0.5">
                {(parsePriceInput(alisFiyati) > 0 || parsePriceInput(satisFiyati) > 0) && (
                  <button
                    type="button"
                    onClick={cancelBudgetEdit}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white h-9 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    data-testid="butce-vazgec"
                  >
                    Vazgeç
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { savePriceForm(); }}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white h-9 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  data-testid="fiyat-kaydet"
                >
                  Kaydet
                </button>
                <button
                  type="button"
                  onClick={savePriceFormAndClose}
                  className="inline-flex items-center justify-center rounded-lg bg-brand-600 h-9 px-3 text-xs font-semibold text-white hover:bg-blue-700"
                  data-testid="fiyat-kaydet-ve-kapat"
                >
                  Kaydet Ve Kapat
                </button>
              </div>
            ) : null}

            {canSeeOpsCost && flow.priceChangeLog.length > 0 && (
              <div className="rounded-lg border border-slate-100 bg-white px-2 py-1" data-testid="fiyat-degisiklik-logu">
                <p className="text-[11px] font-semibold text-slate-600 mb-0.5">Fiyat Değişiklikleri</p>
                <ul className="space-y-0.5 max-h-20 overflow-auto">
                  {flow.priceChangeLog.slice(0, 6).map((e, i) => (
                    <li key={`${e.at}-${i}`} className="text-[10px] text-slate-600 flex justify-between gap-2">
                      <span>
                        {e.field === 'alis' ? 'Tedarikçi Maliyeti' : 'Müşteri Satış Bedeli'}:{' '}
                        {e.oldValue != null
                          ? formatPriceInput(e.oldValue)
                          : '—'}
                        {' → '}
                        {formatPriceInput(e.newValue)} TL
                      </span>
                      <span className="text-slate-400 shrink-0 tabular-nums">{fmtTimeHm(e.at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {showVatDetail && (
              <p className="text-[10px] text-slate-500 leading-snug" data-testid="fiyat-gizlilik-bilgi">
                Tedarikçi satış bedelini görmez. Müşteri tedarikçi maliyetini görmez.
              </p>
            )}
            {approvalMsg && (
              <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1">{approvalMsg}</p>
            )}
          </div>
<div
            className="bg-white rounded-xl border border-slate-100 shadow-sm p-2.5 space-y-1.5 order-4"
            data-testid="zorunlu-islemler"
          >
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <SectionTitle icon={ClipboardList} title="Kapanış Öncesi Kontroller" iconClassName="text-amber-600" />
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border tabular-nums ${
                  requiredOpsComplete
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-amber-700 bg-amber-50 border-amber-200'
                }`}
                data-testid="zorunlu-islemler-ozet"
              >
                {requiredOpsComplete
                  ? `${requiredOpsItems.length}/${requiredOpsItems.length} Tamam`
                  : `${requiredOpsItems.filter((i) => i.done).length}/${requiredOpsItems.length} · ${requiredOpsItems.filter((i) => !i.done).length} Eksik`}
              </span>
            </div>
            <ul className="grid grid-cols-1 gap-1" data-testid="zorunlu-islem-listesi">
              {requiredOpsItems.map((item) => (
                <li
                  key={item.key}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1 text-xs ${
                    item.done
                      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
                      : 'border-amber-200 bg-amber-50/60 text-amber-900'
                  }`}
                  data-testid={`zorunlu-${item.key}`}
                  data-done={item.done ? '1' : '0'}
                  title={item.hint}
                >
                  <span className="font-bold shrink-0 w-3 text-center" aria-hidden>{item.done ? '✓' : '○'}</span>
                  <span className="min-w-0 flex-1 font-semibold leading-tight">{item.label}</span>
                  <span className="text-[10px] opacity-80 shrink-0">{item.done ? 'Tamam' : 'Eksik'}</span>
                </li>
              ))}
            </ul>
            <ClosurePhotosPanel
              entityId={vaka.id}
              onPhotoCountChange={setClosurePhotoCount}
              readonly={fileAlreadyClosed}
            />
            {!requiredOps.insuredInitialNotify && (
              <button
                type="button"
                onClick={() => requestInsuredWhatsAppSend('initial')}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-status-success bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                data-testid="kapanis-ilk-bilgilendirme"
              >
                <MessageCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                Sigortalıya İlk Bilgilendirme
              </button>
            )}
            {!requiredOps.insuredClosureSurvey && (
              <button
                type="button"
                onClick={() => requestInsuredWhatsAppSend('closure_survey')}
                disabled={!closureSurveyUnlocked}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-status-success bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="kapanis-anket-mesaji"
                title={
                  closureSurveyUnlocked
                    ? 'Kapanış / anket WhatsApp mesajı'
                    : 'Önce hizmeti tamamlayın'
                }
              >
                <MessageCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                Kapanış / Anket Mesajı
              </button>
            )}
            {!requiredOps.closureEmail && (
              <button
                type="button"
                onClick={() => void openClosureEmailModal()}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                data-testid="kapanis-email-onizle"
              >
                <Mail className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                Kapanış Maili Gönder
              </button>
            )}
            {requiredOps.closureEmail && (
              <span
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"
                data-testid="kapanis-email-gonderildi"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                Kapanış Maili Gönderildi
              </span>
            )}
            {!saleReady && (
              <p className="text-[10px] text-amber-700" data-testid="zorunlu-satis-uyari">
                Dosyayı kapatmak için satış bedeli de gerekli.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 4–5. Bağlam uyarıları (maliyet / onay) */}
      {/* 4. Tedarikçi maliyeti algılama */}
      {showCostDetect && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4 space-y-3" data-testid="maliyet-algilandi">
          <p className="text-sm font-semibold text-slate-800">
            Tedarikçi maliyeti algılandı:{' '}
            <span className="text-amber-800">{fmtCurrency(Number(costEditDraft || flow.detectedCostTl || 0))}</span>
          </p>
          <p className="text-[11px] text-slate-500">Onaylanmadan maliyet kesinleşmez.</p>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={costEditDraft}
            onChange={(e) => setCostEditDraft(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="maliyet-duzelt-input"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void confirmDetectedCost()}
              className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold"
              data-testid="maliyet-onayla"
            >
              Onayla
            </button>
            <button
              type="button"
              onClick={rejectDetectedCost}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
              data-testid="maliyet-duzelt"
            >
              Düzelt
            </button>
          </div>
        </div>
      )}

      {/* 7. Asistans onayı */}
      {showApprovalDetect && (
        <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-4 space-y-3" data-testid="asistans-onay-algilandi">
          <p className="text-sm font-semibold text-slate-800">
            Onay algılandı. Müşteri onayı olarak kaydedilsin mi?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleCustomerApproval(true)}
              className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold"
              data-testid="asistans-onayla"
            >
              Onayla
            </button>
            <button
              type="button"
              onClick={() => handleCustomerApproval(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
              data-testid="asistans-reddet"
            >
              Reddet
            </button>
          </div>
        </div>
      )}

      {/* 7. Alt bölüm — sekmeler (üst blokla ~8px; space-y-2 parent) */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm min-w-0" data-testid="alt-operasyon">
        <div
          className="flex flex-wrap gap-0.5 border-b border-slate-100 px-1.5 py-1 overflow-x-auto"
          role="tablist"
          data-testid="alt-bolum-sekmeler"
        >
          {([
            { id: 'belgeler' as const, label: 'Belgeler', icon: Files },
            { id: 'whatsapp' as const, label: 'WhatsApp', icon: null },
            { id: 'gecmis' as const, label: 'Dosya Geçmişi', icon: History },
            { id: 'finans' as const, label: 'Finans', icon: Wallet },
          ]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={altTab === tab.id}
              onClick={() => setAltTab(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors shrink-0 ${
                altTab === tab.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
              data-testid={`alt-sekme-${tab.id}`}
            >
              {tab.id === 'whatsapp' ? (
                <WhatsAppBrandIcon className="h-3.5 w-3.5 text-emerald-600" />
              ) : tab.icon ? (
                <tab.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
              ) : null}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-2" data-testid="alt-bolum-icerik">
          {altTab === 'belgeler' && (
            <div
              id="dosya-belgeleri"
              className="space-y-2 min-w-0"
              data-testid="dosya-belgeleri"
            >
              <SectionTitle
                icon={Files}
                title="Dosya Belgeleri"
                iconClassName="text-slate-600"
              />
              <p className="text-[10px] text-slate-500 leading-snug">
                Matbu evrak ve yazışma ekleri. Kapanış fotoğrafları için üstteki{' '}
                <span className="font-semibold text-slate-600">Dosya Kapanış Resimleri</span> alanını kullanın.
              </p>
              <div className="rounded-lg border border-slate-100 p-2">
                <FileDocumentPanel
                  entityType="emergency_case"
                  entityId={vaka.id}
                  documentKind="matbu_evrak"
                />
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-1.5 max-h-36 overflow-auto">
                <InboundEmailCorrespondencePanel emergencyCaseId={vaka.id} compact />
              </div>
            </div>
          )}

          {altTab === 'whatsapp' && (
        <div
          id="whatsapp-yazismalari"
          className="flex flex-col min-w-0 gap-2"
          data-testid="whatsapp-yazismalari"
          data-assigned={vaka.assignedVendorId ? '1' : '0'}
        >
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <WhatsAppBrandIcon className={`${ICON_SM} text-emerald-600`} />
              <p className="text-sm font-semibold text-slate-800 truncate leading-none">
                WhatsApp Yazışmaları
              </p>
            </div>
            <div
              className="flex flex-1 min-w-[12rem] rounded-lg border border-slate-200 bg-slate-50 p-0.5"
              role="tablist"
              data-testid="whatsapp-sekmeler"
            >
              {([
                { id: 'sigortali' as const, label: 'Sigortalıya Mesaj' },
                { id: 'tedarikci' as const, label: 'Tedarikçiye Mesaj' },
                { id: 'musteri' as const, label: 'Müşteri Grubuna Mesaj' },
                { id: 'gecmis' as const, label: 'Mesaj Geçmişi' },
              ]).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={whatsAppTab === tab.id}
                  onClick={() => setWhatsAppTab(tab.id)}
                  className={`flex-1 rounded-md px-1.5 py-1 text-[10px] sm:text-[11px] font-semibold leading-tight transition-colors ${
                    whatsAppTab === tab.id
                      ? 'bg-white text-emerald-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  data-testid={`whatsapp-sekme-${tab.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {whatsAppTab === 'sigortali' && (
            <div
              className="flex flex-col gap-2"
              data-testid="whatsapp-sigortali-panel"
            >
              {insuredMsgErrors.length > 0 && (
                <div
                  className="w-full rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 space-y-0.5"
                  data-testid="whatsapp-sigortali-hata"
                >
                  {insuredMsgErrors.map((err) => (
                    <p key={err} className="text-[10px] text-amber-800 font-medium">{err}</p>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-slate-500">
                Manuel gönderim — otomatik mesaj yok. Kapanış için her iki mesaj zorunludur.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => requestInsuredWhatsAppSend('initial')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-status-success bg-emerald-50/80 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
                  data-testid="whatsapp-ilk-bilgilendirme-btn"
                >
                  <WhatsAppBrandIcon className="h-3.5 w-3.5 text-emerald-600" />
                  {initialNotifyDone ? 'İlk Bilgilendirme (Tekrar)' : 'Sigortalıya İlk Bilgilendirme'}
                </button>
                <button
                  type="button"
                  onClick={() => requestInsuredWhatsAppSend('closure_survey')}
                  disabled={!closureSurveyUnlocked}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-status-success bg-emerald-50/80 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="whatsapp-kapanis-anket-btn"
                >
                  <WhatsAppBrandIcon className="h-3.5 w-3.5 text-emerald-600" />
                  {closureSurveyDone ? 'Kapanış / Anket (Tekrar)' : 'Kapanış / Anket Mesajı'}
                </button>
              </div>
            </div>
          )}

          {whatsAppTab === 'tedarikci' && (
            <div
              className="flex flex-wrap items-center justify-between gap-2"
              data-testid="whatsapp-tedarikci-panel"
            >
              <ul className="text-[10px] text-slate-600 flex flex-wrap gap-x-3 gap-y-1 min-w-0 flex-1">
                <li className={vaka.assignedVendorId ? 'text-emerald-700' : 'text-amber-700'}>
                  {vaka.assignedVendorId ? '✓' : '•'} Tedarikçi {vaka.assignedVendorId ? 'Seçili' : 'Seçilmedi'}
                </li>
                <li className={vendorPhoneOk ? 'text-emerald-700' : 'text-amber-700'}>
                  {vendorPhoneOk ? '✓' : '•'} Telefon {vendorPhoneOk ? 'Doğrulandı' : 'Boş / Geçersiz'}
                </li>
                <li className={(vaka.address || '').trim() ? 'text-emerald-700' : 'text-amber-700'}>
                  {(vaka.address || '').trim() ? '✓' : '•'} Adres {(vaka.address || '').trim() ? 'Dolu' : 'Eksik'}
                </li>
                <li className={(vaka.issueType || '').trim() ? 'text-emerald-700' : 'text-amber-700'}>
                  {(vaka.issueType || '').trim() ? '✓' : '•'} Hizmet {(vaka.issueType || '').trim() ? 'Dolu' : 'Eksik'}
                </li>
              </ul>
              {vendorMsgErrors.length > 0 && (
                <div
                  className="w-full rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 space-y-0.5"
                  data-testid="whatsapp-guard-hata"
                >
                  {vendorMsgErrors.map((err) => (
                    <p key={err} className="text-[10px] text-amber-800 font-medium">{err}</p>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={requestVendorWhatsAppSend}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-status-success bg-emerald-50/80 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors shrink-0"
                data-testid="whatsapp-gonder-btn"
              >
                <WhatsAppBrandIcon className="h-3.5 w-3.5 text-emerald-600" />
                Mesaj Önizle Ve Gönder
              </button>
            </div>
          )}

          {whatsAppTab === 'musteri' && (
            <div
              className="flex flex-wrap items-center justify-between gap-2"
              data-testid="whatsapp-musteri-panel"
            >
              {customerMsgError ? (
                <p className="text-[10px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1.5 flex-1 min-w-0" data-testid="whatsapp-musteri-hata">
                  {customerMsgError}
                </p>
              ) : (
                <span className="text-[10px] text-slate-500 flex-1">Müşteri grubuna güvenli mesaj (alış / kâr yok)</span>
              )}
              <button
                type="button"
                onClick={requestCustomerGroupWhatsAppSend}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-400 bg-blue-50/60 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors shrink-0"
                data-testid="whatsapp-musteri-gonder-btn"
              >
                <WhatsAppBrandIcon className="h-3.5 w-3.5 text-brand-600" />
                Müşteri Mesajı Önizle
              </button>
            </div>
          )}

          {whatsAppTab === 'gecmis' && (
            <div className="overflow-auto max-h-36" data-testid="whatsapp-gecmis-panel">
              {messageHistory.length > 0 ? (
                <ul className="space-y-1.5" data-testid="whatsapp-yazi-listesi">
                  {[...messageHistory]
                    .slice()
                    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
                    .slice(-8)
                    .map((h, i, arr) => {
                      const row = mapWhatsAppThreadRow({ at: h.at, text: h.text });
                      const isLast = i === arr.length - 1;
                      const kindLabel =
                        h.kind === 'vendor' ? 'Tedarikçi'
                        : h.kind === 'customer' ? 'Müşteri'
                        : h.kind === 'insured_initial' ? 'İlk Bilgilendirme'
                        : h.kind === 'insured_closure' ? 'Kapanış / Anket'
                        : 'Sistem';
                      return (
                        <li
                          key={`${h.at}-${i}`}
                          className="flex items-start gap-1.5"
                          data-testid="whatsapp-yazi-satir"
                        >
                          <WhatsAppThreadAvatar />
                          <div className="min-w-0 flex-1 py-0">
                            <p className="text-[9px] font-medium text-slate-400">{kindLabel}</p>
                            <p className="text-[11px] font-semibold text-slate-900 leading-tight truncate">
                              {row.title}
                            </p>
                            {row.detail ? (
                              <p className="text-[10px] text-slate-500 leading-tight truncate mt-0.5">
                                {row.detail}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                            <span className="text-[9px] font-medium text-slate-500 tabular-nums">
                              {fmtTimeHm(row.at)}
                            </span>
                            <WhatsAppReadCheck read={isLast} />
                          </div>
                        </li>
                      );
                    })}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-400 py-2 text-center">
                  Henüz yazışma kaydı yok.
                </p>
              )}
            </div>
          )}
        </div>
          )}

          {altTab === 'gecmis' && (
            <div
              id="dosya-gecmisi"
              className="space-y-3"
              data-testid="dosya-gecmisi"
            >
              <SectionTitle icon={History} title="Dosya Geçmişi" iconClassName="text-slate-600" />
              <div className="space-y-3 text-sm" data-testid="sekme-gecmis-icerik">
                {flow.history.length > 0 ? (
                  <ul className="space-y-2 max-h-64 overflow-auto" data-testid="islem-gecmisi-listesi">
                    {flow.history.map((h, i) => (
                      <li key={`${h.at}-${i}`} className="text-xs text-slate-600 border-b border-slate-50 pb-2">
                        <span className="text-slate-400">{fmtDateTime(h.at)}</span>
                        <p className="mt-0.5 font-medium text-slate-800">{h.text}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">İşlem geçmişi henüz yok.</p>
                )}
                {vaka.findingsText && (
                  <div data-testid="tespit-bulgulari-ozet">
                    <p className="text-xs text-slate-400">Tespit Bulguları</p>
                    <p className="text-slate-700 mt-0.5 whitespace-pre-wrap">{vaka.findingsText}</p>
                  </div>
                )}
                {vaka.notes && (
                  <div>
                    <p className="text-xs text-slate-400">Notlar</p>
                    <p className="text-slate-700 mt-0.5 whitespace-pre-wrap">{vaka.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {altTab === 'finans' && (
            <div
              id="finans-bolumu"
              className="space-y-3"
              data-testid="finans-bolumu"
            >
              <SectionTitle icon={Wallet} title="Finans" iconClassName="text-slate-600" />
<div className="space-y-4" data-testid="sekme-finans-icerik">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="rounded-xl bg-green-50 border border-green-100 px-2 py-2">
                <p className="text-[10px] text-green-600 font-medium">Gelir</p>
                <p className="text-xs font-bold text-green-700 mt-0.5">{fmtCurrency(costSummary.totalGelir)}</p>
              </div>
              <div className="rounded-xl bg-red-50 border border-red-100 px-2 py-2">
                <p className="text-[10px] text-red-600 font-medium">Gider</p>
                <p className="text-xs font-bold text-red-700 mt-0.5">{fmtCurrency(costSummary.totalGider)}</p>
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-2 py-2">
                <p className="text-[10px] text-brand-600 font-medium">Net Kâr</p>
                <p className="text-xs font-bold text-blue-700 mt-0.5">{fmtCurrency(costSummary.netKar)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-2 py-2">
                <p className="text-[10px] text-slate-500 font-medium">Kâr Oranı</p>
                <p className="text-xs font-bold text-slate-700 mt-0.5">%{karOrani.toFixed(1)}</p>
              </div>
            </div>

            {vaka.operationChain && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600 space-y-1">
                {historicalExempt ? (
                  <p data-testid="tarihsel-finans-muaf">
                    Hakediş: Zorunlu Değil · Ödeme / Cari: Zorunlu Değil
                  </p>
                ) : (
                  <p>
                    Durum özeti: satış {costSummary.totalGelir > 0 ? 'var' : 'yok'}
                    {' · '}
                    alış {costSummary.totalGider > 0 ? 'var' : 'yok'}
                  </p>
                )}
                <p>
                  Fatura talebi: {vaka.operationChain.finance.invoiceRequestCount}
                  {' · '}
                  Taslak: {vaka.operationChain.finance.invoiceDraftCount}
                  {(vaka.operationChain.finance.latestInvoiceRequestStatus || vaka.operationChain.finance.latestInvoiceDraftStatus) && (
                    <> · Son: {INVOICE_STATUS_LABELS[vaka.operationChain.finance.latestInvoiceRequestStatus ?? '']
                      ?? vaka.operationChain.finance.latestInvoiceRequestStatus
                      ?? INVOICE_STATUS_LABELS[vaka.operationChain.finance.latestInvoiceDraftStatus ?? '']
                      ?? vaka.operationChain.finance.latestInvoiceDraftStatus}</>
                  )}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-green-700">Gelir</span>
                  <button
                    type="button"
                    onClick={() => { setShowGelirForm((v) => !v); setShowGiderForm(false); }}
                    className="min-h-[44px] sm:min-h-0 text-xs font-medium text-green-600 px-2"
                  >
                    {showGelirForm ? 'Kapat' : 'Ekle'}
                  </button>
                </div>
                {showGelirForm && (
                  <form onSubmit={handleAddGelir} className="px-3 py-2 bg-green-50 space-y-1.5 border-b border-green-100">
                    {gelirError && <p className="text-xs text-red-600">{gelirError}</p>}
                    <input type="text" value={gelirForm.description} onChange={(e) => setGelirForm((f) => ({ ...f, description: e.target.value }))} placeholder="Açıklama" className="w-full h-9 px-2 py-1.5 text-xs border rounded-lg" />
                    <div className="flex gap-1.5">
                      <input type="number" step="0.01" value={gelirForm.amount} onChange={(e) => setGelirForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Tutar" className="flex-1 h-9 px-2 py-1.5 text-xs border rounded-lg" />
                      <TrDateInput value={gelirForm.entryDate} onChange={(entryDate) => setGelirForm((f) => ({ ...f, entryDate }))} className="flex-1 h-9 px-2 py-1.5 text-xs border rounded-lg" />
                    </div>
                    <button type="submit" disabled={gelirLoading} className="w-full min-h-[44px] py-2 bg-green-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                      {gelirLoading ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </form>
                )}
                {costs.filter((c) => c.entryType === 'gelir').length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">Henüz gelir yok</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {costs.filter((c) => c.entryType === 'gelir').map((c) => (
                      <div key={c.id} className="px-3 py-2 flex items-center justify-between gap-2">
                        {editingId === c.id ? (
                          <form onSubmit={(e) => handleSaveEdit(e, c)} className="w-full space-y-1.5">
                            {editError && <p className="text-xs text-red-600">{editError}</p>}
                            <input type="text" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} className="w-full px-2 py-1 text-xs border rounded" />
                            <div className="flex gap-1">
                              <button type="submit" disabled={editLoading} className="flex-1 py-1 bg-brand-600 text-white text-[10px] rounded">Kaydet</button>
                              <button type="button" onClick={() => setEditingId(null)} className="px-2 py-1 text-[10px] border rounded">İptal</button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{c.description}</p>
                              <p className="text-[10px] text-slate-400">{fmtDate(c.entryDate)}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs font-bold text-green-600">+{fmtCurrency(c.amount)}</span>
                              <button type="button" onClick={() => handleStartEdit(c)} className="text-[10px] text-slate-400 hover:text-brand-600">Düzenle</button>
                              <button type="button" onClick={() => handleDeleteCost(c.id)} className="text-[10px] text-slate-400 hover:text-red-600">Sil</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-red-700">Gider</span>
                  <button
                    type="button"
                    onClick={() => { setShowGiderForm((v) => !v); setShowGelirForm(false); }}
                    className="min-h-[44px] sm:min-h-0 text-xs font-medium text-red-600 px-2"
                  >
                    {showGiderForm ? 'Kapat' : 'Ekle'}
                  </button>
                </div>
                {showGiderForm && (
                  <form onSubmit={handleAddGider} className="px-3 py-2 bg-red-50 space-y-1.5 border-b border-red-100">
                    {giderError && <p className="text-xs text-red-600">{giderError}</p>}
                    <input type="text" value={giderForm.description} onChange={(e) => setGiderForm((f) => ({ ...f, description: e.target.value }))} placeholder="Açıklama" className="w-full h-9 px-2 py-1.5 text-xs border rounded-lg" />
                    <div className="flex gap-1.5">
                      <input type="number" step="0.01" value={giderForm.amount} onChange={(e) => setGiderForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Tutar" className="flex-1 h-9 px-2 py-1.5 text-xs border rounded-lg" />
                      <TrDateInput value={giderForm.entryDate} onChange={(entryDate) => setGiderForm((f) => ({ ...f, entryDate }))} className="flex-1 h-9 px-2 py-1.5 text-xs border rounded-lg" />
                    </div>
                    <VendorSelector value={giderVendor} onChange={setGiderVendor} />
                    <button type="submit" disabled={giderLoading} className="w-full min-h-[44px] py-2 bg-red-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                      {giderLoading ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </form>
                )}
                {costs.filter((c) => c.entryType === 'gider').length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">Henüz gider yok</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {costs.filter((c) => c.entryType === 'gider').map((c) => (
                      <div key={c.id} className="px-3 py-2 flex items-center justify-between gap-2">
                        {editingId === c.id ? (
                          <form onSubmit={(e) => handleSaveEdit(e, c)} className="w-full space-y-1.5">
                            {editError && <p className="text-xs text-red-600">{editError}</p>}
                            <input type="text" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} className="w-full px-2 py-1 text-xs border rounded" />
                            <VendorSelector value={editVendor} onChange={setEditVendor} />
                            <div className="flex gap-1">
                              <button type="submit" disabled={editLoading} className="flex-1 py-1 bg-brand-600 text-white text-[10px] rounded">Kaydet</button>
                              <button type="button" onClick={() => setEditingId(null)} className="px-2 py-1 text-[10px] border rounded">İptal</button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{c.description}</p>
                              <p className="text-[10px] text-slate-400">
                                {fmtDate(c.entryDate)}
                                {c.vendor ? ` · ${c.vendor.name}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs font-bold text-red-600">-{fmtCurrency(c.amount)}</span>
                              <button type="button" onClick={() => handleStartEdit(c)} className="text-[10px] text-slate-400 hover:text-brand-600">Düzenle</button>
                              <button type="button" onClick={() => handleDeleteCost(c.id)} className="text-[10px] text-slate-400 hover:text-red-600">Sil</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {!historicalExempt && (
              <ClosureConditionsPanel
                serviceType="emergency"
                entityId={vaka.id}
                fileNo={vaka.caseNo}
                totalAmount={costs.reduce((s, c) => s + c.amount, 0)}
                workItemsSummary={[]}
              />
            )}
          </div>
            </div>
          )}
        </div>
      </div>

      {/* 12. Mobil sabit alt çubuk */}
      <div
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur px-3 py-2 flex gap-2 safe-area-pb"
        data-testid="mobil-alt-cubuk"
      >
        {vaka.assignedVendorId ? (
          <button
            type="button"
            onClick={() => {
              setAltTab('whatsapp');
              handleWhatsAppSend();
            }}
            className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
          >
            WhatsApp
          </button>
        ) : (
          <button
            type="button"
            onClick={() => document.querySelector('[data-testid="tedarikci-onerileri"]')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-brand-600 text-white text-xs font-semibold"
          >
            Tedarikçi
          </button>
        )}
        <button
          type="button"
          onClick={() => { setShowApprovalModal(true); setApprovalMsg(null); }}
          className="flex-1 min-h-[44px] py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
        >
          Onay Talebi
        </button>
        <button
          type="button"
          onClick={() => document.getElementById('hizli-islemler')?.scrollIntoView({ behavior: 'smooth' })}
          className="flex-1 min-h-[44px] py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
        >
          İşlemler
        </button>
      </div>

      {/* Dosya Notları — üst bilgi */}
      {showFileNotes && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" data-testid="dosya-notlari-modal">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-3 max-h-[85vh] overflow-auto">
            <h3 className="text-base font-semibold text-slate-900">Dosya Notları</h3>
            <pre className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-xl p-3 min-h-[80px]">
              {(vaka.notes || '').trim() || 'Bu dosya için henüz not yok.'}
            </pre>
            <button
              type="button"
              onClick={() => setShowFileNotes(false)}
              className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* Onay kanalı modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" data-testid="onay-talebi-modal">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Onay Talebi Oluştur</h3>
            <p className="text-xs text-slate-500">
              Satış fiyatı ({satisFiyati || '—'} TL) seçilen kanala iletilir. Alış fiyatı gönderilmez.
            </p>
            <fieldset className="space-y-2">
              {([
                { id: 'whatsapp' as const, label: 'WhatsApp' },
                { id: 'email' as const, label: 'E-posta' },
                { id: 'both' as const, label: 'WhatsApp + E-posta' },
              ]).map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer ${
                    approvalChannel === opt.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="approvalChannel"
                    checked={approvalChannel === opt.id}
                    onChange={() => setApprovalChannel(opt.id)}
                    className="accent-brand-600"
                  />
                  <span className="text-sm font-medium text-slate-800">{opt.label}</span>
                </label>
              ))}
            </fieldset>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={approvalBusy}
                onClick={handleApprovalSubmit}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"
                data-testid="onay-talebi-gonder"
              >
                {approvalBusy ? 'Gönderiliyor...' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kapanış e-posta önizleme + gönder — alış / kâr YOK */}
      {showClosureEmail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" data-testid="kapanis-email-modal">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-3 max-h-[85vh] overflow-auto">
            <h3 className="text-base font-semibold text-slate-900">Kapanış E-postası</h3>
            <p className="text-xs text-slate-500">
              Asistans firmasına gönderilir. Dosyayı kapatmadan önce önizleyip onaylayın.
            </p>

            {closurePreviewLoading && (
              <p className="text-sm text-slate-500 py-4 text-center">E-posta hazırlanıyor...</p>
            )}

            {!closurePreviewLoading && closurePreview && (() => {
              const recipientList = closurePreview.recipients?.length
                ? closurePreview.recipients
                : (closurePreview.to || '')
                    .split(',')
                    .map((e) => e.trim())
                    .filter(Boolean);
              return (
              <>
                <div className="space-y-1 text-xs text-slate-600">
                  <div data-testid="kapanis-email-alicilar">
                    <p className="font-semibold text-slate-700 mb-0.5">
                      Alıcılar{recipientList.length ? ` (${recipientList.length})` : ''}:
                    </p>
                    {recipientList.length > 0 ? (
                      <ul className="list-none space-y-0.5 pl-0">
                        {recipientList.map((email) => (
                          <li key={email} className="text-slate-600">{email}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-rose-600">Alıcı bulunamadı</p>
                    )}
                  </div>
                  {closurePreview.greetingName?.trim() ? (
                    <p data-testid="kapanis-email-hitap">
                      <span className="font-semibold text-slate-700">Hitap: </span>
                      Sayın {closurePreview.greetingName.trim()}
                    </p>
                  ) : null}
                  <p><span className="font-semibold text-slate-700">Firma: </span>{closurePreview.assistansName}</p>
                  <p data-testid="kapanis-email-konu">
                    <span className="font-semibold text-slate-700">Konu: </span>{closurePreview.subject}
                  </p>
                </div>
                <pre
                  className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-xl p-3"
                  data-testid="kapanis-email-govde"
                >
                  {closurePreview.body}
                </pre>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2" data-testid="kapanis-email-ekler">
                  <p className="text-[11px] font-semibold text-slate-700 mb-1">Ekler</p>
                  {closurePreview.attachmentNames.length > 0 ? (
                    <ul className="text-[11px] text-slate-600 space-y-0.5">
                      {closurePreview.attachmentNames.map((name) => (
                        <li key={name}>• {name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-slate-500">Dosyaya bağlı ek bulunamadı (yoksa boş gönderilir).</p>
                  )}
                </div>
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5" data-testid="kapanis-alis-yok">
                  {closurePreview.note || 'Tedarikçi alış fiyatı, kâr oranı ve iç operasyon bilgileri bu e-postada yer almaz.'}
                </p>
              </>
              );
            })()}

            {(closureSendError || (!closurePreviewLoading && !closurePreview)) && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1.5" data-testid="kapanis-email-hata">
                {closureSendError || 'Önizleme alınamadı'}
              </p>
            )}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={closureSendBusy || closurePreviewLoading || !closurePreview?.canSend}
                onClick={() => void handleSendClosureEmail()}
                className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-45"
                data-testid="kapanis-email-gonder"
              >
                {closureSendBusy ? 'Gönderiliyor...' : 'Onayla Ve Gönder'}
              </button>
              <button
                type="button"
                onClick={() => {
                  persistFlow(appendFlowHistory(flow, 'Kapanış e-postası daha sonraya bırakıldı'));
                  setShowClosureEmail(false);
                  setActionFlash('Kapanış e-postası daha sonra gönderilebilir.');
                }}
                className="w-full py-2 rounded-xl border border-slate-200 text-sm text-slate-600"
                data-testid="kapanis-email-sonra"
              >
                Daha Sonra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tedarikçi WhatsApp önizleme + onay */}
      {vendorMsgPreview && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" data-testid="whatsapp-onizleme-modal">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-3 max-h-[85vh] overflow-auto">
            <h3 className="text-base font-semibold text-slate-900">Tedarikçi Mesaj Önizlemesi</h3>
            <p className="text-xs text-slate-500">Onayladıktan sonra WhatsApp açılır.</p>
            <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-xl p-3" data-testid="whatsapp-onizleme-govde">
              {vendorMsgPreview}
            </pre>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVendorMsgPreview(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={confirmVendorWhatsAppSend}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
                data-testid="whatsapp-onizleme-onayla"
              >
                Onayla Ve Gönder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Müşteri grubu mesaj önizleme */}
      {customerMsgPreview && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" data-testid="musteri-mesaj-onizleme-modal">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-3 max-h-[85vh] overflow-auto">
            <h3 className="text-base font-semibold text-slate-900">Müşteri Grubu Mesaj Önizlemesi</h3>
            <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2" data-testid="musteri-mesaj-guvenlik-notu">
              Alış fiyatı, kâr oranı ve iç operasyon notları bu mesajda yoktur.
            </p>
            <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-xl p-3" data-testid="musteri-mesaj-govde">
              {customerMsgPreview}
            </pre>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCustomerMsgPreview(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={confirmCustomerGroupWhatsAppSend}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold"
                data-testid="musteri-mesaj-onayla"
              >
                Onayla Ve Gönder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sigortalı WhatsApp önizleme (ilk bilgilendirme / kapanış anket) */}
      {insuredMsgPreview && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" data-testid="sigortali-mesaj-onizleme-modal">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-3 max-h-[85vh] overflow-auto">
            <h3 className="text-base font-semibold text-slate-900">
              {insuredMsgPreview.kind === 'initial'
                ? 'Sigortalıya İlk Bilgilendirme'
                : 'Kapanış / Anket Mesajı'}
            </h3>
            <p className="text-xs text-slate-500">
              Onayladıktan sonra WhatsApp açılır. Otomatik gönderim yoktur.
            </p>
            <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-xl p-3" data-testid="sigortali-mesaj-govde">
              {insuredMsgPreview.text}
            </pre>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInsuredMsgPreview(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={confirmInsuredWhatsAppSend}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
                data-testid="sigortali-mesaj-onayla"
              >
                Onayla Ve Gönder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kritik aksiyon onayı */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" data-testid="onay-dialog">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Eksik İşlemlerle Devam Et
            </h3>
            <p className="text-sm text-slate-600">
              Aşağıdaki işlemler tamamlanmadı. Bu işlemleri tamamlamadan devam etmek istiyor musunuz?
            </p>
            <ul className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3" data-testid="eksik-islemler-listesi">
              {missingCloseLabels.map((label) => (
                <li key={label} className="flex items-start gap-2 text-sm text-amber-900">
                  <span aria-hidden>•</span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
                data-testid="onay-dialog-iptal"
              >
                İşlemlere Dön
              </button>
              <button
                type="button"
                disabled={closeBusy || financeBusy}
                onClick={() => { void handleCloseAndFinance(true); }}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"
                data-testid="onay-dialog-onayla"
              >
                Eksik İşlemlerle Devam Et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
