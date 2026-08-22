'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import {
  Files,
  History,
  Wallet,
} from 'lucide-react';
import { resolveEmergencyOperationLabel } from '@sigorta/shared';
import { formatEmergencyFileAddress } from '@/utils/emergency-file-address';
import { ClaimFileHeaderActionsMenu } from '@/components/operasyon/ClaimFileHeaderActionsMenu';
import { PANEL_CARD_BASE, PanelSectionTitle } from '@/components/panel/PanelCard';
import { FILE_STATUS_BADGE_BASE, FILE_STATUS_TONE } from '@/components/panel/file-status-tone';
import type { ManualDecisionAction } from '@/components/operasyon/ManualDecisionModal';
import {
  getCase, updateCase, updateCaseStatus, recordEmergencyManualDecision, addCostEntry, getCostEntries, deleteCostEntry, updateCostEntry,
  getEmergencyVendors, getRecommendedVendors, promoteVendorToPool,
  previewClosureEmail, sendClosureEmail,
  listEmergencyProcessEvents, recordEmergencyProcessEvent,
  EmergencyCase, EmergencyCostEntry, EmergencyStatus, VendorRecommendation,
  type ClosureEmailPreview, type EmergencyUrgency,
} from '@/utils/emergencyApi';
import FileDocumentPanel from '@/components/file-documents/FileDocumentPanel';
import ClosureConditionsPanel from '@/components/file-documents/ClosureConditionsPanel';
import ClosurePhotosPanel from '@/components/file-documents/ClosurePhotosPanel';
import { FieldInspectionPhotosPanel } from '@/components/field-survey/FieldInspectionPhotosPanel';
import {
  AcilOperasyonPlanlayiciPanel,
  type AcilOperasyonPlanlayiciHandle,
  type AcilPlannerStepStatus,
} from '@/components/acil-operasyon-planlayicisi/AcilOperasyonPlanlayiciPanel';
import type {
  ApprovalChannel as PlannerApprovalChannel,
  ApprovalState as PlannerApprovalState,
  OperatorStepKey,
} from '@/components/acil-operasyon-planlayicisi/planner-steps';
import { InboundEmailCorrespondencePanel } from '@/components/operation-inbox/InboundEmailCorrespondencePanel';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { DelegationBanner } from '@/components/delegation/DelegationBanner';
import { PhoneContactActions } from '@/components/ui/PhoneContactActions';
import { LocationPickerModal, LocationPreview, type LatLng } from '@/components/LocationPickerModal';
import { deriveEmergencyLocation } from '@/utils/emergency-location-from-address';
import {
  isHistoricalEmergencyFile,
  readHistoricalFinanceOptIn,
  writeHistoricalFinanceOptIn,
} from './historical-file';
import { RecommendedVendorsTabs } from '@/components/vendor-discovery/RecommendedVendorsTabs';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import SpeechToText from '@/components/SpeechToText';
import { getApiErrorMessage } from '@/utils/api-error';
import { reportCaughtError } from '@/utils/report-caught-error';
import { openWhatsAppChat } from '@/utils/date-helpers';
import {
  isLegacyOpsCatchupBypassActive,
  isWhatsAppMarkSentBypassActive,
  WHATSAPP_MARK_SENT_BYPASS_NOTE,
} from '@/utils/whatsapp-sent-confirm-gate';
import {
  ACIL_STAGES,
  AcilLocalFlow,
  appendFlowHistory,
  appendMessageLog,
  appendPriceChange,
  approvalBudgetReady,
  buildCustomerGroupWhatsAppText,
  buildInsuredClosureSurveyWhatsAppText,
  buildInsuredInitialWhatsAppText,
  buildVendorWhatsAppText,
  buildWorkStartWhatsAppText,
  deriveAcilStageIndex,
  emptyAcilLocalFlow,
  evaluateCloseFinanceGate,
  evaluateOperationStartGate,
  isValidVendorPhone,
  readAcilLocalFlow,
  resolveAcilBudgetAmounts,
  resolveAcilFinanceDisplayKpis,
  hasAcilProcessedFileExpenses,
  validateInsuredWhatsAppGuard,
  validateVendorMessageGuard,
  writeAcilLocalFlow,
} from './acil-workflow';
import { diffAcilProcessEvents, mergeAcilFlowWithServerEvents, applyAcilCaseTimestamps } from './acil-process-events';
import {
  STANDARD_VAT_RATE,
  VatMode,
  MarginWarning,
  calcMarginPercent,
  calcVatBreakdown,
  canSeeAcilOpsCostFields,
  convertPriceForVatMode,
  getMarginWarning,
  priceToNet,
} from './acil-price-helpers';
import { usePanelRoleCode } from '@/hooks/usePanelRole';
import { usePanelAccess } from '@/hooks/usePanelAccess';
import { resolveClaimDosyaKonusu } from '@/utils/text-helpers';
import { SETTINGS_API, settingsAuthHeader } from '@/utils/settings-api';
import { isAcilFileOnlyVendor } from '@/utils/acil-vendor-pool';
import {
  anaMusteriAllowsWhatsApp,
  parseAnaMusteriHaberlesme,
  readAnaMusteriHaberlesme,
  writeAnaMusteriHaberlesme,
} from '@/utils/acil-ana-musteri-haberlesme';

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

const SectionTitle = PanelSectionTitle;

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
      className={`h-4 w-4 shrink-0 ${read ? 'text-emerald-600' : 'text-slate-400'}`}
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

void formatTurkishList;
void currentOperator;
void VatModeToggle;
void VatBreakdownRows;

function personInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('tr-TR');
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toLocaleUpperCase('tr-TR');
}

function customerLabel(vaka: EmergencyCase): string {
  const c = vaka.customer;
  if (!c) return vaka.customerName;
  const short = c.shortName?.trim();
  if (short) return short;
  const company = c.companyName?.trim();
  if (company && company.length > 28) {
    return company.split(/\s+/)[0];
  }
  return (
    company
    || c.fullName
    || [c.firstName, c.lastName].filter(Boolean).join(' ')
    || vaka.customerName
  );
}

function customerFullLabel(vaka: EmergencyCase): string {
  const c = vaka.customer;
  if (!c) return vaka.customerName?.trim() || '—';
  return (
    c.companyName?.trim()
    || c.fullName?.trim()
    || [c.firstName, c.lastName].filter(Boolean).join(' ')
    || vaka.customerName?.trim()
    || '—'
  );
}

function foldPersonLabel(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}

