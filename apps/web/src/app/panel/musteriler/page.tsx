'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import axios from 'axios';
import {
  validateTCKimlik,
  validateVergiNo,
  validateEmail,
} from '@/utils/validators';
import { provinces as STATIC_PROVINCES, districts as STATIC_DISTRICTS } from '@/data/turkey-locations';
import { useToast } from '@/contexts/ToastContext';
import { SlidePanel } from '@/components/SlidePanel';
import { ContactPhoneField } from '@/components/ContactPhoneField';
import { PhoneInput } from '@/components/PhoneInput';
import { LocationPickerModal, LocationPreview, type LatLng } from '@/components/LocationPickerModal';
import { useRouter, useSearchParams } from 'next/navigation';
import { relativeTime, activityColor } from '@/utils/date-helpers';
import { toTitleCaseTR, normalizeFreeTextInput } from '@/utils/text-helpers';
import { geocodeAddressCascade } from '@/utils/geocode-address';
import { NeighborhoodSelect } from '@/components/ui/NeighborhoodSelect';
import { ADDRESS_FIELD } from '@/constants/address-fields';
import { PhoneContactActions } from '@/components/ui/PhoneContactActions';
import {
  CUSTOMER_TYPE_OPTIONS,
  CUSTOMER_FORM_SECTIONS,
  CUSTOMER_RELATION_SECTION_TITLE,
  CUSTOMER_RELATION_SECTION_HINT,
  DEFAULT_CUSTOMER_SUB_TYPES,
  customerSubTypeHint,
  filterCustomerSubTypesForPanelUser,
  mergeCustomerSubTypes,
  customerSubTypesForPicker,
  normalizeCustomerAddressFields,
  normalizeCustomerRow,
  mapCustomerRecordToForm,
  mapCustomerContactsToForm,
  mapCustomerContactInfosToForm,
  subTypeActiveClass,
  customerPhoneValidationError,
  formatCustomerUpdatedMeta,
  customerServiceTypeLabel,
  customerDisplayName,
  isHasarCustomerServiceType,
  type CustomerSubTypeDef,
} from '@/utils/customer-form-helpers';
import {
  parseMusteriGrubuAddContext,
  type MusteriGrubuAddContext,
} from '@/utils/musteri-gruplari-add-context';
import { consumeInboxCustomerPrefill, type InboxCustomerPrefillPayload } from '@/utils/inbox-customer-prefill';
import { ACIL_YARDIM_ASSISTANT_CUSTOMER_SUB_TYPE } from '@/app/panel/kullanicilar/_lib/user-invite-config';
import { readStoredPanelUser, userOperationArea } from '@/utils/panel-access';
import { usePanelRoleCode } from '@/hooks/usePanelRole';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { OpsStripKpi } from '@/components/operasyon/OpsStripKpi';
import { CustomerRowActions } from '@/components/customers/CustomerRowActions';
import { Building2, UserRound, Users } from 'lucide-react';
import {
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableTh,
  SortablePanelTableTh,
  TableColumnsProvider,
  usePanelTableColumns,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { getAccessToken } from '@/utils/auth-session';
import {
  cycleClientSort,
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';
import { API, authHeader, ensureSessionBeforeMutation, getToken } from '@/utils/api';
import { CardNotesEditor } from '@/components/card-notes/CardNotesEditor';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import {
  AUTHORIZED_PERSON_DIRTY_MESSAGE,
  isDirtyAuthorizedPersonName,
} from '@sigorta/shared';
import {
  emptyCardNoteEntries,
  serializeCardNotes,
  validateCardNoteEntries,
  type CardNoteFormEntry,
} from '@/utils/card-notes';

async function turmobQuery(taxNumber: string, token: string | null) {
  const r = await axios.get(`${API}/tax-verification/turmob-query?taxNumber=${encodeURIComponent(taxNumber)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.data.data as { title: string; found: boolean; source: string };
}

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-50 text-green-700 border-green-100',
  passive: 'bg-slate-100 text-slate-500 border-slate-200',
  blacklisted: 'bg-red-50 text-red-700 border-red-100',
};

const DEFAULT_STATUS_FILTER = 'active';
const CUSTOMER_STATUS_LABEL: Record<string, string> = {
  active: 'Aktif',
  passive: 'Arşiv',
  blacklisted: 'Kara Liste',
};

type ContactPerson = {
  id?: string;
  firstName: string;
  lastName: string;
  role: string;
  phone: string;
  phoneType: 'gsm' | 'landline';
  extensionNo: string;
  email: string;
};
type ContactInfoItem = { id?: string; type: string; value: string; label: string };

// Branş listeleri artık API'den dinamik geliyor — sabit diziler kaldırıldı

const emptyContact = (): ContactPerson => ({
  firstName: '', lastName: '', role: '', phone: '', phoneType: 'gsm', extensionNo: '', email: '',
});
const emptyContactInfo = (): ContactInfoItem => ({ type: 'phone', value: '', label: 'general' });
const emptyForm = () => ({
  customerType: 'individual' as 'individual' | 'corporate',
  subType: '' as '' | 'insured' | 'private_customer' | 'eksper' | 'sigorta_sirketi' | 'eksper_firmasi' | 'asistan_firmasi' | 'broker_firmasi',
  firstName: '', lastName: '', companyName: '', shortName: '',
  taxNumber: '', taxOffice: '', identityNo: '',
  contactFirstName: '', contactLastName: '',
  phone: '', email: '',
  phoneType: 'gsm' as 'gsm' | 'landline',
  extensionNo: '',
  cityCode: '', city: '', district: '',
  neighborhood: '', streetName: '', buildingNo: '', doorNo: '',
  address: '',
  source: '', satisfactionScore: '' as '' | '1' | '2' | '3' | '4' | '5',
  followUpDate: '', tags: [] as string[], cardNotes: emptyCardNoteEntries() as CardNoteFormEntry[],
  serviceType: '' as '' | 'hasar' | 'acil_yardim',
  serviceBranches: [] as string[],
  privateServiceType: '' as string,
});

const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-status-success/30 focus:border-emerald-400 transition-colors';
const inpError = 'w-full border border-red-400 ring-2 ring-status-danger/20 rounded-lg px-3 py-2 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-status-danger/30 focus:border-red-400 transition-colors bg-red-50';

function CustomerSubTypeHintBanner({ subType }: { subType: string }) {
  const hint = customerSubTypeHint(subType);
  if (!hint) return null;
  return (
    <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mt-2 leading-relaxed">
      {hint}
    </p>
  );
}

function CustomerSubTypePicker({
  customerType,
  subTypes,
  selectedSubType,
  required,
  hasError,
  onToggle,
}: {
  customerType: 'individual' | 'corporate';
  subTypes: CustomerSubTypeDef[];
  selectedSubType: string;
  required: boolean;
  hasError: boolean;
  onToggle: (value: string) => void;
}) {
  const filtered = customerSubTypesForPicker(subTypes, customerType);
  if (filtered.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="text-xs font-medium text-slate-500 mb-2">
        Müşteri Tipi
        {required && <span className="text-xs italic text-slate-400 ml-1 font-normal">(önce seçin)</span>}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        {filtered.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onToggle(t.value)}
            className={`w-full py-2.5 rounded-xl text-xs font-medium border-2 transition-all sm:flex-1 sm:min-w-[7rem] sm:py-2 ${
              selectedSubType === t.value
                ? subTypeActiveClass(t.color)
                : hasError
                  ? 'bg-white text-slate-600 border-red-400 ring-2 ring-status-danger/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {hasError && <p className="text-xs text-status-danger mt-1.5">Müşteri tipi seçimi zorunludur</p>}
      {selectedSubType && <CustomerSubTypeHintBanner subType={selectedSubType} />}
    </div>
  );
}

function FormField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">
        {label}{required && <span className="text-xs italic text-slate-400 ml-1 font-normal">(zorunlu alan)</span>}
      </label>
      {children}
      {error && <p className="text-xs text-status-danger mt-1.5">{error}</p>}
    </div>
  );
}

function SectionDivider({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 mt-7 first:mt-0 pb-2 border-b border-slate-100">
      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-base">{emoji}</span>
      <span className="text-sm font-semibold text-slate-700">{title}</span>
    </div>
  );
}

// ── Filter Chip (future use) ────────────────────────────────────────────────
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2.5 py-1 font-medium">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 text-emerald-400 hover:text-emerald-700 transition-colors rounded-full w-3.5 h-3.5 flex items-center justify-center hover:bg-emerald-100"
        aria-label="Filtreyi kaldır"
      >
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

const MODAL_SECTIONS = [...CUSTOMER_FORM_SECTIONS];

// ── Drawer helpers ───────────────────────────────────────────────────────────
const CLAIM_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  open: { label: 'Açık', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  in_progress: { label: 'İşlemde', cls: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
  closed: { label: 'Kapalı', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  cancelled: { label: 'İptal', cls: 'bg-red-50 text-red-700 border-red-100' },
};

const DRAWER_STATUS_LABEL: Record<string, string> = CUSTOMER_STATUS_LABEL;

function fmtDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString('tr-TR') : '—';
}

// ── CustomerHoverCard ────────────────────────────────────────────────────────
interface HoverCardProps {
  customer: any;
  anchorRef: React.RefObject<HTMLElement | null>;
  visible: boolean;
}

function CustomerHoverCard({ customer, anchorRef, visible }: HoverCardProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const cardW = 340;
    const cardH = 280; // approximate card height
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    let left = rect.right + 10;
    if (left + cardW > viewW - 12) left = rect.left - cardW - 10;
    if (left < 8) left = 8;
    let top = rect.top - 4;
    if (top + cardH > viewH - 12) top = viewH - cardH - 12;
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [visible, anchorRef]);

  if (!visible || !pos) return null;

  const name = customerDisplayName(customer);

  const contactName = customer.customerType === 'corporate'
    ? (customer.contactFirstName || customer.contactLastName)
      ? `${customer.contactFirstName ?? ''} ${customer.contactLastName ?? ''}`.trim()
      : customer.authorizedPerson ?? null
    : null;

  const serviceColors: Record<string, string> = {
    hasar: 'bg-red-100 text-red-700 border-red-200',
    acil_yardim: 'bg-orange-100 text-orange-700 border-orange-200',
  };
  const serviceLabels: Record<string, string> = {
    hasar: 'Hasar', acil_yardim: 'Acil Yardım',
  };

  const branches: string[] = Array.isArray(customer.serviceBranches) ? customer.serviceBranches : [];
  const totalFiles = (customer._count?.claimFiles ?? customer._count?.files ?? 0);
  const openFiles = customer._openCount ?? 0;
  const closedFiles = Math.max(0, totalFiles - openFiles);

  return (
    <div
      ref={cardRef}
      style={{ top: pos.top, left: pos.left, position: 'fixed', zIndex: 9999, width: 340 }}
      className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden pointer-events-none animate-in fade-in-0 zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${customer.customerType === 'individual' ? 'bg-violet-600' : 'bg-emerald-600'}`}>
              {(name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate leading-tight">{name}</p>
              {contactName && (
                <p className="text-[11px] text-slate-400 truncate mt-0.5">Yetkili: {contactName}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1 flex-shrink-0 mt-0.5">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${customer.customerType === 'individual' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
              {customer.customerType === 'individual' ? 'Bireysel' : 'Kurumsal'}
            </span>
            {customer.serviceType && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${serviceColors[customer.serviceType] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {serviceLabels[customer.serviceType] ?? customer.serviceType}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body: 2-col grid */}
      <div className="px-4 py-3 flex items-start gap-4">
        {/* Sol: İletişim bilgileri */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {customer.phone && (
            <div className="pointer-events-auto">
              <PhoneContactActions phone={customer.phone} variant="inline" />
            </div>
          )}
          {customer.email && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <span className="truncate">{customer.email}</span>
            </div>
          )}
          {customer.city && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span className="truncate">{customer.city}{customer.district ? ` / ${customer.district}` : ''}</span>
            </div>
          )}
          {!customer.phone && !customer.email && !customer.city && (
            <p className="text-xs text-slate-400 italic">İletişim bilgisi yok</p>
          )}
        </div>

        {/* Sağ: Dosya mini kartları */}
        <div className="flex gap-1 flex-shrink-0">
          <div className="flex flex-col items-center bg-emerald-50 border border-emerald-100 rounded-xl px-2.5 py-1.5">
            <span className="text-sm font-bold text-emerald-600 leading-none">{totalFiles}</span>
            <span className="text-[9px] text-emerald-400 font-medium mt-0.5">Toplam</span>
          </div>
          <div className="flex flex-col items-center bg-orange-50 border border-orange-100 rounded-xl px-2.5 py-1.5">
            <span className="text-sm font-bold text-orange-500 leading-none">{openFiles}</span>
            <span className="text-[9px] text-orange-400 font-medium mt-0.5">Açık</span>
          </div>
          <div className="flex flex-col items-center bg-green-50 border border-green-100 rounded-xl px-2.5 py-1.5">
            <span className="text-sm font-bold text-green-600 leading-none">{closedFiles}</span>
            <span className="text-[9px] text-green-400 font-medium mt-0.5">Kapanan</span>
          </div>
        </div>
      </div>

      {/* Branşlar */}
      {branches.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            {branches.slice(0, 4).map((b: string) => (
              <span key={b} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded font-medium border border-slate-200">{b}</span>
            ))}
            {branches.length > 4 && (
              <span className="text-[10px] text-slate-400">+{branches.length - 4}</span>
            )}
          </div>
        </div>
      )}

      {/* Tags */}
      {customer.tags && customer.tags.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1">
          {customer.tags.slice(0, 5).map((tag: string) => (
            <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full">#{tag}</span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[10px] text-slate-400">
          {customer.createdAt ? `Kayıt: ${new Date(customer.createdAt).toLocaleDateString('tr-TR')}` : ''}
        </span>
        {customer.satisfactionScore && (
          <div className="flex items-center gap-0.5">
            {[1,2,3,4,5].map((s) => (
              <svg key={s} className={`w-2.5 h-2.5 ${s <= (customer.satisfactionScore as number) ? 'text-amber-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── CustomerDrawer ───────────────────────────────────────────────────────────
interface CustomerDrawerProps {
  customerId: string | null;
  open: boolean;
  onClose: () => void;
  onEdit: (customer: any) => void;
}

function CustomerDrawer({ customerId, open, onClose, onEdit }: CustomerDrawerProps) {
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadDetail = useCallback(() => {
    if (!customerId) return;
    setCustomer(null);
    setDetailError(null);
    setLoadingDetail(true);
    axios
      .get(`${API}/customers/${customerId}`, { headers: authHeader() })
      .then((r) => setCustomer(r.data.data ?? r.data))
      .catch((e) => {
        console.error(e);
        setCustomer(null);
        setDetailError('Müşteri detayı yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.');
      })
      .finally(() => setLoadingDetail(false));
  }, [customerId]);

  useEffect(() => {
    if (!open || !customerId) return;
    loadDetail();
  }, [open, customerId, loadDetail]);

  const name = customer
    ? customer.customerType === 'individual'
      ? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()
      : customer.companyName ?? '—'
    : '—';

  const typeBadge =
    customer?.customerType === 'individual' ? (
      <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border bg-purple-50 text-purple-700 border-purple-100">
        👤 Bireysel
      </span>
    ) : (
      <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-100">
        🏢 Kurumsal
      </span>
    );

  const statusCls = STATUS_COLOR[customer?.status ?? ''] ?? 'bg-slate-100 text-slate-500 border-slate-200';
  const statusLabel = DRAWER_STATUS_LABEL[customer?.status ?? ''] ?? customer?.status ?? '—';
  const claimFiles: any[] = customer?.claimFiles?.slice(0, 5) ?? [];
  const stars = customer?.satisfactionScore ? Number(customer.satisfactionScore) : 0;

  return (
    <SlidePanel open={open} onClose={onClose} width={400}>
      {/* Custom header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-emerald-700 flex-shrink-0">
        <div>
          <p className="text-xs text-emerald-200 font-medium tracking-wide">Müşteri Özeti</p>
          <h3 className="text-sm font-semibold text-white mt-0.5 truncate max-w-[280px]">{name}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          aria-label="Kapat"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {loadingDetail ? (
        <div className="space-y-3 animate-pulse p-4">{Array.from({length:4}).map((_,i)=><div key={i} className="h-10 rounded-lg bg-slate-200"/>)}</div>
      ) : !customer ? (
        <div className="flex flex-col items-center justify-center h-40 px-6 text-center gap-3">
          <p className="text-sm text-slate-500">{detailError ?? 'Veri alınamadı'}</p>
          <button
            type="button"
            onClick={loadDetail}
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-100 transition-colors"
          >
            Tekrar Dene
          </button>
        </div>
      ) : (
        <div className="pb-24">
          {/* Kimlik */}
          <div className="px-5 pt-5 pb-4 border-b border-slate-50">
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-base font-bold flex-shrink-0 ${customer.customerType === 'individual' ? 'bg-purple-500' : 'bg-emerald-600'}`}>
                {(name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 leading-tight truncate">{name}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {typeBadge}
                  <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${statusCls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1 ${customer.status === 'active' ? 'bg-green-500' : customer.status === 'blacklisted' ? 'bg-status-danger' : 'bg-slate-400'}`} />
                    {statusLabel}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2.5">
              {customer.phone && (
                <PhoneContactActions phone={customer.phone} variant="panel" accent="emerald" />
              )}
              {customer.email && (
                <div className="flex items-center gap-2.5 text-sm text-slate-600">
                  <span className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <span className="truncate">{customer.email}</span>
                </div>
              )}
              {(customer.city || customer.district || customer.address) && (
                <div className="flex items-start gap-2.5 text-sm text-slate-600">
                  <span className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    {(customer.city || customer.district) && (
                      <p className="font-medium text-slate-700">{[customer.city, customer.district].filter(Boolean).join(' / ')}</p>
                    )}
                    {customer.address && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{customer.address}</p>}
                    {customer.latitude != null && customer.longitude != null && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${customer.latitude},${customer.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-100 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        Yol Tarifi
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Hasar Dosyaları */}
          <div className="px-5 pt-4 pb-4 border-b border-slate-50">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">📂</span>
              <p className="text-xs font-semibold text-slate-700 tracking-wide">Hasar Dosyaları</p>
              {customer._count?.claimFiles != null && (
                <span className="ml-auto text-xs text-slate-400">{customer._count.claimFiles} Toplam</span>
              )}
            </div>
            {claimFiles.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">Henüz Hasar Dosyası Yok.</p>
            ) : (
              <div className="space-y-2">
                {claimFiles.map((f: any) => {
                  const st = CLAIM_STATUS_LABEL[f.status] ?? { label: f.status ?? '—', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
                  return (
                    <div key={f.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{f.fileNumber ?? f.id?.slice(0, 8)}</p>
                        <p className="text-xs text-slate-400">{fmtDate(f.createdAt)}</p>
                      </div>
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${st.cls}`}>{st.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Hizmet Türü & Branşlar */}
          {(customer.serviceType || (customer.serviceBranches && customer.serviceBranches.length > 0)) && (
            <div className="px-5 pt-4 pb-4 border-b border-slate-50">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🛠</span>
                <p className="text-xs font-semibold text-slate-700 tracking-wide">Hizmet Türü</p>
              </div>
              {customer.serviceType && (
                <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border mb-2 ${
                  isHasarCustomerServiceType(customer.serviceType)
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-orange-50 text-orange-700 border-orange-100'
                }`}>
                  {customerServiceTypeLabel(customer.serviceType)}
                </span>
              )}
              {customer.serviceBranches && customer.serviceBranches.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {customer.serviceBranches.map((b: string) => (
                    <span key={b} className="inline-flex items-center text-xs bg-slate-50 text-slate-600 rounded-full px-2.5 py-1 border border-slate-200">{b}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* İlişki özeti */}
          <div className="px-5 pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">📊</span>
              <p className="text-xs font-semibold text-slate-700 tracking-wide">{CUSTOMER_RELATION_SECTION_TITLE}</p>
            </div>
            <div className="space-y-3">
              {customer.source && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Kaynak</p>
                  <p className="text-sm text-slate-700 font-medium">{customer.source}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400 mb-1">Memnuniyet</p>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s} className={`text-lg ${stars >= s ? 'text-yellow-400' : 'text-slate-200'}`}>★</span>
                  ))}
                  {stars > 0 && <span className="text-xs text-slate-400 ml-1">{stars}/5</span>}
                </div>
              </div>
              {customer.followUpDate && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Takip Tarihi</p>
                  <p className="text-sm text-slate-700 font-medium">{fmtDate(customer.followUpDate)}</p>
                </div>
              )}
              {customer.tags && customer.tags.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Etiketler</p>
                  <div className="flex flex-wrap gap-1.5">
                    {customer.tags.map((t: string) => (
                      <span key={t} className="inline-flex items-center text-xs bg-amber-50 text-amber-700 rounded-full px-2.5 py-1 border border-amber-100">{toTitleCaseTR(t)}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Alt Butonlar */}
      <div className="absolute bottom-0 left-0 right-0 flex gap-2 px-5 py-4 border-t border-slate-100 bg-white">
        <button
          type="button"
          onClick={() => { onClose(); router.push(`/panel/musteriler/${customerId}`); }}
          className="flex-1 bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-emerald-700 transition-colors"
        >
          Detaya Git
        </button>
        <button
          type="button"
          onClick={() => { onClose(); if (customer) onEdit(customer); }}
          disabled={!customer}
          className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Düzenle
        </button>
      </div>
    </SlidePanel>
  );
}

const SUB_TYPE_FILTER_CHIPS: { value: string; label: string }[] = [
  { value: '', label: 'Tümü' },
  { value: 'eksper_firmasi', label: 'Eksper Firması' },
  { value: 'sigorta_sirketi', label: 'Sigorta Şirketi' },
  { value: 'broker_firmasi', label: 'Broker Firması' },
  { value: 'asistan_firmasi', label: 'Asistan Firması' },
  { value: 'private_customer', label: 'Özel Müşteri' },
];

const TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'name', label: 'Ad Soyad', defaultWidth: 220, minWidth: 160 },
  { id: 'phone', label: 'Telefon', defaultWidth: 160, minWidth: 130 },
  { id: 'type', label: 'Tip', defaultWidth: 108, minWidth: 100 },
  { id: 'service', label: 'Hizmet', defaultWidth: 90, minWidth: 70 },
  { id: 'files', label: 'Dosya', defaultWidth: 72, minWidth: 56 },
  { id: 'activity', label: 'Aktivite', defaultWidth: 110, minWidth: 90 },
  { id: 'status', label: 'Durum', defaultWidth: 90, minWidth: 76 },
  { id: 'actions', label: 'İşlemler', defaultWidth: 120, minWidth: 108, pin: 'end', resizable: false },
];

export default function MusterilerPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const roleCode = usePanelRoleCode();
  const tableColumns = usePanelTableColumns('table-cols:musteriler', TABLE_COLUMNS);
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get('customerType') ?? '');
  const [shortNameMissingOnly, setShortNameMissingOnly] = useState(
    () => searchParams.get('shortName') === 'eksik',
  );
  const [subTypeFilter, setSubTypeFilter] = useState(() => searchParams.get('subType') ?? '');
  const [cityFilter, setCityFilter] = useState('');
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') ?? DEFAULT_STATUS_FILTER);
  const [sourceFilter, setSourceFilter] = useState(() => searchParams.get('source') ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const t = searchParams.get('tags');
    return t ? t.split(',').filter(Boolean) : [];
  });
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeSummary, setTypeSummary] = useState({ individual: 0, corporate: 0 });
  const limit = 20;

  const [showModal, setShowModal] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingCustomerMeta, setEditingCustomerMeta] = useState<{
    updatedAt?: string | Date | null;
    updatedByUser?: { firstName?: string | null; lastName?: string | null } | null;
  } | null>(null);
  const [inboxPrefillFocusRole, setInboxPrefillFocusRole] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  // ── Split button kaydet modu ──────────────────────────────────────────────
  type SaveMode = 'close' | 'new' | 'detail';
  const [saveMode, setSaveMode] = useState<SaveMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('customerSaveMode');
      if (stored === 'new' || stored === 'detail') return stored;
    }
    return 'close';
  });
  const [saveModeDropdownOpen, setSaveModeDropdownOpen] = useState(false);
  const saveModeDropdownRef = useRef<HTMLDivElement>(null);

  const [customerSources, setCustomerSources] = useState<string[]>([]);
  const [customerSubTypes, setCustomerSubTypes] = useState<CustomerSubTypeDef[]>([]);
  const panelOperationArea = useMemo(() => userOperationArea(readStoredPanelUser()), [roleCode]);
  const visibleCustomerSubTypes = useMemo(
    () => filterCustomerSubTypesForPanelUser(customerSubTypes, roleCode, panelOperationArea),
    [customerSubTypes, roleCode, panelOperationArea],
  );
  const visibleSubTypeFilterChips = useMemo(() => {
    const allowed = new Set(visibleCustomerSubTypes.map((t) => t.value));
    return SUB_TYPE_FILTER_CHIPS.filter((chip) => !chip.value || allowed.has(chip.value));
  }, [visibleCustomerSubTypes]);
  const canSelectAsistanFirmasi = useMemo(
    () => visibleCustomerSubTypes.some((t) => t.value === ACIL_YARDIM_ASSISTANT_CUSTOMER_SUB_TYPE),
    [visibleCustomerSubTypes],
  );
  const [relationshipTypes, setRelationshipTypes] = useState<string[]>([]); // sadece aktif olanların label listesi
  const [addingNewRelType, setAddingNewRelType] = useState(false);
  const [newRelTypeValue, setNewRelTypeValue] = useState('');
  const [savingRelType, setSavingRelType] = useState(false);
  const [serviceBranchMap, setServiceBranchMap] = useState<Record<'hasar' | 'acil_yardim', string[]>>({ hasar: [], acil_yardim: [] });
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [customerSubTypeRequired, setCustomerSubTypeRequired] = useState(true);

  const [gibLoading, setGibLoading] = useState(false);
  const [gibError, setGibError] = useState<string | null>(null);
  const [tcResult, setTcResult] = useState<boolean | null>(null);
  const [identityNoError, setIdentityNoError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [taxNoError, setTaxNoError] = useState<string | null>(null);
  const [phoneWarn, setPhoneWarn] = useState<string | null>(null);
  const [emailWarn, setEmailWarn] = useState<string | null>(null);
  const [tcWarn, setTcWarn] = useState<string | null>(null);
  const [taxNoWarn, setTaxNoWarn] = useState<string | null>(null);
  const [duplicateConflicts, setDuplicateConflicts] = useState<{ phone?: string; email?: string; tc?: string; taxNumber?: string }>({});
  const [duplicateExistingCustomerId, setDuplicateExistingCustomerId] = useState<string | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const hasHardDuplicate = !!(duplicateConflicts.tc || duplicateConflicts.taxNumber);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const companyNameRef = useRef<HTMLInputElement>(null);
  const firstContactRoleRef = useRef<HTMLSelectElement>(null);

  const [contacts, setContacts] = useState<ContactPerson[]>([emptyContact()]);
  const [contactInfos, setContactInfos] = useState<ContactInfoItem[]>([emptyContactInfo()]);
  const [tagInput, setTagInput] = useState('');
  const [contactsOpen, setContactsOpen] = useState(false);

  // ── Konum state ───────────────────────────────────────────────────────────
  const [locationCoords, setLocationCoords] = useState<LatLng | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Drawer state ──────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCustomerId, setDrawerCustomerId] = useState<string | null>(null);
  const [settingsReturn, setSettingsReturn] = useState<MusteriGrubuAddContext | null>(null);
  const groupAddHandled = useRef(false);
  const editCustomerHandled = useRef(false);

  // ── Hover card state ──────────────────────────────────────────────────────
  const [hoverCustomer, setHoverCustomer] = useState<any>(null);
  const [hoverVisible, setHoverVisible] = useState(false);
  const hoverAnchorRef = useRef<HTMLElement | null>(null);
  const hoverDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRowMouseEnter = useCallback((customer: any, anchor: HTMLElement) => {
    if (hoverHideRef.current) { clearTimeout(hoverHideRef.current); hoverHideRef.current = null; }
    hoverDelayRef.current = setTimeout(() => {
      hoverAnchorRef.current = anchor;
      setHoverCustomer(customer);
      setHoverVisible(true);
    }, 350);
  }, []);

  const handleRowMouseLeave = useCallback(() => {
    if (hoverDelayRef.current) { clearTimeout(hoverDelayRef.current); hoverDelayRef.current = null; }
    hoverHideRef.current = setTimeout(() => setHoverVisible(false), 150);
  }, []);

  // ── Toplu seçim state ─────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Toplu işlem confirm modal state ──────────────────────────────────────
  type BulkAction = 'status' | 'tags' | 'export';
  type BulkStatusValue = 'active' | 'passive' | 'blacklisted';
  const STATUS_LABELS: Record<BulkStatusValue, string> = CUSTOMER_STATUS_LABEL;

  const [archiveConfirm, setArchiveConfirm] = useState<{ id: string; name: string } | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const [bulkConfirm, setBulkConfirm] = useState<{
    action: BulkAction;
    label: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // ── Toplu etiket panel state ──────────────────────────────────────────────
  const [showTagPanel, setShowTagPanel] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [bulkTagAction, setBulkTagAction] = useState<'add' | 'replace'>('add');
  const [bulkTags, setBulkTags] = useState<string[]>([]);

  const isAllSelected = customers.length > 0 && customers.every((c) => selectedIds.has(c.id));
  const isIndeterminate = customers.some((c) => selectedIds.has(c.id)) && !isAllSelected;
  const selectedArray = Array.from(selectedIds);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => { const next = new Set(prev); customers.forEach((c) => next.delete(c.id)); return next; });
    } else {
      setSelectedIds((prev) => { const next = new Set(prev); customers.forEach((c) => next.add(c.id)); return next; });
    }
  };
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkStatus = (status: BulkStatusValue) => {
    const label = STATUS_LABELS[status];
    setBulkConfirm({
      action: 'status',
      label: `${selectedArray.length} müşteri "${label}" olarak işaretlenecek`,
      onConfirm: async () => {
        await axios.patch(`${API}/customers/bulk-status`, { ids: selectedArray, status }, { headers: authHeader() });
        showToast('success', `${selectedArray.length} Müşteri Güncellendi`);
        clearSelection(); load();
      },
    });
  };

  const handleArchiveCustomer = (id: string, name: string) => {
    setArchiveConfirm({ id, name });
  };

  const runArchiveConfirm = async () => {
    if (!archiveConfirm) return;
    setArchiveLoading(true);
    try {
      await axios.post(`${API}/customers/${archiveConfirm.id}/archive`, {}, { headers: authHeader() });
      showToast('success', 'Müşteri Arşivlendi');
      setArchiveConfirm(null);
      load();
    } catch (e: any) {
      showToast('error', `Arşivleme Başarısız: ${e?.response?.data?.message ?? e?.message ?? 'Bilinmeyen Hata'}`);
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleBulkTagsConfirm = () => {
    if (!bulkTags.length) { showToast('warning', 'En Az Bir Etiket Ekleyin'); return; }
    const actionLabel = bulkTagAction === 'add' ? 'eklenir' : 'değiştirilir';
    setBulkConfirm({
      action: 'tags',
      label: `${selectedArray.length} müşteriye etiket ${actionLabel}: ${bulkTags.join(', ')}`,
      onConfirm: async () => {
        await axios.patch(`${API}/customers/bulk-tags`, { ids: selectedArray, tags: bulkTags, action: bulkTagAction }, { headers: authHeader() });
        showToast('success', `${selectedArray.length} Müşteri Etiketlendi`);
        clearSelection(); setShowTagPanel(false); setBulkTags([]); setBulkTagInput(''); load();
      },
    });
  };

  const handleExport = () => {
    setBulkConfirm({
      action: 'export',
      label: `${selectedArray.length} müşteri Excel dosyasına aktarılacak`,
      onConfirm: async () => {
        const r = await axios.post(`${API}/customers/export`, { ids: selectedArray }, { headers: authHeader(), responseType: 'blob' });
        const url = URL.createObjectURL(new Blob([r.data]));
        const a = document.createElement('a');
        a.href = url; a.download = `musteriler-${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click(); URL.revokeObjectURL(url);
        showToast('success', 'Excel Dosyası İndiriliyor'); clearSelection();
      },
    });
  };

  const runBulkConfirm = async () => {
    if (!bulkConfirm) return;
    setBulkLoading(true);
    try { await bulkConfirm.onConfirm(); }
    catch (e: any) { showToast('error', `İşlem Başarısız: ${e?.response?.data?.message ?? e?.message ?? 'Bilinmeyen Hata'}`); }
    finally { setBulkLoading(false); setBulkConfirm(null); }
  };

  // Statik il/ilçe verisinden türetilen ilçe listesi
  const currentDistricts = form.cityCode ? (STATIC_DISTRICTS[form.cityCode] ?? []) : [];
  const normalizedAddress = normalizeCustomerAddressFields(form);
  const customerAddressLabel = [
    normalizedAddress.neighborhood,
    normalizedAddress.streetName,
    normalizedAddress.address,
    form.buildingNo ? `No: ${form.buildingNo}` : '',
    form.doorNo ? `D: ${form.doorNo}` : '',
    form.district,
    form.city,
  ].filter(Boolean).join(', ');

  const resetForm = () => {
    setEditingCustomerId(null);
    setEditingCustomerMeta(null);
    setForm(emptyForm()); setGibError(null); setTcResult(null);
    setIdentityNoError(null); setPhoneError(null); setEmailError(null); setTaxNoError(null);
    setPhoneWarn(null); setEmailWarn(null); setTcWarn(null); setTaxNoWarn(null);
    setDuplicateConflicts({}); setShowDuplicateModal(false); setDuplicateExistingCustomerId(null);
    setFieldErrors({}); setSectionErrors(null);
    setContacts([emptyContact()]); setContactInfos([emptyContactInfo()]);
    setTagInput(''); setActiveSection(0); setContactsOpen(false);
    setLocationCoords(null); setShowLocationPicker(false);
    setGeocodeMsg(null);
    setInboxPrefillFocusRole(false);
  };

  const applyInboxPrefill = useCallback((payload: InboxCustomerPrefillPayload) => {
    setForm({ ...emptyForm(), ...payload.form });
    setContacts(payload.contacts?.length ? payload.contacts : [emptyContact()]);
    setContactInfos([emptyContactInfo()]);
    setGibError(null);
    setTcResult(null);
    setIdentityNoError(null);
    setPhoneError(null);
    setEmailError(null);
    setTaxNoError(null);
    setPhoneWarn(null);
    setEmailWarn(null);
    setTcWarn(null);
    setTaxNoWarn(null);
    setDuplicateConflicts({});
    setDuplicateExistingCustomerId(null);
    setFieldErrors({});
    setSectionErrors(null);
    setTagInput('');
    setContactsOpen(!!payload.openContacts);
    setActiveSection(payload.initialSection ?? 0);
    setInboxPrefillFocusRole(!!payload.focusContactRole);
    setLocationCoords(null);
    setGeocodeMsg(null);
    setShowModal(true);
    if (payload.toastMessage) {
      showToast('info', payload.toastMessage);
    }
  }, [showToast]);

  const openCustomerForEdit = useCallback((customer: any) => {
    if (!customer?.id) return;
    setEditingCustomerId(customer.id);
    setEditingCustomerMeta({
      updatedAt: customer.updatedAt ?? null,
      updatedByUser: customer.updatedByUser ?? null,
    });
    setForm(mapCustomerRecordToForm(customer, STATIC_PROVINCES));
    setContacts(mapCustomerContactsToForm(customer.contacts ?? []));
    setContactInfos(mapCustomerContactInfosToForm(customer.contactInfos ?? []));
    setLocationCoords(
      customer.latitude != null && customer.longitude != null
        ? { lat: Number(customer.latitude), lng: Number(customer.longitude) }
        : null,
    );
    setGibError(null);
    setTcResult(null);
    setIdentityNoError(null);
    setPhoneError(null);
    setEmailError(null);
    setTaxNoError(null);
    setPhoneWarn(null);
    setEmailWarn(null);
    setTcWarn(null);
    setTaxNoWarn(null);
    setDuplicateConflicts({});
    setDuplicateExistingCustomerId(null);
    setFieldErrors({});
    setSectionErrors(null);
    setTagInput('');
    setActiveSection(0);
    setContactsOpen(false);
    setGeocodeMsg(null);
    setShowModal(true);
  }, []);

  const requiresCustomerSubType = useCallback(
    (customerType: string) => customerType === 'corporate' || customerSubTypeRequired,
    [customerSubTypeRequired],
  );

  const goToDuplicateCustomer = () => {
    if (!duplicateExistingCustomerId) return;
    const targetId = duplicateExistingCustomerId;
    setShowDuplicateModal(false);
    setShowModal(false);
    resetForm();
    router.push(`/panel/musteriler/${targetId}`);
  };

  /** Nominatim geocoding — kademeli adres araması */
  const handleGeocodeAddress = useCallback(async () => {
    if (!form.city?.trim()) return;
    setGeocoding(true);
    setGeocodeMsg(null);
    try {
      const addr = normalizeCustomerAddressFields(form);
      setForm((p) => ({ ...p, ...addr }));
      const result = await geocodeAddressCascade({
        city: form.city,
        district: form.district,
        neighborhood: addr.neighborhood,
        streetName: addr.streetName,
        siteName: addr.address,
        buildingNo: form.buildingNo,
      });
      if (result) {
        setLocationCoords({ lat: result.lat, lng: result.lng });
        const shortName = result.displayName.split(',').slice(0, 2).join(',');
        setGeocodeMsg({
          type: 'success',
          text: result.approximate
            ? `Yaklaşık konum bulundu: ${shortName}`
            : `Konum bulundu: ${shortName}`,
        });
      } else {
        setGeocodeMsg({
          type: 'error',
          text: 'Konum bulunamadı. Plaza adını ayrı alana yazıp tekrar deneyin veya haritadan pin atın.',
        });
      }
    } catch {
      setGeocodeMsg({ type: 'error', text: 'Geocoding başarısız. İnternet bağlantınızı kontrol edin.' });
    } finally {
      setGeocoding(false);
    }
  }, [form.city, form.district, form.neighborhood, form.streetName, form.address, form.buildingNo]);

  const handleIdentityNoBlur = async () => {
    if (!form.identityNo) { setIdentityNoError(null); setTcResult(null); setTcWarn(null); setDuplicateConflicts((p) => { const n = { ...p }; delete n.tc; return n; }); return; }
    if (form.identityNo.length < 11) {
      setIdentityNoError(`TC Kimlik No 11 hane olmalıdır (şu an ${form.identityNo.length} hane)`);
      setTcResult(null);
      return;
    }
    const valid = validateTCKimlik(form.identityNo);
    setTcResult(valid);
    if (!valid) { setIdentityNoError('Geçersiz TC Kimlik Numarası'); return; }
    setIdentityNoError(null);
    // Backend çakışma kontrolü
    try {
      const r = await axios.get(`${API}/customers/check-duplicate?tc=${encodeURIComponent(form.identityNo)}`, { headers: authHeader() });
      const d = r.data.data;
      if (d.exists) {
        const msg = `Bu TC kimlik numarası ile kayıtlı müşteri mevcut: ${d.existingRecord.fullName}`;
        setTcWarn(msg);
        setDuplicateConflicts((p) => ({ ...p, tc: msg }));
        setDuplicateExistingCustomerId(d.existingRecord.id);
        showToast('warning', msg);
      } else {
        setTcWarn(null);
        setDuplicateConflicts((p) => { const n = { ...p }; delete n.tc; return n; });
      }
    } catch { /* sessizce geç */ }
  };

  const handleEmailBlur = () => {
    if (!form.email) { setEmailError(null); return; }
    setEmailError(validateEmail(form.email) ? null : 'Geçersiz e-posta adresi');
  };

  const handlePhoneDuplicateCheck = async (phone: string) => {
    if (!phone || phone.length < 10) return;
    try {
      const r = await axios.get(`${API}/customers/check-duplicate?phone=${encodeURIComponent(phone)}`, { headers: authHeader() });
      const d = r.data.data;
      if (d.exists) {
        const msg = `Bu telefon numarası zaten [${d.existingRecord.fullName}] kaydında mevcut`;
        setPhoneWarn(msg);
        setDuplicateConflicts((p) => ({ ...p, phone: msg }));
        showToast('warning', msg);
      } else {
        setPhoneWarn(null);
        setDuplicateConflicts((p) => { const n = { ...p }; delete n.phone; return n; });
      }
    } catch { /* sessizce geç */ }
  };

  const handlePhoneBlur = (raw: string) => {
    const err = customerPhoneValidationError(raw, form.phoneType);
    setPhoneError(err);
    if (!err && raw.trim()) {
      handlePhoneDuplicateCheck(raw.replace(/\D/g, ''));
    } else if (!raw.trim()) {
      setPhoneError(null);
    }
  };

  const handleEmailDuplicateCheck = async (email: string) => {
    if (!email || !validateEmail(email)) return;
    try {
      const r = await axios.get(`${API}/customers/check-duplicate?email=${encodeURIComponent(email)}`, { headers: authHeader() });
      const d = r.data.data;
      if (d.exists) {
        const msg = `Bu e-posta adresi zaten [${d.existingRecord.fullName}] kaydında mevcut`;
        setEmailWarn(msg);
        setDuplicateConflicts((p) => ({ ...p, email: msg }));
        showToast('warning', msg);
      } else {
        setEmailWarn(null);
        setDuplicateConflicts((p) => { const n = { ...p }; delete n.email; return n; });
      }
    } catch { /* sessizce geç */ }
  };

  const handleTaxNoDuplicateCheck = async (taxNumber: string) => {
    if (!taxNumber || taxNumber.length !== 10 || !validateVergiNo(taxNumber)) return;
    try {
      const r = await axios.get(`${API}/customers/check-duplicate?taxNumber=${encodeURIComponent(taxNumber)}`, { headers: authHeader() });
      const d = r.data.data;
      if (d.exists) {
        const displayName = d.existingRecord.fullName || form.companyName.trim() || 'Kayıtlı müşteri';
        const msg = `Bu vergi numarası zaten "${displayName}" kaydında mevcut`;
        setTaxNoWarn(msg);
        setDuplicateConflicts((p) => ({ ...p, taxNumber: msg }));
        setDuplicateExistingCustomerId(d.existingRecord.id);
        showToast('warning', `${msg}. Mevcut kayda gidebilir veya farklı bir vergi numarası girebilirsiniz.`);
      } else {
        setTaxNoWarn(null);
        setDuplicateConflicts((p) => { const n = { ...p }; delete n.taxNumber; return n; });
      }
    } catch { /* sessizce geç */ }
  };

  const handleTaxNoBlur = async () => {
    if (!form.taxNumber) {
      setTaxNoError(null);
      setTaxNoWarn(null);
      setDuplicateConflicts((p) => { const n = { ...p }; delete n.taxNumber; return n; });
      setDuplicateExistingCustomerId(null);
      return;
    }
    const s = form.taxNumber.replace(/\s/g, '');
    if (s.length > 0 && s.length < 10) {
      setTaxNoError(`Vergi numarası 10 hane olmalıdır (şu an ${s.length} hane)`);
      setTaxNoWarn(null);
      return;
    }
    if (s.length === 10 && !validateVergiNo(s)) {
      setTaxNoError('Geçersiz vergi numarası');
      setTaxNoWarn(null);
      return;
    }
    setTaxNoError(null);
    await handleTaxNoDuplicateCheck(s);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), page: String(page) });
      if (search.trim()) params.set('search', search.trim());
      if (typeFilter) params.set('customerType', typeFilter);
      if (subTypeFilter) params.set('subType', subTypeFilter);
      if (cityFilter) params.set('city', cityFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (sourceFilter) params.set('source', sourceFilter);
      if (shortNameMissingOnly) params.set('missingShortName', '1');
      selectedTags.forEach((tag) => params.append('tags', tag));
      const r = await axios.get(`${API}/customers?${params}`, { headers: authHeader() });
      const rows: any[] = r.data.data || [];
      setCustomers(rows.map((row) => normalizeCustomerRow(row)));
      setTotal(r.data.meta?.total ?? 0);
      const tagSet = new Set<string>();
      rows.forEach((c) => (c.tags ?? []).forEach((t: string) => tagSet.add(t)));
      if (tagSet.size > 0) {
        setAllTags((prev) => Array.from(new Set([...prev, ...tagSet])).sort());
      }
    } catch (e) {
      console.error(e);
      showToast('error', 'Müşteri listesi yüklenemedi. Mevcut kayıtlar korundu — tekrar deneyin.');
    } finally { setLoading(false); }
  }, [search, typeFilter, subTypeFilter, cityFilter, statusFilter, sourceFilter, selectedTags, page, shortNameMissingOnly]); // eslint-disable-line

  const refreshTypeSummary = useCallback(async () => {
    try {
      const h = authHeader();
      const [ind, corp] = await Promise.all([
        axios.get(`${API}/customers?limit=1&customerType=individual`, { headers: h }),
        axios.get(`${API}/customers?limit=1&customerType=corporate`, { headers: h }),
      ]);
      setTypeSummary({
        individual: ind.data.meta?.total ?? 0,
        corporate: corp.data.meta?.total ?? 0,
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshTypeSummary();
  }, [refreshTypeSummary]);

  // Debounce searchInput → search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line

  // URL sync
  useEffect(() => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (typeFilter) p.set('customerType', typeFilter);
    if (subTypeFilter) p.set('subType', subTypeFilter);
    if (cityFilter) p.set('city', cityFilter);
    if (statusFilter) p.set('status', statusFilter);
    if (sourceFilter) p.set('source', sourceFilter);
    if (selectedTags.length) p.set('tags', selectedTags.join(','));
    if (shortNameMissingOnly) p.set('shortName', 'eksik');
    if (page > 1) p.set('page', String(page));
    const qs = p.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }, [search, typeFilter, subTypeFilter, cityFilter, statusFilter, sourceFilter, selectedTags, page, shortNameMissingOnly]); // eslint-disable-line

  // Tag dropdown outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // SaveMode dropdown outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (saveModeDropdownRef.current && !saveModeDropdownRef.current.contains(e.target as Node)) {
        setSaveModeDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadCustomerSources = useCallback(() => {
    axios.get(`${API}/system-settings/customer-sources`, { headers: authHeader() })
      .then((r) => setCustomerSources(r.data.data ?? []))
      .catch(() => setCustomerSources(['Sigorta Şirketi Yönlendirmesi', 'Referans', 'Web', 'Tekrar Gelen Müşteri']));
  }, []);

  const loadCustomerSubTypes = useCallback(() => {
    axios.get(`${API}/system-settings/customer-sub-types`, { headers: authHeader() })
      .then((r) => setCustomerSubTypes(mergeCustomerSubTypes(r.data.data ?? [])))
      .catch(() => setCustomerSubTypes(DEFAULT_CUSTOMER_SUB_TYPES));
  }, []);

  const openCustomerForEditById = useCallback(async (customerId: string) => {
    if (!customerId) return;
    loadCustomerSources();
    loadCustomerSubTypes();
    try {
      const r = await axios.get(`${API}/customers/${customerId}`, { headers: authHeader() });
      const customer = r.data?.data ?? r.data;
      openCustomerForEdit(customer);
      showToast('info', 'Müşteri kaydı düzenleme formunda açıldı.');
    } catch {
      showToast('error', 'Müşteri kaydı yüklenemedi.');
    }
  }, [loadCustomerSources, loadCustomerSubTypes, openCustomerForEdit, showToast]);

  useEffect(() => { loadCustomerSources(); }, [loadCustomerSources]);
  useEffect(() => { loadCustomerSubTypes(); }, [loadCustomerSubTypes]);

  useEffect(() => {
    if (!subTypeFilter) return;
    if (customerSubTypes.length === 0) return;
    if (!visibleCustomerSubTypes.some((t) => t.value === subTypeFilter)) {
      setSubTypeFilter('');
      setPage(1);
    }
  }, [customerSubTypes.length, subTypeFilter, visibleCustomerSubTypes]);

  // Gelen kutusundan müşteri ön-dolumu (?inboxPrefill=1)
  useEffect(() => {
    if (searchParams.get('inboxPrefill') !== '1') return;
    const payload = consumeInboxCustomerPrefill();
    if (!payload) return;
    loadCustomerSources();
    loadCustomerSubTypes();
    applyInboxPrefill(payload);
    router.replace('/panel/musteriler', { scroll: false });
  }, [searchParams, applyInboxPrefill, loadCustomerSources, loadCustomerSubTypes, router]);

  // Ayarlar → Müşteri Grupları'ndan ekleme (?openAdd=1&subType=…&returnTo=…)
  useEffect(() => {
    if (groupAddHandled.current) return;
    if (searchParams.get('openAdd') !== '1') return;
    groupAddHandled.current = true;

    const ctx = parseMusteriGrubuAddContext(searchParams);
    if (ctx) setSettingsReturn(ctx);

    const subType = searchParams.get('subType')?.trim() ?? '';
    const entityType = searchParams.get('entityType') === 'corporate' ? 'corporate' : 'individual';
    const panelUser = readStoredPanelUser();
    const panelRole = String(panelUser?.role?.code ?? '').toLowerCase();
    const panelOpArea = userOperationArea(panelUser);
    const subTypeAllowed = !subType || filterCustomerSubTypesForPanelUser(
      [{ value: subType, label: '', forType: 'both', color: 'gray' }],
      panelRole,
      panelOpArea,
    ).length > 0;
    const effectiveSubType = subTypeAllowed ? subType : '';

    if (subType || searchParams.get('openAdd') === '1') {
      if (effectiveSubType) {
        setTypeFilter(entityType);
        setSubTypeFilter(effectiveSubType);
      }
      setForm({
        ...emptyForm(),
        customerType: entityType,
        subType: effectiveSubType as ReturnType<typeof emptyForm>['subType'],
      });
      loadCustomerSources();
      loadCustomerSubTypes();
      setShowModal(true);
      if (ctx) {
        showToast('info', `${ctx.returnLabel} için kurumsal cari ekliyorsunuz.`);
      } else if (effectiveSubType) {
        showToast('info', 'Önce müşteri tipi seçili geldi; cari bilgilerini tamamlayın.');
      }
    }

    router.replace('/panel/musteriler', { scroll: false });
  }, [searchParams, router, showToast, loadCustomerSources, loadCustomerSubTypes]);

  // Müşteri detay / liste → tam form ile düzenleme (?edit=uuid)
  useEffect(() => {
    if (editCustomerHandled.current) return;
    const editId = searchParams.get('edit')?.trim();
    if (!editId) return;
    editCustomerHandled.current = true;

    loadCustomerSources();
    loadCustomerSubTypes();
    openCustomerForEditById(editId);

    router.replace('/panel/musteriler', { scroll: false });
  }, [searchParams, router, loadCustomerSources, loadCustomerSubTypes, openCustomerForEditById]);

  useEffect(() => {
    if (!showModal || !inboxPrefillFocusRole) return;
    const t = setTimeout(() => {
      firstContactRoleRef.current?.focus();
      setInboxPrefillFocusRole(false);
    }, 350);
    return () => clearTimeout(t);
  }, [showModal, inboxPrefillFocusRole, activeSection, contactsOpen]);

  useEffect(() => {
    axios.get(`${API}/system-settings/relationship-types`, { headers: authHeader() })
      .then((r) => {
        const data = r.data.data ?? [];
        if (data.length > 0 && typeof data[0] === 'string') {
          setRelationshipTypes([]);
        } else {
          setRelationshipTypes(
            (data as { label: string; active: boolean; usageAreas?: string[] }[])
              .filter((t) => t.active !== false && (t.usageAreas ?? []).includes('musteri'))
              .map((t) => t.label)
          );
        }
      })
      .catch(() => { /* use empty fallback */ });
  }, []);

  const handleAddNewRelType = async (onSelect?: (label: string) => void) => {
    const val = newRelTypeValue.trim();
    if (!val || savingRelType) return;
    if (relationshipTypes.includes(val)) {
      onSelect?.(val);
      setAddingNewRelType(false);
      setNewRelTypeValue('');
      return;
    }
    setSavingRelType(true);
    try {
      const res = await axios.get(`${API}/system-settings/relationship-types`, { headers: authHeader() });
      const existing = res.data.data ?? [];
      type RelType = { label: string; active: boolean; usageAreas?: Array<'musteri' | 'eksper' | 'tedarikci' | 'dosya'> };
      const full: RelType[] = existing.length > 0 && typeof existing[0] === 'string'
        ? (existing as string[]).map((l) => ({ label: l, active: true, usageAreas: ['musteri'] }))
        : (existing as RelType[]);
      const found = full.find((t) => t.label === val);
      if (!found) {
        full.push({ label: val, active: true, usageAreas: ['musteri'] });
        await axios.put(`${API}/system-settings/relationship-types`, { values: full }, { headers: authHeader() });
      } else if (!(found.usageAreas ?? []).includes('musteri')) {
        found.usageAreas = [...(found.usageAreas ?? []), 'musteri'];
        await axios.put(`${API}/system-settings/relationship-types`, { values: full }, { headers: authHeader() });
      }
      setRelationshipTypes((prev) => prev.includes(val) ? prev : [...prev, val]);
      onSelect?.(val);
    } catch { /* ignore */ } finally {
      setSavingRelType(false);
      setAddingNewRelType(false);
      setNewRelTypeValue('');
    }
  };

  useEffect(() => {
    axios.get(`${API}/system-settings/field-requirements`, { headers: authHeader() })
      .then((r) => {
        const data = r.data.data;
        if (data && typeof data.customerSubTypeRequired === 'boolean') {
          setCustomerSubTypeRequired(data.customerSubTypeRequired);
        }
      })
      .catch(() => { /* varsayılan: zorunlu */ });
  }, []);

  useEffect(() => {
    setBranchesLoading(true);
    Promise.all([
      axios.get(`${API}/service-branches?type=hasar&scope=meridyen`, { headers: authHeader() }),
      axios.get(`${API}/service-branches?type=acil_yardim&scope=meridyen`, { headers: authHeader() }),
    ])
      .then(([rHasar, rAcil]) => {
        const toNames = (r: any) => (r.data.data ?? []).map((b: any) => b.name as string);
        setServiceBranchMap({ hasar: toNames(rHasar), acil_yardim: toNames(rAcil) });
      })
      .catch(() => { /* API henüz hazır değilse sessizce geç */ })
      .finally(() => setBranchesLoading(false));
  }, []);

  const handleGibQuery = async () => {
    if (!form.taxNumber) return;
    setGibLoading(true); setGibError(null);
    try {
      const r = await turmobQuery(form.taxNumber, getToken());
      if (r.found) setForm((p) => ({ ...p, companyName: r.title || p.companyName }));
      else setGibError('TÜRMOB sorgulaması başarısız — ünvanı manuel girebilirsiniz.');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? '';
      if (msg.includes('yapılandırılmamış') || err?.response?.status === 503) {
        setGibError('TÜRMOB ünvan sorgusu şu an kullanılamıyor. Ayarlar > Sistem sayfasından yapılandırın veya ünvanı manuel girin.');
      } else {
        setGibError('TÜRMOB sorgulaması başarısız — ünvanı manuel girebilirsiniz.');
      }
    } finally { setGibLoading(false); }
  };

  const upC = (i: number, f: keyof ContactPerson, v: string) => setContacts((p) => p.map((c, j) => j === i ? { ...c, [f]: v } : c));
  const upContact = (i: number, patch: Partial<ContactPerson>) => setContacts((p) => p.map((c, j) => j === i ? { ...c, ...patch } : c));
  const upCI = (i: number, f: keyof ContactInfoItem, v: string) => setContactInfos((p) => p.map((ci, j) => j === i ? { ...ci, [f]: v } : ci));
  const addTag = () => {
    const t = toTitleCaseTR(tagInput.trim());
    if (t && !form.tags.includes(t)) setForm((p) => ({ ...p, tags: [...p.tags, t] }));
    setTagInput('');
  };

  // ── Sayfa bazlı validasyon ────────────────────────────────────────────────
  const [sectionErrors, setSectionErrors] = useState<string | null>(null);

  const validateSection0 = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!form.shortName.trim()) errors.shortName = 'Bu alan zorunludur';
    if (form.customerType === 'individual') {
      if (!form.firstName.trim()) errors.firstName = 'Bu alan zorunludur';
      if (!form.lastName.trim()) errors.lastName = 'Bu alan zorunludur';
      if (customerSubTypeRequired && !form.subType) errors.subType = 'Alt tip seçimi zorunludur';
      if (form.identityNo && !validateTCKimlik(form.identityNo)) {
        errors.identityNo = 'Geçersiz TC Kimlik Numarası';
      }
    } else {
      if (!form.companyName.trim()) errors.companyName = 'Bu alan zorunludur';
      if (requiresCustomerSubType(form.customerType) && !form.subType) {
        errors.subType = 'Alt tip seçimi zorunludur';
      }
    }
    if (form.phone) {
      const phoneErr = customerPhoneValidationError(form.phone, form.phoneType);
      if (phoneErr) errors.phone = phoneErr;
    }
    return errors;
  };

  const handleNextSection = () => {
    if (activeSection === 0) {
      const errors = validateSection0();
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        if (errors.identityNo) setIdentityNoError(errors.identityNo);
        if (errors.phone) setPhoneError(errors.phone);
        const labels = [];
        if (errors.shortName) labels.push('Kısa Ad');
        if (errors.firstName) labels.push('Ad');
        if (errors.lastName) labels.push('Soyad');
        if (errors.companyName) labels.push('Şirket Adı');
        if (errors.subType) labels.push('Alt Tip');
        if (errors.identityNo) labels.push('TC Kimlik No');
        if (errors.phone) labels.push('Telefon');
        setSectionErrors(labels.length > 0 ? `Lütfen zorunlu alanları doldurun: ${labels.join(', ')}` : 'Lütfen geçersiz alanları düzeltin');
        return;
      }
    }
    if (activeSection === 2) {
      setForm((p) => ({ ...p, ...normalizeCustomerAddressFields(p) }));
    }
    setSectionErrors(null);
    setActiveSection((s) => s + 1);
  };

  const handleSave = async (overrideSaveMode?: 'close' | 'new' | 'detail') => {
    // Tüm sayfaları validate et
    const errors: Record<string, string> = {};
    const missingLabels: string[] = [];

    if (!form.shortName.trim()) { errors.shortName = 'Bu alan zorunludur'; missingLabels.push('Kısa Ad'); }
    if (form.customerType === 'individual') {
      if (!form.firstName.trim()) { errors.firstName = 'Bu alan zorunludur'; missingLabels.push('Ad'); }
      if (!form.lastName.trim()) { errors.lastName = 'Bu alan zorunludur'; missingLabels.push('Soyad'); }
      if (customerSubTypeRequired && !form.subType) { errors.subType = 'Alt tip seçimi zorunludur'; missingLabels.push('Alt Tip'); }
      // TC Kimlik validasyonu
      if (form.identityNo && !validateTCKimlik(form.identityNo)) {
        errors.identityNo = 'Geçersiz TC Kimlik Numarası';
        setIdentityNoError('Geçersiz TC Kimlik Numarası');
      }
    } else {
      if (!form.companyName.trim()) { errors.companyName = 'Bu alan zorunludur'; missingLabels.push('Şirket Adı'); }
      if (requiresCustomerSubType(form.customerType) && !form.subType) {
        errors.subType = 'Alt tip seçimi zorunludur';
        missingLabels.push('Alt Tip');
      }
      const yetkiliDirty =
        isDirtyAuthorizedPersonName({
          firstName: form.contactFirstName,
          lastName: form.contactLastName,
          companyName: form.companyName,
          shortName: form.shortName,
        }) ||
        contacts.some(
          (c) =>
            Boolean(c.firstName.trim() || c.lastName.trim()) &&
            isDirtyAuthorizedPersonName({
              firstName: c.firstName,
              lastName: c.lastName,
              companyName: form.companyName,
              shortName: form.shortName,
            }),
        );
      if (yetkiliDirty) {
        errors.contactFirstName = AUTHORIZED_PERSON_DIRTY_MESSAGE;
        missingLabels.push('Yetkili Kişi');
      }
    }

    if (form.phone) {
      const phoneErr = customerPhoneValidationError(form.phone, form.phoneType);
      if (phoneErr) {
        errors.phone = phoneErr;
        setPhoneError(phoneErr);
      }
    }

    const cardNotesError = validateCardNoteEntries(form.cardNotes);
    if (cardNotesError) {
      errors.cardNotes = cardNotesError;
      missingLabels.push('Kart Notları');
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const allLabels = [...missingLabels];
      if (errors.identityNo) allLabels.push('TC Kimlik No');
      if (errors.phone) allLabels.push('Telefon');
      const errMsg = allLabels.length > 0
        ? `Lütfen Zorunlu Alanları Doldurun: ${allLabels.join(', ')}`
        : 'Lütfen Geçersiz Alanları Düzeltin';
      showToast('warning', errMsg);
      setSectionErrors(errMsg);
      // Hatalı ilk sayfaya git
      if (errors.cardNotes) setActiveSection(3);
      else setActiveSection(0);
      setTimeout(() => {
        if (errors.firstName) firstNameRef.current?.focus();
        else if (errors.lastName) lastNameRef.current?.focus();
        else if (errors.companyName) companyNameRef.current?.focus();
      }, 100);
      return;
    }
    setSectionErrors(null);

    // Çakışma varsa onay modalı göster
    if (Object.keys(duplicateConflicts).length > 0) {
      setShowDuplicateModal(true);
      return;
    }

    await doSave(overrideSaveMode ?? saveMode);
  };

  const doSave = async (effectiveSaveMode: 'close' | 'new' | 'detail' = saveMode) => {
    setShowDuplicateModal(false);
    setFieldErrors({});
    setSaving(true);
    try {
      const sessionOk = await ensureSessionBeforeMutation();
      if (!sessionOk || !getAccessToken()) {
        showToast('error', 'Oturum süresi doldu. Sayfayı yenileyin veya tekrar giriş yapın.');
        return;
      }
      const addr = normalizeCustomerAddressFields(form);
      setForm((p) => ({ ...p, ...addr }));

      // Yapılandırılmış adres alanlarını birleştir
      const addressParts = [
        addr.neighborhood,
        addr.streetName,
        addr.address,
        form.buildingNo ? `No: ${form.buildingNo}` : '',
        form.doorNo ? `D: ${form.doorNo}` : '',
      ].filter(Boolean);
      const computedAddress = addressParts.length > 0 ? addressParts.join(' ') : null;

      const payload: any = {
        customerType: form.customerType, entityType: form.customerType,
        phone: form.phone || null, email: form.email || null,
        city: form.city || null, district: form.district || null,
        neighborhood: addr.neighborhood || null,
        streetName: addr.streetName || null,
        buildingNo: form.buildingNo || null,
        doorNo: form.doorNo || null,
        address: computedAddress,
        latitude: locationCoords?.lat ?? null, longitude: locationCoords?.lng ?? null,
        shortName: form.shortName.trim(),
        notes: serializeCardNotes(form.cardNotes), source: form.source || null,
        satisfactionScore: form.satisfactionScore ? Number(form.satisfactionScore) : null,
        followUpDate: form.followUpDate || null, tags: form.tags,
        serviceType: form.subType === 'asistan_firmasi'
            ? 'acil_yardim'
            : form.subType === 'sigorta_sirketi'
              ? 'hasar'
              : null,
        serviceBranches: form.subType === 'sigorta_sirketi' ? form.serviceBranches : [],
        contacts: contacts
          .filter((c) => c.firstName.trim() || c.lastName.trim())
          .map((c) => ({
            ...c,
            name: `${c.firstName} ${c.lastName}`.trim(),
            role: c.role === '__other__' ? '' : c.role,
          })),
        contactInfos: contactInfos.filter((ci) => ci.value.trim()),
      };
      if (form.customerType === 'individual') {
        payload.firstName = form.firstName; payload.lastName = form.lastName;
        payload.identityNo = form.identityNo || null; payload.subType = form.subType || null;
      } else {
        payload.companyName = form.companyName; payload.taxNumber = form.taxNumber || null;
        payload.taxOffice = form.taxOffice || null;
        payload.subType = form.subType || null;
        payload.contactFirstName = form.contactFirstName || null;
        payload.contactLastName = form.contactLastName || null;
        // Geriye dönük uyumluluk için authorizedPerson'ı da doldur
        if (form.contactFirstName || form.contactLastName) {
          payload.authorizedPerson = `${form.contactFirstName} ${form.contactLastName}`.trim() || null;
        }
      }

      const isEdit = Boolean(editingCustomerId);
      const res = isEdit
        ? await axios.patch(`${API}/customers/${editingCustomerId}`, payload, { headers: authHeader() })
        : await axios.post(`${API}/customers`, payload, { headers: authHeader() });
      const savedId = res.data?.data?.id ?? editingCustomerId;
      if (isEdit) {
        setShowModal(false);
        resetForm();
        load();
        showToast('success', 'Müşteri Kaydı Güncellendi');
        if (savedId) {
          router.push(`/panel/musteriler/${savedId}`);
        }
        return;
      }
      const newId = savedId;
      if (effectiveSaveMode === 'close') {
        setShowModal(false); resetForm(); load();
        if (settingsReturn) {
          const dest = settingsReturn.returnTo;
          setSettingsReturn(null);
          showToast('success', 'Kayıt eklendi — gruba dönülüyor');
          router.push(dest);
          return;
        }
        showToast('success', 'Müşteri Başarıyla Eklendi');
      } else if (effectiveSaveMode === 'new') {
        resetForm(); load();
        showToast('success', 'Müşteri Eklendi — Yeni Müşteri Formuna Geçildi');
      } else if (effectiveSaveMode === 'detail' && newId) {
        setShowModal(false); resetForm(); load();
        showToast('success', 'Müşteri Eklendi — Detay Sayfasına Yönlendiriliyor');
        router.push(`/panel/musteriler/${newId}`);
      } else {
        setShowModal(false); resetForm(); load();
        showToast('success', 'Müşteri Başarıyla Eklendi');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Bilinmeyen Bir Hata Oluştu';
      const status = e?.response?.status;
      console.error('[doSave] Müşteri kayıt hatası:', { status, msg, error: e });
      if (status === 401) {
        showToast('error', 'Oturum süresi doldu. Sayfayı yenileyin veya tekrar giriş yapın.');
        return;
      }
      if (msg.includes('Vergi No zaten kayıtlı') && form.taxNumber) {
        try {
          const taxNo = form.taxNumber.replace(/\s/g, '');
          const r = await axios.get(`${API}/customers/check-duplicate?taxNumber=${encodeURIComponent(taxNo)}`, { headers: authHeader() });
          const d = r.data.data;
          if (d.exists && d.existingRecord?.id) {
            const name = d.existingRecord.fullName;
            showToast('warning', `Bu Vergi No zaten kayıtlı — ${name} müşterisine yönlendiriliyor`);
            setShowModal(false);
            resetForm();
            router.push(`/panel/musteriler/${d.existingRecord.id}`);
            return;
          }
        } catch { /* aşağıdaki genel hataya düş */ }
      }
      showToast('error', `Kayıt Başarısız: ${msg}`);
    } finally {
      setSaving(false);
      void refreshTypeSummary();
    }
  };

  const hasActiveFilters = !!(
    search || typeFilter || subTypeFilter || cityFilter
    || (statusFilter && statusFilter !== DEFAULT_STATUS_FILTER)
    || sourceFilter || selectedTags.length || shortNameMissingOnly
  );

  const summaryTotal = typeSummary.individual + typeSummary.corporate;

  const applyKpiToplam = () => {
    setTypeFilter('');
    setShortNameMissingOnly(false);
    setPage(1);
  };
  const applyKpiType = (next: 'individual' | 'corporate') => {
    setShortNameMissingOnly(false);
    setTypeFilter((cur) => (cur === next ? '' : next));
    setPage(1);
  };

  const [clientSort, setClientSort] = useState<ClientSortState>(null);
  const displayedCustomers = useMemo(
    () =>
      sortRowsByClientSort(customers, clientSort, (c, key) => {
        switch (key) {
          case 'name':
            return customerDisplayName(c);
          case 'phone':
            return c.phone ?? c.mobilePhone ?? '';
          case 'type':
            return c.customerType ?? '';
          case 'service':
            return c.subType ?? '';
          case 'files':
            return c._count?.claimFiles ?? c.fileCount ?? 0;
          case 'activity':
            return c.lastActivityAt ?? c.updatedAt ?? '';
          case 'status':
            return c.status ?? '';
          default:
            return '';
        }
      }),
    [customers, clientSort],
  );

  const clearAllFilters = () => {
    setSearchInput(''); setSearch('');
    setTypeFilter(''); setSubTypeFilter(''); setCityFilter('');
    setStatusFilter(DEFAULT_STATUS_FILTER); setSourceFilter(''); setSelectedTags([]);
    setShortNameMissingOnly(false);
    setPage(1);
  };

  const statusLabel = CUSTOMER_STATUS_LABEL;
  const typeLabel: Record<string, string> = { individual: 'Bireysel', corporate: 'Kurumsal' };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
    setPage(1);
  };

  return (
    <TableColumnsProvider value={tableColumns}>
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        <a href="/panel" className="hover:text-emerald-600 transition-colors">Panel</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Müşteriler</span>
      </nav>

      {settingsReturn && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">{settingsReturn.returnLabel}</span>
            <span className="text-blue-700"> — Müşteri grubu kaydı ekliyorsunuz</span>
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={settingsReturn.returnTo}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
            >
              ← Ayarlara Dön
            </Link>
            <button
              type="button"
              onClick={() => setSettingsReturn(null)}
              className="rounded-lg p-1.5 text-blue-500 hover:bg-blue-100 transition-colors"
              aria-label="Bağlamı kapat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="page-header-icon-emerald">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h2 className="page-title">Müşteriler</h2>
            <p className="page-subtitle">
              {subTypeFilter === 'eksper_firmasi'
                ? 'Eksper Firması Kayıtları — Hasar İhbar Cari Hesapları'
                : subTypeFilter === 'asistan_firmasi'
                  ? 'Geliştirilebilir müşteri ve görüşme kartları; operasyon seçimi müşteri kartından yapılır.'
                : 'Bireysel ve Kurumsal Müşteri Yönetimi'}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => { resetForm(); loadCustomerSources(); loadCustomerSubTypes(); setShowModal(true); }}
          className="btn-primary-emerald">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Müşteri
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="musteri-kpi-band">
        <OpsStripKpi
          dense
          label="Toplam"
          value={summaryTotal}
          color="bg-brand-600"
          icon={Users}
          active={!typeFilter && !shortNameMissingOnly}
          onClick={applyKpiToplam}
        />
        <OpsStripKpi
          dense
          label="Bireysel"
          value={typeSummary.individual}
          color="bg-violet-600"
          icon={UserRound}
          active={typeFilter === 'individual' && !shortNameMissingOnly}
          onClick={() => applyKpiType('individual')}
        />
        <OpsStripKpi
          dense
          label="Kurumsal"
          value={typeSummary.corporate}
          color="bg-emerald-600"
          icon={Building2}
          active={typeFilter === 'corporate' && !shortNameMissingOnly}
          onClick={() => applyKpiType('corporate')}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-500">Alt Tip:</span>
        {visibleSubTypeFilterChips.map((chip) => (
          <button
            key={chip.value || 'all'}
            type="button"
            onClick={() => { setSubTypeFilter(chip.value); setPage(1); }}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              subTypeFilter === chip.value
                ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card px-3 py-2.5">
        <div className="panel-filter-bar">
          <div className="panel-filter-search-wrap">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              autoComplete="off"
              placeholder="Ad, Telefon, TC, Vergi No..."
              className="panel-search-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button type="button" onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <select
            className="panel-filter-control"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setSubTypeFilter('');
              setShortNameMissingOnly(false);
              setPage(1);
            }}
          >
            <option value="">Tüm Tipler</option>
            <option value="individual">Bireysel</option>
            <option value="corporate">Kurumsal</option>
          </select>
          <select
            className={`panel-filter-control ${subTypeFilter ? 'border-emerald-400 text-emerald-700 bg-emerald-50' : ''}`}
            value={subTypeFilter}
            onChange={(e) => { setSubTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tüm Alt Tipler</option>
            {visibleCustomerSubTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select
            className="panel-filter-control"
            value={cityFilter}
            onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tüm Bölgeler</option>
            {STATIC_PROVINCES.map((p) => <option key={p.code} value={p.name}>{p.name}</option>)}
          </select>
          <select
            className="panel-filter-control"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tümü</option>
            <option value="active">Aktif</option>
            <option value="passive">Arşiv</option>
            <option value="blacklisted">Kara Liste</option>
          </select>
          {customerSources.length > 0 && (
            <select
              className="panel-filter-control"
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
            >
              <option value="">Tüm Kaynaklar</option>
              {customerSources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {allTags.length > 0 && (
            <div className="relative flex-[1_1_calc(50%-0.25rem)] sm:flex-[0_0_8.75rem] min-w-[7.25rem]" ref={tagDropdownRef}>
              <button
                type="button"
                onClick={() => setTagDropdownOpen((o) => !o)}
                className={`flex items-center gap-1.5 panel-filter-control w-full ${
                  selectedTags.length ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : ''
                }`}
              >
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span className="truncate min-w-0">Etiket{selectedTags.length > 0 && ` (${selectedTags.length})`}</span>
                <svg className={`w-3 h-3 flex-shrink-0 ml-auto transition-transform ${tagDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {tagDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-100 rounded-xl shadow-card min-w-[160px] py-1 max-h-52 overflow-y-auto">
                  {allTags.map((tag) => (
                    <button key={tag} type="button" onClick={() => toggleTag(tag)}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-slate-50 transition-colors ${selectedTags.includes(tag) ? 'text-emerald-700 font-medium' : 'text-slate-700'}`}
                    >
                      <span className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${selectedTags.includes(tag) ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                        {selectedTags.includes(tag) && (
                          <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex-shrink-0 sm:ml-auto">
            <PanelTableColumnPicker tableColumns={tableColumns} />
          </div>
        </div>
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-400 mr-0.5">Aktif filtreler:</span>
            {search && <FilterChip label={`Arama: "${search}"`} onRemove={() => setSearchInput('')} />}
            {typeFilter && <FilterChip label={`Tip: ${typeLabel[typeFilter] ?? typeFilter}`} onRemove={() => { setTypeFilter(''); setPage(1); }} />}
            {shortNameMissingOnly && (
              <FilterChip label="Kısa Ad eksik" onRemove={() => { setShortNameMissingOnly(false); setPage(1); }} />
            )}
            {subTypeFilter && <FilterChip label={`Alt Tip: ${visibleCustomerSubTypes.find((t) => t.value === subTypeFilter)?.label ?? subTypeFilter}`} onRemove={() => { setSubTypeFilter(''); setPage(1); }} />}
            {cityFilter && <FilterChip label={`Bölge: ${cityFilter}`} onRemove={() => { setCityFilter(''); setPage(1); }} />}
            {statusFilter && statusFilter !== DEFAULT_STATUS_FILTER && (
              <FilterChip
                label={`Durum: ${statusLabel[statusFilter] ?? statusFilter}`}
                onRemove={() => { setStatusFilter(DEFAULT_STATUS_FILTER); setPage(1); }}
              />
            )}
            {sourceFilter && <FilterChip label={`Kaynak: ${sourceFilter}`} onRemove={() => { setSourceFilter(''); setPage(1); }} />}
            {selectedTags.map((tag) => (
              <FilterChip key={tag} label={`Etiket: ${tag}`} onRemove={() => toggleTag(tag)} />
            ))}
            <button type="button" onClick={clearAllFilters}
              className="text-[11px] text-status-danger hover:text-red-700 font-medium ml-1 hover:underline transition-colors">
              Temizle
            </button>
          </div>
        )}
      </div>

      {/* ── Toplu İşlem Toolbar ── */}
      {selectedIds.size > 0 && (
        <div className="sticky top-4 z-30 mb-4">
          <div className="bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200 px-5 py-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 mr-2">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">{selectedIds.size}</div>
              <span className="text-sm font-medium">{selectedIds.size} Müşteri Seçildi</span>
            </div>
            <div className="h-5 w-px bg-white/30" />
            <div className="relative group">
              <button className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors font-medium">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Durum Değiştir
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className="absolute left-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 min-w-36 hidden group-hover:block z-50">
                {(['active', 'passive', 'blacklisted'] as const).map((val) => (
                  <button key={val} type="button" onClick={() => handleBulkStatus(val)}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${val === 'active' ? 'bg-green-500' : val === 'blacklisted' ? 'bg-status-danger' : 'bg-slate-400'}`} />
                    {val === 'active' ? 'Aktif' : val === 'passive' ? 'Arşiv' : 'Kara Liste'}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setShowTagPanel((p) => !p)}
              className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
              Etiket Ata
            </button>
            <button type="button" onClick={handleExport}
              className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Excel&apos;e Aktar
            </button>
            <div className="ml-auto">
              <button type="button" onClick={clearSelection} className="text-white/70 hover:text-white text-xs underline transition-colors">Seçimi Temizle</button>
            </div>
          </div>
          {showTagPanel && (
            <div className="bg-white border border-emerald-100 rounded-xl shadow-lg mt-2 p-4">
              <p className="text-xs font-semibold text-slate-600 mb-3">Etiket İşlemi</p>
              <div className="flex gap-3 mb-3">
                {(['add', 'replace'] as const).map((act) => (
                  <button key={act} type="button" onClick={() => setBulkTagAction(act)}
                    className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${bulkTagAction === act ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-200 text-slate-600 hover:border-emerald-300'}`}>
                    {act === 'add' ? 'Mevcut Etiketlere Ekle' : 'Etiketleri Değiştir'}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mb-3">
                <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-status-success/30 focus:border-emerald-400 transition-colors"
                  placeholder="Etiket Adı Girin..." value={bulkTagInput} onChange={(e) => setBulkTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const t = toTitleCaseTR(bulkTagInput.trim()); if (t && !bulkTags.includes(t)) setBulkTags((p) => [...p, t]); setBulkTagInput(''); } }} />
                <button type="button" onClick={() => { const t = toTitleCaseTR(bulkTagInput.trim()); if (t && !bulkTags.includes(t)) setBulkTags((p) => [...p, t]); setBulkTagInput(''); }}
                  className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-200 text-sm">+</button>
              </div>
              {bulkTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {bulkTags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 rounded-full px-2.5 py-1 border border-amber-100">
                      {t}<button type="button" onClick={() => setBulkTags((p) => p.filter((x) => x !== t))} className="text-amber-400 hover:text-status-danger">×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowTagPanel(false); setBulkTags([]); setBulkTagInput(''); }}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">İptal</button>
                <button type="button" onClick={handleBulkTagsConfirm}
                  className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">Uygula</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Arşivle Onay Modalı ── */}
      {archiveConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xl">
                📦
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-1">Müşteriyi Arşivle</h4>
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{archiveConfirm.name}</span> arşive alınacak. Açık dosya veya aktif portal bağlantısı varsa işlem reddedilir. Emin misiniz?
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-2">
              <button type="button" onClick={() => setArchiveConfirm(null)} disabled={archiveLoading}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">İptal</button>
              <button type="button" onClick={runArchiveConfirm} disabled={archiveLoading}
                className="px-5 py-2 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-800 font-medium disabled:opacity-50 flex items-center gap-2">
                {archiveLoading && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                Arşivle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toplu İşlem Onay Modalı ── */}
      {bulkConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-xl">
                {bulkConfirm.action === 'export' ? '📊' : '⚡'}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-1">İşlemi Onayla</h4>
                <p className="text-xs text-slate-500">{bulkConfirm.label}. Emin Misiniz?</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-2">
              <button type="button" onClick={() => setBulkConfirm(null)} disabled={bulkLoading}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">İptal</button>
              <button type="button" onClick={runBulkConfirm} disabled={bulkLoading}
                className="px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50 flex items-center gap-2">
                {bulkLoading && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                Evet, Devam Et
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head-row">
                <tr>
                  <th className="table-th">İsim</th>
                  <th className="table-th">Tip</th>
                  <th className="table-th">Telefon</th>
                  <th className="table-th">E-posta</th>
                  <th className="table-th">Şehir</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : !customers.length ? (
        <div className="table-container">
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <p className="text-sm font-semibold text-slate-600">
              {hasActiveFilters ? 'Filtrelere Uyan Müşteri Bulunamadı' : 'Henüz Müşteri Kaydı Yok'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {hasActiveFilters ? 'Farklı filtreler deneyin veya filtreleri temizleyin.' : 'İlk müşterinizi ekleyin.'}
            </p>
            {hasActiveFilters ? (
              <button type="button" onClick={clearAllFilters} className="btn-secondary mt-4">
                Filtreleri Temizle
              </button>
            ) : (
              <button type="button" onClick={() => { loadCustomerSources(); loadCustomerSubTypes(); setShowModal(true); }} className="btn-primary-emerald mt-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Yeni Müşteri Ekle
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="table-container ops-queue-table">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
            <span className="text-xs text-slate-500 font-medium">
              {total} kayıt{hasActiveFilters && <span className="ml-1 text-slate-400 font-normal">(filtre uygulandı)</span>}
            </span>
            <span className="text-xs text-slate-400">Sayfa {page} / {Math.max(1, Math.ceil(total / limit))}</span>
          </div>

          {/* Mobil / tablet kart */}
          <div className="grid gap-3 p-3 lg:hidden">
            {displayedCustomers.map((c) => {
              const name = customerDisplayName(c);
              const subTypeDef = customerSubTypes.find((t) => t.value === c.subType);
              const subTypeLabel = subTypeDef?.label ?? null;
              const isOverdue = c.followUpDate && c.status === 'active' && new Date(c.followUpDate) < new Date(new Date().setHours(0, 0, 0, 0));
              const overdueDays = isOverdue ? Math.floor((Date.now() - new Date(c.followUpDate).getTime()) / 86_400_000) : 0;
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  className={`rounded-2xl border bg-white p-4 shadow-sm transition-colors active:bg-slate-50 ${
                    selectedIds.has(c.id) ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200'
                  } ${isOverdue ? 'border-l-4 border-l-amber-400' : ''}`}
                  onClick={() => {
                    setDrawerCustomerId(c.id);
                    setDrawerOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDrawerCustomerId(c.id);
                      setDrawerOpen(true);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${c.customerType === 'individual' ? 'bg-purple-500' : 'bg-emerald-600'}`}>
                      {(name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{name || '—'}</p>
                          {c.city ? <p className="mt-0.5 truncate text-xs text-slate-500">{c.city}</p> : null}
                        </div>
                        <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${STATUS_COLOR[c.status] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {c.status === 'active' ? 'Aktif' : c.status === 'blacklisted' ? 'Kara Liste' : 'Arşiv'}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${c.customerType === 'individual' ? 'bg-purple-50 text-purple-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {c.customerType === 'individual' ? 'Bireysel' : 'Kurumsal'}
                        </span>
                        {subTypeLabel ? (
                          <span className="inline-flex rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">{subTypeLabel}</span>
                        ) : null}
                        {c.serviceType ? (
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            isHasarCustomerServiceType(c.serviceType)
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-orange-50 text-orange-700 border-orange-100'
                          }`}>
                            {customerServiceTypeLabel(c.serviceType)}
                          </span>
                        ) : null}
                        <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          {c._count?.claimFiles ?? 0} dosya
                        </span>
                      </div>
                      {c.phone ? (
                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                          <PhoneContactActions phone={c.phone} variant="inline" accent="emerald" size="sm" />
                        </div>
                      ) : null}
                      <p className={`mt-2 text-[11px] font-medium ${isOverdue ? 'text-status-danger' : activityColor(c.lastActivityDate)}`}>
                        {isOverdue ? `${overdueDays}g gecikme` : relativeTime(c.lastActivityDate)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end border-t border-slate-100 pt-3" onClick={(e) => e.stopPropagation()}>
                    <CustomerRowActions
                      customerId={c.id}
                      canArchive={c.status !== 'passive'}
                      onEdit={() => void openCustomerForEditById(c.id)}
                      onArchive={() => handleArchiveCustomer(c.id, name || '—')}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="text-sm" style={panelTableLayoutStyle(tableColumns)}>
              <thead className="sticky top-0 z-10">
                <tr className="table-head-row">
                  <th className="px-3 py-2.5 w-9">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => { if (el) el.indeterminate = isIndeterminate; }}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-slate-300 accent-emerald-600 cursor-pointer"
                    />
                  </th>
                  <SortablePanelTableTh colId="name" sortKey="name" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th">Ad Soyad</SortablePanelTableTh>
                  <SortablePanelTableTh colId="phone" sortKey="phone" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th">Telefon</SortablePanelTableTh>
                  <SortablePanelTableTh colId="type" sortKey="type" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th text-center">Tip</SortablePanelTableTh>
                  <SortablePanelTableTh colId="service" sortKey="service" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th">Hizmet</SortablePanelTableTh>
                  <SortablePanelTableTh colId="files" sortKey="files" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th text-center">Dosya</SortablePanelTableTh>
                  <SortablePanelTableTh colId="activity" sortKey="activity" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th">Aktivite</SortablePanelTableTh>
                  <SortablePanelTableTh colId="status" sortKey="status" activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="table-th-center">Durum</SortablePanelTableTh>
                  <PanelTableTh colId="actions" className="table-th-center">İşlemler</PanelTableTh>
                </tr>
              </thead>
              <tbody className="table-body">
                {displayedCustomers.map((c) => {
                  const name = customerDisplayName(c);
                  const subTypeDef = customerSubTypes.find((t) => t.value === c.subType);
                  const subTypeLabel = subTypeDef?.label ?? null;
                  const isOverdue = c.followUpDate && c.status === 'active' && new Date(c.followUpDate) < new Date(new Date().setHours(0, 0, 0, 0));
                  const overdueDays = isOverdue ? Math.floor((Date.now() - new Date(c.followUpDate).getTime()) / 86_400_000) : 0;
                  return (
                    <tr
                      key={c.id}
                      className={`table-row cursor-pointer ${selectedIds.has(c.id) ? 'bg-emerald-50/60' : ''} ${isOverdue ? 'border-l-2 border-amber-400' : ''}`}
                      onMouseEnter={(e) => handleRowMouseEnter(c, e.currentTarget)}
                      onMouseLeave={handleRowMouseLeave}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('a, button, input')) return;
                        setDrawerCustomerId(c.id);
                        setDrawerOpen(true);
                      }}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="w-3.5 h-3.5 rounded border-slate-300 accent-emerald-600 cursor-pointer"
                        />
                      </td>
                      {/* Ad Soyad */}
                      <PanelTableTd colId="name" className="table-td">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${c.customerType === 'individual' ? 'bg-purple-500' : 'bg-emerald-600'}`}>
                            {(name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <Link href={`/panel/musteriler/${c.id}`} className="text-xs font-semibold text-slate-800 hover:text-emerald-600 transition-colors truncate block">{name || '—'}</Link>
                            {c.city && <p className="text-[11px] text-slate-400 leading-tight truncate">{c.city}</p>}
                          </div>
                        </div>
                      </PanelTableTd>
                      {/* Telefon */}
                      <PanelTableTd colId="phone" className="table-td">
                        {c.phone ? (
                          <PhoneContactActions phone={c.phone} variant="inline" />
                        ) : (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </PanelTableTd>
                      {/* Tip */}
                      <PanelTableTd colId="type" className="table-td text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${c.customerType === 'individual' ? 'bg-purple-50 text-purple-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {c.customerType === 'individual' ? 'Bireysel' : 'Kurumsal'}
                          </span>
                          {subTypeLabel && (
                            <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] whitespace-nowrap ${
                              subTypeDef?.color === 'orange' ? 'bg-orange-50 text-orange-700' :
                              subTypeDef?.color === 'green'  ? 'bg-green-50 text-green-700' :
                              subTypeDef?.color === 'purple' ? 'bg-purple-50 text-purple-700' :
                              subTypeDef?.color === 'blue'   ? 'bg-emerald-50 text-emerald-700' :
                              'bg-slate-50 text-slate-600'
                            }`}>
                              {subTypeLabel}
                            </span>
                          )}
                        </div>
                      </PanelTableTd>
                      {/* Hizmet Türü */}
                      <PanelTableTd colId="service" className="table-td">
                        {c.serviceType ? (
                          <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                            isHasarCustomerServiceType(c.serviceType)
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-orange-50 text-orange-700 border-orange-100'
                          }`}>
                            {customerServiceTypeLabel(c.serviceType)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </PanelTableTd>
                      {/* Dosya Sayısı */}
                      <PanelTableTd colId="files" className="table-td text-right">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                          {c._count?.claimFiles ?? 0}
                        </span>
                      </PanelTableTd>
                      {/* Aktivite */}
                      <PanelTableTd colId="activity" className="table-td">
                        {isOverdue ? (
                          <div>
                            <span className="text-[11px] font-semibold text-status-danger">{overdueDays}g gecikme</span>
                            <p className="text-[10px] text-red-400 leading-tight">{new Date(c.followUpDate).toLocaleDateString('tr-TR')}</p>
                          </div>
                        ) : (
                          <span className={`text-[11px] font-medium ${activityColor(c.lastActivityDate)}`}>
                            {relativeTime(c.lastActivityDate)}
                          </span>
                        )}
                      </PanelTableTd>
                      {/* Durum */}
                      <PanelTableTd colId="status" className="table-td text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${STATUS_COLOR[c.status] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.status === 'active' ? 'bg-green-500' : c.status === 'blacklisted' ? 'bg-status-danger' : 'bg-slate-400'}`} />
                          {c.status === 'active' ? 'Aktif' : c.status === 'blacklisted' ? 'Kara Liste' : 'Arşiv'}
                        </span>
                      </PanelTableTd>
                      <PanelTableTd colId="actions" wrap={false} className="table-td-center">
                        <CustomerRowActions
                          customerId={c.id}
                          canArchive={c.status !== 'passive'}
                          onEdit={() => void openCustomerForEditById(c.id)}
                          onArchive={() => handleArchiveCustomer(c.id, name || '—')}
                        />
                      </PanelTableTd>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/60">
            <span className="text-xs text-slate-400">
              {total === 0 ? '0 kayıt' : `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} / ${total} müşteri`}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                className="text-xs border border-slate-200 px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">← Önceki</button>
              <button type="button" disabled={page * limit >= total} onClick={() => setPage((p) => p + 1)}
                className="text-xs border border-slate-200 px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">Sonraki →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Customer Hover Card ── */}
      {hoverCustomer && (
        <CustomerHoverCard
          customer={hoverCustomer}
          anchorRef={hoverAnchorRef}
          visible={hoverVisible}
        />
      )}

      {/* ── Customer Drawer ── */}
      <CustomerDrawer
        customerId={drawerCustomerId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onEdit={(customer) => {
          setDrawerOpen(false);
          if (customer?.id) {
            void openCustomerForEditById(customer.id);
          }
        }}
      />

      <SlidePanel open={showModal} onClose={() => { setShowModal(false); resetForm(); }} width={640} scrollContent={false}>
        <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-emerald-700 flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-white">
                  {editingCustomerId
                    ? 'Müşteri Düzenle'
                    : settingsReturn
                      ? `${settingsReturn.returnLabel} Ekle`
                      : 'Yeni Müşteri Ekle'}
                </h3>
                <p className="text-emerald-200 text-xs mt-0.5">
                  {editingCustomerId
                    ? 'Kayıt türü ve alt tip dahil tüm alanları güncelleyebilirsiniz'
                    : settingsReturn
                      ? 'Kurumsal cari kaydı tamamlayın; kayıttan sonra gruba dönebilirsiniz'
                      : 'Tüm Bilgileri Eksiksiz Doldurun'}
                </p>
                {editingCustomerId && editingCustomerMeta && formatCustomerUpdatedMeta(editingCustomerMeta) && (
                  <p className="text-emerald-100 text-xs mt-1">
                    Son Güncelleme: {formatCustomerUpdatedMeta(editingCustomerMeta)}
                  </p>
                )}
                {settingsReturn && (
                  <Link
                    href={settingsReturn.returnTo}
                    className="inline-block mt-1.5 text-xs font-medium text-emerald-100 hover:text-white underline underline-offset-2"
                  >
                    ← {settingsReturn.returnLabel} listesine dön
                  </Link>
                )}
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-emerald-200 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Kimlik Bandı */}
            {(() => {
              const displayName = form.customerType === 'individual'
                ? `${form.firstName} ${form.lastName}`.trim()
                : form.companyName.trim();
              const typeLabel = form.customerType === 'individual' ? 'Bireysel' : 'Kurumsal';
              return displayName ? (
                <div className="flex items-center gap-2 px-6 py-2.5 bg-emerald-50 border-b border-emerald-100">
                  <svg className="w-3.5 h-3.5 text-status-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm font-semibold text-emerald-800">{displayName}</span>
                  <span className="text-xs text-status-success font-medium">— {typeLabel}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-50 border-b border-slate-100">
                  <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-xs text-slate-400 italic">İsim girilmedi</span>
                </div>
              );
            })()}

            <div className="flex shrink-0 flex-col border-b border-slate-100 bg-slate-50/50 sm:hidden">
              {MODAL_SECTIONS.map((sec, i) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setActiveSection(i)}
                  className={`border-b border-slate-100 px-4 py-2.5 text-left text-xs font-medium transition-all last:border-b-0 ${
                    activeSection === i ? 'bg-white text-emerald-700 ring-1 ring-inset ring-emerald-200' : 'text-slate-600'
                  }`}
                >
                  {i + 1}. {sec}
                </button>
              ))}
            </div>
            <div className="hidden shrink-0 overflow-x-auto border-b border-slate-100 bg-slate-50/50 sm:flex">
              {MODAL_SECTIONS.map((sec, i) => (
                <button key={sec} type="button" onClick={() => setActiveSection(i)}
                  className={`flex-shrink-0 px-5 py-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${activeSection === i ? 'border-emerald-600 text-emerald-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/70'}`}>
                  {i + 1}. {sec}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <OpsFirstRunNotice
                noticeId={OPS_NOTICE.musteriYetkiliAd.id}
                title={OPS_NOTICE.musteriYetkiliAd.title}
                body={OPS_NOTICE.musteriYetkiliAd.body}
                testId="musteri-yetkili-ad-ilk-kullanim-seridi"
                className="mb-4"
              />
              {activeSection === 0 && (
                <div>
                  <SectionDivider emoji="👤" title="Önce Müşteri Tipi" />
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                    Kurumsal veya bireysel seçin; ardından müşteri tipini belirleyin. Cari adı ve iletişim bilgileri tip seçildikten sonra açılır.
                  </p>
                  <div className="grid grid-cols-1 gap-3 mb-5 sm:grid-cols-2">
                    {CUSTOMER_TYPE_OPTIONS.map(({ val, label, emoji }) => (
                      <button key={val} type="button"
                        onClick={() => { setForm((p) => ({ ...p, customerType: val, subType: '', serviceType: '', serviceBranches: [] })); setTcResult(null); setGibError(null); setTaxNoError(null); setFieldErrors({}); }}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border-2 transition-all ${form.customerType === val ? val === 'individual' ? 'bg-purple-600 text-white border-purple-600' : 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                        <span>{emoji}</span>{label}
                      </button>
                    ))}
                  </div>

                  <CustomerSubTypePicker
                    customerType={form.customerType}
                    subTypes={visibleCustomerSubTypes}
                    selectedSubType={form.subType}
                    required={requiresCustomerSubType(form.customerType)}
                    hasError={!!fieldErrors.subType}
                    onToggle={(value) => {
                      if (value === ACIL_YARDIM_ASSISTANT_CUSTOMER_SUB_TYPE && !canSelectAsistanFirmasi) return;
                      setForm((p) => {
                        const nextSubType = p.subType === value ? '' : value as typeof p.subType;
                        return {
                          ...p,
                          subType: nextSubType,
                          serviceType: nextSubType === 'asistan_firmasi' ? 'acil_yardim' : '',
                          serviceBranches: [],
                        };
                      });
                      setFieldErrors((prev) => { const n = { ...prev }; delete n.subType; return n; });
                    }}
                  />

                  {requiresCustomerSubType(form.customerType) && !form.subType ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                      Cari bilgileri için yukarıdan müşteri tipini seçin.
                    </div>
                  ) : form.customerType === 'individual' ? (
                    <>
                      <SectionDivider emoji="📋" title="Bireysel Bilgiler" />
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-start">
                        <div className="col-span-1 sm:col-span-2">
                          <FormField label="Kısa Ad" required error={fieldErrors.shortName}>
                            <input
                              className={fieldErrors.shortName ? inpError : inp}
                              placeholder="Listelerde Görünecek Kısa Ad"
                              value={form.shortName}
                              onChange={(e) => {
                                setForm((p) => ({ ...p, shortName: e.target.value }));
                                setFieldErrors((prev) => { const n = { ...prev }; delete n.shortName; return n; });
                              }}
                              onBlur={(e) => {
                                const v = toTitleCaseTR(e.target.value.trim());
                                if (v) setForm((p) => ({ ...p, shortName: v }));
                              }}
                            />
                            <p className="mt-1 text-[11px] text-slate-500">Dosya listelerinde uzun unvan yerine bu ad gösterilir.</p>
                          </FormField>
                        </div>
                        <FormField label="Ad" required error={fieldErrors.firstName}>
                          <input ref={firstNameRef} className={fieldErrors.firstName ? inpError : inp} placeholder="Örn: Ahmet" value={form.firstName}
                            onChange={(e) => { setForm((p) => ({ ...p, firstName: e.target.value })); setFieldErrors((prev) => { const n = { ...prev }; delete n.firstName; return n; }); }}
                            onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, firstName: v })); }} />
                        </FormField>
                        <FormField label="Soyad" required error={fieldErrors.lastName}>
                          <input ref={lastNameRef} className={fieldErrors.lastName ? inpError : inp} placeholder="Örn: Yılmaz" value={form.lastName}
                            onChange={(e) => { setForm((p) => ({ ...p, lastName: e.target.value })); setFieldErrors((prev) => { const n = { ...prev }; delete n.lastName; return n; }); }}
                            onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, lastName: v })); }} />
                        </FormField>
                        <div className="col-span-1 sm:col-span-2">
                          <FormField label="TC Kimlik No" error={identityNoError ?? fieldErrors.identityNo ?? undefined}>
                            <div className="relative">
                              <input
                                className={`w-full border rounded-lg px-3 py-2 h-[38px] pr-8 text-sm focus:outline-none focus:ring-2 transition-colors ${identityNoError || fieldErrors.identityNo ? 'border-red-400 ring-2 ring-status-danger/20 bg-red-50 focus:ring-status-danger/30' : tcResult === true ? 'border-green-400 ring-2 ring-green-500/20 focus:ring-green-500/30' : 'border-slate-200 focus:ring-purple-500/30'}`}
                                placeholder="11 Haneli TC" maxLength={11} inputMode="numeric" value={form.identityNo}
                                onChange={(e) => {
                                  const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 11);
                                  setForm((p) => ({ ...p, identityNo: onlyDigits }));
                                  setTcResult(null);
                                  setIdentityNoError(null);
                                  setTcWarn(null);
                                  setDuplicateConflicts((prev) => { const n = { ...prev }; delete n.tc; return n; });
                                  setFieldErrors((prev) => { const n = { ...prev }; delete n.identityNo; return n; });
                                  // 11 hane tamamlandığında otomatik doğrula
                                  if (onlyDigits.length === 11) {
                                    const valid = validateTCKimlik(onlyDigits);
                                    setTcResult(valid);
                                    if (!valid) setIdentityNoError('Geçersiz TC Kimlik Numarası');
                                  }
                                }}
                                onBlur={handleIdentityNoBlur}
                              />
                              {tcResult === true && !tcWarn && (
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-500">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                </span>
                              )}
                              {tcResult === false && (
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-400">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                </span>
                              )}
                            </div>
                            {!identityNoError && tcWarn && <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">⚠ {tcWarn}</p>}
                          </FormField>
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                        <FormField label="Telefon" error={phoneError ?? undefined}>
                          <ContactPhoneField
                            phone={form.phone}
                            phoneType={form.phoneType}
                            extensionNo={form.extensionNo}
                            onPhoneChange={(v) => {
                              setForm((p) => ({ ...p, phone: v }));
                              setPhoneError(null);
                              setPhoneWarn(null);
                              setDuplicateConflicts((p) => { const n = { ...p }; delete n.phone; return n; });
                            }}
                            onPhoneTypeChange={(t) => setForm((p) => ({ ...p, phoneType: t, extensionNo: '' }))}
                            onExtensionChange={(v) => setForm((p) => ({ ...p, extensionNo: v }))}
                            onPhoneBlur={handlePhoneBlur}
                          />
                          {!phoneError && phoneWarn && <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">⚠ {phoneWarn}</p>}
                        </FormField>
                        </div>
                        <FormField label="E-posta">
                          <input type="email" className={inp} placeholder="ornek@mail.com" value={form.email}
                            onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setEmailError(null); setEmailWarn(null); setDuplicateConflicts((p) => { const n = { ...p }; delete n.email; return n; }); }}
                            onBlur={() => { handleEmailBlur(); handleEmailDuplicateCheck(form.email); }} />
                          {emailError && <p className="text-xs text-status-danger mt-1.5">{emailError}</p>}
                          {!emailError && emailWarn && <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">⚠ {emailWarn}</p>}
                        </FormField>
                      </div>
                    </>
                  ) : (
                    <>
                      <SectionDivider emoji="🏢" title="Kurumsal Bilgiler" />
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-start">
                        <div className="col-span-1 sm:col-span-2">
                          <FormField label="Kısa Ad" required error={fieldErrors.shortName}>
                            <input
                              className={fieldErrors.shortName ? inpError : inp}
                              placeholder="Örn: Remed, Sezgi Grup"
                              value={form.shortName}
                              onChange={(e) => {
                                setForm((p) => ({ ...p, shortName: e.target.value }));
                                setFieldErrors((prev) => { const n = { ...prev }; delete n.shortName; return n; });
                              }}
                              onBlur={(e) => {
                                const v = toTitleCaseTR(e.target.value.trim());
                                if (v) setForm((p) => ({ ...p, shortName: v }));
                              }}
                            />
                            <p className="mt-1 text-[11px] text-slate-500">Dosya listelerinde uzun unvan yerine bu ad gösterilir.</p>
                          </FormField>
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                          <FormField label="Şirket Adı" required error={fieldErrors.companyName}>
                            <input ref={companyNameRef} className={fieldErrors.companyName ? inpError : inp} placeholder="Şirket Unvanı" value={form.companyName} onChange={(e) => { setForm((p) => ({ ...p, companyName: e.target.value })); setFieldErrors((prev) => { const n = { ...prev }; delete n.companyName; return n; }); }} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, companyName: v })); }} />
                          </FormField>
                        </div>
                        <FormField label="Vergi No">
                          <div className="flex gap-2">
                            <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-status-success/30 focus:border-emerald-400 transition-colors"
                              placeholder="10 Haneli VKN" maxLength={10} inputMode="numeric"
                              value={form.taxNumber}
                              onChange={(e) => {
                                const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 10);
                                setForm((p) => ({ ...p, taxNumber: onlyDigits }));
                                setGibError(null); setTaxNoError(null); setTaxNoWarn(null);
                                setDuplicateConflicts((p) => { const n = { ...p }; delete n.taxNumber; return n; });
                                setDuplicateExistingCustomerId(null);
                              }}
                              onBlur={handleTaxNoBlur} />
                            <button type="button" onClick={handleGibQuery} disabled={gibLoading || !form.taxNumber}
                              className="bg-emerald-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap">
                              {gibLoading && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                              Ünvan Sorgula
                            </button>
                          </div>
                          {taxNoError && <p className="text-xs text-status-danger mt-1.5">{taxNoError}</p>}
                          {!taxNoError && taxNoWarn && (
                            <div className="mt-1.5 space-y-1">
                              <p className="text-xs text-amber-600 flex items-center gap-1">⚠ {taxNoWarn}</p>
                              {duplicateExistingCustomerId && (
                                <button type="button" onClick={goToDuplicateCustomer}
                                  className="text-xs font-medium text-emerald-700 hover:text-emerald-800 underline">
                                  Mevcut Müşteriye Git
                                </button>
                              )}
                            </div>
                          )}
                          {!taxNoError && !taxNoWarn && gibError && <p className="text-xs text-amber-600 mt-1.5">⚠ {gibError}</p>}
                        </FormField>
                        <FormField label="Vergi Dairesi">
                          <input className={inp} placeholder="Opsiyonel" value={form.taxOffice} onChange={(e) => setForm((p) => ({ ...p, taxOffice: e.target.value }))} />
                        </FormField>
                        <div className="col-span-1 sm:col-span-2">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-start">
                            <FormField label="Yetkili Kişi Adı" error={fieldErrors.contactFirstName}>
                              <input className={fieldErrors.contactFirstName ? inpError : inp} placeholder="Ad" value={form.contactFirstName}
                                onChange={(e) => {
                                  setForm((p) => ({ ...p, contactFirstName: e.target.value }));
                                  setFieldErrors((prev) => { const n = { ...prev }; delete n.contactFirstName; return n; });
                                }}
                                onBlur={(e) => {
                                  const v = toTitleCaseTR(e.target.value.trim());
                                  if (v) setForm((p) => ({ ...p, contactFirstName: v }));
                                  const first = v || form.contactFirstName;
                                  if (
                                    isDirtyAuthorizedPersonName({
                                      firstName: first,
                                      lastName: form.contactLastName,
                                      companyName: form.companyName,
                                      shortName: form.shortName,
                                    })
                                  ) {
                                    setFieldErrors((prev) => ({ ...prev, contactFirstName: AUTHORIZED_PERSON_DIRTY_MESSAGE }));
                                  }
                                }} />
                            </FormField>
                            <FormField label="Yetkili Kişi Soyadı" error={fieldErrors.contactFirstName}>
                              <input className={fieldErrors.contactFirstName ? inpError : inp} placeholder="Soyad" value={form.contactLastName}
                                onChange={(e) => {
                                  setForm((p) => ({ ...p, contactLastName: e.target.value }));
                                  setFieldErrors((prev) => { const n = { ...prev }; delete n.contactFirstName; return n; });
                                }}
                                onBlur={(e) => {
                                  const v = toTitleCaseTR(e.target.value.trim());
                                  if (v) setForm((p) => ({ ...p, contactLastName: v }));
                                  const last = v || form.contactLastName;
                                  if (
                                    isDirtyAuthorizedPersonName({
                                      firstName: form.contactFirstName,
                                      lastName: last,
                                      companyName: form.companyName,
                                      shortName: form.shortName,
                                    })
                                  ) {
                                    setFieldErrors((prev) => ({ ...prev, contactFirstName: AUTHORIZED_PERSON_DIRTY_MESSAGE }));
                                  }
                                }} />
                            </FormField>
                          </div>
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                        <FormField label="Telefon" error={phoneError ?? undefined}>
                          <ContactPhoneField
                            phone={form.phone}
                            phoneType={form.phoneType}
                            extensionNo={form.extensionNo}
                            onPhoneChange={(v) => {
                              setForm((p) => ({ ...p, phone: v }));
                              setPhoneError(null);
                              setPhoneWarn(null);
                              setDuplicateConflicts((p) => { const n = { ...p }; delete n.phone; return n; });
                            }}
                            onPhoneTypeChange={(t) => setForm((p) => ({ ...p, phoneType: t, extensionNo: '' }))}
                            onExtensionChange={(v) => setForm((p) => ({ ...p, extensionNo: v }))}
                            onPhoneBlur={handlePhoneBlur}
                          />
                          {!phoneError && phoneWarn && <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">⚠ {phoneWarn}</p>}
                        </FormField>
                        </div>
                        <FormField label="E-posta">
                          <input type="email" className={inp} placeholder="ornek@mail.com" value={form.email}
                            onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setEmailError(null); setEmailWarn(null); setDuplicateConflicts((p) => { const n = { ...p }; delete n.email; return n; }); }}
                            onBlur={() => { handleEmailBlur(); handleEmailDuplicateCheck(form.email); }} />
                          {emailError && <p className="text-xs text-status-danger mt-1.5">{emailError}</p>}
                          {!emailError && emailWarn && <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">⚠ {emailWarn}</p>}
                        </FormField>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeSection === 1 && (
                <div>
                  {/* Bireysel için collapsible İlgili Kişi bölümü */}
                  {form.customerType === 'individual' ? (
                    <div className="mb-5">
                      <button
                        type="button"
                        onClick={() => setContactsOpen((o) => !o)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-base">👥</span>
                          <span className="text-sm font-semibold text-slate-700">İlgili Kişi Ekle</span>
                          {contacts.filter((c) => c.firstName.trim() || c.lastName.trim()).length > 0 && (
                            <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">
                              {contacts.filter((c) => c.firstName.trim() || c.lastName.trim()).length} kişi
                            </span>
                          )}
                        </div>
                        <svg
                          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${contactsOpen ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {contactsOpen && (
                        <div className="mt-3 border border-slate-200 rounded-xl p-4 bg-white">
                          <div className="space-y-3 mb-4">
                            {contacts.map((c, idx) => (
                              <div key={idx} className="bg-slate-50 rounded-xl border border-slate-100 p-4 relative">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-xs font-semibold text-slate-500">İlgili Kişi #{idx + 1}</span>
                                  {contacts.length > 1 && (
                                    <button type="button" onClick={() => setContacts((p) => p.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-status-danger transition-colors">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <div className="col-span-1 sm:col-span-2">
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                      <FormField label="Ad">
                                        <input className={inp} placeholder="Ad" value={c.firstName}
                                          onChange={(e) => upC(idx, 'firstName', e.target.value)}
                                          onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) upC(idx, 'firstName', v); }} />
                                      </FormField>
                                      <FormField label="Soyad">
                                        <input className={inp} placeholder="Soyad" value={c.lastName}
                                          onChange={(e) => upC(idx, 'lastName', e.target.value)}
                                          onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) upC(idx, 'lastName', v); }} />
                                      </FormField>
                                    </div>
                                  </div>
                                  <FormField label="İlişki Türü">
                                    <select
                                      className={inp}
                                      value={c.role === '' ? '' : (relationshipTypes.includes(c.role) ? c.role : '__other__')}
                                      onChange={(e) => {
                                        if (e.target.value === '__add_new__') { setAddingNewRelType(true); setNewRelTypeValue(''); }
                                        else if (e.target.value === '__other__') upC(idx, 'role', '__other__');
                                        else upC(idx, 'role', e.target.value);
                                      }}
                                    >
                                      <option value="">Seçin...</option>
                                      {relationshipTypes.filter((rt) => rt !== 'Diğer').map((rt) => (
                                        <option key={rt} value={rt}>{rt}</option>
                                      ))}
                                      <option value="__other__">Diğer</option>
                                      <option value="__add_new__">+ Yeni Tür Ekle</option>
                                    </select>
                                    {addingNewRelType && (
                                      <div className="flex gap-1.5 mt-1.5">
                                        <input
                                          autoFocus
                                          className={`${inp} flex-1`}
                                          placeholder="Yeni tür adı..."
                                          value={newRelTypeValue}
                                          onChange={(e) => setNewRelTypeValue(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') { e.preventDefault(); handleAddNewRelType((label) => upC(idx, 'role', label)); }
                                            if (e.key === 'Escape') { setAddingNewRelType(false); setNewRelTypeValue(''); }
                                          }}
                                        />
                                        <button type="button" disabled={savingRelType || !newRelTypeValue.trim()}
                                          onClick={() => handleAddNewRelType((label) => upC(idx, 'role', label))}
                                          className="px-2.5 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex-shrink-0">
                                          {savingRelType ? '...' : 'Ekle'}
                                        </button>
                                        <button type="button" onClick={() => { setAddingNewRelType(false); setNewRelTypeValue(''); }}
                                          className="px-2 py-1.5 border border-slate-200 text-slate-500 text-xs rounded-lg hover:bg-slate-50 flex-shrink-0">
                                          İptal
                                        </button>
                                      </div>
                                    )}
                                    {!addingNewRelType && (c.role === '__other__' || (!relationshipTypes.includes(c.role) && c.role !== '')) && (
                                      <input
                                        className={`${inp} mt-1.5`}
                                        placeholder="Görevi / Ünvanı girin..."
                                        value={c.role === '__other__' ? '' : c.role}
                                        onChange={(e) => upC(idx, 'role', e.target.value || '__other__')}
                                      />
                                    )}
                                  </FormField>
                                  <div className="col-span-1 sm:col-span-2 min-w-0">
                                    <FormField label="Telefon">
                                      <ContactPhoneField
                                        phone={c.phone}
                                        phoneType={c.phoneType}
                                        extensionNo={c.extensionNo}
                                        onPhoneChange={(v) => upC(idx, 'phone', v)}
                                        onPhoneTypeChange={(t) => upContact(idx, { phoneType: t, extensionNo: '' })}
                                        onExtensionChange={(v) => upC(idx, 'extensionNo', v)}
                                      />
                                    </FormField>
                                  </div>
                                  <div className="col-span-1 sm:col-span-2"><FormField label="E-posta"><input type="email" className={inp} placeholder="ornek@mail.com" value={c.email} onChange={(e) => upC(idx, 'email', e.target.value)} /></FormField></div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => setContacts((p) => [...p, emptyContact()])}
                            className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium py-2 px-3 rounded-lg hover:bg-emerald-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Kişi Ekle
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <SectionDivider emoji="👥" title="Yetkili Kişiler" />
                      <div className="space-y-3 mb-4">
                        {contacts.map((c, idx) => (
                          <div key={idx} className="bg-slate-50 rounded-xl border border-slate-100 p-4 relative">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-semibold text-slate-500">Yetkili #{idx + 1}</span>
                              {contacts.length > 1 && (
                                <button type="button" onClick={() => setContacts((p) => p.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-status-danger transition-colors">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="col-span-1 sm:col-span-2">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <FormField label="Ad">
                                    <input className={inp} placeholder="Ad" value={c.firstName}
                                      onChange={(e) => upC(idx, 'firstName', e.target.value)}
                                      onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) upC(idx, 'firstName', v); }} />
                                  </FormField>
                                  <FormField label="Soyad">
                                    <input className={inp} placeholder="Soyad" value={c.lastName}
                                      onChange={(e) => upC(idx, 'lastName', e.target.value)}
                                      onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) upC(idx, 'lastName', v); }} />
                                  </FormField>
                                </div>
                              </div>
                              <FormField label="Görev / Ünvan">
                                <select
                                  ref={idx === 0 ? firstContactRoleRef : undefined}
                                  className={inp}
                                  value={c.role === '' ? '' : (relationshipTypes.includes(c.role) ? c.role : '__other__')}
                                  onChange={(e) => {
                                    if (e.target.value === '__other__') upC(idx, 'role', '__other__');
                                    else upC(idx, 'role', e.target.value);
                                  }}
                                >
                                  <option value="">Görevini seçin...</option>
                                  {relationshipTypes.filter((rt) => rt !== 'Diğer').map((rt) => (
                                    <option key={rt} value={rt}>{rt}</option>
                                  ))}
                                  <option value="__other__">Diğer</option>
                                </select>
                                {(c.role === '__other__' || (!relationshipTypes.includes(c.role) && c.role !== '')) && (
                                  <input
                                    className={`${inp} mt-1.5`}
                                    placeholder="Görevi / Ünvanı girin..."
                                    value={c.role === '__other__' ? '' : c.role}
                                    onChange={(e) => upC(idx, 'role', e.target.value || '__other__')}
                                  />
                                )}
                              </FormField>
                              <div className="col-span-1 sm:col-span-2 min-w-0">
                                <FormField label="Telefon">
                                  <ContactPhoneField
                                    phone={c.phone}
                                    phoneType={c.phoneType}
                                    extensionNo={c.extensionNo}
                                    onPhoneChange={(v) => upC(idx, 'phone', v)}
                                    onPhoneTypeChange={(t) => upContact(idx, { phoneType: t, extensionNo: '' })}
                                    onExtensionChange={(v) => upC(idx, 'extensionNo', v)}
                                  />
                                </FormField>
                              </div>
                              <div className="col-span-1 sm:col-span-2"><FormField label="E-posta"><input type="email" className={inp} placeholder="ornek@sirket.com" value={c.email} onChange={(e) => upC(idx, 'email', e.target.value)} /></FormField></div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => setContacts((p) => [...p, emptyContact()])}
                        className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium py-2 px-3 rounded-lg hover:bg-emerald-50 transition-colors mb-5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Yetkili Kişi Ekle
                      </button>
                    </>
                  )}
                  <SectionDivider emoji="📡" title="İletişim Kanalları" />
                  <div className="space-y-2.5 mb-4">
                    {contactInfos.map((ci, idx) => (
                      <div key={idx} className="flex flex-wrap gap-2 items-stretch sm:items-center bg-slate-50 rounded-xl p-3 border border-slate-100 min-w-0">
                        <select className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white w-[7.25rem] flex-shrink-0" value={ci.type} onChange={(e) => upCI(idx, 'type', e.target.value)}>
                          <option value="phone">📞 Telefon</option>
                          <option value="email">✉ E-posta</option>
                          <option value="fax">🖷 Faks</option>
                          <option value="whatsapp">💬 WhatsApp</option>
                        </select>
                        {(ci.type === 'phone' || ci.type === 'whatsapp') ? (
                          <PhoneInput className="flex-1 min-w-0 basis-0" value={ci.value} onChange={(v) => upCI(idx, 'value', v)} />
                        ) : (
                          <input className="flex-1 min-w-0 basis-0 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                            placeholder={ci.type === 'email' ? 'ornek@sirket.com' : 'Faks numarası'}
                            value={ci.value} onChange={(e) => upCI(idx, 'value', e.target.value)} />
                        )}
                        <select className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white w-24 flex-shrink-0" value={ci.label} onChange={(e) => upCI(idx, 'label', e.target.value)}>
                          <option value="general">Genel</option>
                          <option value="work">İş</option>
                          <option value="personal">Kişisel</option>
                        </select>
                        {contactInfos.length > 1 && (
                          <button type="button" onClick={() => setContactInfos((p) => p.filter((_, i) => i !== idx))} className="flex-shrink-0 self-center text-slate-300 hover:text-status-danger transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setContactInfos((p) => [...p, emptyContactInfo()])}
                    className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium py-2 px-3 rounded-lg hover:bg-emerald-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Kanal Ekle
                  </button>
                </div>
              )}

              {activeSection === 2 && (
                <div>
                  <SectionDivider emoji="📍" title="Adres Bilgileri" />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* İl */}
                    <FormField label={ADDRESS_FIELD.province}>
                      <select className={inp} value={form.cityCode}
                        onChange={(e) => {
                          const prov = STATIC_PROVINCES.find((p) => p.code === e.target.value);
                          setForm((p) => ({ ...p, cityCode: e.target.value, city: prov?.name ?? '', district: '', neighborhood: '' }));
                        }}>
                        <option value="">{ADDRESS_FIELD.provincePlaceholder}</option>
                        {STATIC_PROVINCES.map((p) => (
                          <option key={p.code} value={p.code}>{p.name}</option>
                        ))}
                      </select>
                    </FormField>
                    {/* İlçe */}
                    <FormField label={ADDRESS_FIELD.district}>
                      <select key={form.cityCode} className={inp} value={form.district} disabled={!form.cityCode}
                        onChange={(e) => setForm((p) => ({ ...p, district: e.target.value, neighborhood: '' }))}>
                        <option value="">{ADDRESS_FIELD.districtPlaceholder}</option>
                        {currentDistricts.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </FormField>
                    {/* Mahalle */}
                    <div className="col-span-1 sm:col-span-2">
                      <FormField label={ADDRESS_FIELD.neighborhood}>
                        <NeighborhoodSelect
                          provinceName={form.city}
                          districtName={form.district}
                          value={form.neighborhood}
                          onChange={(v) => setForm((p) => ({ ...p, neighborhood: normalizeFreeTextInput(v) }))}
                          inputClassName={inp}
                        />
                      </FormField>
                    </div>
                    {/* Cadde / Sokak */}
                    <div className="col-span-1 sm:col-span-2">
                      <FormField label={ADDRESS_FIELD.street}>
                        <input
                          type="text"
                          className={inp}
                          placeholder={ADDRESS_FIELD.streetPlaceholder}
                          value={form.streetName}
                          onChange={(e) => setForm((p) => ({ ...p, streetName: normalizeFreeTextInput(e.target.value) }))}
                          onBlur={(e) => {
                            const v = toTitleCaseTR(e.target.value.trim());
                            if (v) setForm((p) => ({ ...p, streetName: v }));
                          }}
                        />
                      </FormField>
                    </div>
                    <FormField label={ADDRESS_FIELD.siteName}>
                      <input
                        type="text"
                        className={inp}
                        placeholder={ADDRESS_FIELD.siteNamePlaceholder}
                        value={form.address}
                        onChange={(e) => setForm((p) => ({ ...p, address: normalizeFreeTextInput(e.target.value) }))}
                        onBlur={(e) => {
                          const v = toTitleCaseTR(e.target.value.trim());
                          if (v) setForm((p) => ({ ...p, address: v }));
                        }}
                      />
                    </FormField>
                    {/* Bina No + Daire No */}
                    <FormField label={ADDRESS_FIELD.buildingNo}>
                      <input
                        type="text"
                        className={inp}
                        placeholder={ADDRESS_FIELD.buildingNoPlaceholder}
                        value={form.buildingNo}
                        onChange={(e) => setForm((p) => ({ ...p, buildingNo: e.target.value }))}
                      />
                    </FormField>
                    <FormField label={ADDRESS_FIELD.doorNo}>
                      <input
                        type="text"
                        className={inp}
                        placeholder={ADDRESS_FIELD.doorNoPlaceholder}
                        value={form.doorNo}
                        onChange={(e) => setForm((p) => ({ ...p, doorNo: e.target.value }))}
                      />
                    </FormField>
                    {/* Konum araçları */}
                    <div className="col-span-1 sm:col-span-2 flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        disabled={geocoding || !customerAddressLabel}
                        onClick={() => void handleGeocodeAddress()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                        title={!customerAddressLabel ? 'Önce adres bilgisi girin' : undefined}
                      >
                        {geocoding ? (
                          <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                        {geocoding ? 'Aranıyor...' : 'Konumu Bul'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLocationPicker(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${locationCoords ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        {locationCoords ? 'Konum Seçildi' : 'Haritadan Konum Seç'}
                      </button>
                    </div>
                    {!customerAddressLabel && (
                      <p className="col-span-1 sm:col-span-2 text-xs text-slate-400">Konum bulmak için il ve en az bir adres alanı doldurun. Sahada ziyaret sırasında &quot;Haritadan Konum Seç&quot; ile GPS de kullanabilirsiniz.</p>
                    )}
                    {customerAddressLabel && (
                      <div className="col-span-1 sm:col-span-2 text-xs px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-slate-600">
                        <span className="font-medium text-slate-500">Adres özeti: </span>{customerAddressLabel}
                      </div>
                    )}
                    {geocodeMsg && (
                      <div className={`col-span-1 sm:col-span-2 text-xs px-3 py-2 rounded-lg ${geocodeMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {geocodeMsg.text}
                      </div>
                    )}
                    {locationCoords && (
                      <div className="col-span-1 sm:col-span-2">
                        <LocationPreview
                          lat={locationCoords.lat}
                          lng={locationCoords.lng}
                          addressLabel={customerAddressLabel || undefined}
                          onEdit={() => setShowLocationPicker(true)}
                          onClear={() => { setLocationCoords(null); setGeocodeMsg(null); }}
                          accentColor="emerald"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeSection === 3 && (
                <div>
                  <SectionDivider emoji="📊" title={CUSTOMER_RELATION_SECTION_TITLE} />
                  <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5 mb-4 leading-relaxed">
                    {CUSTOMER_RELATION_SECTION_HINT}
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
                    <FormField label="Müşteri Kaynağı">
                      <select className={inp} value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}>
                        <option value="">Seçin...</option>
                        {customerSources.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Takip Tarihi">
                      <TrDateInput className={inp} value={form.followUpDate} onChange={(followUpDate) => setForm((p) => ({ ...p, followUpDate }))} />
                    </FormField>
                  </div>
                  <FormField label="Memnuniyet Notu (1-5)">
                    <div className="flex items-center gap-1">
                      {([1, 2, 3, 4, 5] as const).map((star) => (
                        <button key={star} type="button" onClick={() => setForm((p) => ({ ...p, satisfactionScore: p.satisfactionScore === String(star) ? '' : String(star) as any }))} className={`text-2xl transition-all hover:scale-110 ${Number(form.satisfactionScore) >= star ? 'text-yellow-400' : 'text-slate-200'}`}>★</button>
                      ))}
                      {form.satisfactionScore && <span className="text-xs text-slate-500 ml-2">{form.satisfactionScore}/5</span>}
                    </div>
                  </FormField>
                  <div className="mt-4">
                    <FormField label="Etiketler / Segment">
                      <div className="flex gap-1.5">
                        <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-status-success/30 focus:border-emerald-400 transition-colors" placeholder="VIP, Standart, Riskli..." value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
                        <button type="button" onClick={addTag} className="bg-slate-100 text-slate-600 text-sm px-3 py-2 rounded-lg hover:bg-slate-200">+</button>
                      </div>
                    </FormField>
                    {form.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {form.tags.map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 rounded-full px-2.5 py-1 border border-amber-100">
                            {toTitleCaseTR(t)}
                            <button type="button" onClick={() => setForm((p) => ({ ...p, tags: p.tags.filter((x) => x !== t) }))} className="text-amber-400 hover:text-status-danger ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-5">
                    <FormField label="Kart Notları" error={fieldErrors.cardNotes}>
                      <CardNotesEditor
                        entries={form.cardNotes}
                        onChange={(cardNotes) => setForm((p) => ({ ...p, cardNotes }))}
                        accent="emerald"
                        error={fieldErrors.cardNotes}
                      />
                    </FormField>
                  </div>

                  {/* Sigorta şirketi müşteri tipi: yalnızca branş seçimi */}
                  {form.subType === 'sigorta_sirketi' && (
                  <div className="mt-5">
                    <SectionDivider emoji="🛠" title="Branşlar" />
                      <div className="mt-3">
                        {branchesLoading ? (
                          <p className="text-xs text-slate-400 py-2 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            Branşlar Yükleniyor...
                          </p>
                        ) : (
                          (() => {
                          const branchKey = 'hasar' as const;
                          const branchList = serviceBranchMap[branchKey] ?? [];
                          const allSelected = branchList.length > 0 && branchList.every((b) => form.serviceBranches.includes(b));
                          return (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-slate-500">
                                  Branşlar
                                  <span className="text-slate-400 font-normal ml-1">(Çoklu Seçim)</span>
                                </p>
                                {branchList.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setForm((p) => ({
                                      ...p,
                                      serviceBranches: allSelected ? [] : [...branchList],
                                    }))}
                                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all font-medium ${
                                      allSelected
                                        ? 'border-slate-300 text-slate-500 hover:bg-slate-50'
                                        : 'border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    }`}
                                  >
                                    {allSelected ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                                  </button>
                                )}
                              </div>
                              {branchList.length === 0 ? (
                                <p className="text-xs text-slate-400 py-2">Hizmet branşı bulunamadı. Ayarlar → Dosya Konuları sayfasından ekleyin.</p>
                              ) : (
                                <div className="grid grid-cols-2 gap-1.5">
                                  {branchList.map((branch) => {
                                    const selected = form.serviceBranches.includes(branch);
                                    return (
                                      <button
                                        key={branch}
                                        type="button"
                                        onClick={() => setForm((p) => ({
                                          ...p,
                                          serviceBranches: selected
                                            ? p.serviceBranches.filter((b) => b !== branch)
                                            : [...p.serviceBranches, branch],
                                        }))}
                                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs border transition-all text-left ${
                                          selected
                                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700 font-medium'
                                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[9px] ${
                                          selected
                                            ? 'bg-emerald-600 border-emerald-600 text-white'
                                            : 'border-slate-300'
                                        }`}>
                                          {selected ? '✓' : ''}
                                        </span>
                                        {branch}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                              {form.serviceBranches.length > 0 && (
                                <p className="text-xs text-slate-500 mt-2">
                                  {form.serviceBranches.length} hizmet türü seçildi: {form.serviceBranches.join(', ')}
                                </p>
                              )}
                            </>
                          );
                        })()
                        )}
                      </div>
                  </div>
                  )}
                </div>
              )}
            </div>

            {sectionErrors && (
              <div className="px-6 py-2 border-t border-red-100 bg-red-50">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-status-danger shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  <p className="text-xs text-red-700 font-medium">{sectionErrors}</p>
                </div>
              </div>
            )}
            <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex gap-1.5">
                {MODAL_SECTIONS.map((_, i) => (
                  <button key={i} type="button" onClick={() => setActiveSection(i)} className={`h-2 rounded-full transition-all ${activeSection === i ? 'bg-emerald-600 w-4' : 'w-2 bg-slate-300 hover:bg-slate-400'}`} />
                ))}
              </div>
              <div className="flex gap-2 items-center">
                {activeSection > 0 && (
                  <button type="button" onClick={() => setActiveSection((s) => s - 1)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">← Önceki</button>
                )}
                {activeSection < MODAL_SECTIONS.length - 1 ? (
                  <button type="button" onClick={handleNextSection} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">Sonraki →</button>
                ) : (
                  // ── Split Kaydet Butonu ──────────────────────────────────
                  <div ref={saveModeDropdownRef} className="relative flex items-stretch">
                    {/* Ana buton */}
                    <button
                      type="button"
                      onClick={() => handleSave()}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2 text-sm bg-emerald-600 text-white rounded-l-xl hover:bg-emerald-700 disabled:opacity-50 font-medium border-r border-status-success transition-colors"
                    >
                      {saving && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                      {saving ? 'Kaydediliyor...' : saveMode === 'close' ? 'Kaydet ve Kapat' : saveMode === 'new' ? 'Kaydet ve Yeni Ekle' : 'Kaydet ve Detaya Git'}
                    </button>
                    {/* Dropdown ok */}
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setSaveModeDropdownOpen((o) => !o)}
                      className="flex items-center justify-center px-2.5 bg-emerald-600 text-white rounded-r-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      aria-label="Kaydetme seçenekleri"
                    >
                      <svg className={`w-3.5 h-3.5 transition-transform duration-150 ${saveModeDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {/* Dropdown menü */}
                    {saveModeDropdownOpen && (
                      <div className="absolute bottom-full right-0 mb-2 bg-white border border-slate-200 rounded-xl shadow-xl py-1 min-w-[210px] z-50">
                        {([
                          { mode: 'close' as const, label: 'Kaydet ve Kapat', desc: 'Listeye geri dön', icon: '✓' },
                          { mode: 'new' as const, label: 'Kaydet ve Yeni Ekle', desc: 'Formu sıfırla, devam et', icon: '+' },
                          { mode: 'detail' as const, label: 'Kaydet ve Detaya Git', desc: 'Müşteri detay sayfası', icon: '→' },
                        ] as const).map(({ mode, label, desc, icon }) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => {
                              setSaveMode(mode);
                              localStorage.setItem('customerSaveMode', mode);
                              setSaveModeDropdownOpen(false);
                              // overrideSaveMode olarak mode'u geçirerek hemen kaydet
                              handleSave(mode);
                            }}
                            className={`w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-emerald-50 transition-colors ${saveMode === mode ? 'bg-emerald-50' : ''}`}
                          >
                            <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${saveMode === mode ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{saveMode === mode ? '✓' : icon}</span>
                            <div>
                              <p className={`text-xs font-medium ${saveMode === mode ? 'text-emerald-700' : 'text-slate-700'}`}>{label}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">İptal</button>
              </div>
            </div>
        </div>
      </SlidePanel>

      <LocationPickerModal
        open={showLocationPicker}
        initial={locationCoords}
        addressHint={customerAddressLabel || undefined}
        onConfirm={(coords) => { setLocationCoords(coords); setShowLocationPicker(false); setGeocodeMsg(null); }}
        onClose={() => setShowLocationPicker(false)}
      />

      {/* ── Duplicate Onay Modalı ── */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-xl">⚠</div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-1">Çakışan Bilgi Tespit Edildi</h4>
                <p className="text-xs text-slate-500">
                  {hasHardDuplicate
                    ? 'Bu TC Kimlik No veya Vergi No sistemde benzersizdir; aynı numara ile yeni kayıt açılamaz.'
                    : 'Bu Bilgiler Başka Bir Kayıtta Mevcut. Yine de Kaydetmek İstiyor Musunuz?'}
                </p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4 space-y-1">
              {duplicateConflicts.tc && <p className="text-xs text-amber-700">🪪 {duplicateConflicts.tc}</p>}
              {duplicateConflicts.taxNumber && <p className="text-xs text-amber-700">🏢 {duplicateConflicts.taxNumber}</p>}
              {duplicateConflicts.phone && <p className="text-xs text-amber-700">📞 {duplicateConflicts.phone}</p>}
              {duplicateConflicts.email && <p className="text-xs text-amber-700">✉ {duplicateConflicts.email}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowDuplicateModal(false)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                {hasHardDuplicate ? 'Formda Kal' : 'İptal'}
              </button>
              {hasHardDuplicate && duplicateExistingCustomerId ? (
                <button type="button" onClick={goToDuplicateCustomer}
                  className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">
                  Mevcut Müşteriye Git
                </button>
              ) : (
                <button type="button" onClick={() => doSave()}
                  className="px-4 py-2 text-sm bg-status-warning text-white rounded-lg hover:bg-amber-600 font-medium">
                  Yine de Kaydet
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </TableColumnsProvider>
  );
}
