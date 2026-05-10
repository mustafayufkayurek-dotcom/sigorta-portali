'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
import { LocationPickerModal, LocationPreview, type LatLng } from '@/components/LocationPickerModal';
import { useRouter, useSearchParams } from 'next/navigation';
import { relativeTime, activityColor } from '@/utils/date-helpers';
import { toTitleCaseTR } from '@/utils/text-helpers';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

// ── Telefon Numarası mask helpers ─────────────────────────────────────────────
/**
 * Ham rakam dizisinden "0 (5XX) XXX XX XX" maskesi üretir.
 * rawDigits: kullanıcının girdiği tüm rakamlar (0 dahil), max 11 karakter
 */
function maskPhoneTR(rawDigits: string): string {
  const d = rawDigits.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 1) return d; // "0"
  if (d.length <= 4) return `${d[0]} (${d.slice(1)}`; // "0 (5", "0 (53", "0 (532"
  if (d.length <= 7) return `${d[0]} (${d.slice(1, 4)}) ${d.slice(4)}`; // "0 (532) 1", ...
  if (d.length <= 9) return `${d[0]} (${d.slice(1, 4)}) ${d.slice(4, 7)} ${d.slice(7)}`; // "0 (532) 123 45"
  return `${d[0]} (${d.slice(1, 4)}) ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;
}

/** Maske içindeki rakamları çıkarır: "0 (532) 123 45 67" → "05321234567" */
function unmaskPhoneTR(masked: string): string {
  return masked.replace(/\D/g, '');
}

/** Yükleme formatı: "05321234567" → "0 (532) 123 45 67" */
function storageToMask(stored: string): string {
  if (!stored) return '';
  return maskPhoneTR(stored.replace(/\D/g, ''));
}

// ── TRPhoneInput bileşeni ─────────────────────────────────────────────────────
interface TRPhoneInputProps {
  value: string; // saklama formatı: "05321234567"
  onChange: (raw: string) => void; // "05321234567" formatında geri bildirir
  onBlur?: (raw: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
}

function TRPhoneInput({ value, onChange, onBlur, className = '', placeholder = '0 (5XX) XXX XX XX', disabled, hasError }: TRPhoneInputProps) {
  const [display, setDisplay] = useState(() => storageToMask(value));

  // Dışarıdan value değiştiğinde senkronize et (edit modu)
  useEffect(() => {
    setDisplay(storageToMask(value));
  }, [value]); // eslint-disable-line

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '').slice(0, 11);
    const masked = maskPhoneTR(rawDigits);
    setDisplay(masked);
    onChange(rawDigits); // sadece rakamları geri bildir
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const rawDigits = pasted.replace(/\D/g, '').slice(0, 11);
    const masked = maskPhoneTR(rawDigits);
    setDisplay(masked);
    onChange(rawDigits);
  };

  const borderCls = hasError
    ? 'border-red-400 ring-2 ring-red-500/20 bg-red-50'
    : 'border-slate-200 focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-400';

  return (
    <input
      type="text"
      inputMode="numeric"
      className={`w-full border rounded-lg px-3 py-2 h-[38px] text-sm focus:outline-none transition-colors ${borderCls} ${disabled ? 'bg-slate-50 text-slate-400' : ''} ${className}`}
      placeholder={placeholder}
      value={display}
      disabled={disabled}
      maxLength={18} // "0 (532) 123 45 67" = 17 karakter + 1 tolerans
      onChange={handleChange}
      onPaste={handlePaste}
      onBlur={() => {
        if (onBlur) {
          onBlur(unmaskPhoneTR(display));
        }
      }}
    />
  );
}

// ── Doğum Tarihi mask helpers ──────────────────────────────────────────────────
function maskBirthDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}
function birthMaskToISO(masked: string): string {
  const digits = masked.replace(/\D/g, '');
  if (digits.length < 8) return '';
  const dd = digits.slice(0, 2), mm = digits.slice(2, 4), yyyy = digits.slice(4, 8);
  return `${yyyy}-${mm}-${dd}`;
}
function isoToDisplayBirth(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}.${mm}.${yyyy}`;
}

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

type ContactPerson = { id?: string; firstName: string; lastName: string; role: string; phone: string; email: string };
type ContactInfoItem = { id?: string; type: string; value: string; label: string };

// Branş listeleri artık API'den dinamik geliyor — sabit diziler kaldırıldı

const emptyContact = (): ContactPerson => ({ firstName: '', lastName: '', role: '', phone: '', email: '' });
const emptyContactInfo = (): ContactInfoItem => ({ type: 'phone', value: '', label: 'general' });
const emptyForm = () => ({
  customerType: 'individual' as 'individual' | 'corporate',
  subType: '' as '' | 'insured' | 'private_customer' | 'eksper' | 'sigorta_sirketi' | 'eksper_firmasi',
  firstName: '', lastName: '', companyName: '',
  taxNumber: '', taxOffice: '', identityNo: '', birthDate: '',
  contactFirstName: '', contactLastName: '',
  phone: '', email: '',
  phoneType: 'gsm' as 'gsm' | 'landline',
  extensionNo: '',
  cityCode: '', city: '', district: '',
  neighborhood: '', streetName: '', buildingNo: '', doorNo: '',
  address: '',
  source: '', satisfactionScore: '' as '' | '1' | '2' | '3' | '4' | '5',
  followUpDate: '', tags: [] as string[], notes: '',
  serviceType: '' as '' | 'hasar' | 'acil_yardim',
  serviceBranches: [] as string[],
  privateServiceType: '' as string,
});

const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors';
const inpError = 'w-full border border-red-400 ring-2 ring-red-500/20 rounded-lg px-3 py-2 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 transition-colors bg-red-50';

function FormField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">
        {label}{required && <span className="text-xs italic text-slate-400 ml-1 font-normal">(zorunlu alan)</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}

function SectionDivider({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 mt-7 first:mt-0 pb-2 border-b border-slate-100">
      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-base">{emoji}</span>
      <span className="text-sm font-semibold text-slate-700">{title}</span>
    </div>
  );
}

// ── Filter Chip (future use) ────────────────────────────────────────────────
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2.5 py-1 font-medium">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 text-blue-400 hover:text-blue-700 transition-colors rounded-full w-3.5 h-3.5 flex items-center justify-center hover:bg-blue-100"
        aria-label="Filtreyi kaldır"
      >
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

const MODAL_SECTIONS = ['Müşteri Bilgileri', 'Yetkili & İletişim', 'Adres', 'CRM'];