function insuredLabel(vaka: EmergencyCase): string {
  // Acil: sigortalı kişi adı. Müşteri = asistan/sigorta firması kartı — aynı metin basılmaz.
  const firm = foldPersonLabel(customerLabel(vaka));
  const fromField = (vaka.customerName || '').trim();
  if (fromField && foldPersonLabel(fromField) !== firm) return fromField;
  const note = (vaka.notes || '').trim();
  const m = note.match(/sigortal[ıi]\s*[:：]\s*(.+)/i);
  if (m?.[1]) {
    const fromNote = m[1].split(/[\n|]/)[0].trim().slice(0, 80);
    if (fromNote && foldPersonLabel(fromNote) !== firm) return fromNote;
  }
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

function ihbarTarihiKisa(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/** Durum rengi ortak sözlükten gelir; Hasar ile aynı renk davranışı. */
function acilDurumBadgeClass(label: string, stageIdx: number): string {
  if (label === 'Reddedildi') return FILE_STATUS_TONE.red;
  if (stageIdx >= 6) return FILE_STATUS_TONE.green;
  if (stageIdx >= 3) return FILE_STATUS_TONE.amber;
  if (stageIdx >= 1) return FILE_STATUS_TONE.blue;
  return FILE_STATUS_TONE.gray;
}

const URGENCY_OZET: Record<EmergencyUrgency, string> = {
  DUSUK: 'Düşük',
  NORMAL: 'Normal',
  YUKSEK: 'Yüksek',
  KRITIK: 'Kritik',
};

const URGENCY_BADGE: Record<EmergencyUrgency, string> = {
  DUSUK: FILE_STATUS_TONE.gray,
  NORMAL: FILE_STATUS_TONE.blue,
  YUKSEK: FILE_STATUS_TONE.amber,
  KRITIK: FILE_STATUS_TONE.red,
};

function openWhatsApp(phone: string | null | undefined, text: string) {
  return openWhatsAppChat(phone, text);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const EMPTY_COST_FORM = { description: '', amount: '', entryDate: new Date().toISOString().slice(0, 10) };

export default function AcilDosyaDetayPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const roleCode = usePanelRoleCode();
  const { showAcilFinancePage } = usePanelAccess();
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
  const [, setPriceSaveBusy] = useState(false);
  const priceFormRef = useRef<HTMLDivElement | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalChannel, setApprovalChannel] = useState<ApprovalChannel>('whatsapp');
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalMsg, setApprovalMsg] = useState<string | null>(null);

  const [flow, setFlow] = useState<AcilLocalFlow>(emptyAcilLocalFlow);
  const flowRef = useRef<AcilLocalFlow>(emptyAcilLocalFlow());
  const [costEditDraft, setCostEditDraft] = useState('');
  const [showClosureEmail, setShowClosureEmail] = useState(false);
  const [closurePreview, setClosurePreview] = useState<ClosureEmailPreview | null>(null);
  const [closurePreviewLoading, setClosurePreviewLoading] = useState(false);
  const [closureSendBusy, setClosureSendBusy] = useState(false);
  const [closureSendError, setClosureSendError] = useState<string | null>(null);
  const [, setFinanceResult] = useState<string | null>(null);
  const [closeBusy, setCloseBusy] = useState(false);
  const [financeBusy, setFinanceBusy] = useState(false);
  const closeSubmitRef = useRef(false);
  const [opsActionBusy, setOpsActionBusy] = useState<'work_start' | 'service' | null>(null);
  const [actionFlash, setActionFlash] = useState<string | null>(null);

  const [showGelirForm, setShowGelirForm] = useState(false);
  const [gelirForm, setGelirForm] = useState(EMPTY_COST_FORM);
  const [gelirLoading, setGelirLoading] = useState(false);
  const [gelirError, setGelirError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ description: '', amount: '', entryDate: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [financeOptIn, setFinanceOptIn] = useState(false);
  const [fileFactsOpen, setFileFactsOpen] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);

  const [whatsAppTab, setWhatsAppTab] = useState<WhatsAppPanelTab>('sigortali');
  const [altTab, setAltTab] = useState<AltBolumTab>('belgeler');
  /** Dosya Kapanış Resimleri — Fotoğraflar kapısı ile senkron */
  const [closurePhotoCount, setClosurePhotoCount] = useState(0);
  const [plannerApprovalChannel, setPlannerApprovalChannel] = useState<PlannerApprovalChannel>('email');
  const [plannerApprovalText, setPlannerApprovalText] = useState('Riziko adreste; ');
  const plannerRef = useRef<AcilOperasyonPlanlayiciHandle | null>(null);

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
  const [poolSuggestDismissed, setPoolSuggestDismissed] = useState(false);
  const [poolPromoteBusy, setPoolPromoteBusy] = useState(false);
  const [poolPromoteMsg, setPoolPromoteMsg] = useState<string | null>(null);
  const [, setMarginToast] = useState<MarginWarning>(null);
  const marginToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [budgetEditing, setBudgetEditing] = useState(true);
  const [draftFindings, setDraftFindings] = useState('');
  const [findingsError, setFindingsError] = useState<string | null>(null);
  const [, setFindingsSaving] = useState(false);
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

  const persistFlow = useCallback(async (next: AcilLocalFlow) => {
    const prev = flowRef.current;
    flowRef.current = next;
    setFlow(next);
    if (id) {
      writeAcilLocalFlow(id, next);
      const events = diffAcilProcessEvents(prev, next);
      if (events.length > 0) {
        const results = await Promise.all(
          events.map((event) =>
            recordEmergencyProcessEvent(id, event).then(() => true).catch(() => false),
          ),
        );
        if (
          results.some((ok) => !ok)
          && events.some((event) => event.action === 'EMERGENCY_MESSAGE_RECORDED')
        ) {
          setActionFlash('Bilgilendirme bu ekranda göründü; kayıt tamamlanamadı. Sayfayı yenileyip tekrar deneyin.');
        }
      }
    }
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const caseRes = await getCase(id);
      setVaka(caseRes.data);
      setDraftFindings(caseRes.data.findingsText ?? '');
      setFindingsError(null);
      const [costRes, processRes] = await Promise.all([
        getCostEntries(id).catch(() => ({
          data: [] as EmergencyCostEntry[],
          summary: { totalGelir: 0, totalGider: 0, netKar: 0 },
        })),
        listEmergencyProcessEvents(id).catch(() => ({ data: [] })),
      ]);
      setCosts(costRes.data);
      setCostSummary(costRes.summary);
      const localFlow = readAcilLocalFlow(id);
      const mergedFlow = applyAcilCaseTimestamps(
        mergeAcilFlowWithServerEvents(localFlow, processRes.data ?? []),
        caseRes.data,
      );
      const customerId = caseRes.data.customer?.id;
      const channel = customerId
        ? readAnaMusteriHaberlesme(customerId)
        : parseAnaMusteriHaberlesme(mergedFlow.customerNotifyChannel);
      const withPref: AcilLocalFlow = {
        ...mergedFlow,
        customerNotifyChannel: channel,
        vendorPaid:
          mergedFlow.vendorPaid === true ? true : mergedFlow.vendorPaid === false ? false : null,
      };
      writeAcilLocalFlow(id, withPref);
      flowRef.current = withPref;
      setFlow(withPref);
      setApprovalChannel(channel);
      const resolved = resolveAcilBudgetAmounts({
        costs: costRes.data,
        priceChangeLog: mergedFlow.priceChangeLog,
      });
      if (resolved.satis != null) {
        setSatisFiyati((prev) => prev || formatPriceInput(resolved.satis!));
        if (satisRef.current == null) satisRef.current = resolved.satis;
      }
      if (resolved.alis != null) {
        setAlisFiyati((prev) => prev || formatPriceInput(resolved.alis!));
        if (alisRef.current == null) alisRef.current = resolved.alis;
      }
    } catch (err) {
      reportCaughtError(err, 'Dosya yüklenemedi');
      setVaka(null);
      setActionFlash(getApiErrorMessage(err, 'Dosya yüklenemedi'));
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
    flowRef.current = saved;
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
    let cancelled = false;
    setRecsLoading(true);
    (async () => {
      try {
        const recRes = await getRecommendedVendors(id, 20);
        let list = recRes.data ?? [];
        if (list.length === 0) {
          const loc = deriveEmergencyLocation({
            city: vaka?.city,
            district: vaka?.district,
            address: vaka?.address,
          });
          if (loc.city) {
            const pool = await getEmergencyVendors(undefined, loc);
            list = (pool.data ?? []).map((v) => ({
              id: v.id,
              name: v.name,
              phone: v.phone,
              city: v.city ?? loc.city,
              district: v.district ?? loc.district,
              avgServiceScore: null,
              avgCost: null,
              avgResponseTime: null,
              completedFileCount: 0,
            }));
          }
        }
        if (!cancelled) setVendorRecs(list);
      } catch {
        if (!cancelled) setVendorRecs([]);
      } finally {
        if (!cancelled) setRecsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, vaka?.city, vaka?.district, vaka?.address]);

  useEffect(() => {
    if (!id) return;
    try {
      setPoolSuggestDismissed(window.localStorage.getItem(`acil-pool-suggest:${id}`) === '1');
    } catch {
      setPoolSuggestDismissed(false);
    }
    setPoolPromoteMsg(null);
  }, [id]);

  async function refreshCosts() {
    const res = await getCostEntries(id);
    setCosts(res.data);
    setCostSummary(res.summary);
  }

  async function handleAssignVendor(vendorId: string) {
    const rec = vendorRecs.find((v) => v.id === vendorId);
    if (rec?.qualityWarning) {
      const ok = window.confirm(
        'Bu tedarikçinin memnuniyet veya maliyet değerlendirmesi olumsuz. Alternatif tedarikçi aramanız gerekir. Yine de atamak istiyor musunuz?',
      );
      if (!ok) return;
    }
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

  async function handlePromoteAssignedVendorToPool() {
    const vendorId = vaka?.assignedVendorId;
    if (!vendorId) return;
    setPoolPromoteBusy(true);
    setPoolPromoteMsg(null);
    try {
      await promoteVendorToPool(vendorId);
      const res = await getCase(id);
      setVaka(res.data);
      setPoolPromoteMsg('Tedarikçi kayıtlı havuza eklendi. Sonraki dosyalarda önerilir.');
    } catch {
      setPoolPromoteMsg('Kayıt tamamlanamadı. Lütfen tekrar deneyin.');
    } finally {
      setPoolPromoteBusy(false);
    }
  }

  function dismissPoolSuggest() {
    try {
      window.localStorage.setItem(`acil-pool-suggest:${id}`, '1');
    } catch {
      /* ignore */
    }
    setPoolSuggestDismissed(true);
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

  async function upsertBudgetCostEntries(opts: {
    alis: number | null;
    satis: number | null;
    persistAlis: boolean;
    persistSatis: boolean;
    currentCosts?: EmergencyCostEntry[];
  }): Promise<EmergencyCostEntry[]> {
    const today = new Date().toISOString().slice(0, 10);
    const list = opts.currentCosts ?? costs;
    const vendorId = vaka?.assignedVendorId ?? undefined;

    if (opts.persistAlis && opts.alis != null && opts.alis > 0) {
      const existing = list.find((c) => c.entryType === 'gider');
      if (existing) {
        const prev = Number(existing.amount);
        if (!Number.isFinite(prev) || Math.abs(prev - opts.alis) >= 0.005) {
          await updateCostEntry(id, existing.id, {
            amount: opts.alis,
            vendorId: vendorId ?? existing.vendorId ?? null,
          });
        }
      } else {
        await addCostEntry(id, {
          entryType: 'gider',
          description: 'Tedarikçi Alış Fiyatı',
          amount: opts.alis,
          entryDate: today,
          vendorId,
        });
      }
    }

    if (opts.persistSatis && opts.satis != null && opts.satis > 0) {
      const existing = list.find((c) => c.entryType === 'gelir');
      if (existing) {
        const prev = Number(existing.amount);
        if (!Number.isFinite(prev) || Math.abs(prev - opts.satis) >= 0.005) {
          await updateCostEntry(id, existing.id, { amount: opts.satis });
        }
      } else {
        await addCostEntry(id, {
          entryType: 'gelir',
          description: 'Meridyen Satış Fiyatı',
          amount: opts.satis,
          entryDate: today,
        });
      }
    }

    const refreshed = await getCostEntries(id);
    setCosts(refreshed.data);
    setCostSummary(refreshed.summary);
    return refreshed.data;
  }

  function hydrateBudgetFields(resolved: { alis: number | null; satis: number | null }, force = false) {
    if (resolved.alis != null && (force || !(parsePriceInput(alisFiyati) > 0))) {
      const text = formatPriceInput(resolved.alis);
      setAlisFiyati(text);
      setDraftAlis(text);
      alisRef.current = resolved.alis;
    }
    if (resolved.satis != null && (force || !(parsePriceInput(satisFiyati) > 0))) {
      const text = formatPriceInput(resolved.satis);
      setSatisFiyati(text);
      setDraftSatis(text);
      satisRef.current = resolved.satis;
    }
  }

  /** @returns true if fiyat kaydı geçerli ve uygulandı (veya değişiklik yok ama form geçerli) */
  async function savePriceForm(): Promise<boolean> {
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
    const persistAlis = canSeeOpsCost && hasAlisInput && Number.isFinite(alisN) && alisN > 0;
    const persistSatis = hasSatisInput && Number.isFinite(satisN) && satisN > 0;

    if (persistAlis) {
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

    if (persistSatis) {
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
    }

    setPriceSaveBusy(true);
    try {
      await upsertBudgetCostEntries({
        alis: persistAlis ? alisN : null,
        satis: persistSatis ? satisN : null,
        persistAlis,
        persistSatis,
      });
      setActionFlash('Fiyat kaydedildi.');
      setPriceFormError(null);
      setBudgetEditing(false);
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Fiyat sunucuya kaydedilemedi. Tekrar deneyin.');
      reportCaughtError(err, msg);
      setPriceFormError(msg);
      return false;
    } finally {
      setPriceSaveBusy(false);
    }

    if (canSeeOpsCost) {
      const warn = getMarginWarning(
        calcMarginPercent(alisN, draftAlisVat, satisN, draftSatisVat),
      );
      if (warn) flashMarginWarning(warn);
    }
    return true;
  }

  async function savePriceFormAndClose() {
    if (!(await savePriceForm())) return;
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
      latitude: vaka.latitude,
      longitude: vaka.longitude,
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
    // Grup numarası yoktur. Numarasız açılır; personel sohbeti/grubu seçer, metin hazır durur.
    openWhatsApp(null, customerMsgPreview);
    persistFlow(appendMessageLog(flow, 'customer', customerMsgPreview));
    setCustomerMsgPreview(null);
    setActionFlash('WhatsApp açıldı. Sohbeti veya grubu seçin; metin hazır. Alış / kâr yok.');
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
    const current = flowRef.current;
    let next = appendMessageLog(current, logKind, insuredMsgPreview.text);
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

  /** 19.08.2026 dahil: geriye dönük giriş için WhatsApp açmadan gönderildi işareti */
  function markInsuredWhatsAppSentWithoutOpen() {
    if (!vaka || !insuredMsgPreview || !isWhatsAppMarkSentBypassActive()) return;
    const logKind = insuredMsgPreview.kind === 'initial' ? 'insured_initial' : 'insured_closure';
    const current = flowRef.current;
    let next = appendMessageLog(
      current,
      logKind,
      `[Geçici işaret — WhatsApp açılmadan] ${insuredMsgPreview.text}`,
    );
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
        ? 'İlk bilgilendirme gönderildi olarak işaretlendi (geçici muafiyet).'
        : 'Kapanış / anket gönderildi olarak işaretlendi (geçici muafiyet).',
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

  function readLiveBudgetAmounts(): { alis: number | null; satis: number | null } {
    const fromFormAlis = budgetEditing ? parsePriceInput(draftAlis) : parsePriceInput(alisFiyati);
    const fromFormSatis = budgetEditing ? parsePriceInput(draftSatis) : parsePriceInput(satisFiyati);
    const resolved = resolveAcilBudgetAmounts({
      costs,
      priceChangeLog: flow.priceChangeLog,
    });
    const alis =
      (Number.isFinite(fromFormAlis) && fromFormAlis > 0 ? fromFormAlis : null)
      ?? resolved.alis;
    const satis =
      (Number.isFinite(fromFormSatis) && fromFormSatis > 0 ? fromFormSatis : null)
      ?? resolved.satis;
    return { alis, satis };
  }

  function openApprovalModal() {
    if (!requireAssignedVendor()) return;
    setApprovalMsg(null);

    const live = readLiveBudgetAmounts();
    hydrateBudgetFields(live, true);

    const ready = approvalBudgetReady({
      alis: live.alis,
      satis: live.satis,
      requireAlis: canSeeOpsCost,
    });
    if (!ready.ok) {
      const msg = ready.missing === 'alis'
        ? 'Onay talebi için tedarikçi maliyetini girip Kaydet’e basın.'
        : 'Onay talebi için müşteri satış bedelini girip Kaydet’e basın.';
      setPriceFormError(msg);
      setActionFlash(msg);
      // Taslağı canlı tutardan doldur (setState henüz flush olmadan syncPriceDrafts boş yazmasın)
      if (live.alis != null) setDraftAlis(formatPriceInput(live.alis));
      if (live.satis != null) setDraftSatis(formatPriceInput(live.satis));
      setBudgetEditing(true);
      plannerRef.current?.openStep('tedarikci_maliyet');
      return;
    }

    setShowApprovalModal(true);
  }

  async function handleApprovalSubmit() {
    if (!requireAssignedVendor()) {
      setShowApprovalModal(false);
      return;
    }
    setApprovalBusy(true);
    setApprovalMsg(null);
    try {
      const live = readLiveBudgetAmounts();
      const ready = approvalBudgetReady({
        alis: live.alis,
        satis: live.satis,
        requireAlis: canSeeOpsCost,
      });
      if (!ready.ok) {
        const msg = ready.missing === 'alis'
          ? 'Tedarikçi maliyeti girin ve Kaydet’e basın.'
          : 'Müşteri satış bedelini girin ve Kaydet’e basın.';
        setApprovalMsg(msg);
        setPriceFormError(msg);
        return;
      }

      const alis = live.alis!;
      const satis = live.satis!;
      setAlisFiyati(formatPriceInput(alis));
      setSatisFiyati(formatPriceInput(satis));
      alisRef.current = alis;
      satisRef.current = satis;

      await upsertBudgetCostEntries({
        alis,
        satis,
        persistAlis: canSeeOpsCost,
        persistSatis: true,
      });

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
      setPriceFormError(null);
      setBudgetEditing(false);
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'Onay talebi oluşturulamadı');
      reportCaughtError(err, msg);
      setApprovalMsg(msg);
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

  async function handlePlannerWorkStart() {
    if (!vaka) return;
    if (!vaka.assignedVendorId) {
      setActionFlash('Önce tedarikçi atayın. İşe başlama atamadan sonra gelir.');
      return;
    }
    if (!flow.customerApproved) {
      setActionFlash('Önce müşteri onayı ve dijital evrak.');
      return;
    }
    const docsNow = vaka.operationChain?.documents;
    const digitalOk =
      (docsNow?.digitallyApprovedCount ?? 0) > 0 || Boolean(docsNow?.hasApprovedMatbuEvrak);
    const opGate = evaluateOperationStartGate({
      hasVendor: Boolean(vaka.assignedVendorId),
      saleReady: parsePriceInput(satisFiyati) > 0 || costSummary.totalGelir > 0,
      customerApproved: flow.customerApproved,
      digitalApproval: digitalOk,
    });
    if (!opGate.ready) {
      setActionFlash(`Operasyon açılamaz: ${opGate.missingLabels.join(', ')}.`);
      return;
    }
    if (flow.workStartPrepared) {
      setActionFlash('İş zaten başladı.');
      return;
    }
    setOpsActionBusy('work_start');
    try {
      const fileNo = vaka.fileNo || vaka.caseNo;
      const text = buildWorkStartWhatsAppText(fileNo, vaka.issueType);
      const vendorPhone = vaka.assignedVendor?.phone ?? null;
      openWhatsApp(vendorPhone, text);
      if (vaka.status !== 'SAHADA' && vaka.status !== 'COZULDU' && vaka.status !== 'FATURALANDILDI') {
        try {
          const res = await updateCaseStatus(id, 'SAHADA');
          setVaka(res.data);
        } catch {
          /* yerel akış yine ilerler */
        }
      }
      await persistFlow(appendFlowHistory(
        { ...flow, workStartPrepared: true },
        'İşe başlama (planlayıcı)',
      ));
      setActionFlash('İş başladı. Tedarikçiye mesaj hazırlandı. Sıradaki iş: kapanış.');
      await load();
    } catch (err) {
      setActionFlash(getApiErrorMessage(err, 'İşe başlama kaydedilemedi'));
    } finally {
      setOpsActionBusy(null);
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

  void applyDraftVatModeChange;
  void openBudgetEdit;
  void cancelBudgetEdit;
  void savePriceFormAndClose;
  void openApprovalModal;
  void handlePlannerWorkStart;
  void handleWorkStartMessage;

  async function handleServiceComplete() {
    if (!vaka || opsActionBusy) return;
    if (!requireAssignedVendor()) return;
    if (flow.serviceCompleted) {
      setActionFlash('Hizmet zaten tamamlandı olarak işaretli.');
      return;
    }
    if (
      !flow.workStartPrepared
      && vaka.status !== 'SAHADA'
      && vaka.status !== 'COZULDU'
      && vaka.status !== 'FATURALANDILDI'
    ) {
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
      await persistFlow(appendFlowHistory(
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

  async function handleCloseFile(allowIncomplete = false) {
    if (closeSubmitRef.current || closeBusy) return;
    if (!requireAssignedVendor()) {
      setConfirmAction(null);
      return;
    }
    const saleOk = parsePriceInput(satisFiyati) > 0 || costSummary.totalGelir > 0;
    const alreadyClosed =
      flow.fileClosed || vaka?.status === 'COZULDU' || vaka?.status === 'FATURALANDILDI';
    if (alreadyClosed) {
      setActionFlash('Dosya zaten kapalı.');
      return;
    }
    const gate = evaluateCloseFinanceGate({
      docs: vaka?.operationChain?.documents,
      inbox: vaka?.operationChain?.inbox,
      uploadedPhotoCount: closurePhotoCount,
      flow,
      saleReady: saleOk,
      customerNotifyChannel: flow.customerNotifyChannel,
    });
    const skippedLabels = gate.missingLabels;
    if (!gate.closeReady && !allowIncomplete && !isLegacyOpsCatchupBypassActive()) {
      if (skippedLabels.length > 0) {
        setConfirmAction('dosya_kapat_finansa');
        setActionFlash(`Eksik işlemler: ${skippedLabels.join(', ')}.`);
        return;
      }
      setActionFlash('Kapanış öncesi kontroller tamamlanmadan dosya kapatılamaz.');
      setConfirmAction(null);
      return;
    }

    closeSubmitRef.current = true;
    setCloseBusy(true);
    try {
      const closeRes = await updateCaseStatus(id, 'COZULDU');
      setVaka(closeRes.data);
      const mail = closeRes.data.autoClosureEmail;
      persistFlow(appendFlowHistory(
        {
          ...flow,
          fileClosed: true,
          serviceCompleted: true,
          closureEmailSent: Boolean(mail?.sent) || flow.closureEmailSent,
        },
        mail?.sent
          ? `Dosya kapatıldı. Ana müşteriye kapanış maili gitti${mail.to ? ` → ${mail.to}` : ''}.`
          : 'Dosya kapatıldı',
      ));
      setConfirmAction(null);
      if (mail?.sent) {
        setActionFlash(`Dosya kapatıldı. Ana müşteriye kapanış maili gitti${mail.to ? ` (${mail.to})` : ''}. Anket tercihli.`);
      } else if (mail?.error) {
        setActionFlash(`Dosya kapatıldı. Kapanış maili gidemedi: ${mail.error}`);
      } else {
        setActionFlash('Dosya kapatıldı. Anket tercihli. Sonraki iş: ödeme ve finans.');
      }
      await load();
    } catch (err: any) {
      setActionFlash(err?.message ?? 'Dosya kapatılamadı');
      setConfirmAction(null);
    } finally {
      closeSubmitRef.current = false;
      setCloseBusy(false);
    }
  }

  async function handleSendToFinance() {
    if (financeBusy) return;
    if (!requireAssignedVendor()) return;
    const closed =
      flow.fileClosed || vaka?.status === 'COZULDU' || vaka?.status === 'FATURALANDILDI';
    if (!closed) {
      setActionFlash('Önce dosyayı kapatın.');
      return;
    }
    if (flow.vendorPaid !== true && flow.vendorPaid !== false) {
      setActionFlash('Tedarikçi ödemesi evet veya hayır seçin.');
      return;
    }
    if (flow.financeTransferred || vaka?.status === 'FATURALANDILDI') {
      setActionFlash('Finansa aktarım zaten kayıtlı.');
      return;
    }
    setFinanceBusy(true);
    setFinanceResult(null);
    try {
      const financeRes = await updateCaseStatus(id, 'FATURALANDILDI');
      setVaka(financeRes.data);
      const grantedAt = financeRes.data.operationChain?.vendorEntitlementGrantedAt;
      const result = grantedAt
        ? `Finansa gönderildi. Tedarikçi hakedişi verildi (${fmtDateTime(grantedAt)}). Vade uygulanmaz.`
        : 'Finansa gönderildi. Tedarikçi hakedişi için alış kaydı gerekir.';
      setFinanceResult(result);
      persistFlow(appendFlowHistory(
        {
          ...flow,
          fileClosed: true,
          serviceCompleted: true,
          financeTransferred: true,
          vendorProcess: 'fatura_bekleniyor',
        },
        result,
      ));
      setActionFlash(result);
      await load();
    } catch (err: any) {
      const msg = err?.message ?? 'Finansa gönderme başarısız';
      setFinanceResult(msg);
      setActionFlash(msg);
    } finally {
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
  const stageEngineInput = {
    status: vaka.status,
    hasVendor: Boolean(vaka.assignedVendorId),
    hasAlis,
    flow,
  };
  const stageIdx = deriveAcilStageIndex(stageEngineInput);
  const chainDocs = vaka.operationChain?.documents;
  const digitalDocsOk =
    (chainDocs?.digitallyApprovedCount ?? 0) > 0 || Boolean(chainDocs?.hasApprovedMatbuEvrak);
  const vendorCostDone = (costSummary.totalGider > 0 || flow.costConfirmed || parsePriceInput(alisFiyati) > 0)
    && (parsePriceInput(satisFiyati) > 0 || costSummary.totalGelir > 0);
  const operatorStepStatuses: Record<OperatorStepKey, AcilPlannerStepStatus> = {
    ihbar: 'done',
    tedarikci_maliyet: vaka.assignedVendorId && vendorCostDone
      ? 'done'
      : 'waiting',
    onay: flow.customerApproved && digitalDocsOk
      ? 'done'
      : vendorCostDone
        ? 'waiting'
        : 'future',
    kapanis: (vaka.status === 'COZULDU' || vaka.status === 'FATURALANDILDI' || Boolean(vaka.resolvedAt) || flow.fileClosed)
      ? 'done'
      : flow.customerApproved && digitalDocsOk
        ? 'waiting'
        : 'future',
    finans: (flow.financeTransferred || vaka.status === 'FATURALANDILDI')
      ? 'done'
      : (vaka.status === 'COZULDU' || Boolean(vaka.resolvedAt) || flow.fileClosed)
        ? 'waiting'
        : 'future',
  };
  const owner = fileOwnerContact(vaka);
  const assigneeName = owner.name;
  const assigneeInitials = assigneeName !== '—' ? personInitials(assigneeName) : '—';
  const assigneeContact = [owner.phone, owner.email].filter(Boolean).join(' · ');
  const loc = deriveEmergencyLocation({
    city: vaka.city,
    district: vaka.district,
    address: vaka.address,
  });
  const addressDisplay = formatEmergencyFileAddress({
    address: vaka.address,
    district: loc.district ?? vaka.district,
    city: loc.city ?? vaka.city,
  });
  const recommendLocation = {
    city: loc.city ?? vaka.city ?? undefined,
    district: loc.district ?? vaka.district ?? undefined,
  };
  const liveBudgetForKpis = readLiveBudgetAmounts();
  const finansKpis = resolveAcilFinanceDisplayKpis({
    totalGelir: costSummary.totalGelir,
    totalGider: costSummary.totalGider,
    budgetAlis: liveBudgetForKpis.alis,
    budgetSatis: liveBudgetForKpis.satis,
    isApproved: Boolean(flow.customerApproved),
    hasFileExpenses: hasAcilProcessedFileExpenses(costs),
  });
  const karOrani = finansKpis.karOrani;
  const displaySatis = budgetEditing ? draftSatis : satisFiyati;
  const displayAlisVat = budgetEditing ? draftAlisVat : alisVatMode;
  const displaySatisVat = budgetEditing ? draftSatisVat : satisVatMode;
  const draftSatisNet = priceToNet(parsePriceInput(displaySatis), displaySatisVat);
  // Kâr uyarısı formda sürekli değil; yalnızca Kaydet’te (limit aşımında) geçici toast.
  const fileNo = vaka.fileNo || vaka.caseNo;
  const phone = insuredPhoneLabel(vaka);
  const insured = insuredLabel(vaka);
  const vendorWhatsAppText = buildVendorWhatsAppText({
    fileNo,
    issueType: vaka.issueType,
    insuredLabel: insured,
    phone: phone === '—' ? '' : phone,
    address: vaka.address,
    city: vaka.city,
    district: vaka.district,
    notes: vaka.notes,
    latitude: vaka.latitude,
    longitude: vaka.longitude,
  });
  const decisionLabel = resolveEmergencyOperationLabel({
    status: vaka.status,
    notes: vaka.notes,
  });
  const fileRejected = decisionLabel === 'Reddedildi' || vaka.operationStatusLabel === 'Reddedildi';
  const guncelDurum = fileRejected
    ? 'Reddedildi'
    : (ACIL_STAGES[stageIdx]?.label ?? statusLabel(vaka.status));

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
    customerNotifyChannel: flow.customerNotifyChannel,
  });
  const requiredOps = closeGate.requiredOps;
  const requiredOpsComplete = closeGate.requiredOpsComplete;
  const fileAlreadyClosed =
    flow.fileClosed || vaka.status === 'COZULDU' || vaka.status === 'FATURALANDILDI';
  const financeDone = flow.financeTransferred || vaka.status === 'FATURALANDILDI';
  const dosyaKonusuLabel = resolveClaimDosyaKonusu({ lossType: vaka.issueType }) || '—';
  const anaMusteriKisa = customerLabel(vaka).trim() || '—';
  const anaMusteriUzun = customerFullLabel(vaka).trim() || '—';
  const ihbarRozet = ihbarTarihiKisa(
    vaka.operationTimestamps?.notifiedAt
      ?? vaka.operationChain?.inbox?.lastReceivedAt
      ?? vaka.fileDate
      ?? vaka.createdAt,
  );
  const workStartedLabel = vaka.operationTimestamps?.workStartedAt
    ? fmtDateTime(vaka.operationTimestamps.workStartedAt)
    : vaka.workStartedAt
      ? fmtDateTime(vaka.workStartedAt)
      : '';
  const serviceDeliveredLabel = vaka.operationTimestamps?.serviceDeliveredAt
    ? fmtDateTime(vaka.operationTimestamps.serviceDeliveredAt)
    : vaka.serviceDeliveredAt
      ? fmtDateTime(vaka.serviceDeliveredAt)
      : '';
  const closedAtLabel = vaka.operationTimestamps?.closedAt
    ? fmtDateTime(vaka.operationTimestamps.closedAt)
    : vaka.resolvedAt
      ? fmtDateTime(vaka.resolvedAt)
      : '';
  const headerBand = [
    anaMusteriKisa !== '—' ? anaMusteriKisa : null,
    fileNo || null,
    dosyaKonusuLabel !== '—' ? dosyaKonusuLabel : null,
  ].filter(Boolean).join(' - ');
  const requiredOpsItems = closeGate.items;
  const missingCloseLabels = closeGate.missingLabels;

  const workStartDone = flow.customerApproved && digitalDocsOk;
  const serviceDone = flow.serviceCompleted || fileAlreadyClosed;
  const initialNotifyDone = requiredOps.insuredInitialNotify;
  const closureSurveyDone = closeGate.surveyDone;
  /** Anket: dosya kapandıktan sonra tercihli */
  const closureSurveyUnlocked = fileAlreadyClosed;

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
    <div className="w-full min-w-0 space-y-2 pb-24 sm:pb-8 overflow-x-hidden" data-testid="acil-dosya-detay">
      <OpsFirstRunNotice
        noticeId={OPS_NOTICE.acilDosyaSonDegisiklik.id}
        title={OPS_NOTICE.acilDosyaSonDegisiklik.title}
        body={OPS_NOTICE.acilDosyaSonDegisiklik.body}
        testId="acil-dosya-ilk-kullanim-seridi"
      />
      <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="dosya-basligi">
        <div className="flex items-center px-4 pt-2.5">
          <button
            type="button"
            onClick={handleBack}
            className="shrink-0 text-sm text-slate-400 hover:text-slate-700"
            data-testid="acil-dosya-geri"
          >
            ← Geri
          </button>
          <h1 className="sr-only" data-testid="acil-dosya-sayfa-basligi">
            Acil Yardım - Dosya Detayı
          </h1>
        </div>

        <div className="mx-4 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-blue-100/80 bg-blue-50/60 px-3 py-2">
          <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-blue-900">
            {headerBand}
          </p>
          <div className="flex w-full min-w-0 items-center justify-end gap-2 sm:ml-auto sm:w-auto">
            <div className="shrink-0">
              <ClaimFileHeaderActionsMenu
                fileNo={vaka.fileNo || vaka.caseNo}
                showManualDecision
                onManualDecision={async (action: ManualDecisionAction, reason: string) => {
                  try {
                    const res = await recordEmergencyManualDecision(id, { action, reason });
                    const hint = res?.data?.flowHint;
                    if (hint === 'customerApproved') {
                      await persistFlow(appendFlowHistory(
                        { ...flow, customerApproved: true, approvalDetected: false, approvalRequested: true },
                        `Manuel onay: ${reason}`,
                      ));
                    } else if (hint === 'approvalRejected') {
                      await persistFlow(appendFlowHistory(
                        { ...flow, customerApproved: false, approvalDetected: false, approvalRequested: true },
                        `Manuel red: ${reason}`,
                      ));
                    } else {
                      await persistFlow(appendFlowHistory(
                        { ...flow, approvalDetected: false, approvalRequested: true },
                        `Manuel revizyon: ${reason}`,
                      ));
                    }
                    await load();
                    setActionFlash(
                      action === 'approve'
                        ? 'Manuel onay kaydedildi. Yönetici ve müşteri bilgilendirildi.'
                        : action === 'reject'
                          ? 'Manuel red kaydedildi. Yönetici ve müşteri bilgilendirildi.'
                          : 'Manuel revizyon kaydedildi. Yönetici ve müşteri bilgilendirildi.',
                    );
                  } catch (err: any) {
                    setActionFlash(getApiErrorMessage(err, 'Manuel karar kaydedilemedi'));
                    throw err;
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setFileFactsOpen((v) => !v)}
                className="flex flex-wrap items-center gap-2 text-left hover:opacity-90 transition-opacity"
              >
                <p className="text-[11px] font-semibold text-slate-600">Dosya Bilgileri</p>
                {ihbarRozet !== '—' && (
                  <span className={`${FILE_STATUS_BADGE_BASE} ${FILE_STATUS_TONE.teal}`}>
                    İhbar Tarihi {ihbarRozet}
                  </span>
                )}
                <span
                  className={`${FILE_STATUS_BADGE_BASE} ${acilDurumBadgeClass(guncelDurum, stageIdx)}`}
                  data-testid="guncel-durum"
                >
                  {guncelDurum}
                </span>
                {URGENCY_OZET[vaka.urgency] ? (
                  <span
                    className={`${FILE_STATUS_BADGE_BASE} ${URGENCY_BADGE[vaka.urgency] ?? URGENCY_BADGE.NORMAL}`}
                    data-testid="acil-oncelik-rozet"
                  >
                    {URGENCY_OZET[vaka.urgency]}
                  </span>
                ) : null}
              </button>
              {!fileFactsOpen ? (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
                  {insured && insured !== '—' ? <span>Sigortalı {insured}</span> : <span>Sigortalı —</span>}
                  {phone !== '—' ? (
                    <>
                      <span aria-hidden>·</span>
                      <PhoneContactActions
                        phone={phone}
                        variant="inline"
                        accent="blue"
                        size="sm"
                      />
                    </>
                  ) : null}
                  {addressDisplay ? <span> · {addressDisplay}</span> : null}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setFileFactsOpen((v) => !v)}
              className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              {fileFactsOpen ? 'Gizle' : 'Detay'}
            </button>
          </div>
          {fileFactsOpen ? (
            <div className="px-4 pb-3 pt-0 border-t border-slate-100 bg-slate-50/40">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-3 pt-3">
                <div className="min-w-0 text-center" data-testid="ana-musteri">
                  <p className="text-[11px] text-slate-400">Ana Müşteri</p>
                  <p className="mt-0.5 truncate text-xs font-medium text-slate-800" title={anaMusteriUzun}>
                    {anaMusteriUzun}
                  </p>
                </div>
                <div className="min-w-0 text-center">
                  <p className="text-[11px] text-slate-400">Sigortalı Adı Soyadı</p>
                  <p className="mt-0.5 truncate text-xs font-medium text-slate-800" title={insured}>
                    {insured}
                  </p>
                </div>
                <div className="min-w-0 text-center" data-testid="sigortali-telefon">
                  <p className="text-[11px] text-slate-400">Sigortalı Telefon</p>
                  {phone !== '—' ? (
                    <PhoneContactActions
                      phone={phone}
                      variant="inline"
                      accent="blue"
                      size="sm"
                      className="mt-0.5 justify-center"
                    />
                  ) : (
                    <p className="mt-0.5 truncate text-xs font-medium text-slate-800">{phone}</p>
                  )}
                </div>
                <div className="min-w-0 text-center">
                  <p className="text-[11px] text-slate-400">Dosya Konusu</p>
                  <p className="mt-0.5 truncate text-xs font-medium text-slate-800" title={dosyaKonusuLabel}>
                    {dosyaKonusuLabel}
                  </p>
                </div>
                <div className="min-w-0 text-center" data-testid="dosya-sorumlusu">
                  <p className="text-[11px] text-slate-400">Dosya Sorumlusu</p>
                  <div className="mt-0.5 flex min-w-0 items-center justify-center gap-1.5">
                    {assigneeName !== '—' ? (
                      <span
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[8px] font-bold text-white"
                        aria-hidden
                      >
                        {assigneeInitials}
                      </span>
                    ) : null}
                    <p className="truncate text-xs font-medium text-slate-800">{assigneeName}</p>
                  </div>
                  {assigneeContact ? (
                    <p className="mt-0.5 truncate text-[11px] text-slate-500" title={assigneeContact}>
                      {assigneeContact}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                <div className="min-w-0" data-testid="acil-konum-tespit">
                  <p className="text-[11px] text-slate-400">Adres</p>
                  <p className="mt-0.5 text-xs font-medium leading-snug text-slate-800" title={addressDisplay}>
                    {addressDisplay}
                  </p>
                  {vaka.latitude != null && vaka.longitude != null ? (
                    <LocationPreview
                      lat={vaka.latitude}
                      lng={vaka.longitude}
                      addressLabel={addressDisplay}
                      onEdit={() => setLocationPickerOpen(true)}
                      onClear={() => {
                        void (async () => {
                          try {
                            const res = await updateCase(id, { latitude: null, longitude: null });
                            setVaka(res.data);
                          } catch {
                            setActionFlash('Konum kaldırılamadı');
                          }
                        })();
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLocationPickerOpen(true)}
                      className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Konum Tespiti
                    </button>
                  )}
                </div>
                <div className="min-w-0" data-testid="dosya-notlari">
                  <p className="text-[11px] text-slate-400">Dosya Notları</p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-xs font-medium leading-snug text-slate-800">
                    {(vaka.notes || '').trim() || 'Bu dosya için henüz not yok.'}
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3" data-testid="acil-islem-saatleri">
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400">İhbar</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-800">{ihbarRozet}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400">İşe başlama</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-800">{workStartedLabel || '—'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400">Hizmet verilme</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-800">{serviceDeliveredLabel || '—'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400">Kapanış</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-800">{closedAtLabel || '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {isHistorical && historicalExempt && (
          <div className="mx-4 mb-3 flex flex-wrap items-center gap-2" data-testid="tarihsel-dosya-muafiyet">
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
          <p className="mx-4 mb-3 text-[11px] text-emerald-700" data-testid="tarihsel-finans-optin-active">
            Yeni finans dönemine dahil edildi.
          </p>
        )}
        {vaka.activeDelegation && (
          <div className="mx-4 mb-3">
            <DelegationBanner delegation={vaka.activeDelegation} />
          </div>
        )}
      </div>

      <div
        className={`${PANEL_CARD_BASE} px-4 py-2.5`}
        data-testid="acil-finans-ozet-serit"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-green-50 border border-green-100 px-2.5 py-2">
            <p className="text-xs font-medium text-green-700">Gelir</p>
            <p className="text-sm font-semibold tabular-nums text-green-800">{fmtCurrency(finansKpis.gelir)}</p>
          </div>
          <div className="rounded-lg bg-red-50 border border-red-100 px-2.5 py-2">
            <p className="text-xs font-medium text-red-700">Gider</p>
            <p className="text-sm font-semibold tabular-nums text-red-800">{fmtCurrency(finansKpis.gider)}</p>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-2">
            <p className="text-xs font-medium text-brand-700">{finansKpis.profitLabel}</p>
            <p className="text-sm font-semibold tabular-nums text-blue-800">{fmtCurrency(finansKpis.net)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2">
            <p className="text-xs font-medium text-slate-500">Kâr Oranı</p>
            <p className="text-sm font-semibold tabular-nums text-slate-800">%{karOrani.toFixed(1)}</p>
          </div>
        </div>
      </div>

      <AcilOperasyonPlanlayiciPanel
        ref={plannerRef}
        vendorStep={(
          <div className="space-y-3">
            <OpsFirstRunNotice
              noticeId={OPS_NOTICE.acilKayitliTedarikci.id}
              title={OPS_NOTICE.acilKayitliTedarikci.title}
              body={OPS_NOTICE.acilKayitliTedarikci.body}
              testId="tedarikci-ilk-kullanim-seridi"
            />
            <RecommendedVendorsTabs
              assignedBadge={Boolean(vaka.assignedVendor)}
              loading={recsLoading}
              vendors={vendorRecs}
              assignedVendorId={vaka.assignedVendorId}
              assignLoading={assignLoading}
              onAssign={handleAssignVendor}
              preferAlternatif={
                forceAltVendor
                || flow.vendorProcess === 'reddedildi'
                || (!recsLoading && vendorRecs.length === 0 && !vaka.assignedVendorId)
              }
              city={recommendLocation.city}
              district={recommendLocation.district}
              serviceType={vaka.issueType ?? undefined}
              category="acil"
              fillHeight={false}
              helpText="Üstte Memnuniyet Ve Fiyat Avantajı Yüksek İlk 3 Önerilir. Diğer Kayıtlılar Aynı Listede Kapalı/Açılır. Bölgede Yoksa Alternatif Önerilere Bakın."
              onAlternativeAssigned={async (vendor) => {
                await handleAssignVendor(vendor.id);
              }}
              onSavedToPool={() => {
                setActionFlash('Tedarikçi havuza kaydedildi. Sonraki dosyalarda önerilir.');
              }}
            />
          </div>
        )}
        approvalStep={(
          <div className="space-y-3" data-testid="acil-onay-evrak">
            <FileDocumentPanel
              entityType="emergency_case"
              entityId={vaka.id}
              documentKind="matbu_evrak"
            />
          </div>
        )}
        closingStep={(
          <div className="space-y-3">
            <section
              className="rounded-xl border border-slate-200 bg-white p-3 space-y-3"
              data-testid="acil-saha-tespit"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-slate-900">İşlem detayı ve resimler</h4>
                <p className="text-[11px] text-slate-500">Tedarikçiden gelince dosyaya işlenir</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold text-slate-600">Tespit Fotoğrafları</p>
                  <FieldInspectionPhotosPanel entityType="emergency_case" entityId={vaka.id} />
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold text-slate-600">Tespit Notları</p>
                  <div className="relative">
                    <textarea
                      value={draftFindings}
                      onChange={(e) => {
                        setDraftFindings(e.target.value);
                        if (e.target.value.trim()) setFindingsError(null);
                      }}
                      onBlur={() => { void saveFindingsText(); }}
                      rows={5}
                      placeholder="Tespit bulgularını yazın…"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      data-testid="tespit-bulgulari-input"
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
                  {findingsError ? (
                    <p className="mt-1 text-xs text-status-danger" data-testid="tespit-bulgulari-error">{findingsError}</p>
                  ) : null}
                </div>
              </div>
            </section>
            <ClosurePhotosPanel
              entityId={vaka.id}
              onPhotoCountChange={setClosurePhotoCount}
              readonly={fileAlreadyClosed}
            />
          </div>
        )}
        stepStatuses={operatorStepStatuses}
        body={{
          step: 'ihbar',
          file: {
            fileNo: vaka.fileNo || vaka.caseNo,
            insured,
            phone: phone !== '—' ? phone : (vaka.customerPhone || ''),
            customer: customerLabel(vaka),
            customerPhone: vaka.customer?.phone || vaka.customerPhone || '',
            customerEmail: vaka.customer?.email || '',
            subject: dosyaKonusuLabel,
            ihbarDate: ihbarRozet,
            workStartedAt: workStartedLabel,
            serviceDeliveredAt: serviceDeliveredLabel,
            closedAt: closedAtLabel,
            appointmentDate: '—',
            appointmentTime: '—',
          },
          address: addressDisplay,
          vendorWhatsAppText,
          vendors: vendorRecs,
          assigned: vaka.assignedVendorId ?? null,
          assignedVendor:
            (vendorRecs.find((v) => v.id === vaka.assignedVendorId)
              ?? (vaka.assignedVendor
                ? ({
                    id: vaka.assignedVendor.id,
                    name: vaka.assignedVendor.name,
                    phone: vaka.assignedVendor.phone ?? null,
                    city: vaka.city ?? null,
                    district: vaka.district ?? null,
                    avgResponseTime: null,
                    avgServiceScore: null,
                    avgCost: null,
                    completedFileCount: 0,
                    serviceBranches: [],
                  } satisfies VendorRecommendation)
                : null)),
          alis: alisFiyati,
          satis: satisFiyati,
          workStartOk: workStartDone,
          serviceDone: Boolean(serviceDeliveredLabel) || flow.serviceCompleted,
          fileClosed: fileAlreadyClosed,
          digitalDocsOk,
          vendorPaid: flow.vendorPaid,
          alisVatMode: displayAlisVat,
          satisVatMode: displaySatisVat,
          satisNetLabel: Number.isFinite(draftSatisNet)
            ? `${formatPriceInput(draftSatisNet)} TL`
            : undefined,
          inboxPhotoCount: vaka.operationChain?.inbox?.attachmentCount ?? 0,
          hakedisAt: vaka.operationChain?.vendorEntitlementGrantedAt
            ? fmtDateTime(vaka.operationChain.vendorEntitlementGrantedAt)
            : null,
          financeSent: financeDone,
          canOpenFinancePage: showAcilFinancePage,
          financeAt: financeDone && vaka.updatedAt ? fmtDateTime(vaka.updatedAt) : null,
          approvalChannel: plannerApprovalChannel,
          approvalState: (flow.customerApproved
            ? 'onaylandi'
            : guncelDurum === 'Reddedildi'
              ? 'reddedildi'
              : 'bekliyor') as PlannerApprovalState,
          approvalRequestedAt: flow.approvalRequested ? 'Talep gönderildi' : '—',
          approvalDecidedAt: flow.customerApproved ? 'Onaylandı' : null,
          approvalText: plannerApprovalText,
          waLog: [],
          photos: [],
          customerNotifyChannel: flow.customerNotifyChannel,
          onAssign: (vid) => { void handleAssignVendor(vid); },
          onAlis: (v) => {
            setAlisFiyati(v);
            setDraftAlis(v);
            setBudgetEditing(true);
          },
          onSatis: (v) => {
            setSatisFiyati(v);
            setDraftSatis(v);
            setBudgetEditing(true);
          },
          onWorkStart: () => undefined,
          onServiceComplete: (ok) => {
            if (ok) void handleServiceComplete();
          },
          onCloseFile: () => { void handleCloseFile(); },
          onFinance: () => { void handleSendToFinance(); },
          onVendorPaid: (v) => {
            persistFlow(appendFlowHistory(
              { ...flow, vendorPaid: v },
              v ? 'Tedarikçi hakediş: ödendi (onaylı kayıt)' : 'Tedarikçi hakediş: ödenmedi (onaylı kayıt)',
            ));
          },
          onInsuredNotify: () => requestInsuredWhatsAppSend('initial'),
          onClosureSurvey: () => requestInsuredWhatsAppSend('closure_survey'),
          onCustomerNotifyChannel: (v) => {
            const cid = vaka.customer?.id;
            writeAnaMusteriHaberlesme(cid, v);
            setApprovalChannel(v);
            persistFlow(appendFlowHistory({ ...flow, customerNotifyChannel: v }, `Ana müşteri haberleşme: ${v}`));
          },
          onCustomerEmail: () => {
            const to = vaka.customer?.email?.trim();
            if (!to) {
              setActionFlash('Ana müşteri e-postası kayıtlı değil.');
              return;
            }
            const fileNo = vaka.fileNo || vaka.caseNo;
            const subj = encodeURIComponent(`Onay talebi – ${fileNo}`);
            const body = encodeURIComponent(plannerApprovalText.trim() || `${fileNo} hizmet bedeli onayı.`);
            window.open(`mailto:${to}?subject=${subj}&body=${body}`, '_self');
            persistFlow(appendFlowHistory(flow, `Onay e-postası açıldı → ${to}`));
          },
          onClosureEmail: () => { void openClosureEmailModal(); },
          onApprovalChannel: setPlannerApprovalChannel,
          onApprovalState: (st) => {
            void (async () => {
              if (st === 'onaylandi') {
                await persistFlow(appendFlowHistory(
                  { ...flow, customerApproved: true, approvalDetected: false, approvalRequested: true, workStartPrepared: true },
                  'Müşteri onayı (planlayıcı)',
                ));
                if (vaka.status !== 'SAHADA' && vaka.status !== 'COZULDU' && vaka.status !== 'FATURALANDILDI') {
                  try {
                    const res = await updateCaseStatus(id, 'SAHADA');
                    setVaka(res.data);
                  } catch {
                    /* onay kaydı durur */
                  }
                }
              } else if (st === 'reddedildi') {
                await persistFlow(appendFlowHistory(
                  { ...flow, customerApproved: false, approvalDetected: false, approvalRequested: true },
                  'Müşteri red (planlayıcı)',
                ));
              }
            })();
          },
          onApprovalText: setPlannerApprovalText,
          onWhatsApp: (to, ph, text) => {
            const opened = openWhatsApp(ph, text);
            if (!opened) {
              setActionFlash('WhatsApp açılamadı. Numarayı kontrol edin veya sohbeti elle seçin.');
              return;
            }
            if (to === 'Müşteri') {
              persistFlow(appendMessageLog(flowRef.current, 'customer', text));
            } else {
              persistFlow(appendFlowHistory(flow, `WhatsApp açıldı → ${to}`));
            }
          },
        }}
        onSaved={async (step) => {
          if (step === 'tedarikci_maliyet') {
            setDraftAlis(alisFiyati);
            setDraftSatis(satisFiyati);
            const ok = await savePriceForm();
            if (!ok) throw new Error(priceFormError || 'Fiyat kaydedilemedi.');
            if (!vaka.assignedVendorId) throw new Error('Tedarikçi atayın.');
          }
          if (step === 'kapanis' && !fileAlreadyClosed) {
            await handleCloseFile();
          }
          if (step === 'finans' && !financeDone) {
            await handleSendToFinance();
          }
        }}
      />

      {/* Ana sayfa: özet (planlayıcı) + bildirim / havuz; iş sağ çekmecede */}
      {actionFlash ? (
        <span
          className="inline-flex rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800"
          data-testid="aksiyon-bildirim"
        >
          {actionFlash}
        </span>
      ) : null}

      {serviceDone && isAcilFileOnlyVendor(vaka.assignedVendor) && !poolSuggestDismissed ? (
        <div
          className={`${PANEL_CARD_BASE} p-3 space-y-2`}
          data-testid="tedarikci-havuz-tavsiye"
        >
          <p className="text-sm font-semibold text-content-primary">Tedarikçi Kaydı</p>
          <p className="text-xs text-content-secondary leading-snug">
            Hizmet tamamlandı. Memnuniyet olumluyduysa bu tedarikçiyi kayıtlı havuza ekleyin.
          </p>
          {poolPromoteMsg ? (
            <p className="text-xs text-status-success">{poolPromoteMsg}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handlePromoteAssignedVendorToPool()}
              disabled={poolPromoteBusy}
              className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              data-testid="tedarikci-havuza-kaydet"
            >
              {poolPromoteBusy ? 'Kaydediliyor...' : 'Havuza Kaydet'}
            </button>
            <button
              type="button"
              onClick={dismissPoolSuggest}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              data-testid="tedarikci-havuz-atla"
            >
              Şimdi Değil
            </button>
          </div>
        </div>
      ) : null}

      <OpsFirstRunNotice
        noticeId={OPS_NOTICE.acilTedarikciHakedis.id}
        title={OPS_NOTICE.acilTedarikciHakedis.title}
        body={OPS_NOTICE.acilTedarikciHakedis.body}
        testId="acil-hakedis-ilk-kullanim-seridi"
      />
      {vaka.operationChain?.vendorEntitlementGrantedAt ? (
        <p className="text-[11px] text-emerald-700" data-testid="acil-hakedis-ozet">
          Hakediş verildi · {fmtDateTime(vaka.operationChain.vendorEntitlementGrantedAt)} · Vade uygulanmaz
        </p>
      ) : (
        <p className="sr-only">Vade uygulanmaz</p>
      )}

      {/* Kilit / smoke: tutarlar çekmecede; ana sayfada gizli tutamak */}
      <div className="sr-only" aria-hidden data-testid="alis-ozet" id="maliyet-onay" ref={priceFormRef}>
        <span className="absolute right-2.5">TL</span>
        <input data-testid="alis-fiyati" value={alisFiyati} readOnly tabIndex={-1} />
        <input data-testid="satis-fiyati" value={satisFiyati} readOnly tabIndex={-1} />
        <span data-testid="alis-fiyati-ozet">{alisFiyati.trim() || '—'}</span>
        <span data-testid="satis-fiyati-ozet">{satisFiyati.trim() || '—'}</span>
        <span data-testid="tedarikci-ozet-ad">
          {vaka.assignedVendorId ? (vaka.assignedVendor?.name || 'Atandı') : 'Atanmadı'}
        </span>
        <ul data-testid="zorunlu-islem-listesi">
          {requiredOpsItems.map((item) => (
            <li key={item.key} data-testid={`zorunlu-${item.key}`} data-done={item.done ? '1' : '0'}>
              {item.label}
            </li>
          ))}
        </ul>
        <span data-testid="zorunlu-islemler-ozet">
          {requiredOpsComplete
            ? `${requiredOpsItems.length}/${requiredOpsItems.length} Tamam`
            : `${requiredOpsItems.filter((i) => i.done).length}/${requiredOpsItems.length}`}
        </span>
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

      {/* Alt kayıtlar — Hasar evrak kartı gibi tek pencere */}
      <div className={`${PANEL_CARD_BASE} overflow-hidden`} data-testid="alt-operasyon">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/40 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Dosya kayıtları</p>
            <p className="mt-0.5 text-xs text-slate-500">Belgeler, yazışma, geçmiş ve finans kayıtları</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="sr-only">Kayıt türü</span>
            <select
              value={altTab}
              onChange={(e) => setAltTab(e.target.value as AltBolumTab)}
              className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm"
              data-testid="alt-bolum-sekmeler"
            >
              <option value="belgeler">Belgeler</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="gecmis">Dosya Geçmişi</option>
              <option value="finans">Finans</option>
            </select>
          </label>
        </div>

        <div className="p-4" data-testid="alt-bolum-icerik">
          {altTab === 'belgeler' && (
            <div
              id="dosya-belgeleri"
              className="space-y-3 min-w-0"
              data-testid="dosya-belgeleri"
            >
              <div>
                <SectionTitle
                  icon={Files}
                  title="Dosya Belgeleri"
                  iconClassName="text-slate-600"
                />
                <p className="mt-1 text-xs text-slate-500 leading-snug">
                  Yazışma ekleri. Servis onay formu burada da durur. Kapanış fotoğrafları kapanış adımında.
                </p>
              </div>
              <FileDocumentPanel
                entityType="emergency_case"
                entityId={vaka.id}
                documentKind="matbu_evrak"
              />
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 max-h-36 overflow-auto">
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
              <WhatsAppBrandIcon className="h-3.5 w-3.5 text-emerald-600" />
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
                Manuel gönderim — otomatik mesaj yok. Anket dosya kapandıktan sonra tercihlidir.
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
              {!anaMusteriAllowsWhatsApp(flow.customerNotifyChannel) ? (
                <span className="text-[10px] text-slate-500 flex-1">
                  Bu müşteri e-posta ile çalışır. WhatsApp bu müşteride kapalı.
                </span>
              ) : (
                <>
              {customerMsgError ? (
                <p className="text-[10px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1.5 flex-1 min-w-0" data-testid="whatsapp-musteri-hata">
                  {customerMsgError}
                </p>
              ) : (
                <span className="text-[10px] text-slate-500 flex-1">
                  WhatsApp açılınca grubu siz seçersiniz. Metin hazır durur. Alış / kâr yok.
                </span>
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
                </>
              )}
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
                    .map((h, i) => {
                      const row = mapWhatsAppThreadRow({ at: h.at, text: h.text });
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
                            <WhatsAppReadCheck read />
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
            {vaka.operationChain && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600 space-y-1">
                {historicalExempt ? (
                  <p data-testid="tarihsel-finans-muaf">
                    Hakediş: Zorunlu Değil · Ödeme / Cari: Zorunlu Değil
                  </p>
                ) : (
                  <p>
                    Durum özeti: satış {finansKpis.gelir > 0 ? 'var' : 'yok'}
                    {' · '}
                    alış {finansKpis.gider > 0 ? 'var' : 'yok'}
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
                    onClick={() => { setShowGelirForm((v) => !v); }}
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

              <div className="border border-slate-100 rounded-xl overflow-hidden" data-testid="acil-gider-ozet">
                <div className="px-3 py-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-red-700">Gider</span>
                  <p className="mt-0.5 text-[10px] text-slate-500">Alış tutarı operasyonda girilir. Buradan gider eklenmez.</p>
                </div>
                {costs.filter((c) => c.entryType === 'gider').length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">Henüz gider yok</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {costs.filter((c) => c.entryType === 'gider').map((c) => (
                      <div key={c.id} className="px-3 py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{c.description}</p>
                          <p className="text-[10px] text-slate-400">
                            {fmtDate(c.entryDate)}
                            {c.vendor ? ` · ${c.vendor.name}` : ''}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-red-600 shrink-0">-{fmtCurrency(c.amount)}</span>
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
                fileClosed={vaka.status === 'COZULDU' || vaka.status === 'FATURALANDILDI'}
              />
            )}
          </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobil: tek operasyon kapısı + WhatsApp */}
      <div
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur px-3 py-2 flex gap-2 safe-area-pb"
        data-testid="mobil-alt-cubuk"
      >
        <button
          type="button"
          onClick={() => plannerRef.current?.openStep(vaka.assignedVendorId ? 'ihbar' : 'tedarikci_maliyet')}
          className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-brand-600 text-white text-xs font-semibold"
        >
          Operasyonu Başlat
        </button>
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
        ) : null}
      </div>

      {/* Onay kanalı modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" data-testid="onay-talebi-modal">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Onay Talebi Oluştur</h3>
            <p className="text-xs text-slate-500">
              Bu müşteri için yöntem. Satış fiyatı seçilen kanala iletilir. Alış fiyatı gönderilmez.
            </p>
            {approvalMsg && (
              <p
                className="text-xs text-status-danger bg-rose-50 border border-rose-100 rounded-lg px-2 py-1.5"
                data-testid="onay-talebi-modal-hata"
                role="alert"
              >
                {approvalMsg}
              </p>
            )}
            <fieldset className="space-y-2">
              {([
                { id: 'whatsapp' as const, label: 'WhatsApp' },
                { id: 'email' as const, label: 'E-posta' },
                { id: 'both' as const, label: 'WhatsApp ve e-posta' },
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
                    onChange={() => {
                      setApprovalChannel(opt.id);
                      const cid = vaka.customer?.id;
                      writeAnaMusteriHaberlesme(cid, opt.id);
                      persistFlow({ ...flow, customerNotifyChannel: opt.id });
                    }}
                    className="accent-brand-600"
                  />
                  <span className="text-sm font-medium text-slate-800">{opt.label}</span>
                </label>
              ))}
            </fieldset>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowApprovalModal(false); setApprovalMsg(null); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={approvalBusy}
                onClick={() => { void handleApprovalSubmit(); }}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50 hover:bg-brand-700"
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

      <LocationPickerModal
        open={locationPickerOpen}
        initial={
          vaka.latitude != null && vaka.longitude != null
            ? { lat: vaka.latitude, lng: vaka.longitude }
            : null
        }
        addressHint={addressDisplay}
        onClose={() => setLocationPickerOpen(false)}
        onConfirm={(coords: LatLng) => {
          setLocationPickerOpen(false);
          void (async () => {
            try {
              const res = await updateCase(id, { latitude: coords.lat, longitude: coords.lng });
              setVaka(res.data);
              setActionFlash('Konum kaydedildi.');
            } catch {
              setActionFlash('Konum kaydedilemedi');
            }
          })();
        }}
      />

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
              Alış fiyatı, kâr oranı ve iç operasyon notları bu mesajda yoktur. WhatsApp açılınca sohbeti veya müşteri grubunu seçin; metin hazır durur.
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
            {isWhatsAppMarkSentBypassActive() ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {WHATSAPP_MARK_SENT_BYPASS_NOTE}
              </p>
            ) : null}
            <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-xl p-3" data-testid="sigortali-mesaj-govde">
              {insuredMsgPreview.text}
            </pre>
            <div className="flex flex-col gap-2">
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
              {isWhatsAppMarkSentBypassActive() ? (
                <button
                  type="button"
                  onClick={markInsuredWhatsAppSentWithoutOpen}
                  className="w-full py-2.5 rounded-xl border border-brand-600 bg-brand-50 text-sm font-semibold text-brand-700"
                  data-testid="sigortali-mesaj-gonderildi-isaretle"
                >
                  Gönderildi Olarak İşaretle (WhatsApp Açmadan)
                </button>
              ) : null}
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
                onClick={() => { void handleCloseFile(true); }}
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