// ── Drawer helpers ───────────────────────────────────────────────────────────
const CLAIM_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  open: { label: 'Açık', cls: 'bg-blue-50 text-blue-700 border-blue-100' },
  in_progress: { label: 'İşlemde', cls: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
  closed: { label: 'Kapalı', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  cancelled: { label: 'İptal', cls: 'bg-red-50 text-red-700 border-red-100' },
};

const DRAWER_STATUS_LABEL: Record<string, string> = {
  active: 'Aktif',
  passive: 'Pasif',
  blacklisted: 'Kara Liste',
};

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

  const name =
    customer.customerType === 'individual'
      ? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() || '—'
      : customer.companyName ?? '—';

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
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${customer.customerType === 'individual' ? 'bg-violet-600' : 'bg-blue-600'}`}>
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
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${customer.customerType === 'individual' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
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
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              <span className="truncate">{customer.phone}</span>
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
          <div className="flex flex-col items-center bg-blue-50 border border-blue-100 rounded-xl px-2.5 py-1.5">
            <span className="text-sm font-bold text-blue-600 leading-none">{totalFiles}</span>
            <span className="text-[9px] text-blue-400 font-medium mt-0.5">Toplam</span>
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

  useEffect(() => {
    if (!open || !customerId) return;
    setCustomer(null);
    setLoadingDetail(true);
    axios
      .get(`${API}/customers/${customerId}`, { headers: authHeader() })
      .then((r) => setCustomer(r.data.data ?? r.data))
      .catch(() => setCustomer(null))
      .finally(() => setLoadingDetail(false));
  }, [customerId, open]);

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
      <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-100">
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
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700 flex-shrink-0">
        <div>
          <p className="text-xs text-blue-200 font-medium uppercase tracking-wide">Müşteri Özeti</p>
          <h3 className="text-sm font-semibold text-white mt-0.5 truncate max-w-[280px]">{name}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          aria-label="Kapat"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {loadingDetail ? (
        <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Yükleniyor...</div>
      ) : !customer ? (
        <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Veri Alınamadı</div>
      ) : (
        <div className="pb-24">
          {/* Kimlik */}
          <div className="px-5 pt-5 pb-4 border-b border-slate-50">
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-base font-bold flex-shrink-0 ${customer.customerType === 'individual' ? 'bg-purple-500' : 'bg-blue-600'}`}>
                {(name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 leading-tight truncate">{name}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {typeBadge}
                  <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${statusCls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1 ${customer.status === 'active' ? 'bg-green-500' : customer.status === 'blacklisted' ? 'bg-red-500' : 'bg-slate-400'}`} />
                    {statusLabel}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2.5">
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-2.5 text-sm text-blue-600 hover:text-blue-700 transition-colors group">
                  <span className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors flex-shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </span>
                  {customer.phone}
                </a>
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
            </div>
          </div>

          {/* Hasar Dosyaları */}
          <div className="px-5 pt-4 pb-4 border-b border-slate-50">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">📂</span>
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Hasar Dosyaları</p>
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
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Hizmet Türü</p>
              </div>
              {customer.serviceType && (
                <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border mb-2 ${
                  customer.serviceType === 'hasar'
                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                    : 'bg-orange-50 text-orange-700 border-orange-100'
                }`}>
                  {customer.serviceType === 'hasar' ? 'Hasar' : 'Acil Yardım'}
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

          {/* CRM */}
          <div className="px-5 pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">📊</span>
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">CRM</p>
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
                      <span key={t} className="inline-flex items-center text-xs bg-amber-50 text-amber-700 rounded-full px-2.5 py-1 border border-amber-100">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Finans Bilgileri */}
          {customer && (() => {
            const invoices = mockInvoices(customer.id);
            const totalAmt = invoices.reduce((s, i) => s + i.amount, 0);
            const paidAmt  = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
            const overdueAmt = invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
            const perf = mockPaymentPerf(customer.id);
            const perfBadge = PAYMENT_PERF_BADGE[perf];
            return (
              <div className="px-5 pt-4 pb-4 border-t border-slate-50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">💰</span>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Finans</p>
                  <span className={`ml-auto inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${perfBadge.cls}`}>
                    {perfBadge.label}
                  </span>
                </div>
                {/* Alacak yaşlandırma */}
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {[
                    { label: '0–30 gün', amt: invoices.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount, 0), cls: 'bg-yellow-50 border-yellow-100 text-yellow-700' },
                    { label: '31–60 gün', amt: Math.round(overdueAmt * 0.4), cls: 'bg-orange-50 border-orange-100 text-orange-700' },
                    { label: '60+ gün',  amt: Math.round(overdueAmt * 0.6), cls: 'bg-red-50 border-red-100 text-red-700' },
                  ].map((item) => (
                    <div key={item.label} className={`rounded-lg border px-2 py-1.5 ${item.cls}`}>
                      <p className="text-[10px] font-medium opacity-70">{item.label}</p>
                      <p className="text-xs font-bold tabular-nums">{fmtTL(item.amt)}</p>
                    </div>
                  ))}
                </div>
                {/* Son faturalar */}
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Son Faturalar</p>
                <div className="space-y-1.5">
                  {invoices.map((inv) => {
                    const st = INVOICE_STATUS[inv.status];
                    return (
                      <div key={inv.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">{inv.id}</p>
                          <p className="text-[10px] text-slate-400">{new Date(inv.date).toLocaleDateString('tr-TR')}{inv.fileNumber ? ` · ${inv.fileNumber}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-semibold text-slate-700 tabular-nums">{fmtTL(inv.amount)}</span>
                          <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Özet */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                  <span>Toplam: <strong className="text-slate-700">{fmtTL(totalAmt)}</strong></span>
                  <span>Tahsil: <strong className="text-green-600">{fmtTL(paidAmt)}</strong></span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Alt Butonlar */}
      <div className="absolute bottom-0 left-0 right-0 flex gap-2 px-5 py-4 border-t border-slate-100 bg-white">
        <button
          type="button"
          onClick={() => { onClose(); router.push(`/panel/musteriler/${customerId}`); }}
          className="flex-1 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
        >
          Detaya Git
        </button>
        <button
          type="button"
          onClick={() => { onEdit(customer); }}
          disabled={!customer}
          className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Düzenle
        </button>
      </div>
    </SlidePanel>
  );
}

// ── Finans Mock Data ──────────────────────────────────────────────────────────
type PaymentPerf = 'regular' | 'sometimes_late' | 'chronic_late';

const PAYMENT_PERF_BADGE: Record<PaymentPerf, { label: string; cls: string }> = {
  regular:       { label: 'Düzenli Öder',    cls: 'bg-green-50 text-green-700 border-green-200' },
  sometimes_late:{ label: 'Bazen Gecikir',   cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  chronic_late:  { label: 'Kronik Gecikme',  cls: 'bg-red-50 text-red-700 border-red-200' },
};

function mockPaymentPerf(id: string): PaymentPerf {
  const n = id.charCodeAt(0) % 10;
  if (n < 6) return 'regular';
  if (n < 9) return 'sometimes_late';
  return 'chronic_late';
}

interface MockInvoice {
  id: string; date: string; amount: number;
  status: 'paid' | 'pending' | 'overdue'; fileNumber?: string;
}

const INVOICE_STATUS: Record<string, { label: string; cls: string }> = {
  paid:    { label: 'Ödendi',    cls: 'bg-green-50 text-green-700 border-green-200' },
  pending: { label: 'Bekliyor', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  overdue: { label: 'Gecikmiş', cls: 'bg-red-50 text-red-700 border-red-200' },
};

function mockInvoices(id: string): MockInvoice[] {
  const seed = id.charCodeAt(0);
  return [
    { id: 'INV-001', date: '2025-03-15', amount: 4_800, status: 'paid',    fileNumber: `HAS-${seed % 900 + 100}` },
    { id: 'INV-002', date: '2025-04-01', amount: 2_350, status: 'paid',    fileNumber: `HAS-${seed % 900 + 101}` },
    { id: 'INV-003', date: '2025-04-22', amount: 6_120, status: 'pending', fileNumber: `HAS-${seed % 900 + 102}` },
    { id: 'INV-004', date: '2025-03-05', amount: 3_200, status: 'overdue', fileNumber: `HAS-${seed % 900 + 103}` },
  ];
}

function fmtTL(amount: number) {
  return amount.toLocaleString('tr-TR') + ' TL';
}

// ── Resizable Columns ─────────────────────────────────────────────────────────
const COL_KEYS = ['check', 'name', 'phone', 'type', 'service', 'files', 'activity', 'payment', 'status', 'action'] as const;
type ColKey = typeof COL_KEYS[number];
const COL_MIN_W: Record<ColKey, number> = {
  check: 36, name: 160, phone: 110, type: 90, service: 70, files: 56, activity: 90, payment: 110, status: 76, action: 68,
};
const COL_DEFAULT_W: Record<ColKey, number> = {
  check: 36, name: 220, phone: 140, type: 120, service: 90, files: 72, activity: 110, payment: 130, status: 90, action: 78,
};
const LS_COL_KEY = 'musteriler_col_widths_v2';

function loadColWidths(): Record<ColKey, number> {
  try {
    if (typeof window === 'undefined') return { ...COL_DEFAULT_W };
    const raw = localStorage.getItem(LS_COL_KEY);
    if (!raw) return { ...COL_DEFAULT_W };
    const parsed = JSON.parse(raw) as Partial<Record<ColKey, number>>;
    return COL_KEYS.reduce((acc, k) => {
      acc[k] = Math.max(COL_MIN_W[k], parsed[k] ?? COL_DEFAULT_W[k]);
      return acc;
    }, {} as Record<ColKey, number>);
  } catch { return { ...COL_DEFAULT_W }; }
}

function useResizableCols() {
  const [widths, setWidths] = useState<Record<ColKey, number>>(loadColWidths);
  const dragging = useRef<{ key: ColKey; startX: number; startW: number } | null>(null);

  const startResize = useCallback((key: ColKey, e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = { key, startX: e.clientX, startW: widths[key] };
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientX - dragging.current.startX;
      const newW = Math.max(COL_MIN_W[dragging.current.key], dragging.current.startW + delta);
      setWidths((prev) => ({ ...prev, [dragging.current!.key]: newW }));
    };
    const onUp = () => {
      setWidths((prev) => {
        try { localStorage.setItem(LS_COL_KEY, JSON.stringify(prev)); } catch { /* noop */ }
        return prev;
      });
      dragging.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [widths]);

  return { widths, startResize };
}

export default function MusterilerPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { widths, startResize } = useResizableCols();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [subTypeFilter, setSubTypeFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [overdueFilter, setOverdueFilter] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') ?? '');
  const [sourceFilter, setSourceFilter] = useState(() => searchParams.get('source') ?? '');
  const [paymentFilter, setPaymentFilter] = useState<'' | PaymentPerf>('');
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const t = searchParams.get('tags');
    return t ? t.split(',').filter(Boolean) : [];
  });
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [showModal, setShowModal] = useState(false);
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
  const [customerSubTypes, setCustomerSubTypes] = useState<Array<{ value: string; label: string; forType: 'individual' | 'corporate' | 'both'; color: 'orange' | 'green' | 'purple' | 'blue' | 'gray' }>>([]);
  const [relationshipTypes, setRelationshipTypes] = useState<string[]>([]); // sadece aktif olanların label listesi
  const [addingNewRelType, setAddingNewRelType] = useState(false);
  const [newRelTypeValue, setNewRelTypeValue] = useState('');
  const [savingRelType, setSavingRelType] = useState(false);
  const [serviceBranchMap, setServiceBranchMap] = useState<Record<'hasar' | 'acil_yardim', string[]>>({ hasar: [], acil_yardim: [] });
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
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
  const [duplicateConflicts, setDuplicateConflicts] = useState<{ phone?: string; email?: string; tc?: string }>({});
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const companyNameRef = useRef<HTMLInputElement>(null);

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
  const STATUS_LABELS: Record<BulkStatusValue, string> = { active: 'Aktif', passive: 'Pasif', blacklisted: 'Kara Liste' };

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

  const resetForm = () => {
    setForm(emptyForm()); setGibError(null); setTcResult(null);
    setIdentityNoError(null); setPhoneError(null); setEmailError(null); setTaxNoError(null);
    setPhoneWarn(null); setEmailWarn(null); setTcWarn(null);
    setDuplicateConflicts({}); setShowDuplicateModal(false);
    setFieldErrors({}); setSectionErrors(null);
    setContacts([emptyContact()]); setContactInfos([emptyContactInfo()]);
    setTagInput(''); setActiveSection(0); setContactsOpen(false);
    setLocationCoords(null); setShowLocationPicker(false);
    setGeocodeMsg(null);
  };

  /** Nominatim geocoding — adres alanlarından koordinat bul */
  const handleGeocodeAddress = useCallback(async (
    city: string,
    district: string,
    neighborhood: string,
    streetName: string,
    buildingNo: string,
  ) => {
    const parts = [neighborhood, streetName, buildingNo ? `No: ${buildingNo}` : '', district, city].filter(Boolean);
    const query = parts.join(' ').trim();
    if (!query) return;
    setGeocoding(true);
    setGeocodeMsg(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=tr&limit=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'SigortaHasarSistemi/1.0 (contact@example.com)' },
      });
      const data = await res.json();
      if (data && data.length > 0) {
        const coords: LatLng = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        setLocationCoords(coords);
        const shortName = (data[0].display_name as string)?.split(',').slice(0, 2).join(',') ?? '';
        setGeocodeMsg({ type: 'success', text: `Konum bulundu: ${shortName}` });
      } else {
        setGeocodeMsg({ type: 'error', text: 'Konum bulunamadı. Haritadan pin atarak konumu manuel belirleyebilirsiniz.' });
      }
    } catch {
      setGeocodeMsg({ type: 'error', text: 'Geocoding başarısız. İnternet bağlantınızı kontrol edin.' });
    } finally {
      setGeocoding(false);
    }
  }, []);

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
    if (!raw) { setPhoneError(null); return; }
    const digits = raw.replace(/\D/g, '');
    if (digits.length > 0 && digits.length < 11) {
      setPhoneError(`Telefon numarası 11 hane olmalıdır (şu an ${digits.length} hane)`);
    } else if (digits.length === 11 && form.phoneType === 'gsm' && digits[0] !== '0') {
      setPhoneError('Telefon numarası 0 ile başlamalıdır');
    } else {
      setPhoneError(null);
      if (digits.length === 11) handlePhoneDuplicateCheck(digits);
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

  const handleTaxNoBlur = () => {
    if (!form.taxNumber) { setTaxNoError(null); return; }
    const s = form.taxNumber.replace(/\s/g, '');
    if (s.length > 0 && s.length < 10) {
      setTaxNoError(`Vergi numarası 10 hane olmalıdır (şu an ${s.length} hane)`);
    } else {
      setTaxNoError(s.length === 10 ? (validateVergiNo(s) ? null : 'Geçersiz vergi numarası') : null);
    }
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
      if (overdueFilter) params.set('followUpOverdue', 'true');
      selectedTags.forEach((tag) => params.append('tags', tag));
      const r = await axios.get(`${API}/customers?${params}`, { headers: authHeader() });
      const rows: any[] = r.data.data || [];
      setCustomers(rows);
      setTotal(r.data.meta?.total ?? 0);
      const tagSet = new Set<string>();
      rows.forEach((c) => (c.tags ?? []).forEach((t: string) => tagSet.add(t)));
      if (tagSet.size > 0) {
        setAllTags((prev) => Array.from(new Set([...prev, ...tagSet])).sort());
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [search, typeFilter, subTypeFilter, cityFilter, statusFilter, sourceFilter, selectedTags, overdueFilter, page]); // eslint-disable-line

  const loadOverdueCount = async () => {
    try {
      const r = await axios.get(`${API}/customers/overdue-count`, { headers: authHeader() });
      setOverdueCount(r.data.data?.count ?? 0);
    } catch { /* sessizce geç */ }
  };

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
    if (overdueFilter) p.set('overdue', 'true');
    if (page > 1) p.set('page', String(page));
    const qs = p.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }, [search, typeFilter, subTypeFilter, cityFilter, statusFilter, sourceFilter, selectedTags, overdueFilter, page]); // eslint-disable-line

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
  useEffect(() => { loadOverdueCount(); }, []); // eslint-disable-line

  const loadCustomerSources = useCallback(() => {
    axios.get(`${API}/system-settings/customer-sources`, { headers: authHeader() })
      .then((r) => setCustomerSources(r.data.data ?? []))
      .catch(() => setCustomerSources(['Sigorta Şirketi Yönlendirmesi', 'Referans', 'Web', 'Tekrar Gelen Müşteri']));
  }, []);

  const loadCustomerSubTypes = useCallback(() => {
    axios.get(`${API}/system-settings/customer-sub-types`, { headers: authHeader() })
      .then((r) => setCustomerSubTypes(r.data.data ?? []))
      .catch(() => setCustomerSubTypes([
        { value: 'sigorta_sirketi',  label: 'Sigorta Şirketi', forType: 'corporate',  color: 'blue'   },
        { value: 'eksper',           label: 'Eksper',          forType: 'individual', color: 'purple' },
        { value: 'eksper_firmasi',   label: 'Eksper Firması',  forType: 'corporate',  color: 'purple' },
        { value: 'insured',          label: 'Sigortalı',       forType: 'both',       color: 'orange' },
        { value: 'private_customer', label: 'Özel Müşteri',    forType: 'individual', color: 'green'  },
      ]));
  }, []);

  useEffect(() => { loadCustomerSources(); }, [loadCustomerSources]);
  useEffect(() => { loadCustomerSubTypes(); }, [loadCustomerSubTypes]);

  useEffect(() => {
    axios.get(`${API}/system-settings/relationship-types`, { headers: authHeader() })
      .then((r) => {
        const data = r.data.data ?? [];
        // Geriye dönük uyumluluk: eski string[] veya yeni {label,active}[]
        if (data.length > 0 && typeof data[0] === 'string') {
          setRelationshipTypes(data as string[]);
        } else {
          // Sadece aktif olanların label'ını al
          setRelationshipTypes(
            (data as { label: string; active: boolean }[])
              .filter((t) => t.active)
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
      // Önce tüm türleri getir (aktif+pasif), yeni ekle, kaydet
      const res = await axios.get(`${API}/system-settings/relationship-types`, { headers: authHeader() });
      const existing = res.data.data ?? [];
      const full: Array<{ label: string; active: boolean }> = existing.length > 0 && typeof existing[0] === 'string'
        ? existing.map((l: string) => ({ label: l, active: true }))
        : existing;
      if (!full.some((t: { label: string }) => t.label === val)) {
        full.push({ label: val, active: true });
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
    axios.get(`${API}/system-settings/service-types`, { headers: authHeader() })
      .then((r) => setServiceTypes(r.data.data ?? []))
      .catch(() => setServiceTypes(['Tadilat', 'Onarım', 'Restorasyon', 'Bakım', 'Montaj', 'Söküm', 'Temizlik', 'Peyzaj', 'Diğer']));
  }, []);

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
      axios.get(`${API}/service-branches?type=hasar`, { headers: authHeader() }),
      axios.get(`${API}/service-branches?type=acil_yardim`, { headers: authHeader() }),
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
        setGibError('TÜRMOB entegrasyonu henüz yapılandırılmamış. Ayarlar > Sistem > Entegrasyonlar sayfasından yapılandırın.');
      } else {
        setGibError('TÜRMOB sorgulaması başarısız — ünvanı manuel girebilirsiniz.');
      }
    } finally { setGibLoading(false); }
  };

  const upC = (i: number, f: keyof ContactPerson, v: string) => setContacts((p) => p.map((c, j) => j === i ? { ...c, [f]: v } : c));
  const upCI = (i: number, f: keyof ContactInfoItem, v: string) => setContactInfos((p) => p.map((ci, j) => j === i ? { ...ci, [f]: v } : ci));
  const addTag = () => { const t = tagInput.trim(); if (t && !form.tags.includes(t)) setForm((p) => ({ ...p, tags: [...p.tags, t] })); setTagInput(''); };

  // ── Sayfa bazlı validasyon ────────────────────────────────────────────────
  const [sectionErrors, setSectionErrors] = useState<string | null>(null);

  const validateSection0 = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (form.customerType === 'individual') {
      if (!form.firstName.trim()) errors.firstName = 'Bu alan zorunludur';
      if (!form.lastName.trim()) errors.lastName = 'Bu alan zorunludur';
      if (customerSubTypeRequired && !form.subType) errors.subType = 'Alt tip seçimi zorunludur';
      if (form.identityNo && !validateTCKimlik(form.identityNo)) {
        errors.identityNo = 'Geçersiz TC Kimlik Numarası';
      }
    } else {
      if (!form.companyName.trim()) errors.companyName = 'Bu alan zorunludur';
    }
    if (form.phone) {
      const phoneDigits = form.phone.replace(/\D/g, '');
      if (phoneDigits.length > 0 && phoneDigits.length !== 11) {
        errors.phone = `Telefon numarası 11 hane olmalıdır (şu an ${phoneDigits.length} hane)`;
      } else if (phoneDigits.length === 11 && form.phoneType === 'gsm' && phoneDigits[0] !== '0') {
        errors.phone = 'Telefon numarası 0 ile başlamalıdır';
      }
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
    setSectionErrors(null);
    setActiveSection((s) => s + 1);
  };

  const handleSave = async (overrideSaveMode?: 'close' | 'new' | 'detail') => {
    // Tüm sayfaları validate et
    const errors: Record<string, string> = {};
    const missingLabels: string[] = [];

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
    }

    // Telefon format validasyonu
    if (form.phone) {
      const phoneDigits = form.phone.replace(/\D/g, '');
      if (phoneDigits.length > 0 && phoneDigits.length !== 11) {
        errors.phone = `Telefon numarası 11 hane olmalıdır (şu an ${phoneDigits.length} hane)`;
        setPhoneError(errors.phone);
      } else if (phoneDigits.length === 11 && form.phoneType === 'gsm' && phoneDigits[0] !== '0') {
        errors.phone = 'Telefon numarası 0 ile başlamalıdır';
        setPhoneError(errors.phone);
      }
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
      setActiveSection(0);
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
      // Yapılandırılmış adres alanlarını birleştir
      const addressParts = [
        form.neighborhood,
        form.streetName,
        form.buildingNo ? `No: ${form.buildingNo}` : '',
        form.doorNo ? `D: ${form.doorNo}` : '',
      ].filter(Boolean);
      const computedAddress = addressParts.length > 0 ? addressParts.join(' ') : (form.address || null);

      const payload: any = {
        customerType: form.customerType, entityType: form.customerType,
        phone: form.phone || null, email: form.email || null,
        city: form.city || null, district: form.district || null,
        address: computedAddress,
        latitude: locationCoords?.lat ?? null, longitude: locationCoords?.lng ?? null,
        notes: form.notes || null, source: form.source || null,
        satisfactionScore: form.satisfactionScore ? Number(form.satisfactionScore) : null,
        followUpDate: form.followUpDate || null, tags: form.tags,
        serviceType: form.subType === 'private_customer' ? null : (form.serviceType || null),
        privateServiceType: form.subType === 'private_customer' ? (form.privateServiceType || null) : null,
        serviceBranches: form.serviceBranches,
        contacts: contacts.filter((c) => c.firstName.trim() || c.lastName.trim()).map((c) => ({ ...c, role: c.role === '__other__' ? '' : c.role })),
        contactInfos: contactInfos.filter((ci) => ci.value.trim()),
      };
      if (form.customerType === 'individual') {
        payload.firstName = form.firstName; payload.lastName = form.lastName;
        payload.identityNo = form.identityNo || null; payload.subType = form.subType || null;
        payload.birthDate = form.birthDate || null;
      } else {
        payload.companyName = form.companyName; payload.taxNumber = form.taxNumber || null;
        payload.taxOffice = form.taxOffice || null;
        payload.contactFirstName = form.contactFirstName || null;
        payload.contactLastName = form.contactLastName || null;
        // Geriye dönük uyumluluk için authorizedPerson'ı da doldur
        if (form.contactFirstName || form.contactLastName) {
          payload.authorizedPerson = `${form.contactFirstName} ${form.contactLastName}`.trim() || null;
        }
      }
      const res = await axios.post(`${API}/customers`, payload, { headers: authHeader() });
      const newId = res.data?.data?.id;
      if (effectiveSaveMode === 'close') {
        setShowModal(false); resetForm(); load();
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
      showToast('error', `Kayıt Başarısız: ${msg}`);
    } finally { setSaving(false); }
  };

  const individualCount = customers.filter((c) => c.customerType === 'individual').length;
  const corporateCount = customers.filter((c) => c.customerType === 'corporate').length;

  const hasActiveFilters = !!(search || typeFilter || subTypeFilter || cityFilter || statusFilter || sourceFilter || selectedTags.length || overdueFilter || paymentFilter);

  // Finans istatistikleri henüz API'den gelmiyor; widget kaldırıldı

  const displayedCustomers = paymentFilter
    ? customers.filter((c) => mockPaymentPerf(c.id) === paymentFilter)
    : customers;

  const clearAllFilters = () => {
    setSearchInput(''); setSearch('');
    setTypeFilter(''); setSubTypeFilter(''); setCityFilter('');
    setStatusFilter(''); setSourceFilter(''); setSelectedTags([]);
    setOverdueFilter(false); setPaymentFilter(''); setPage(1);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
    setPage(1);
  };

  const statusLabel: Record<string, string> = { active: 'Aktif', passive: 'Pasif', blacklisted: 'Kara Liste' };
  const typeLabel: Record<string, string> = { individual: 'Bireysel', corporate: 'Kurumsal' };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="page-header-icon">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h2 className="page-title">Müşteriler</h2>
            <p className="page-subtitle">Bireysel ve Kurumsal Müşteri Yönetimi</p>
          </div>
        </div>
        <button type="button" onClick={() => { resetForm(); loadCustomerSources(); loadCustomerSubTypes(); setShowModal(true); }}
          className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Müşteri
        </button>
      </div>

      {/* ── Overdue Banner ── */}
      {overdueCount > 0 && (
        <button
          type="button"
          onClick={() => { setOverdueFilter((prev) => !prev); setPage(1); }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
            overdueFilter
              ? 'bg-amber-100 border-amber-300 text-amber-900'
              : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 hover:border-amber-300'
          }`}
        >
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 text-base">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {overdueCount} müşterinin takip tarihi geçti
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {overdueFilter ? 'Tüm Müşterilere Dönmek İçin Tekrar Tıklayın' : 'Tıklayarak Sadece Takip Tarihi Geçmiş Müşterileri Görüntüleyin'}
            </p>
          </div>
          {overdueFilter ? (
            <span className="flex-shrink-0 text-xs bg-amber-300 text-amber-900 px-2.5 py-1 rounded-full font-medium">Filtre Aktif ✕</span>
          ) : (
            <svg className="flex-shrink-0 w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card px-4 py-2.5 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {/* Toplam */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide leading-none">Toplam</p>
              <p className="text-base font-bold text-slate-800 leading-tight tabular-nums">{total}</p>
            </div>
          </div>
          <div className="w-px h-7 bg-slate-100 flex-shrink-0" />
          {/* Bireysel */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide leading-none">Bireysel</p>
              <p className="text-base font-bold text-purple-700 leading-tight tabular-nums">{individualCount}</p>
            </div>
          </div>
          <div className="w-px h-7 bg-slate-100 flex-shrink-0" />
          {/* Kurumsal */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide leading-none">Kurumsal</p>
              <p className="text-base font-bold text-blue-700 leading-tight tabular-nums">{corporateCount}</p>
            </div>
          </div>
          {/* Finans istatistikleri: gerçek API verisi geldikten sonra eklenecek */}

        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
        {/* Arama — üst satır, tam genişlik */}
        <div className="relative mb-2.5">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            placeholder="Ad, Telefon, TC, Vergi No..."
            className="input-base-sm pl-9 pr-8 w-full"
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
        {/* Filtreler — alt satır, grid ile yan yana */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 items-center">
          <select
            className="input-base-sm w-full"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setSubTypeFilter(''); setPage(1); }}
          >
            <option value="">Tüm Tipler</option>
            <option value="individual">Bireysel</option>
            <option value="corporate">Kurumsal</option>
          </select>
          {/* Alt Tip filtresi — dropdown */}
          <select
            className={`input-base-sm w-full ${subTypeFilter ? 'border-blue-400 text-blue-700 bg-blue-50' : ''}`}
            value={subTypeFilter}
            onChange={(e) => { setSubTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tüm Alt Tipler</option>
            {customerSubTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {/* Bölge (il) filtresi */}
          <select
            className="input-base-sm w-full"
            value={cityFilter}
            onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tüm Bölgeler</option>
            {STATIC_PROVINCES.map((p) => <option key={p.code} value={p.name}>{p.name}</option>)}
          </select>
          <select
            className="input-base-sm w-full"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
            <option value="blacklisted">Kara Liste</option>
          </select>
          {customerSources.length > 0 && (
            <select
              className="input-base-sm w-full"
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
            >
              <option value="">Tüm Kaynaklar</option>
              {customerSources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <select
            className={`input-base-sm w-full ${paymentFilter ? 'border-blue-400 text-blue-700 bg-blue-50' : ''}`}
            value={paymentFilter}
            onChange={(e) => { setPaymentFilter(e.target.value as '' | PaymentPerf); setPage(1); }}
          >
            <option value="">Ödeme Durumu</option>
            <option value="regular">Düzenli Öder</option>
            <option value="sometimes_late">Bazen Gecikir</option>
            <option value="chronic_late">Kronik Gecikme</option>
          </select>
          {allTags.length > 0 && (
            <div className="relative" ref={tagDropdownRef}>
              <button
                type="button"
                onClick={() => setTagDropdownOpen((o) => !o)}
                className={`flex items-center gap-1.5 input-base-sm w-full ${
                  selectedTags.length ? 'border-blue-400 bg-blue-50 text-blue-700' : ''
                }`}
              >
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span className="truncate">Etiket{selectedTags.length > 0 && ` (${selectedTags.length})`}</span>
                <svg className={`w-3 h-3 flex-shrink-0 ml-auto transition-transform ${tagDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {tagDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-100 rounded-xl shadow-card min-w-[160px] py-1 max-h-52 overflow-y-auto">
                  {allTags.map((tag) => (
                    <button key={tag} type="button" onClick={() => toggleTag(tag)}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-slate-50 transition-colors ${selectedTags.includes(tag) ? 'text-blue-700 font-medium' : 'text-slate-700'}`}
                    >
                      <span className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${selectedTags.includes(tag) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
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
          <button
            type="button"
            onClick={() => { setOverdueFilter((p) => !p); setPage(1); }}
            className={`flex items-center justify-center gap-1.5 input-base-sm px-3 w-full ${overdueFilter ? 'bg-amber-100 border-amber-400 text-amber-800' : ''}`}
          >
            <span className="text-[11px]">⚠️</span>
            <span className="text-xs truncate">Takibi Geçmiş</span>
            {overdueCount > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${overdueFilter ? 'bg-amber-400 text-amber-900' : 'bg-amber-100 text-amber-700'}`}>{overdueCount}</span>
            )}
          </button>
        </div>
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-400 mr-0.5">Aktif filtreler:</span>
            {search && <FilterChip label={`Arama: "${search}"`} onRemove={() => setSearchInput('')} />}
            {typeFilter && <FilterChip label={`Tip: ${typeLabel[typeFilter] ?? typeFilter}`} onRemove={() => { setTypeFilter(''); setPage(1); }} />}
            {subTypeFilter && <FilterChip label={`Alt Tip: ${customerSubTypes.find((t) => t.value === subTypeFilter)?.label ?? subTypeFilter}`} onRemove={() => { setSubTypeFilter(''); setPage(1); }} />}
            {cityFilter && <FilterChip label={`Bölge: ${cityFilter}`} onRemove={() => { setCityFilter(''); setPage(1); }} />}
            {statusFilter && <FilterChip label={`Durum: ${statusLabel[statusFilter] ?? statusFilter}`} onRemove={() => { setStatusFilter(''); setPage(1); }} />}
            {sourceFilter && <FilterChip label={`Kaynak: ${sourceFilter}`} onRemove={() => { setSourceFilter(''); setPage(1); }} />}
            {paymentFilter && <FilterChip label={`Ödeme: ${PAYMENT_PERF_BADGE[paymentFilter]?.label ?? paymentFilter}`} onRemove={() => { setPaymentFilter(''); setPage(1); }} />}
            {overdueFilter && <FilterChip label="Takibi Geçmiş" onRemove={() => { setOverdueFilter(false); setPage(1); }} />}
            {selectedTags.map((tag) => (
              <FilterChip key={tag} label={`Etiket: ${tag}`} onRemove={() => toggleTag(tag)} />
            ))}
            <button type="button" onClick={clearAllFilters}
              className="text-[11px] text-red-500 hover:text-red-700 font-medium ml-1 hover:underline transition-colors">
              Temizle
            </button>
          </div>
        )}
      </div>

      {/* ── Toplu İşlem Toolbar ── */}
      {selectedIds.size > 0 && (
        <div className="sticky top-4 z-30 mb-4">
          <div className="bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 px-5 py-3 flex flex-wrap items-center gap-3">
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
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${val === 'active' ? 'bg-green-500' : val === 'blacklisted' ? 'bg-red-500' : 'bg-slate-400'}`} />
                    {val === 'active' ? 'Aktif' : val === 'passive' ? 'Pasif' : 'Kara Liste'}
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
            <div className="bg-white border border-blue-100 rounded-xl shadow-lg mt-2 p-4">
              <p className="text-xs font-semibold text-slate-600 mb-3">Etiket İşlemi</p>
              <div className="flex gap-3 mb-3">
                {(['add', 'replace'] as const).map((act) => (
                  <button key={act} type="button" onClick={() => setBulkTagAction(act)}
                    className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${bulkTagAction === act ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}>
                    {act === 'add' ? 'Mevcut Etiketlere Ekle' : 'Etiketleri Değiştir'}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mb-3">
                <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                  placeholder="Etiket Adı Girin..." value={bulkTagInput} onChange={(e) => setBulkTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const t = bulkTagInput.trim(); if (t && !bulkTags.includes(t)) setBulkTags((p) => [...p, t]); setBulkTagInput(''); } }} />
                <button type="button" onClick={() => { const t = bulkTagInput.trim(); if (t && !bulkTags.includes(t)) setBulkTags((p) => [...p, t]); setBulkTagInput(''); }}
                  className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-200 text-sm">+</button>
              </div>
              {bulkTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {bulkTags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 rounded-full px-2.5 py-1 border border-amber-100">
                      {t}<button type="button" onClick={() => setBulkTags((p) => p.filter((x) => x !== t))} className="text-amber-400 hover:text-red-500">×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowTagPanel(false); setBulkTags([]); setBulkTagInput(''); }}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">İptal</button>
                <button type="button" onClick={handleBulkTagsConfirm}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Uygula</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Toplu İşlem Onay Modalı ── */}
      {bulkConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xl">
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
                className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center gap-2">
                {bulkLoading && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                Evet, Devam Et
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <div className="inline-block w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-3" /><br/>Yükleniyor...
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
              <button type="button" onClick={() => { loadCustomerSources(); loadCustomerSubTypes(); setShowModal(true); }} className="btn-primary mt-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Yeni Müşteri Ekle
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="table-container">
          {/* Kayıt / Sayfa bilgisi */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
            <span className="text-xs text-slate-500 font-medium">
              {total} kayıt{hasActiveFilters && <span className="ml-1 text-slate-400 font-normal">(filtre uygulandı)</span>}
            </span>
            <span className="text-xs text-slate-400">Sayfa {page} / {Math.max(1, Math.ceil(total / limit))}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="text-sm" style={{ tableLayout: 'fixed', width: '100%', minWidth: COL_KEYS.reduce((s, k) => s + widths[k], 0) + 'px' }}>
              <colgroup>
                {COL_KEYS.map((k) => <col key={k} style={{ width: widths[k] + 'px' }} />)}
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="table-head-row">
                  <th className="px-3 py-2.5 relative" style={{ width: widths.check }}>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => { if (el) el.indeterminate = isIndeterminate; }}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-slate-300 accent-blue-600 cursor-pointer"
                    />
                    <span className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-300/40 select-none" onMouseDown={(e) => startResize('check', e)} />
                  </th>
                  <th className="table-th relative" style={{ width: widths.name }}>
                    Ad Soyad<span className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-300/40 select-none" onMouseDown={(e) => startResize('name', e)} />
                  </th>
                  <th className="table-th relative" style={{ width: widths.phone }}>
                    Telefon<span className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-300/40 select-none" onMouseDown={(e) => startResize('phone', e)} />
                  </th>
                  <th className="table-th relative" style={{ width: widths.type }}>
                    Tip<span className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-300/40 select-none" onMouseDown={(e) => startResize('type', e)} />
                  </th>
                  <th className="table-th relative" style={{ width: widths.service }}>
                    Hizmet<span className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-300/40 select-none" onMouseDown={(e) => startResize('service', e)} />
                  </th>
                  <th className="table-th text-right relative" style={{ width: widths.files }}>
                    Dosya<span className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-300/40 select-none" onMouseDown={(e) => startResize('files', e)} />
                  </th>
                  <th className="table-th relative" style={{ width: widths.activity }}>
                    Aktivite<span className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-300/40 select-none" onMouseDown={(e) => startResize('activity', e)} />
                  </th>
                  <th className="table-th relative" style={{ width: widths.payment }}>
                    Ödeme<span className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-300/40 select-none" onMouseDown={(e) => startResize('payment', e)} />
                  </th>
                  <th className="table-th text-center relative" style={{ width: widths.status }}>
                    Durum<span className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-300/40 select-none" onMouseDown={(e) => startResize('status', e)} />
                  </th>
                  <th className="table-th text-right relative" style={{ width: widths.action }}>
                    İşlem<span className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-300/40 select-none" onMouseDown={(e) => startResize('action', e)} />
                  </th>
                </tr>
              </thead>
              <tbody className="table-body">
                {displayedCustomers.map((c) => {
                  const name = c.customerType === 'individual'
                    ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() : c.companyName ?? '—';
                  const subTypeDef = customerSubTypes.find((t) => t.value === c.subType);
                  const subTypeLabel = subTypeDef?.label ?? null;
                  const isOverdue = c.followUpDate && c.status === 'active' && new Date(c.followUpDate) < new Date(new Date().setHours(0, 0, 0, 0));
                  const overdueDays = isOverdue ? Math.floor((Date.now() - new Date(c.followUpDate).getTime()) / 86_400_000) : 0;
                  return (
                    <tr
                      key={c.id}
                      className={`table-row cursor-pointer ${selectedIds.has(c.id) ? 'bg-blue-50/60' : ''} ${isOverdue ? 'border-l-2 border-amber-400' : ''}`}
                      onMouseEnter={(e) => handleRowMouseEnter(c, e.currentTarget)}
                      onMouseLeave={handleRowMouseLeave}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('a, button, input')) return;
                        setDrawerCustomerId(c.id);
                        setDrawerOpen(true);
                      }}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2 overflow-hidden" style={{ width: widths.check }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="w-3.5 h-3.5 rounded border-slate-300 accent-blue-600 cursor-pointer"
                        />
                      </td>
                      {/* Ad Soyad */}
                      <td className="table-td overflow-hidden" style={{ width: widths.name }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${c.customerType === 'individual' ? 'bg-purple-500' : 'bg-blue-600'}`}>
                            {(name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <Link href={`/panel/musteriler/${c.id}`} className="text-xs font-semibold text-slate-800 hover:text-blue-600 transition-colors truncate block">{name || '—'}</Link>
                            {c.city && <p className="text-[11px] text-slate-400 leading-tight truncate">{c.city}</p>}
                          </div>
                        </div>
                      </td>
                      {/* Telefon */}
                      <td className="table-td overflow-hidden" style={{ width: widths.phone }}>
                        {c.phone ? (
                          <a href={`tel:${c.phone}`} className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 transition-colors truncate">
                            {c.phone}
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </td>
                      {/* Tip */}
                      <td className="table-td overflow-hidden" style={{ width: widths.type }}>
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium w-fit ${c.customerType === 'individual' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                            {c.customerType === 'individual' ? 'Bireysel' : 'Kurumsal'}
                          </span>
                          {subTypeLabel && (
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] w-fit ${
                              subTypeDef?.color === 'orange' ? 'bg-orange-50 text-orange-700' :
                              subTypeDef?.color === 'green'  ? 'bg-green-50 text-green-700' :
                              subTypeDef?.color === 'purple' ? 'bg-purple-50 text-purple-700' :
                              subTypeDef?.color === 'blue'   ? 'bg-blue-50 text-blue-700' :
                              'bg-slate-50 text-slate-600'
                            }`}>
                              {subTypeLabel}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Hizmet Türü */}
                      <td className="table-td overflow-hidden" style={{ width: widths.service }}>
                        {c.serviceType ? (
                          <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                            c.serviceType === 'hasar'
                              ? 'bg-blue-50 text-blue-700 border-blue-100'
                              : 'bg-orange-50 text-orange-700 border-orange-100'
                          }`}>
                            {c.serviceType === 'hasar' ? 'Hasar' : 'Acil'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </td>
                      {/* Dosya Sayısı */}
                      <td className="table-td text-right overflow-hidden" style={{ width: widths.files }}>
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                          {c._count?.claimFiles ?? 0}
                        </span>
                      </td>
                      {/* Aktivite */}
                      <td className="table-td overflow-hidden" style={{ width: widths.activity }}>
                        {isOverdue ? (
                          <div>
                            <span className="text-[11px] font-semibold text-red-500">{overdueDays}g gecikme</span>
                            <p className="text-[10px] text-red-400 leading-tight">{new Date(c.followUpDate).toLocaleDateString('tr-TR')}</p>
                          </div>
                        ) : (
                          <span className={`text-[11px] font-medium ${activityColor(c.lastActivityDate)}`}>
                            {relativeTime(c.lastActivityDate)}
                          </span>
                        )}
                      </td>
                      {/* Ödeme Performansı */}
                      <td className="table-td overflow-hidden" style={{ width: widths.payment }}>
                        {(() => {
                          const perf = mockPaymentPerf(c.id);
                          const badge = PAYMENT_PERF_BADGE[perf];
                          return (
                            <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${badge.cls}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </td>
                      {/* Durum */}
                      <td className="table-td text-center overflow-hidden" style={{ width: widths.status }}>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${STATUS_COLOR[c.status] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.status === 'active' ? 'bg-green-500' : c.status === 'blacklisted' ? 'bg-red-500' : 'bg-slate-400'}`} />
                          {c.status === 'active' ? 'Aktif' : c.status === 'blacklisted' ? 'Kara' : 'Pasif'}
                        </span>
                      </td>
                      {/* Operasyon */}
                      <td className="table-td text-right overflow-hidden" style={{ width: widths.action }}>
                        <Link href={`/panel/musteriler/${c.id}`}
                          className="text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg transition-colors font-medium">
                          Detay
                        </Link>
                      </td>
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
        onEdit={() => {
          setDrawerOpen(false);
          resetForm();
          loadCustomerSources();
          setShowModal(true);
        }}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 py-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700">
              <div>
                <h3 className="text-base font-semibold text-white">Yeni Müşteri Ekle</h3>
                <p className="text-blue-200 text-xs mt-0.5">Tüm Bilgileri Eksiksiz Doldurun</p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-blue-200 hover:text-white transition-colors">
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
                <div className="flex items-center gap-2 px-6 py-2.5 bg-blue-50 border-b border-blue-100">
                  <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm font-semibold text-blue-800">{displayName}</span>
                  <span className="text-xs text-blue-500 font-medium">— {typeLabel}</span>
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

            <div className="flex overflow-x-auto border-b border-slate-100 bg-slate-50/50">
              {MODAL_SECTIONS.map((sec, i) => (
                <button key={sec} type="button" onClick={() => setActiveSection(i)}
                  className={`flex-shrink-0 px-5 py-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${activeSection === i ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/70'}`}>
                  {i + 1}. {sec}
                </button>
              ))}
            </div>

            <div className="p-6">
              {activeSection === 0 && (
                <div>
                  <SectionDivider emoji="👤" title="Müşteri Tipi" />
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {[
                      { val: 'individual', label: 'Bireysel', emoji: '👤' },
                      { val: 'corporate', label: 'Kurumsal', emoji: '🏢' },
                    ].map(({ val, label, emoji }) => (
                      <button key={val} type="button"
                        onClick={() => { setForm((p) => ({ ...p, customerType: val as any, subType: '', serviceType: '', serviceBranches: [] })); setTcResult(null); setGibError(null); setTaxNoError(null); setFieldErrors({}); }}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border-2 transition-all ${form.customerType === val ? val === 'individual' ? 'bg-purple-600 text-white border-purple-600' : 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                        <span>{emoji}</span>{label}
                      </button>
                    ))}
                  </div>

                  {form.customerType === 'individual' && (
                    <div className="mb-5">
                      <p className="text-xs font-medium text-slate-500 mb-2">Alt Tip{customerSubTypeRequired && <span className="text-xs italic text-slate-400 ml-1 font-normal">(zorunlu alan)</span>}</p>
                      <div className="flex gap-2 flex-wrap">
                        {customerSubTypes
                          .filter((t) => t.forType === 'individual' || t.forType === 'both')
                          .map((t) => {
                            const activeClass =
                              t.color === 'orange' ? 'bg-orange-500 text-white border-orange-500' :
                              t.color === 'green'  ? 'bg-green-600 text-white border-green-600' :
                              t.color === 'purple' ? 'bg-purple-600 text-white border-purple-600' :
                              t.color === 'blue'   ? 'bg-blue-600 text-white border-blue-600' :
                                                     'bg-slate-600 text-white border-slate-600';
                            return (
                              <button key={t.value} type="button"
                                onClick={() => { setForm((p) => ({ ...p, subType: p.subType === t.value as any ? '' : t.value as any, serviceType: '', serviceBranches: [] })); setFieldErrors((prev) => { const n = { ...prev }; delete n.subType; return n; }); }}
                                className={`flex-1 py-2 rounded-xl text-xs font-medium border-2 transition-all ${form.subType === t.value ? activeClass : fieldErrors.subType ? 'bg-white text-slate-600 border-red-400 ring-2 ring-red-500/20' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                                {t.label}
                              </button>
                            );
                          })}
                      </div>
                      {fieldErrors.subType && <p className="text-xs text-red-500 mt-1.5">{fieldErrors.subType}</p>}
                    </div>
                  )}

                  {form.customerType === 'individual' ? (
                    <>
                      <SectionDivider emoji="📋" title="Bireysel Bilgiler" />
                      <div className="grid grid-cols-2 gap-4 items-start">
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
                        <div className="col-span-2">
                          <FormField label="TC Kimlik No" error={identityNoError ?? fieldErrors.identityNo ?? undefined}>
                            <div className="relative">
                              <input
                                className={`w-full border rounded-lg px-3 py-2 h-[38px] pr-8 text-sm focus:outline-none focus:ring-2 transition-colors ${identityNoError || fieldErrors.identityNo ? 'border-red-400 ring-2 ring-red-500/20 bg-red-50 focus:ring-red-500/30' : tcResult === true ? 'border-green-400 ring-2 ring-green-500/20 focus:ring-green-500/30' : 'border-slate-200 focus:ring-purple-500/30'}`}
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
                        <FormField label="Telefon" error={phoneError ?? undefined}>
                          <div className="flex gap-1.5 items-center">
                            {/* Telefon tipi ikonu */}
                            <span className="flex-shrink-0 w-8 h-9 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200 text-slate-400">
                              {form.phoneType === 'gsm' ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <rect x="5" y="2" width="14" height="20" rx="2" strokeWidth={1.8} />
                                  <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                              )}
                            </span>
                            <select
                              className="border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors bg-white flex-shrink-0 h-9"
                              value={form.phoneType}
                              onChange={(e) => setForm((p) => ({ ...p, phoneType: e.target.value as 'gsm' | 'landline', extensionNo: '' }))}
                            >
                              <option value="gsm">GSM</option>
                              <option value="landline">Sabit Hat</option>
                            </select>
                            <TRPhoneInput
                              className="flex-1"
                              placeholder={form.phoneType === 'gsm' ? '0 (5XX) XXX XX XX' : '0 (XXX) XXX XX XX'}
                              value={form.phone}
                              onChange={(v) => { setForm((p) => ({ ...p, phone: v })); setPhoneError(null); setPhoneWarn(null); setDuplicateConflicts((p) => { const n = { ...p }; delete n.phone; return n; }); }}
                              onBlur={handlePhoneBlur}
                              hasError={!!phoneError}
                            />
                            {form.phoneType === 'landline' && (
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={5}
                                placeholder="Dahili"
                                className="w-16 border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors flex-shrink-0 h-9"
                                value={form.extensionNo}
                                onChange={(e) => setForm((p) => ({ ...p, extensionNo: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                              />
                            )}
                          </div>
                          {!phoneError && phoneWarn && <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">⚠ {phoneWarn}</p>}
                        </FormField>
                        <FormField label="Doğum Tarihi">
                          <input type="text" inputMode="numeric" className={inp} placeholder="GG.AA.YYYY" maxLength={10}
                            value={isoToDisplayBirth(form.birthDate)}
                            onChange={(e) => {
                              const masked = maskBirthDate(e.target.value);
                              const iso = birthMaskToISO(masked);
                              setForm((p) => ({ ...p, birthDate: iso || masked }));
                            }} />
                        </FormField>
                        <FormField label="E-posta">
                          <input type="email" className={inp} placeholder="ornek@mail.com" value={form.email}
                            onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setEmailError(null); setEmailWarn(null); setDuplicateConflicts((p) => { const n = { ...p }; delete n.email; return n; }); }}
                            onBlur={() => { handleEmailBlur(); handleEmailDuplicateCheck(form.email); }} />
                          {emailError && <p className="text-xs text-red-500 mt-1.5">{emailError}</p>}
                          {!emailError && emailWarn && <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">⚠ {emailWarn}</p>}
                        </FormField>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-5">
                        <p className="text-xs font-medium text-slate-500 mb-2">Alt Tip{customerSubTypeRequired && <span className="text-xs italic text-slate-400 ml-1 font-normal">(zorunlu alan)</span>}</p>
                        <div className="flex gap-2 flex-wrap">
                          {customerSubTypes
                            .filter((t) => t.forType === 'corporate' || t.forType === 'both')
                            .map((t) => {
                              const activeClass =
                                t.color === 'orange' ? 'bg-orange-500 text-white border-orange-500' :
                                t.color === 'green'  ? 'bg-green-600 text-white border-green-600' :
                                t.color === 'purple' ? 'bg-purple-600 text-white border-purple-600' :
                                t.color === 'blue'   ? 'bg-blue-600 text-white border-blue-600' :
                                                       'bg-slate-600 text-white border-slate-600';
                              return (
                                <button key={t.value} type="button"
                                  onClick={() => { setForm((p) => ({ ...p, subType: p.subType === t.value as any ? '' : t.value as any, serviceType: '', serviceBranches: [] })); setFieldErrors((prev) => { const n = { ...prev }; delete n.subType; return n; }); }}
                                  className={`flex-1 py-2 rounded-xl text-xs font-medium border-2 transition-all ${form.subType === t.value ? activeClass : fieldErrors.subType ? 'bg-white text-slate-600 border-red-400 ring-2 ring-red-500/20' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                                  {t.label}
                                </button>
                              );
                            })}
                        </div>
                        {fieldErrors.subType && <p className="text-xs text-red-500 mt-1.5">{fieldErrors.subType}</p>}
                      </div>
                      <SectionDivider emoji="🏢" title="Kurumsal Bilgiler" />
                      <div className="grid grid-cols-2 gap-4 items-start">
                        <div className="col-span-2">
                          <FormField label="Şirket Adı" required error={fieldErrors.companyName}>
                            <input ref={companyNameRef} className={fieldErrors.companyName ? inpError : inp} placeholder="Şirket Unvanı" value={form.companyName} onChange={(e) => { setForm((p) => ({ ...p, companyName: e.target.value })); setFieldErrors((prev) => { const n = { ...prev }; delete n.companyName; return n; }); }} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, companyName: v })); }} />
                          </FormField>
                        </div>
                        <FormField label="Vergi No">
                          <div className="flex gap-2">
                            <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                              placeholder="10 Haneli VKN" maxLength={10} inputMode="numeric"
                              value={form.taxNumber}
                              onChange={(e) => {
                                const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 10);
                                setForm((p) => ({ ...p, taxNumber: onlyDigits })); setGibError(null); setTaxNoError(null);
                              }}
                              onBlur={handleTaxNoBlur} />
                            <button type="button" onClick={handleGibQuery} disabled={gibLoading || !form.taxNumber}
                              className="bg-blue-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap">
                              {gibLoading && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                              Ünvan Sorgula
                            </button>
                          </div>
                          {taxNoError && <p className="text-xs text-red-500 mt-1.5">{taxNoError}</p>}
                          {!taxNoError && gibError && <p className="text-xs text-amber-600 mt-1.5">⚠ {gibError}</p>}
                        </FormField>
                        <FormField label="Vergi Dairesi">
                          <input className={inp} placeholder="Opsiyonel" value={form.taxOffice} onChange={(e) => setForm((p) => ({ ...p, taxOffice: e.target.value }))} />
                        </FormField>
                        <div className="col-span-2">
                          <div className="grid grid-cols-2 gap-4 items-start">
                            <FormField label="Yetkili Kişi Adı">
                              <input className={inp} placeholder="Ad" value={form.contactFirstName}
                                onChange={(e) => setForm((p) => ({ ...p, contactFirstName: e.target.value }))}
                                onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, contactFirstName: v })); }} />
                            </FormField>
                            <FormField label="Yetkili Kişi Soyadı">
                              <input className={inp} placeholder="Soyad" value={form.contactLastName}
                                onChange={(e) => setForm((p) => ({ ...p, contactLastName: e.target.value }))}
                                onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, contactLastName: v })); }} />
                            </FormField>
                          </div>
                        </div>
                        <FormField label="Telefon" error={phoneError ?? undefined}>
                          <div className="flex gap-1.5 items-center">
                            {/* Telefon tipi ikonu */}
                            <span className="flex-shrink-0 w-8 h-9 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200 text-slate-400">
                              {form.phoneType === 'gsm' ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <rect x="5" y="2" width="14" height="20" rx="2" strokeWidth={1.8} />
                                  <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                              )}
                            </span>
                            <select
                              className="border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors bg-white flex-shrink-0 h-9"
                              value={form.phoneType}
                              onChange={(e) => setForm((p) => ({ ...p, phoneType: e.target.value as 'gsm' | 'landline', extensionNo: '' }))}
                            >
                              <option value="gsm">GSM</option>
                              <option value="landline">Sabit Hat</option>
                            </select>
                            <TRPhoneInput
                              className="flex-1"
                              placeholder={form.phoneType === 'gsm' ? '0 (5XX) XXX XX XX' : '0 (XXX) XXX XX XX'}
                              value={form.phone}
                              onChange={(v) => { setForm((p) => ({ ...p, phone: v })); setPhoneError(null); setPhoneWarn(null); setDuplicateConflicts((p) => { const n = { ...p }; delete n.phone; return n; }); }}
                              onBlur={handlePhoneBlur}
                              hasError={!!phoneError}
                            />
                            {form.phoneType === 'landline' && (
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={5}
                                placeholder="Dahili"
                                className="w-16 border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors flex-shrink-0 h-9"
                                value={form.extensionNo}
                                onChange={(e) => setForm((p) => ({ ...p, extensionNo: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                              />
                            )}
                          </div>
                          {!phoneError && phoneWarn && <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">⚠ {phoneWarn}</p>}
                        </FormField>
                        <FormField label="E-posta">
                          <input type="email" className={inp} placeholder="ornek@mail.com" value={form.email}
                            onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setEmailError(null); setEmailWarn(null); setDuplicateConflicts((p) => { const n = { ...p }; delete n.email; return n; }); }}
                            onBlur={() => { handleEmailBlur(); handleEmailDuplicateCheck(form.email); }} />
                          {emailError && <p className="text-xs text-red-500 mt-1.5">{emailError}</p>}
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
                          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-base">👥</span>
                          <span className="text-sm font-semibold text-slate-700">İlgili Kişi Ekle</span>
                          {contacts.filter((c) => c.firstName.trim() || c.lastName.trim()).length > 0 && (
                            <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">
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
                                    <button type="button" onClick={() => setContacts((p) => p.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="col-span-2">
                                    <div className="grid grid-cols-2 gap-3">
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
                                          className="px-2.5 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 flex-shrink-0">
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
                                  <FormField label="Telefon"><TRPhoneInput value={c.phone} onChange={(v) => upC(idx, 'phone', v)} /></FormField>
                                  <div className="col-span-2"><FormField label="E-posta"><input type="email" className={inp} placeholder="ornek@mail.com" value={c.email} onChange={(e) => upC(idx, 'email', e.target.value)} /></FormField></div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => setContacts((p) => [...p, emptyContact()])}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium py-2 px-3 rounded-lg hover:bg-blue-50 transition-colors">
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
                                <button type="button" onClick={() => setContacts((p) => p.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="col-span-2">
                                <div className="grid grid-cols-2 gap-3">
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
                                    if (e.target.value === '__other__') upC(idx, 'role', '__other__');
                                    else upC(idx, 'role', e.target.value);
                                  }}
                                >
                                  <option value="">Seçin...</option>
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
                              <FormField label="Telefon"><TRPhoneInput value={c.phone} onChange={(v) => upC(idx, 'phone', v)} /></FormField>
                              <div className="col-span-2"><FormField label="E-posta"><input type="email" className={inp} placeholder="ornek@sirket.com" value={c.email} onChange={(e) => upC(idx, 'email', e.target.value)} /></FormField></div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => setContacts((p) => [...p, emptyContact()])}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium py-2 px-3 rounded-lg hover:bg-blue-50 transition-colors mb-5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Yetkili Kişi Ekle
                      </button>
                    </>
                  )}
                  <SectionDivider emoji="📡" title="İletişim Kanalları" />
                  <div className="space-y-2.5 mb-4">
                    {contactInfos.map((ci, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <select className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm bg-white w-32 flex-shrink-0" value={ci.type} onChange={(e) => upCI(idx, 'type', e.target.value)}>
                          <option value="phone">📞 Telefon</option>
                          <option value="email">✉ E-posta</option>
                          <option value="fax">🖷 Faks</option>
                          <option value="whatsapp">💬 WhatsApp</option>
                        </select>
                        {(ci.type === 'phone' || ci.type === 'whatsapp') ? (
                          <TRPhoneInput className="flex-1" value={ci.value} onChange={(v) => upCI(idx, 'value', v)} />
                        ) : (
                          <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                            placeholder={ci.type === 'email' ? 'ornek@sirket.com' : 'Faks numarası'}
                            value={ci.value} onChange={(e) => upCI(idx, 'value', e.target.value)} />
                        )}
                        <select className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm bg-white w-28 flex-shrink-0" value={ci.label} onChange={(e) => upCI(idx, 'label', e.target.value)}>
                          <option value="general">Genel</option>
                          <option value="work">İş</option>
                          <option value="personal">Kişisel</option>
                        </select>
                        {contactInfos.length > 1 && (
                          <button type="button" onClick={() => setContactInfos((p) => p.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setContactInfos((p) => [...p, emptyContactInfo()])}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium py-2 px-3 rounded-lg hover:bg-blue-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Kanal Ekle
                  </button>
                </div>
              )}

              {activeSection === 2 && (
                <div>
                  <SectionDivider emoji="📍" title="Adres Bilgileri" />
                  <div className="grid grid-cols-2 gap-4">
                    {/* İl */}
                    <FormField label="İl">
                      <select className={inp} value={form.cityCode}
                        onChange={(e) => {
                          const prov = STATIC_PROVINCES.find((p) => p.code === e.target.value);
                          setForm((p) => ({ ...p, cityCode: e.target.value, city: prov?.name ?? '', district: '', neighborhood: '' }));
                        }}>
                        <option value="">İl seçin...</option>
                        {STATIC_PROVINCES.map((p) => (
                          <option key={p.code} value={p.code}>{p.plateCode} - {p.name}</option>
                        ))}
                      </select>
                    </FormField>
                    {/* İlçe */}
                    <FormField label="İlçe">
                      <select key={form.cityCode} className={inp} value={form.district} disabled={!form.cityCode}
                        onChange={(e) => setForm((p) => ({ ...p, district: e.target.value, neighborhood: '' }))}>
                        <option value="">İlçe seçin...</option>
                        {currentDistricts.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </FormField>
                    {/* Mahalle */}
                    <div className="col-span-2">
                      <FormField label="Mahalle">
                        <input
                          type="text"
                          className={inp}
                          placeholder="Mahalle adı girin..."
                          value={form.neighborhood}
                          onChange={(e) => setForm((p) => ({ ...p, neighborhood: e.target.value }))}
                        />
                      </FormField>
                    </div>
                    {/* Cadde / Sokak */}
                    <div className="col-span-2">
                      <FormField label="Cadde / Sokak">
                        <input
                          type="text"
                          className={inp}
                          placeholder="Cadde veya sokak adı..."
                          value={form.streetName}
                          onChange={(e) => setForm((p) => ({ ...p, streetName: e.target.value }))}
                        />
                      </FormField>
                    </div>
                    {/* Bina No + Daire No */}
                    <FormField label="Bina No">
                      <input
                        type="text"
                        className={inp}
                        placeholder="Örn: 12"
                        value={form.buildingNo}
                        onChange={(e) => setForm((p) => ({ ...p, buildingNo: e.target.value }))}
                      />
                    </FormField>
                    <FormField label="Daire No (Opsiyonel)">
                      <input
                        type="text"
                        className={inp}
                        placeholder="Örn: 3"
                        value={form.doorNo}
                        onChange={(e) => setForm((p) => ({ ...p, doorNo: e.target.value }))}
                      />
                    </FormField>
                    {/* Konum butonları */}
                    <div className="col-span-2 pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Konumu Bul (geocoding) */}
                        {(form.city || form.district || form.neighborhood || form.streetName) && (
                          <button
                            type="button"
                            onClick={() => handleGeocodeAddress(form.city, form.district, form.neighborhood, form.streetName, form.buildingNo)}
                            disabled={geocoding}
                            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors font-medium bg-green-50 text-green-700 border-green-200 hover:bg-green-100 disabled:opacity-60"
                          >
                            {geocoding ? (
                              <>
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Aranıyor...
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                Konumu Bul
                              </>
                            )}
                          </button>
                        )}
                        {/* Haritadan seç */}
                        <button
                          type="button"
                          onClick={() => setShowLocationPicker(true)}
                          title="Haritadan Konum Seç"
                          className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors font-medium ${locationCoords ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {locationCoords ? 'Konum Seçildi' : 'Haritadan Konum Seç'}
                        </button>
                        {locationCoords && (
                          <button type="button" onClick={() => { setLocationCoords(null); setGeocodeMsg(null); }} className="text-xs text-slate-400 hover:text-red-500 transition-colors ml-auto">Konumu Kaldır</button>
                        )}
                      </div>
                      {/* Geocode mesajı */}
                      {geocodeMsg && (
                        <div className={`mt-2 flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${geocodeMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                          {geocodeMsg.type === 'success' ? (
                            <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span>{geocodeMsg.text}</span>
                        </div>
                      )}
                    </div>
                    {locationCoords && (
                      <div className="col-span-2">
                        <LocationPreview
                          lat={locationCoords.lat}
                          lng={locationCoords.lng}
                          onEdit={() => setShowLocationPicker(true)}
                          onClear={() => { setLocationCoords(null); setGeocodeMsg(null); }}
                          accentColor="blue"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <LocationPickerModal
                open={showLocationPicker}
                initial={locationCoords}
                addressHint={[form.neighborhood, form.streetName, form.buildingNo ? `No: ${form.buildingNo}` : '', form.district, form.city].filter(Boolean).join(' ') || undefined}
                onConfirm={(coords) => { setLocationCoords(coords); setShowLocationPicker(false); setGeocodeMsg(null); }}
                onClose={() => setShowLocationPicker(false)}
              />

              {activeSection === 3 && (
                <div>
                  <SectionDivider emoji="📊" title="CRM Bilgileri" />
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <FormField label="Müşteri Kaynağı">
                      <select className={inp} value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}>
                        <option value="">Seçin...</option>
                        {customerSources.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Takip Tarihi">
                      <input type="date" className={inp} value={form.followUpDate} onChange={(e) => setForm((p) => ({ ...p, followUpDate: e.target.value }))} />
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
                        <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors" placeholder="VIP, Standart, Riskli..." value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
                        <button type="button" onClick={addTag} className="bg-slate-100 text-slate-600 text-sm px-3 py-2 rounded-lg hover:bg-slate-200">+</button>
                      </div>
                    </FormField>
                    {form.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {form.tags.map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 rounded-full px-2.5 py-1 border border-amber-100">
                            {t}
                            <button type="button" onClick={() => setForm((p) => ({ ...p, tags: p.tags.filter((x) => x !== t) }))} className="text-amber-400 hover:text-red-500 ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-5">
                    <FormField label="Notlar">
                      <textarea rows={4} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="Müşteri Hakkında Ek Notlar..." value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
                    </FormField>
                  </div>

                  {/* ── Hizmet Türü & Branşlar (koşullu) ── */}
                  {/* Eksper veya Eksper Firması: Hizmet Türü + Branşlar */}
                  {/* Sigorta Şirketi: Sadece Branşlar */}
                  {/* Sigortalı / Özel Müşteri: Gizli */}
                  {form.subType === 'private_customer' && (
                  <div className="mt-5">
                    <SectionDivider emoji="🛠" title="Hizmet Türü" />
                    <FormField label="Hizmet Türü">
                      <select
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                        value={form.privateServiceType}
                        onChange={(e) => setForm((p) => ({ ...p, privateServiceType: e.target.value }))}
                      >
                        <option value="">Seçiniz...</option>
                        {serviceTypes.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </FormField>
                  </div>
                  )}
                  {(form.subType === 'eksper' || form.subType === 'eksper_firmasi' || form.subType === 'sigorta_sirketi') && (
                  <div className="mt-5">
                    <SectionDivider emoji="🛠" title="Hizmet Türü & Branşlar" />

                    {/* Sigorta Şirketi için Hizmet Türü gizli, Eksper için görünür */}
                    {form.subType !== 'sigorta_sirketi' && (
                    <FormField label="Hizmet Türü">
                      <div className="flex gap-2">
                        {(['hasar', 'acil_yardim'] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, serviceType: p.serviceType === type ? '' : type, serviceBranches: [] }))}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm border transition-all font-medium ${
                              form.serviceType === type
                                ? type === 'hasar'
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-orange-400 bg-orange-50 text-orange-700'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {type === 'hasar' ? 'Hasar' : 'Acil Yardım'}
                          </button>
                        ))}
                      </div>
                    </FormField>
                    )}

                    {(form.serviceType || form.subType === 'sigorta_sirketi') && (
                      <div className="mt-3">
                        {branchesLoading ? (
                          <p className="text-xs text-slate-400 py-2 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            Branşlar Yükleniyor...
                          </p>
                        ) : (
                          (() => {
                          const branchKey = form.subType === 'sigorta_sirketi' ? 'hasar' : (form.serviceType as 'hasar' | 'acil_yardim');
                          const branchList = serviceBranchMap[branchKey] ?? [];
                          const allSelected = branchList.length > 0 && branchList.every((b) => form.serviceBranches.includes(b));
                          return (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-slate-500">
                                  {form.subType === 'sigorta_sirketi' ? 'Branşlar' : form.serviceType === 'hasar' ? 'Hasar Branşları' : 'Acil Yardım Hizmet Alanları'}
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
                                        : form.subType === 'sigorta_sirketi'
                                          ? 'border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                          : form.serviceType === 'hasar'
                                            ? 'border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                            : 'border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100'
                                    }`}
                                  >
                                    {allSelected ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                                  </button>
                                )}
                              </div>
                              {branchList.length === 0 ? (
                                <p className="text-xs text-slate-400 py-2">Branş bulunamadı. Ayarlar &gt; Hizmet Branşları sayfasından ekleyin.</p>
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
                                            ? (form.subType === 'sigorta_sirketi' || form.serviceType === 'hasar')
                                              ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                                              : 'border-orange-400 bg-orange-50 text-orange-700 font-medium'
                                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[9px] ${
                                          selected
                                            ? (form.subType === 'sigorta_sirketi' || form.serviceType === 'hasar') ? 'bg-blue-600 border-blue-600 text-white' : 'bg-orange-500 border-orange-500 text-white'
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
                                  {form.serviceBranches.length} branş seçildi: {form.serviceBranches.join(', ')}
                                </p>
                              )}
                            </>
                          );
                        })()
                        )}
                      </div>
                    )}
                  </div>
                  )}
                </div>
              )}
            </div>

            {sectionErrors && (
              <div className="px-6 py-2 border-t border-red-100 bg-red-50">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  <p className="text-xs text-red-700 font-medium">{sectionErrors}</p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <div className="flex gap-1.5">
                {MODAL_SECTIONS.map((_, i) => (
                  <button key={i} type="button" onClick={() => setActiveSection(i)} className={`h-2 rounded-full transition-all ${activeSection === i ? 'bg-blue-600 w-4' : 'w-2 bg-slate-300 hover:bg-slate-400'}`} />
                ))}
              </div>
              <div className="flex gap-2 items-center">
                {activeSection > 0 && (
                  <button type="button" onClick={() => setActiveSection((s) => s - 1)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">← Önceki</button>
                )}
                {activeSection < MODAL_SECTIONS.length - 1 ? (
                  <button type="button" onClick={handleNextSection} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Sonraki →</button>
                ) : (
                  // ── Split Kaydet Butonu ──────────────────────────────────
                  <div ref={saveModeDropdownRef} className="relative flex items-stretch">
                    {/* Ana buton */}
                    <button
                      type="button"
                      onClick={() => handleSave()}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-l-xl hover:bg-blue-700 disabled:opacity-50 font-medium border-r border-blue-500 transition-colors"
                    >
                      {saving && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                      {saving ? 'Kaydediliyor...' : saveMode === 'close' ? 'Kaydet ve Kapat' : saveMode === 'new' ? 'Kaydet ve Yeni Ekle' : 'Kaydet ve Detaya Git'}
                    </button>
                    {/* Dropdown ok */}
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setSaveModeDropdownOpen((o) => !o)}
                      className="flex items-center justify-center px-2.5 bg-blue-600 text-white rounded-r-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
                            className={`w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-blue-50 transition-colors ${saveMode === mode ? 'bg-blue-50' : ''}`}
                          >
                            <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${saveMode === mode ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{saveMode === mode ? '✓' : icon}</span>
                            <div>
                              <p className={`text-xs font-medium ${saveMode === mode ? 'text-blue-700' : 'text-slate-700'}`}>{label}</p>
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
        </div>
      )}

      {/* ── Duplicate Onay Modalı ── */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-xl">⚠</div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-1">Çakışan Bilgi Tespit Edildi</h4>
                <p className="text-xs text-slate-500">Bu Bilgiler Başka Bir Kayıtta Mevcut. Yine de Kaydetmek İstiyor Musunuz?</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4 space-y-1">
              {duplicateConflicts.tc && <p className="text-xs text-amber-700">🪪 {duplicateConflicts.tc}</p>}
              {duplicateConflicts.phone && <p className="text-xs text-amber-700">📞 {duplicateConflicts.phone}</p>}
              {duplicateConflicts.email && <p className="text-xs text-amber-700">✉ {duplicateConflicts.email}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowDuplicateModal(false)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                İptal
              </button>
              <button type="button" onClick={() => doSave()}
                className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium">
                Yine de Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
