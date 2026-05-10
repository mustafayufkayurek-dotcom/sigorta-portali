'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { provinces as STATIC_PROVINCES, districts as STATIC_DISTRICTS } from '@/data/turkey-locations';
import { PhoneInput } from '@/components/PhoneInput';
import { useToast } from '@/contexts/ToastContext';
import { SlidePanel } from '@/components/SlidePanel';
import { LocationPickerModal, LocationPreview, type LatLng } from '@/components/LocationPickerModal';
import { relativeTime, toWhatsAppLink } from '@/utils/date-helpers';
import { toTitleCaseTR } from '@/utils/text-helpers';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null; }
function authHeader() { return { Authorization: `Bearer ${getToken()}` }; }

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
async function nviVerify(payload: { tcNo: string; firstName: string; lastName: string; birthYear: number }, token: string | null) {
  const r = await axios.post(`${API}/tax-verification/verify-identity`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.data.data as { verified: boolean };
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icon = {
  building: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  user: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  phone: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  mail: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  plus: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  x: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  search: (
    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  mapPin: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  tag: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  bank: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
    </svg>
  ),
  briefcase: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  users: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
};

// ── Types ─────────────────────────────────────────────────────────────────────
type Province = { id: string; plateCode: number; name: string };
type District = { id: string; name: string; provinceId: string };
type WorkGroup = { id: string; code: string; name: string; sortOrder: number };
type ServiceArea = { provinceId: string; districtId?: string | null };
type ContactPerson = { id?: string; firstName: string; lastName: string; title: string; phone: string; email: string; birthDate: string };
type ContactInfoItem = { id?: string; type: string; value: string; label: string };

const emptyContact = (): ContactPerson => ({ firstName: '', lastName: '', title: '', phone: '', email: '', birthDate: '' });
const emptyContactInfo = (): ContactInfoItem => ({ type: 'phone', value: '', label: 'general' });
// ── Sözleşme Tarihi mask helpers ─────────────────────────────────────────────
function maskContractDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}
function contractMaskToISO(masked: string): string {
  const digits = masked.replace(/\D/g, '');
  if (digits.length < 8) return '';
  const dd = digits.slice(0, 2), mm = digits.slice(2, 4), yyyy = digits.slice(4, 8);
  return `${yyyy}-${mm}-${dd}`;
}
function isoToDisplayContract(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [yyyy, mm, dd] = iso.split('T')[0].split('-');
  return `${dd}.${mm}.${yyyy}`;
}
function contractDaysLeft(endDate: string | null | undefined): number | null {
  if (!endDate) return null;
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

const emptyForm = () => ({
  entityType: 'corporate' as 'corporate' | 'individual',
  name: '', type: '', taxNumber: '', taxOffice: '', tradeRegistryNo: '',
  identityNo: '', firstName: '', lastName: '', birthDate: '',
  cityCode: '', city: '', district: '', neighborhood: '', streetName: '', buildingNo: '', doorNo: '', address: '',
  iban: '', bankName: '', referral: '', tags: [] as string[], notes: '',
  contractStartDate: '', contractEndDate: '', contractNotes: '',
});

// ── Evrak Türleri ──────────────────────────────────────────────────────────────
const EVRAK_TURLERI_MODAL = [
  'Vergi Levhası', 'İmza Sirküleri', 'Ticaret Sicil Gazetesi', 'Faaliyet Belgesi',
  'Sözleşme', 'Sigorta Poliçesi', 'İş Güvenliği Belgesi', 'Referans Mektubu', 'Diğer',
];

type PendingDoc = { id: string; file: File; type: string; customType: string };
function fmtDocSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function SectionDivider({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 mt-7 first:mt-0 pb-2 border-b border-slate-100">
      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600">{icon}</span>
      <span className="text-sm font-semibold text-slate-700">{title}</span>
    </div>
  );
}

function FormField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}

const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors';
const inpError = 'w-full border border-red-400 ring-2 ring-red-500/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 transition-colors bg-red-50';

// ── Filter Chip ─────────────────────────────────────────────────────────────
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2.5 py-1 font-medium">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 text-indigo-400 hover:text-indigo-700 transition-colors rounded-full w-3.5 h-3.5 flex items-center justify-center hover:bg-indigo-100"
        aria-label="Filtreyi kaldır"
      >
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

// ── VendorDrawer ──────────────────────────────────────────────────────────────
const VENDOR_STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-50 text-green-700 border-green-100',
  passive: 'bg-slate-100 text-slate-500 border-slate-200',
};

interface VendorDrawerProps {
  vendorId: string | null;
  open: boolean;
  onClose: () => void;
  onEdit: (vendor: any) => void;
}

function VendorDrawer({ vendorId, open, onClose, onEdit }: VendorDrawerProps) {
  const router = useRouter();
  const [vendor, setVendor] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!open || !vendorId) return;
    setVendor(null);
    setLoadingDetail(true);
    axios
      .get(`${API}/vendors/${vendorId}`, { headers: authHeader() })
      .then((r) => setVendor(r.data.data ?? r.data))
      .catch(() => setVendor(null))
      .finally(() => setLoadingDetail(false));
  }, [vendorId, open]);

  const displayName = vendor?.name ?? '—';

  const typeBadge = vendor?.entityType === 'individual' ? (
    <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border bg-purple-50 text-purple-700 border-purple-100">
      {Icon.user} <span className="ml-1">Bireysel</span>
    </span>
  ) : (
    <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-100">
      {Icon.building} <span className="ml-1">Kurumsal</span>
    </span>
  );

  const statusCls = VENDOR_STATUS_COLOR[vendor?.status ?? ''] ?? 'bg-slate-100 text-slate-500 border-slate-200';
  const statusLabel = vendor?.status === 'active' ? 'Aktif' : vendor?.status === 'passive' ? 'Pasif' : (vendor?.status ?? '—');

  // Collect service area province names from full vendor detail
  const serviceAreas: any[] = vendor?.serviceAreas ?? [];
  const workGroups: any[] = vendor?.vendorWorkGroups ?? [];

  return (
    <SlidePanel open={open} onClose={onClose} width={400}>
      {/* Custom header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-indigo-700 flex-shrink-0">
        <div>
          <p className="text-xs text-indigo-200 font-medium uppercase tracking-wide">Tedarikçi Özeti</p>
          <h3 className="text-sm font-semibold text-white mt-0.5 truncate max-w-[280px]">{displayName}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          aria-label="Kapat"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {loadingDetail ? (
        <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Yükleniyor...</div>
      ) : !vendor ? (
        <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Veri alınamadı</div>
      ) : (
        <div className="pb-24">
          {/* Kimlik */}
          <div className="px-5 pt-5 pb-4 border-b border-slate-50">
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-base font-bold flex-shrink-0 ${vendor.entityType === 'individual' ? 'bg-purple-500' : 'bg-indigo-600'}`}>
                {(displayName || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 leading-tight truncate">{displayName}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {typeBadge}
                  <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${statusCls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1 ${vendor.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`} />
                    {statusLabel}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2.5">
              {vendor.phone && (
                <div className="flex items-center gap-2">
                  <a href={`tel:${vendor.phone}`} className="flex items-center gap-2.5 text-sm text-indigo-600 hover:text-indigo-700 transition-colors group flex-1">
                    <span className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center group-hover:bg-indigo-100 transition-colors flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </span>
                    {vendor.phone}
                  </a>
                  {toWhatsAppLink(vendor.phone) && (
                  <a
                    href={toWhatsAppLink(vendor.phone)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-7 h-7 bg-green-50 hover:bg-green-100 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                    title="WhatsApp"
                  >
                    <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </a>
                  )}
                </div>
              )}
              {vendor.email && (
                <div className="flex items-center gap-2.5 text-sm text-slate-600">
                  <span className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <span className="truncate">{vendor.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Faaliyet Alanları (İş Grupları) */}
          {workGroups.length > 0 && (
            <div className="px-5 pt-4 pb-4 border-b border-slate-50">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 flex-shrink-0">{Icon.briefcase}</span>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Faaliyet Alanları</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {workGroups.map((vwg: any) => (
                  <span key={vwg.workGroupId ?? vwg.id} className="inline-flex items-center text-xs bg-indigo-50 text-indigo-700 rounded-full px-2.5 py-1 border border-indigo-100">
                    {vwg.workGroup?.name ?? vwg.name ?? vwg.workGroupId}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Hizmet Bölgeleri */}
          {serviceAreas.length > 0 && (
            <div className="px-5 pt-4 pb-4 border-b border-slate-50">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">{Icon.mapPin}</span>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Hizmet Bölgeleri</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {serviceAreas.map((sa: any, i: number) => {
                  const label = sa.districtId
                    ? `${sa.province?.name ?? sa.provinceId} / ${sa.district?.name ?? sa.districtId}`
                    : `${sa.province?.name ?? sa.provinceId} (Tümü)`;
                  return (
                    <span key={i} className="inline-flex items-center text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 border border-blue-100">
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Banka Bilgileri */}
          {(vendor.iban || vendor.bankName) && (
            <div className="px-5 pt-4 pb-4 border-b border-slate-50">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 bg-slate-50 rounded-lg flex items-center justify-center text-slate-500 flex-shrink-0">{Icon.bank}</span>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Banka Bilgileri</p>
              </div>
              <div className="space-y-2">
                {vendor.bankName && (
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Banka</p>
                    <p className="text-sm text-slate-700 font-medium">{vendor.bankName}</p>
                  </div>
                )}
                {vendor.iban && (
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">IBAN</p>
                    <p className="text-sm text-slate-700 font-mono">{vendor.iban}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Referans */}
          {vendor.referral && (
            <div className="px-5 pt-4 pb-4 border-b border-slate-50">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 flex-shrink-0">{Icon.users}</span>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Referans</p>
              </div>
              <p className="text-sm text-slate-700">{vendor.referral}</p>
            </div>
          )}

          {/* Tags */}
          {vendor.tags && vendor.tags.length > 0 && (
            <div className="px-5 pt-4 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 flex-shrink-0">{Icon.tag}</span>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Etiketler</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {vendor.tags.map((t: string) => (
                  <span key={t} className="inline-flex items-center text-xs bg-amber-50 text-amber-700 rounded-full px-2.5 py-1 border border-amber-100">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alt Butonlar */}
      <div className="absolute bottom-0 left-0 right-0 flex gap-2 px-5 py-4 border-t border-slate-100 bg-white">
        <button
          type="button"
          onClick={() => { onClose(); router.push(`/panel/tedarikciler/${vendorId}`); }}
          className="flex-1 bg-indigo-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Detaya Git
        </button>
        <button
          type="button"
          onClick={() => { onEdit(vendor); }}
          disabled={!vendor}
          className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Düzenle
        </button>
      </div>
    </SlidePanel>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VendorsPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  // ── Filter state ─────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') ?? '');
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get('type') ?? '');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') ?? '');
  const [entityTypeFilter, setEntityTypeFilter] = useState(() => searchParams.get('entityType') ?? '');
  const [selectedWorkGroupIds_filter, setSelectedWorkGroupIds_filter] = useState<string[]>(() => {
    const wg = searchParams.get('workGroups');
    return wg ? wg.split(',').filter(Boolean) : [];
  });
  const [serviceRegionFilter, setServiceRegionFilter] = useState(() => searchParams.get('serviceRegion') ?? '');
  const [wgFilterOpen, setWgFilterOpen] = useState(false);
  const wgFilterRef = useRef<HTMLDivElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [editVendor, setEditVendor] = useState<any>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [gibLoading, setGibLoading] = useState(false);
  const [gibError, setGibError] = useState<string | null>(null);
  const [nviLoading, setNviLoading] = useState(false);
  const [nviResult, setNviResult] = useState<boolean | null>(null);

  const [phoneWarn, setPhoneWarn] = useState<string | null>(null);
  const [emailWarn, setEmailWarn] = useState<string | null>(null);
  const [duplicateConflicts, setDuplicateConflicts] = useState<{ phone?: string; email?: string }>({});
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const [vendorTypes, setVendorTypes] = useState<string[]>([]);
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [savingType, setSavingType] = useState(false);
  const [relationshipTypes, setRelationshipTypes] = useState<string[]>([]);
  const [addingNewRelType, setAddingNewRelType] = useState(false);
  const [newRelTypeValue, setNewRelTypeValue] = useState('');
  const [savingRelType, setSavingRelType] = useState(false);

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
  const [serviceDistricts, setServiceDistricts] = useState<District[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);

  const [workGroups, setWorkGroups] = useState<WorkGroup[]>([]);
  const [selectedWorkGroupIds, setSelectedWorkGroupIds] = useState<string[]>([]);
  const [wgOpen, setWgOpen] = useState(false);
  const [wgSearch, setWgSearch] = useState('');
  const wgRef = useRef<HTMLDivElement>(null);

  const [contacts, setContacts] = useState<ContactPerson[]>([emptyContact()]);
  const [contactInfos, setContactInfos] = useState<ContactInfoItem[]>([emptyContactInfo()]);
  const [tagInput, setTagInput] = useState('');
  const [activeSection, setActiveSection] = useState(0);
  const [numericErrors, setNumericErrors] = useState<{ taxNumber?: string; identityNo?: string }>({});
  const [contactsOpen, setContactsOpen] = useState(false);

  // ── Bekleyen evraklar (yeni kayıt formunda geçici) ────────────────────────
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [docSelectedType, setDocSelectedType] = useState('');
  const [docCustomType, setDocCustomType] = useState('');
  const docFileInputRef = useRef<HTMLInputElement>(null);

  // ── Konum state ───────────────────────────────────────────────────────────
  const [locationCoords, setLocationCoords] = useState<LatLng | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState<string | null>(null);

  const handleGeocodeAddress = useCallback(async (
    city: string, district: string, neighborhood: string, streetName: string, buildingNo: string,
  ) => {
    const parts = [neighborhood, streetName, buildingNo ? `No: ${buildingNo}` : '', district, city].filter(Boolean);
    if (!parts.length) return;
    setGeocoding(true); setGeocodeMsg(null);
    try {
      const q = encodeURIComponent(parts.join(', ') + ', Türkiye');
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1&countrycodes=tr`, {
        headers: { 'Accept-Language': 'tr', 'User-Agent': 'sigorta-hasar-sistemi/1.0' },
      });
      const data = await res.json();
      if (data.length > 0) {
        const { lat, lon, display_name } = data[0];
        setLocationCoords({ lat: parseFloat(lat), lng: parseFloat(lon) });
        setGeocodeMsg(`Konum bulundu: ${display_name}`);
      } else {
        setGeocodeMsg('Konum bulunamadı. Lütfen adresi kontrol edin veya haritadan seçin.');
      }
    } catch {
      setGeocodeMsg('Geocoding hatası. İnternet bağlantınızı kontrol edin.');
    } finally { setGeocoding(false); }
  }, []);

  const nameRef = useRef<HTMLInputElement>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Drawer state ─────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVendorId, setDrawerVendorId] = useState<string | null>(null);

  // ── Sözleşme uyarı state ──────────────────────────────────────────────────
  const [contractAlert, setContractAlert] = useState<{ expiring: any[]; expired: any[]; expiringCount: number; expiredCount: number } | null>(null);

  // ── Toplu seçim state ─────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Toplu işlem confirm modal state ──────────────────────────────────────
  type BulkStatusValue = 'active' | 'passive';
  const STATUS_LABELS: Record<BulkStatusValue, string> = { active: 'Aktif', passive: 'Pasif' };

  const [bulkConfirm, setBulkConfirm] = useState<{
    label: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const isAllSelected = vendors.length > 0 && vendors.every((v) => selectedIds.has(v.id));
  const isIndeterminate = vendors.some((v) => selectedIds.has(v.id)) && !isAllSelected;
  const selectedArray = Array.from(selectedIds);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => { const next = new Set(prev); vendors.forEach((v) => next.delete(v.id)); return next; });
    } else {
      setSelectedIds((prev) => { const next = new Set(prev); vendors.forEach((v) => next.add(v.id)); return next; });
    }
  };
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkStatus = (status: BulkStatusValue) => {
    const label = STATUS_LABELS[status];
    setBulkConfirm({
      label: `${selectedArray.length} tedarikçi "${label}" olarak işaretlenecek`,
      onConfirm: async () => {
        await axios.patch(`${API}/vendors/bulk-status`, { ids: selectedArray, status }, { headers: authHeader() });
        showToast('success', `${selectedArray.length} tedarikçi güncellendi`);
        clearSelection(); load();
      },
    });
  };

  const handleExport = () => {
    setBulkConfirm({
      label: `${selectedArray.length} tedarikçi Excel dosyasına aktarılacak`,
      onConfirm: async () => {
        const r = await axios.post(`${API}/vendors/export`, { ids: selectedArray }, { headers: authHeader(), responseType: 'blob' });
        const url = URL.createObjectURL(new Blob([r.data]));
        const a = document.createElement('a');
        a.href = url; a.download = `tedarikciler-${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click(); URL.revokeObjectURL(url);
        showToast('success', 'Excel dosyası indiriliyor'); clearSelection();
      },
    });
  };

  const runBulkConfirm = async () => {
    if (!bulkConfirm) return;
    setBulkLoading(true);
    try { await bulkConfirm.onConfirm(); }
    catch (e: any) { showToast('error', `İşlem başarısız: ${e?.response?.data?.message ?? e?.message ?? 'Bilinmeyen hata'}`); }
    finally { setBulkLoading(false); setBulkConfirm(null); }
  };

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

  const resetForm = () => {
    setForm(emptyForm()); setServiceAreas([]); setSelectedWorkGroupIds([]);
    setSelectedProvince(null); setServiceDistricts([]);
    setWgOpen(false); setWgSearch(''); setGibError(null); setNviResult(null);
    setPhoneWarn(null); setEmailWarn(null);
    setDuplicateConflicts({}); setShowDuplicateModal(false);
    setContacts([emptyContact()]); setContactInfos([emptyContactInfo()]);
    setTagInput(''); setActiveSection(0); setNumericErrors({}); setFieldErrors({}); setContactsOpen(false);
    setLocationCoords(null); setShowLocationPicker(false); setGeocodeMsg(null);
    setPendingDocs([]); setDocSelectedType(''); setDocCustomType('');
  };

  const onlyDigits = /^[0-9]*$/;
  const handleNumericChange = (field: 'taxNumber' | 'identityNo', value: string) => {
    if (!onlyDigits.test(value)) {
      setNumericErrors((p) => ({ ...p, [field]: 'Sadece rakam giriniz' }));
      return;
    }
    setNumericErrors((p) => { const n = { ...p }; delete n[field]; return n; });
    if (field === 'taxNumber') { setForm((p) => ({ ...p, taxNumber: value })); setGibError(null); }
    else { setForm((p) => ({ ...p, identityNo: value })); setNviResult(null); }
  };

  const loadVendorTypes = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/system-settings/vendor-types`, { headers: authHeader() });
      setVendorTypes(r.data.data || []);
    } catch { setVendorTypes(['Taşeron', 'Malzeme Tedarikçisi', 'Lojistik', 'Ekipman', 'Diğer']); }
  }, []);

  const loadProvinces = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/locations/provinces`, { headers: authHeader() });
      setProvinces(r.data.data || []);
    } catch (e) { console.error(e); }
  }, []);

  const loadWorkGroups = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/work-groups?limit=100`, { headers: authHeader() });
      setWorkGroups(r.data.data || []);
    } catch (e) { console.error(e); }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), page: String(page) });
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (entityTypeFilter) params.set('entityType', entityTypeFilter);
      if (serviceRegionFilter) params.set('serviceRegion', serviceRegionFilter);
      selectedWorkGroupIds_filter.forEach((id) => params.append('workGroupId', id));
      const r = await axios.get(`${API}/vendors?${params}`, { headers: authHeader() });
      setVendors(r.data.data || []);
      setTotal(r.data.meta?.total ?? 0);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [search, typeFilter, statusFilter, entityTypeFilter, serviceRegionFilter, selectedWorkGroupIds_filter, page]); // eslint-disable-line

  // Debounce searchInput → search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line

  // URL sync
  useEffect(() => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (typeFilter) p.set('type', typeFilter);
    if (statusFilter) p.set('status', statusFilter);
    if (entityTypeFilter) p.set('entityType', entityTypeFilter);
    if (serviceRegionFilter) p.set('serviceRegion', serviceRegionFilter);
    if (selectedWorkGroupIds_filter.length) p.set('workGroups', selectedWorkGroupIds_filter.join(','));
    if (page > 1) p.set('page', String(page));
    const qs = p.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }, [search, typeFilter, statusFilter, entityTypeFilter, serviceRegionFilter, selectedWorkGroupIds_filter, page]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadProvinces(); loadWorkGroups(); loadVendorTypes(); }, [loadProvinces, loadWorkGroups, loadVendorTypes]);

  useEffect(() => {
    axios.get(`${API}/system-settings/relationship-types`, { headers: authHeader() })
      .then((r) => {
        const data = r.data.data ?? [];
        if (data.length > 0 && typeof data[0] === 'string') {
          setRelationshipTypes(data as string[]);
        } else {
          setRelationshipTypes(
            (data as { label: string; active: boolean }[])
              .filter((t) => t.active)
              .map((t) => t.label)
          );
        }
      })
      .catch(() => { /* empty fallback */ });
  }, []);
  useEffect(() => {
    axios.get(`${API}/vendors/contract-expiring?days=30`, { headers: authHeader() })
      .then((r) => setContractAlert(r.data.data ?? null))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wgRef.current && !wgRef.current.contains(e.target as Node)) { setWgOpen(false); setWgSearch(''); }
      if (wgFilterRef.current && !wgFilterRef.current.contains(e.target as Node)) setWgFilterOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleGibQuery = async () => {
    if (!form.taxNumber) return;
    setGibLoading(true); setGibError(null);
    try {
      const r = await turmobQuery(form.taxNumber, getToken());
      if (r.found) {
        setForm((p) => ({ ...p, name: r.title || p.name }));
      } else { setGibError('TÜRMOB sorgulaması başarısız — ünvanı manuel girebilirsiniz.'); }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? '';
      if (msg.includes('yapılandırılmamış') || err?.response?.status === 503) {
        setGibError('TÜRMOB entegrasyonu henüz yapılandırılmamış. Ayarlar > Sistem > Entegrasyonlar sayfasından yapılandırın.');
      } else {
        setGibError('TÜRMOB sorgulaması başarısız — ünvanı manuel girebilirsiniz.');
      }
    } finally { setGibLoading(false); }
  };

  const handleNviVerify = async () => {
    if (!form.identityNo || !form.firstName || !form.lastName || !form.birthDate) return;
    const birthYear = new Date(form.birthDate).getFullYear();
    setNviLoading(true); setNviResult(null);
    try {
      const r = await nviVerify({ tcNo: form.identityNo, firstName: form.firstName, lastName: form.lastName, birthYear }, getToken());
      setNviResult(r.verified);
    } catch { setNviResult(false); } finally { setNviLoading(false); }
  };

  const handlePhoneDuplicateCheck = async (phone: string) => {
    if (!phone || phone.length < 10) return;
    const excludeId = editVendor?.id;
    try {
      const params = new URLSearchParams({ phone });
      if (excludeId) params.set('excludeId', excludeId);
      const r = await axios.get(`${API}/vendors/check-duplicate?${params}`, { headers: authHeader() });
      const d = r.data.data;
      if (d.exists) {
        const msg = `Bu telefon numarası zaten [${d.existingRecord.name}] kaydında mevcut`;
        setPhoneWarn(msg);
        setDuplicateConflicts((p) => ({ ...p, phone: msg }));
        showToast('warning', msg);
      } else {
        setPhoneWarn(null);
        setDuplicateConflicts((p) => { const n = { ...p }; delete n.phone; return n; });
      }
    } catch { /* sessizce geç */ }
  };

  const handleEmailDuplicateCheck = async (email: string) => {
    if (!email) return;
    const excludeId = editVendor?.id;
    try {
      const params = new URLSearchParams({ email });
      if (excludeId) params.set('excludeId', excludeId);
      const r = await axios.get(`${API}/vendors/check-duplicate?${params}`, { headers: authHeader() });
      const d = r.data.data;
      if (d.exists) {
        const msg = `Bu e-posta adresi zaten [${d.existingRecord.name}] kaydında mevcut`;
        setEmailWarn(msg);
        setDuplicateConflicts((p) => ({ ...p, email: msg }));
        showToast('warning', msg);
      } else {
        setEmailWarn(null);
        setDuplicateConflicts((p) => { const n = { ...p }; delete n.email; return n; });
      }
    } catch { /* sessizce geç */ }
  };

  const loadServiceDistricts = async (provinceId: string) => {
    try {
      const r = await axios.get(`${API}/locations/provinces/${provinceId}/districts`, { headers: authHeader() });
      setServiceDistricts(r.data.data || []);
    } catch (e) { console.error(e); }
  };

  const toggleServiceArea = (provinceId: string, districtId?: string | null) => {
    const key = districtId ? `${provinceId}:${districtId}` : `${provinceId}:`;
    const exists = serviceAreas.some((sa) => (sa.districtId ? `${sa.provinceId}:${sa.districtId}` : `${sa.provinceId}:`) === key);
    if (exists) setServiceAreas((p) => p.filter((sa) => (sa.districtId ? `${sa.provinceId}:${sa.districtId}` : `${sa.provinceId}:`) !== key));
    else setServiceAreas((p) => [...p, { provinceId, districtId: districtId ?? null }]);
  };

  const addWholeProvince = (prov: Province) => {
    setServiceAreas((p) => [...p.filter((sa) => sa.provinceId !== prov.id), { provinceId: prov.id, districtId: null }]);
  };

  const toggleWg = (id: string) => setSelectedWorkGroupIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const handleAddVendorType = async () => {
    const t = newTypeName.trim();
    if (!t || vendorTypes.includes(t)) return;
    setSavingType(true);
    try {
      const updated = [...vendorTypes, t];
      await axios.put(`${API}/system-settings/vendor-types`, { types: updated }, { headers: authHeader() });
      setVendorTypes(updated); setNewTypeName(''); setShowAddType(false);
    } catch (e) { console.error(e); } finally { setSavingType(false); }
  };

  const openCreate = () => { setEditVendor(null); resetForm(); setShowModal(true); };
  const openEdit = async (v: any) => {
    setEditVendor(v);
    // Find cityCode from city name for static data
    const matchedProv = STATIC_PROVINCES.find((p) => p.name === v.city);
    setForm({
      entityType: (v.entityType as 'corporate' | 'individual') || 'corporate',
      name: v.name, type: v.type ?? '', taxNumber: v.taxNumber ?? '',
      taxOffice: v.taxOffice ?? '', tradeRegistryNo: v.tradeRegistryNo ?? '',
      identityNo: v.identityNo ?? '', firstName: v.firstName ?? '', lastName: v.lastName ?? '', birthDate: '',
      cityCode: matchedProv?.code ?? '', city: v.city ?? '', district: v.district ?? '',
      neighborhood: v.neighborhood ?? '', streetName: v.streetName ?? '',
      buildingNo: v.buildingNo ?? '', doorNo: v.doorNo ?? '',
      address: v.address ?? '', iban: v.iban ?? '', bankName: v.bankName ?? '',
      referral: v.referral ?? '', tags: Array.isArray(v.tags) ? v.tags : [], notes: v.notes ?? '',
      contractStartDate: v.contractStartDate ? v.contractStartDate.split('T')[0] : '',
      contractEndDate: v.contractEndDate ? v.contractEndDate.split('T')[0] : '',
      contractNotes: v.contractNotes ?? '',
    });
    setGibError(null); setNviResult(null);
    // Konum koordinatlarını yükle
    if (v.latitude != null && v.longitude != null) {
      setLocationCoords({ lat: v.latitude, lng: v.longitude });
    } else {
      setLocationCoords(null);
    }
    try {
      const r = await axios.get(`${API}/vendors/${v.id}`, { headers: authHeader() });
      const full = r.data.data;
      setServiceAreas((full.serviceAreas || []).map((sa: any) => ({ provinceId: sa.provinceId, districtId: sa.districtId ?? null })));
      setSelectedWorkGroupIds((full.vendorWorkGroups || []).map((vwg: any) => vwg.workGroupId));
      setContacts(full.contacts?.length ? full.contacts.map((c: any) => ({ id: c.id, firstName: c.firstName ?? '', lastName: c.lastName ?? '', title: c.title ?? '', phone: c.phone ?? '', email: c.email ?? '', birthDate: c.birthDate ? c.birthDate.split('T')[0] : '' })) : [emptyContact()]);
      setContactInfos(full.contactInfos?.length ? full.contactInfos.map((ci: any) => ({ id: ci.id, type: ci.type ?? 'phone', value: ci.value ?? '', label: ci.label ?? 'general' })) : [emptyContactInfo()]);
    } catch { setContacts([emptyContact()]); setContactInfos([emptyContactInfo()]); }
    setSelectedProvince(null); setServiceDistricts([]); setActiveSection(0); setShowModal(true);
  };

  const handleSave = async () => {
    // Validasyon
    const errors: Record<string, string> = {};
    const missingLabels: string[] = [];

    if (form.entityType === 'corporate') {
      if (!form.name.trim()) {
        errors.name = 'Bu alan zorunludur';
        missingLabels.push('Şirket Adı');
      }
    } else {
      if (!form.firstName.trim()) {
        errors.firstName = 'Bu alan zorunludur';
        missingLabels.push('Ad');
      }
      if (!form.lastName.trim()) {
        errors.lastName = 'Bu alan zorunludur';
        missingLabels.push('Soyad');
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      showToast('warning', `Lütfen zorunlu alanları doldurun: ${missingLabels.join(', ')}`);
      setActiveSection(0);
      setTimeout(() => { nameRef.current?.focus(); }, 100);
      return;
    }

    // Çakışma varsa onay modalı göster
    if (Object.keys(duplicateConflicts).length > 0) {
      setShowDuplicateModal(true);
      return;
    }

    await doSave();
  };

  const doSave = async () => {
    setShowDuplicateModal(false);
    setFieldErrors({});
    setSaving(true);
    try {
      const payload: any = {
        entityType: form.entityType, name: form.name, type: form.type || undefined,
        address: form.address || null, city: form.city || null, district: form.district || null,
        neighborhood: form.neighborhood || null, streetName: form.streetName || null,
        buildingNo: form.buildingNo || null, doorNo: form.doorNo || null,
        latitude: locationCoords?.lat ?? null, longitude: locationCoords?.lng ?? null,
        iban: form.iban || null, bankName: form.bankName || null,
        referral: form.referral || null, tags: form.tags, notes: form.notes || null,
        contractStartDate: form.contractStartDate ? new Date(form.contractStartDate).toISOString() : null,
        contractEndDate: form.contractEndDate ? new Date(form.contractEndDate).toISOString() : null,
        contractNotes: form.contractNotes || null,
        serviceAreas, workGroupIds: selectedWorkGroupIds,
        contacts: contacts.filter((c) => c.firstName.trim() || c.lastName.trim()).map((c) => ({ ...c, title: c.title === '__other__' ? '' : c.title })),
        contactInfos: contactInfos.filter((ci) => ci.value.trim()),
      };
      if (form.entityType === 'corporate') {
        payload.taxNumber = form.taxNumber || null;
        payload.taxOffice = form.taxOffice || null;
        payload.tradeRegistryNo = form.tradeRegistryNo || null;
      } else {
        payload.firstName = form.firstName || null;
        payload.lastName = form.lastName || null;
        payload.name = `${form.firstName} ${form.lastName}`.trim() || form.name;
        payload.identityNo = form.identityNo || null;
      }
      if (editVendor) {
        await axios.patch(`${API}/vendors/${editVendor.id}`, payload, { headers: authHeader() });
        // Upload pending docs for existing vendor
        if (pendingDocs.length > 0) {
          await Promise.allSettled(pendingDocs.map(async (pd) => {
            const effectiveType = pd.type === 'Diğer' ? pd.customType.trim() : pd.type;
            if (!effectiveType) return;
            const fd = new FormData();
            fd.append('file', pd.file);
            fd.append('documentTypeName', effectiveType);
            await axios.post(`${API}/vendors/${editVendor.id}/documents`, fd, {
              headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
            });
          }));
        }
      } else {
        const res = await axios.post(`${API}/vendors`, payload, { headers: authHeader() });
        const newVendorId = res.data.data?.id;
        // Upload pending docs for newly created vendor
        if (newVendorId && pendingDocs.length > 0) {
          await Promise.allSettled(pendingDocs.map(async (pd) => {
            const effectiveType = pd.type === 'Diğer' ? pd.customType.trim() : pd.type;
            if (!effectiveType) return;
            const fd = new FormData();
            fd.append('file', pd.file);
            fd.append('documentTypeName', effectiveType);
            await axios.post(`${API}/vendors/${newVendorId}/documents`, fd, {
              headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
            });
          }));
        }
      }
      setShowModal(false); resetForm(); load();
      showToast('success', editVendor ? 'Tedarikçi başarıyla güncellendi' : 'Tedarikçi başarıyla eklendi');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Bilinmeyen bir hata oluştu';
      showToast('error', `İşlem başarısız: ${msg}`);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" tedarikçisini silmek istediğinize emin misiniz?`)) return;
    try { await axios.delete(`${API}/vendors/${id}`, { headers: authHeader() }); load(); } catch (e) { console.error(e); }
  };

  const handleToggleStatus = async (v: any) => {
    try { await axios.patch(`${API}/vendors/${v.id}`, { status: v.status === 'active' ? 'passive' : 'active' }, { headers: authHeader() }); load(); } catch (e) { console.error(e); }
  };

  const upC = (i: number, f: keyof ContactPerson, v: string) => setContacts((p) => p.map((c, j) => j === i ? { ...c, [f]: v } : c));
  const upCI = (i: number, f: keyof ContactInfoItem, v: string) => setContactInfos((p) => p.map((ci, j) => j === i ? { ...ci, [f]: v } : ci));
  const addTag = () => { const t = tagInput.trim(); if (t && !form.tags.includes(t)) setForm((p) => ({ ...p, tags: [...p.tags, t] })); setTagInput(''); };

  const selectedWgNames = workGroups.filter((wg) => selectedWorkGroupIds.includes(wg.id));
  const selectedWgFilterNames = workGroups.filter((wg) => selectedWorkGroupIds_filter.includes(wg.id));

  const hasActiveFilters = !!(search || typeFilter || statusFilter || entityTypeFilter || serviceRegionFilter || selectedWorkGroupIds_filter.length);

  const clearAllFilters = () => {
    setSearchInput(''); setSearch('');
    setTypeFilter(''); setStatusFilter('');
    setEntityTypeFilter(''); setServiceRegionFilter('');
    setSelectedWorkGroupIds_filter([]);
    setPage(1);
  };

  const toggleWgFilter = (id: string) => {
    setSelectedWorkGroupIds_filter((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    setPage(1);
  };

  const entityTypeLabel: Record<string, string> = { individual: 'Bireysel', corporate: 'Kurumsal' };
  const statusLabel: Record<string, string> = { active: 'Aktif', passive: 'Pasif' };

  // Modal sections
  const MODAL_SECTIONS = ['Temel Bilgiler', 'Yetkili Kişiler', 'İletişim', 'Konum & Hizmet', 'CRM & Banka', 'Evraklar'];

  const activeVendors = vendors.filter((v) => v.status === 'active').length;
  const corporateCount = vendors.filter((v) => v.entityType === 'corporate').length;

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="page-header !mb-0">
        <div className="flex items-center gap-3">
          <div className="page-header-icon">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h2 className="page-title">Tedarikçiler</h2>
            <p className="page-subtitle">Tedarikçi ve Alt Yüklenici Yönetimi</p>
          </div>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary">
          {Icon.plus} Yeni Tedarikçi
        </button>
      </div>

      {/* ── Sözleşme Uyarı Banner ── */}
      {contractAlert && (contractAlert.expiredCount > 0 || contractAlert.expiringCount > 0) && (
        <div className="space-y-2">
          {contractAlert.expiredCount > 0 && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-700">{contractAlert.expiredCount} tedarikçinin sözleşmesi sona erdi</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {contractAlert.expired.slice(0, 5).map((v: any) => (
                    <span key={v.id} className="text-xs text-red-600 bg-red-100 rounded-full px-2 py-0.5 border border-red-200">
                      {v.name} ({isoToDisplayContract(v.contractEndDate)})
                    </span>
                  ))}
                  {contractAlert.expiredCount > 5 && (
                    <span className="text-xs text-red-500">+{contractAlert.expiredCount - 5} daha...</span>
                  )}
                </div>
              </div>
            </div>
          )}
          {contractAlert.expiringCount > 0 && (
            <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
              <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-orange-700">{contractAlert.expiringCount} tedarikçinin sözleşmesi 30 gün içinde bitiyor</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {contractAlert.expiring.slice(0, 5).map((v: any) => {
                    const days = contractDaysLeft(v.contractEndDate);
                    return (
                      <span key={v.id} className="text-xs text-orange-600 bg-orange-100 rounded-full px-2 py-0.5 border border-orange-200">
                        {v.name} ({days !== null ? `${days} gün` : isoToDisplayContract(v.contractEndDate)})
                      </span>
                    );
                  })}
                  {contractAlert.expiringCount > 5 && (
                    <span className="text-xs text-orange-500">+{contractAlert.expiringCount - 5} daha...</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Stats ── */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-slate-200/70 shadow-card px-5 py-3">
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide leading-none">Toplam</p>
            <p className="text-lg font-bold text-slate-800 leading-tight tabular-nums">{vendors.length}</p>
          </div>
        </div>
        <div className="w-px h-8 bg-slate-100" />
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide leading-none">Aktif</p>
            <p className="text-lg font-bold text-emerald-700 leading-tight tabular-nums">{activeVendors}</p>
          </div>
        </div>
        <div className="w-px h-8 bg-slate-100" />
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide leading-none">Kurumsal</p>
            <p className="text-lg font-bold text-indigo-700 leading-tight tabular-nums">{corporateCount}</p>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="filter-bar">
        {/* Arama — üst satır, tam genişlik */}
        <div className="relative mb-2.5">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">{Icon.search}</span>
          <input
            placeholder="İsim, Telefon, Vergi No Ara..."
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 items-center">
          {/* Tip */}
          <select className="input-base-sm w-full" value={entityTypeFilter} onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1); }}>
            <option value="">Tüm Tipler</option>
            <option value="individual">Bireysel</option>
            <option value="corporate">Kurumsal</option>
          </select>

          {/* Durum */}
          <select className="input-base-sm w-full" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
          </select>

          {/* Tür (vendor type) */}
          {vendorTypes.length > 0 && (
            <select className="input-base-sm w-full" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">Tüm Türler</option>
              {vendorTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}

          {/* Faaliyet Alanı (work groups) - multi-select */}
          {workGroups.length > 0 && (
            <div className="relative" ref={wgFilterRef}>
              <button
                type="button"
                onClick={() => setWgFilterOpen((o) => !o)}
                className={`flex items-center gap-1.5 input-base-sm w-full ${
                  selectedWorkGroupIds_filter.length ? 'border-blue-400 bg-blue-50 text-blue-700' : ''
                }`}
              >
                {Icon.briefcase}
                <span className="truncate">Faaliyet{selectedWorkGroupIds_filter.length > 0 && ` (${selectedWorkGroupIds_filter.length})`}</span>
                <svg className={`w-3.5 h-3.5 transition-transform ml-auto flex-shrink-0 ${wgFilterOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {wgFilterOpen && (
                <div className="absolute left-0 top-full mt-1.5 z-20 bg-white border border-slate-100 rounded-xl shadow-card min-w-[200px] py-1.5 max-h-56 overflow-y-auto">
                  {workGroups.map((wg) => (
                    <button key={wg.id} type="button" onClick={() => toggleWgFilter(wg.id)}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 transition-colors ${selectedWorkGroupIds_filter.includes(wg.id) ? 'text-blue-700 font-medium' : 'text-slate-700'}`}
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${selectedWorkGroupIds_filter.includes(wg.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                        {selectedWorkGroupIds_filter.includes(wg.id) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      {wg.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Hizmet Bölgesi */}
          <select className="input-base-sm w-full" value={serviceRegionFilter} onChange={(e) => { setServiceRegionFilter(e.target.value); setPage(1); }}>
            <option value="">Tüm Bölgeler</option>
            {STATIC_PROVINCES.map((p) => (
              <option key={p.code} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Aktif filtre chip'leri */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-400 mr-0.5">Aktif filtreler:</span>
            {search && <FilterChip label={`Arama: "${search}"`} onRemove={() => setSearchInput('')} />}
            {entityTypeFilter && <FilterChip label={`Tip: ${entityTypeLabel[entityTypeFilter] ?? entityTypeFilter}`} onRemove={() => { setEntityTypeFilter(''); setPage(1); }} />}
            {statusFilter && <FilterChip label={`Durum: ${statusLabel[statusFilter] ?? statusFilter}`} onRemove={() => { setStatusFilter(''); setPage(1); }} />}
            {typeFilter && <FilterChip label={`Tür: ${typeFilter}`} onRemove={() => { setTypeFilter(''); setPage(1); }} />}
            {serviceRegionFilter && <FilterChip label={`Bölge: ${serviceRegionFilter}`} onRemove={() => { setServiceRegionFilter(''); setPage(1); }} />}
            {selectedWgFilterNames.map((wg) => (
              <FilterChip key={wg.id} label={`Faaliyet: ${wg.name}`} onRemove={() => toggleWgFilter(wg.id)} />
            ))}
            <button type="button" onClick={clearAllFilters}
              className="text-xs text-red-500 hover:text-red-700 font-medium ml-1 hover:underline transition-colors">
              Tüm Filtreleri Temizle
            </button>
          </div>
        )}
      </div>

      {/* ── Toplu İşlem Toolbar ── */}
      {selectedIds.size > 0 && (
        <div className="sticky top-4 z-30 mb-4">
          <div className="bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 px-5 py-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 mr-2">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">{selectedIds.size}</div>
              <span className="text-sm font-medium">{selectedIds.size} tedarikçi seçildi</span>
            </div>
            <div className="h-5 w-px bg-white/30" />
            <div className="relative group">
              <button type="button" className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors font-medium">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Durum Değiştir
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className="absolute left-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 min-w-36 hidden group-hover:block z-50">
                {(['active', 'passive'] as const).map((val) => (
                  <button key={val} type="button" onClick={() => handleBulkStatus(val)}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${val === 'active' ? 'bg-green-500' : 'bg-slate-400'}`} />
                    {val === 'active' ? 'Aktif' : 'Pasif'}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" onClick={handleExport}
              className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Excel&apos;e Aktar
            </button>
            <div className="ml-auto">
              <button type="button" onClick={clearSelection} className="text-white/70 hover:text-white text-xs underline transition-colors">Seçimi Temizle</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toplu İşlem Onay Modalı ── */}
      {bulkConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xl">&#x26A1;</div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-1">İşlemi Onayla</h4>
                <p className="text-xs text-slate-500">{bulkConfirm.label}. Emin misiniz?</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-2">
              <button type="button" onClick={() => setBulkConfirm(null)} disabled={bulkLoading}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50">İptal</button>
              <button type="button" onClick={runBulkConfirm} disabled={bulkLoading}
                className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 flex items-center gap-2">
                {bulkLoading && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                Evet, Devam Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <div className="inline-block w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-3" /><br/>Yükleniyor...
        </div>
      ) : !vendors.length ? (
        <div className="table-container">
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">{Icon.briefcase}</div>
            <p className="text-sm font-semibold text-slate-600">
              {hasActiveFilters ? 'Filtrelere Uyan Tedarikçi Bulunamadı' : 'Henüz Tedarikçi Kaydı Yok'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {hasActiveFilters ? 'Farklı filtreler deneyin veya filtreleri temizleyin.' : 'İlk tedarikçinizi ekleyin.'}
            </p>
            {hasActiveFilters ? (
              <button type="button" onClick={clearAllFilters} className="btn-secondary mt-4">Filtreleri Temizle</button>
            ) : (
              <button type="button" onClick={() => { setShowModal(true); }} className="btn-primary mt-4">
                {Icon.plus} Yeni Tedarikçi
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head-row">
                <tr>
                  <th className="table-th w-10">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => { if (el) el.indeterminate = isIndeterminate; }}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 accent-blue-600 cursor-pointer"
                    />
                  </th>
                  <th className="table-th">Tedarikçi</th>
                  <th className="table-th">Tür / Tip</th>
                  <th className="table-th">İletişim</th>
                  <th className="table-th">Konum</th>
                  <th className="table-th">İş Sayısı</th>
                  <th className="table-th">Son İş</th>
                  <th className="table-th">Sözleşme Bitiş</th>
                  <th className="table-th text-center">Durum</th>
                  <th className="table-th w-32" />
                </tr>
              </thead>
              <tbody className="table-body">
                {vendors.map((v) => (
                  <tr key={v.id} className={`table-row cursor-pointer ${selectedIds.has(v.id) ? 'bg-blue-50/60' : ''}`}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('a, button, input')) return;
                      setDrawerVendorId(v.id);
                      setDrawerOpen(true);
                    }}
                  >
                  <td className="table-td" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(v.id)}
                      onChange={() => toggleSelect(v.id)}
                      className="w-4 h-4 rounded border-slate-300 accent-indigo-600 cursor-pointer"
                    />
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${v.entityType === 'individual' ? 'bg-purple-500' : 'bg-indigo-600'}`}>
                        {v.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <Link href={`/panel/tedarikciler/${v.id}`} className="font-semibold text-slate-800 hover:text-blue-600 transition-colors">{v.name}</Link>
                        {v.type && <p className="text-xs text-slate-400 mt-0.5">{v.type}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="table-td">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${v.entityType === 'individual' ? 'bg-purple-50 text-purple-700' : 'bg-indigo-50 text-indigo-700'}`}>
                      {v.entityType === 'individual' ? Icon.user : Icon.building}
                      {v.entityType === 'individual' ? 'Bireysel' : 'Kurumsal'}
                    </span>
                  </td>
                  <td className="table-td">
                    <div className="space-y-1">
                      {v.email && (
                        <p className="text-xs text-slate-600 flex items-center gap-1.5">{Icon.mail}{v.email}</p>
                      )}
                      {v.phone && (
                        <div className="flex items-center gap-1.5">
                          <a href={`tel:${v.phone}`} className="text-xs text-blue-600 hover:underline cursor-pointer flex items-center gap-1 transition-colors">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                            {v.phone}
                          </a>
                          {toWhatsAppLink(v.phone) && (
                            <a
                              href={toWhatsAppLink(v.phone)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="WhatsApp"
                              className="text-green-500 hover:text-green-600 transition-colors flex-shrink-0"
                            >
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                            </a>
                          )}
                        </div>
                      )}
                      {!v.email && !v.phone && <span className="text-xs text-slate-300">—</span>}
                    </div>
                  </td>
                  <td className="table-td">
                    {v.city ? (
                      <p className="text-xs text-slate-600 flex items-center gap-1">{Icon.mapPin}{v.city}{v.district ? ` / ${v.district}` : ''}</p>
                    ) : <span className="text-xs text-slate-300">—</span>}
                  </td>
                  <td className="table-td">
                    {(v._count?.costEntries ?? 0) > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                        {v._count.costEntries}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="table-td">
                    {v.lastJobDate ? (
                      <span className="text-xs text-slate-500" title={new Date(v.lastJobDate).toLocaleDateString('tr-TR')}>
                        {relativeTime(v.lastJobDate)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="table-td">
                    {v.contractEndDate ? (() => {
                      const days = contractDaysLeft(v.contractEndDate);
                      const display = isoToDisplayContract(v.contractEndDate);
                      if (days !== null && days < 0) {
                        return <span className="text-xs font-medium text-red-600 bg-red-50 rounded-full px-2 py-0.5 border border-red-200">{display}</span>;
                      }
                      if (days !== null && days <= 30) {
                        return <span className="text-xs font-medium text-orange-600 bg-orange-50 rounded-full px-2 py-0.5 border border-orange-200">{display}</span>;
                      }
                      return <span className="text-xs text-slate-600">{display}</span>;
                    })() : <span className="text-xs text-slate-300">—</span>}
                  </td>
                  <td className="table-td text-center">
                    <button type="button" onClick={() => handleToggleStatus(v)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${v.status === 'active' ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${v.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`} />
                      {v.status === 'active' ? 'Aktif' : 'Pasif'}
                    </button>
                  </td>
                  <td className="table-td">
                    <div className="flex gap-1.5 justify-end">
                      <Link href={`/panel/tedarikciler/${v.id}`}
                        className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded-lg transition-colors">
                        Detay
                      </Link>
                      <button type="button" onClick={() => openEdit(v)}
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1.5 rounded-lg transition-colors">
                        Düzenle
                      </button>
                      <button type="button" onClick={() => handleDelete(v.id, v.name)}
                        className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1.5 rounded-lg transition-colors">
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {total > limit && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/60">
              <span className="text-xs text-slate-400">{(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total} tedarikçi</span>
              <div className="flex gap-2">
                <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                  className="text-xs border border-slate-200 px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">← Önceki</button>
                <button type="button" disabled={page * limit >= total} onClick={() => setPage((p) => p + 1)}
                  className="text-xs border border-slate-200 px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">Sonraki →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Vendor Drawer ── */}
      <VendorDrawer
        vendorId={drawerVendorId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onEdit={(v) => {
          setDrawerOpen(false);
          openEdit(v);
        }}
      />

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 py-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-indigo-700">
              <div>
                <h3 className="text-base font-semibold text-white">{editVendor ? 'Tedarikçi Düzenle' : 'Yeni Tedarikçi'}</h3>
                <p className="text-indigo-200 text-xs mt-0.5">{editVendor ? editVendor.name : 'Tüm Bilgileri Eksiksiz Doldurun'}</p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-indigo-200 hover:text-white transition-colors">{Icon.x}</button>
            </div>

            {/* Kimlik Bandı */}
            {(() => {
              const displayName = form.entityType === 'individual'
                ? `${form.firstName} ${form.lastName}`.trim()
                : form.name.trim();
              const typeLabel = form.entityType === 'individual' ? 'Bireysel Tedarikçi' : 'Kurumsal Tedarikçi';
              return displayName ? (
                <div className="flex items-center gap-2 px-6 py-2.5 bg-indigo-50 border-b border-indigo-100">
                  <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm font-semibold text-indigo-800">{displayName}</span>
                  <span className="text-xs text-indigo-500 font-medium">— {typeLabel}</span>
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

            {/* Section Tabs */}
            <div className="flex overflow-x-auto border-b border-slate-100 bg-slate-50/50">
              {MODAL_SECTIONS.map((sec, i) => (
                <button key={sec} type="button" onClick={() => setActiveSection(i)}
                  className={`flex-shrink-0 px-5 py-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${activeSection === i ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/70'}`}>
                  {i + 1}. {sec}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* ── Section 0: Temel Bilgiler ── */}
              {activeSection === 0 && (
                <div>
                  {/* Tip Toggle */}
                  <SectionDivider icon={Icon.building} title="Tedarikçi Tipi" />
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {[
                      { val: 'corporate', label: 'Kurumsal', icon: Icon.building, color: 'indigo' },
                      { val: 'individual', label: 'Bireysel', icon: Icon.user, color: 'purple' },
                    ].map(({ val, label, icon, color }) => (
                      <button key={val} type="button" onClick={() => { setForm((p) => ({ ...p, entityType: val as any })); setFieldErrors({}); }}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border-2 transition-all
                          ${form.entityType === val
                            ? color === 'indigo' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}>
                        {icon} {label}
                      </button>
                    ))}
                  </div>

                  {/* Tür */}
                  <SectionDivider icon={Icon.briefcase} title="Tedarikçi Türü" />
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1">
                      <select className={inp} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
                        <option value="">Tür Seçin...</option>
                        {vendorTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <button type="button" onClick={() => setShowAddType(!showAddType)}
                      className="flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100 whitespace-nowrap">
                      {Icon.plus} Yeni Tür
                    </button>
                  </div>
                  {showAddType && (
                    <div className="flex gap-2 mb-3 p-3.5 bg-indigo-50 rounded-xl border border-indigo-100">
                      <input className={inp} placeholder="Tür Adı" value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddVendorType(); }} />
                      <button type="button" onClick={handleAddVendorType} disabled={savingType || !newTypeName.trim()}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-indigo-700">Ekle</button>
                      <button type="button" onClick={() => setShowAddType(false)} className="text-sm text-slate-500 hover:text-slate-700 px-2">İptal</button>
                    </div>
                  )}

                  {/* Kurumsal */}
                  {form.entityType === 'corporate' && (
                    <>
                      <SectionDivider icon={Icon.building} title="Kurumsal Bilgiler" />
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <FormField label="Şirket Adı" required error={fieldErrors.name}>
                            <input ref={nameRef} className={fieldErrors.name ? inpError : inp} placeholder="Şirket Unvanı" value={form.name} onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setFieldErrors((p) => { const n = { ...p }; delete n.name; return n; }); }} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, name: v })); }} />
                          </FormField>
                        </div>
                        <FormField label="Vergi No">
                          <div className="flex gap-2">
                            <input className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${numericErrors.taxNumber ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                              placeholder="10 Haneli VKN" maxLength={10} value={form.taxNumber}
                              onChange={(e) => handleNumericChange('taxNumber', e.target.value)} />
                            <button type="button" onClick={handleGibQuery} disabled={gibLoading || !form.taxNumber}
                              className="bg-indigo-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap">
                              {gibLoading
                                ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                              }
                              Ünvan Sorgula
                            </button>
                          </div>
                          {numericErrors.taxNumber && <p className="text-xs text-red-500 mt-1.5">⚠ {numericErrors.taxNumber}</p>}
                          {!numericErrors.taxNumber && gibError && <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">⚠ {gibError}</p>}
                        </FormField>
                        <FormField label="Vergi Dairesi">
                          <input className={inp} placeholder="Opsiyonel" value={form.taxOffice} onChange={(e) => setForm((p) => ({ ...p, taxOffice: e.target.value }))} />
                        </FormField>
                        <FormField label="Ticaret Sicil No">
                          <input className={inp} placeholder="Opsiyonel" value={form.tradeRegistryNo} onChange={(e) => setForm((p) => ({ ...p, tradeRegistryNo: e.target.value }))} />
                        </FormField>
                      </div>
                    </>
                  )}

                  {/* Bireysel */}
                  {form.entityType === 'individual' && (
                    <>
                      <SectionDivider icon={Icon.user} title="Bireysel Bilgiler" />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField label="Ad" required error={fieldErrors.firstName}>
                          <input ref={nameRef} className={fieldErrors.firstName ? inpError : inp} placeholder="Ad" value={form.firstName} onChange={(e) => { setForm((p) => ({ ...p, firstName: e.target.value, name: `${e.target.value} ${p.lastName}`.trim() })); setFieldErrors((p) => { const n = { ...p }; delete n.firstName; delete n.name; return n; }); }} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, firstName: v, name: `${v} ${p.lastName}`.trim() })); }} />
                        </FormField>
                        <FormField label="Soyad" required error={fieldErrors.lastName}>
                          <input className={fieldErrors.lastName ? inpError : inp} placeholder="Soyad" value={form.lastName} onChange={(e) => { setForm((p) => ({ ...p, lastName: e.target.value, name: `${p.firstName} ${e.target.value}`.trim() })); setFieldErrors((p) => { const n = { ...p }; delete n.lastName; delete n.name; return n; }); }} onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, lastName: v, name: `${p.firstName} ${v}`.trim() })); }} />
                        </FormField>
                        <FormField label="TC Kimlik No">
                          <input className={`${inp} ${numericErrors.identityNo ? 'border-red-400 bg-red-50 focus:ring-red-400/30' : ''}`}
                            placeholder="11 Haneli TC" maxLength={11} value={form.identityNo}
                            onChange={(e) => handleNumericChange('identityNo', e.target.value)} />
                          {numericErrors.identityNo && <p className="text-xs text-red-500 mt-1.5">⚠ {numericErrors.identityNo}</p>}
                        </FormField>
                        <FormField label="Ad (NVI doğrulama için)">
                          <input className={inp} placeholder="Resmi Ad" value={form.firstName}
                            onChange={(e) => { setForm((p) => ({ ...p, firstName: e.target.value })); setNviResult(null); }}
                            onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, firstName: v })); }} />
                        </FormField>
                        <FormField label="Soyad">
                          <input className={inp} placeholder="Resmi Soyad" value={form.lastName}
                            onChange={(e) => { setForm((p) => ({ ...p, lastName: e.target.value })); setNviResult(null); }}
                            onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, lastName: v })); }} />
                        </FormField>
                        <FormField label="Doğum Tarihi">
                          <div className="flex gap-2">
                            <input type="text" inputMode="numeric" className={`flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30`}
                              placeholder="GG.AA.YYYY" maxLength={10}
                              value={isoToDisplayBirth(form.birthDate)}
                              onChange={(e) => {
                                const masked = maskBirthDate(e.target.value);
                                const iso = birthMaskToISO(masked);
                                setForm((p) => ({ ...p, birthDate: iso || masked }));
                                setNviResult(null);
                              }} />
                            <button type="button" onClick={handleNviVerify}
                              disabled={nviLoading || !form.identityNo || !form.firstName || !form.lastName || !form.birthDate}
                              className="bg-purple-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap">
                              {nviLoading && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                              NVI Doğrula
                            </button>
                          </div>
                          {nviResult === true && <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">✓ TC Kimlik doğrulandı</p>}
                          {nviResult === false && <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">⚠ TC Kimlik doğrulanamadı</p>}
                        </FormField>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Section 1: Yetkili Kişiler ── */}
              {activeSection === 1 && (
                <div>
                  {form.entityType === 'individual' ? (
                    <div className="mb-5">
                      <button
                        type="button"
                        onClick={() => setContactsOpen((o) => !o)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600">{Icon.users}</span>
                          <span className="text-sm font-semibold text-slate-700">İlgili Kişi Ekle</span>
                          {contacts.filter((c) => c.firstName.trim() || c.lastName.trim()).length > 0 && (
                            <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-medium">
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
                              <div key={idx} className="relative bg-slate-50 rounded-xl border border-slate-100 p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-xs font-semibold text-slate-500">İlgili Kişi #{idx + 1}</span>
                                  {contacts.length > 1 && (
                                    <button type="button" onClick={() => setContacts((p) => p.filter((_, i) => i !== idx))}
                                      className="text-slate-300 hover:text-red-500 transition-colors">{Icon.x}</button>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <FormField label="Ad">
                                    <input className={inp} placeholder="Ad" value={c.firstName} onChange={(e) => upC(idx, 'firstName', e.target.value)} />
                                  </FormField>
                                  <FormField label="Soyad">
                                    <input className={inp} placeholder="Soyad" value={c.lastName} onChange={(e) => upC(idx, 'lastName', e.target.value)} />
                                  </FormField>
                                  <FormField label="İlişki Türü">
                                    <select
                                      className={inp}
                                      value={c.title === '' ? '' : (relationshipTypes.includes(c.title) ? c.title : '__other__')}
                                      onChange={(e) => {
                                        if (e.target.value === '__add_new__') { setAddingNewRelType(true); setNewRelTypeValue(''); }
                                        else if (e.target.value === '__other__') upC(idx, 'title', '__other__');
                                        else upC(idx, 'title', e.target.value);
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
                                            if (e.key === 'Enter') { e.preventDefault(); handleAddNewRelType((label) => upC(idx, 'title', label)); }
                                            if (e.key === 'Escape') { setAddingNewRelType(false); setNewRelTypeValue(''); }
                                          }}
                                        />
                                        <button type="button" disabled={savingRelType || !newRelTypeValue.trim()}
                                          onClick={() => handleAddNewRelType((label) => upC(idx, 'title', label))}
                                          className="px-2.5 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 flex-shrink-0">
                                          {savingRelType ? '...' : 'Ekle'}
                                        </button>
                                        <button type="button" onClick={() => { setAddingNewRelType(false); setNewRelTypeValue(''); }}
                                          className="px-2 py-1.5 border border-slate-200 text-slate-500 text-xs rounded-lg hover:bg-slate-50 flex-shrink-0">
                                          İptal
                                        </button>
                                      </div>
                                    )}
                                    {!addingNewRelType && (c.title === '__other__' || (!relationshipTypes.includes(c.title) && c.title !== '')) && (
                                      <input
                                        className={`${inp} mt-1.5`}
                                        placeholder="Görevi / Ünvanı girin..."
                                        value={c.title === '__other__' ? '' : c.title}
                                        onChange={(e) => upC(idx, 'title', e.target.value || '__other__')}
                                      />
                                    )}
                                  </FormField>
                                  <FormField label="Telefon">
                                    <PhoneInput value={c.phone} onChange={(v) => upC(idx, 'phone', v)} />
                                  </FormField>
                                  <FormField label="E-posta">
                                    <input type="email" className={inp} placeholder="ornek@mail.com" value={c.email} onChange={(e) => upC(idx, 'email', e.target.value)} />
                                  </FormField>
                                  <FormField label="Doğum Tarihi">
                                    <input type="text" inputMode="numeric" className={inp} placeholder="GG.AA.YYYY" maxLength={10}
                                      value={isoToDisplayBirth(c.birthDate)}
                                      onChange={(e) => {
                                        const masked = maskBirthDate(e.target.value);
                                        const iso = birthMaskToISO(masked);
                                        upC(idx, 'birthDate', iso || masked);
                                      }} />
                                  </FormField>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => setContacts((p) => [...p, emptyContact()])}
                            className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium py-2 px-3 rounded-lg hover:bg-indigo-50 transition-colors">
                            {Icon.plus} Kişi Ekle
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <SectionDivider icon={Icon.users} title="Yetkili Kişiler" />
                      <div className="space-y-3 mb-4">
                        {contacts.map((c, idx) => (
                          <div key={idx} className="relative bg-slate-50 rounded-xl border border-slate-100 p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-semibold text-slate-500">Yetkili #{idx + 1}</span>
                              {contacts.length > 1 && (
                                <button type="button" onClick={() => setContacts((p) => p.filter((_, i) => i !== idx))}
                                  className="text-slate-300 hover:text-red-500 transition-colors">{Icon.x}</button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <FormField label="Ad">
                                <input className={inp} placeholder="Yetkili Kişinin Adı" value={c.firstName} onChange={(e) => upC(idx, 'firstName', e.target.value)} />
                              </FormField>
                              <FormField label="Soyad">
                                <input className={inp} placeholder="Yetkili Kişinin Soyadı" value={c.lastName} onChange={(e) => upC(idx, 'lastName', e.target.value)} />
                              </FormField>
                              <FormField label="İlişki Türü">
                                <select
                                  className={inp}
                                  value={c.title === '' ? '' : (relationshipTypes.includes(c.title) ? c.title : '__other__')}
                                  onChange={(e) => {
                                    if (e.target.value === '__other__') upC(idx, 'title', '__other__');
                                    else upC(idx, 'title', e.target.value);
                                  }}
                                >
                                  <option value="">Seçin...</option>
                                  {relationshipTypes.filter((rt) => rt !== 'Diğer').map((rt) => (
                                    <option key={rt} value={rt}>{rt}</option>
                                  ))}
                                  <option value="__other__">Diğer</option>
                                </select>
                                {(c.title === '__other__' || (!relationshipTypes.includes(c.title) && c.title !== '')) && (
                                  <input
                                    className={`${inp} mt-1.5`}
                                    placeholder="Görevi / Ünvanı girin..."
                                    value={c.title === '__other__' ? '' : c.title}
                                    onChange={(e) => upC(idx, 'title', e.target.value || '__other__')}
                                  />
                                )}
                              </FormField>
                              <FormField label="Telefon">
                                <PhoneInput value={c.phone} onChange={(v) => upC(idx, 'phone', v)} />
                              </FormField>
                              <FormField label="E-posta">
                                <input type="email" className={inp} placeholder="ornek@sirket.com" value={c.email} onChange={(e) => upC(idx, 'email', e.target.value)} />
                              </FormField>
                              <FormField label="Doğum Tarihi">
                                <input type="text" inputMode="numeric" className={inp} placeholder="GG.AA.YYYY" maxLength={10}
                                  value={isoToDisplayBirth(c.birthDate)}
                                  onChange={(e) => {
                                    const masked = maskBirthDate(e.target.value);
                                    const iso = birthMaskToISO(masked);
                                    upC(idx, 'birthDate', iso || masked);
                                  }} />
                              </FormField>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => setContacts((p) => [...p, emptyContact()])}
                        className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium py-2 px-3 rounded-lg hover:bg-indigo-50 transition-colors">
                        {Icon.plus} Yetkili Kişi Ekle
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* ── Section 2: İletişim ── */}
              {activeSection === 2 && (
                <div>
                  <SectionDivider icon={Icon.phone} title="Çoklu İletişim Kanalları" />
                  <div className="space-y-2.5 mb-4">
                    {contactInfos.map((ci, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <div className="flex gap-2 items-center bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <select className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors w-32 flex-shrink-0"
                            value={ci.type} onChange={(e) => upCI(idx, 'type', e.target.value)}>
                            <option value="phone">📞 Telefon</option>
                            <option value="email">✉ E-posta</option>
                            <option value="fax">🖷 Faks</option>
                            <option value="whatsapp">💬 WhatsApp</option>
                          </select>
                          {(ci.type === 'phone' || ci.type === 'whatsapp') ? (
                            <PhoneInput
                              className="flex-1"
                              value={ci.value}
                              onChange={(v) => { upCI(idx, 'value', v); setPhoneWarn(null); setDuplicateConflicts((p) => { const n = { ...p }; delete n.phone; return n; }); }}
                              onBlur={(v) => handlePhoneDuplicateCheck(v)}
                            />
                          ) : (
                            <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors"
                              placeholder={ci.type === 'email' ? 'ornek@sirket.com' : 'Faks Numarası'}
                              value={ci.value}
                              onChange={(e) => { upCI(idx, 'value', e.target.value); if (ci.type === 'email') { setEmailWarn(null); setDuplicateConflicts((p) => { const n = { ...p }; delete n.email; return n; }); } }}
                              onBlur={() => { if (ci.type === 'email') handleEmailDuplicateCheck(ci.value); }}
                            />
                          )}
                          <select className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors w-28 flex-shrink-0"
                            value={ci.label} onChange={(e) => upCI(idx, 'label', e.target.value)}>
                            <option value="general">Genel</option>
                            <option value="work">İş</option>
                            <option value="personal">Kişisel</option>
                          </select>
                          {contactInfos.length > 1 && (
                            <button type="button" onClick={() => setContactInfos((p) => p.filter((_, i) => i !== idx))}
                              className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">{Icon.x}</button>
                          )}
                        </div>
                        {(ci.type === 'phone' || ci.type === 'whatsapp') && phoneWarn && idx === 0 && (
                          <p className="text-xs text-amber-600 px-1 flex items-center gap-1">⚠ {phoneWarn}</p>
                        )}
                        {ci.type === 'email' && emailWarn && (
                          <p className="text-xs text-amber-600 px-1 flex items-center gap-1">⚠ {emailWarn}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setContactInfos((p) => [...p, emptyContactInfo()])}
                    className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium py-2 px-3 rounded-lg hover:bg-indigo-50 transition-colors">
                    {Icon.plus} İletişim Kanalı Ekle
                  </button>
                </div>
              )}

              {/* ── Section 3: Konum & Hizmet ── */}
              {activeSection === 3 && (
                <div>
                  <SectionDivider icon={Icon.mapPin} title="Adres Bilgileri" />
                  <div className="grid grid-cols-2 gap-4 mb-2">
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
                    <FormField label="İlçe">
                      <select className={inp} value={form.district} disabled={!form.cityCode}
                        onChange={(e) => setForm((p) => ({ ...p, district: e.target.value, neighborhood: '' }))}>
                        <option value="">İlçe seçin...</option>
                        {(form.cityCode ? (STATIC_DISTRICTS[form.cityCode] ?? []) : []).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </FormField>
                    <div className="col-span-2">
                      <FormField label="Mahalle">
                        <input className={inp} placeholder="Mahalle adı"
                          value={form.neighborhood}
                          onChange={(e) => setForm((p) => ({ ...p, neighborhood: e.target.value }))} />
                      </FormField>
                    </div>
                    <FormField label="Cadde / Sokak">
                      <input className={inp} placeholder="Cadde veya sokak adı"
                        value={form.streetName}
                        onChange={(e) => setForm((p) => ({ ...p, streetName: e.target.value }))} />
                    </FormField>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Bina No">
                        <input className={inp} placeholder="Bina no"
                          value={form.buildingNo}
                          onChange={(e) => setForm((p) => ({ ...p, buildingNo: e.target.value }))} />
                      </FormField>
                      <FormField label="Daire No">
                        <input className={inp} placeholder="Daire no"
                          value={form.doorNo}
                          onChange={(e) => setForm((p) => ({ ...p, doorNo: e.target.value }))} />
                      </FormField>
                    </div>
                    <div className="col-span-2">
                      <FormField label="Açık Adres">
                        <textarea rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                          placeholder="Mahalle, Cadde, Sokak..." value={form.address}
                          onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
                      </FormField>
                    </div>
                    {/* Geocoding buttons */}
                    {(form.city || form.district || form.neighborhood || form.streetName) && (
                      <div className="col-span-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={geocoding}
                          onClick={() => handleGeocodeAddress(form.city, form.district, form.neighborhood, form.streetName, form.buildingNo)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition"
                        >
                          {geocoding ? (
                            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                            </svg>
                          )}
                          {geocoding ? 'Aranıyor...' : 'Konumu Bul'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowLocationPicker(true)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${locationCoords ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                          </svg>
                          {locationCoords ? 'Konum Seçildi' : 'Haritadan Konum Seç'}
                        </button>
                      </div>
                    )}
                    {geocodeMsg && (
                      <div className={`col-span-2 text-xs px-3 py-2 rounded-lg ${geocodeMsg.startsWith('Konum bulundu') ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {geocodeMsg}
                      </div>
                    )}
                    {locationCoords && (
                      <div className="col-span-2">
                        <LocationPreview
                          lat={locationCoords.lat}
                          lng={locationCoords.lng}
                          onEdit={() => setShowLocationPicker(true)}
                          onClear={() => { setLocationCoords(null); setGeocodeMsg(null); }}
                          accentColor="indigo"
                        />
                      </div>
                    )}
                  </div>

                  <LocationPickerModal
                    open={showLocationPicker}
                    initial={locationCoords}
                    addressHint={[form.neighborhood, form.streetName, form.buildingNo ? `No: ${form.buildingNo}` : '', form.district, form.city].filter(Boolean).join(' ') || undefined}
                    onConfirm={(coords) => { setLocationCoords(coords); setShowLocationPicker(false); setGeocodeMsg(null); }}
                    onClose={() => setShowLocationPicker(false)}
                  />

                  <SectionDivider icon={Icon.briefcase} title="Faaliyet Alanları (İş Grupları)" />
                  <div ref={wgRef} className="relative mb-4">
                    <div className={`w-full border rounded-lg transition-all ${wgOpen ? 'border-indigo-400 ring-2 ring-indigo-500/30' : 'border-slate-200'}`}>
                      <div className="flex items-center px-3 py-2 gap-2">
                        <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          className="flex-1 text-sm focus:outline-none bg-transparent placeholder-slate-400"
                          placeholder="Faaliyet alanı ara veya seç..."
                          value={wgSearch}
                          onChange={(e) => { setWgSearch(e.target.value); setWgOpen(true); }}
                          onFocus={() => setWgOpen(true)}
                        />
                        {selectedWgNames.length > 0 && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-medium flex-shrink-0">
                            {selectedWgNames.length} seçili
                          </span>
                        )}
                        <button type="button" onClick={() => setWgOpen((o) => !o)} className="text-slate-400 hover:text-slate-600">
                          <span className={`block transition-transform ${wgOpen ? 'rotate-180' : ''}`}>{Icon.chevronDown}</span>
                        </button>
                      </div>
                    </div>
                    {wgOpen && (
                      <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-slate-100 z-30 max-h-52 overflow-y-auto py-1">
                        {workGroups.filter((wg) => wgSearch ? wg.name.toLowerCase().includes(wgSearch.toLowerCase()) : true).length === 0 ? (
                          <p className="text-xs text-slate-400 px-4 py-3">
                            {wgSearch ? `"${wgSearch}" için sonuç bulunamadı.` : 'İş Grubu Bulunamadı.'}
                          </p>
                        ) : workGroups
                            .filter((wg) => wgSearch ? wg.name.toLowerCase().includes(wgSearch.toLowerCase()) : true)
                            .map((wg) => (
                          <label key={wg.id} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 cursor-pointer transition-colors">
                            <input type="checkbox" checked={selectedWorkGroupIds.includes(wg.id)} onChange={() => { toggleWg(wg.id); setWgSearch(''); }} className="rounded accent-indigo-600" />
                            <span>
                              {wgSearch ? (
                                wg.name.split(new RegExp(`(${wgSearch})`, 'gi')).map((part, i) =>
                                  part.toLowerCase() === wgSearch.toLowerCase()
                                    ? <mark key={i} className="bg-indigo-100 text-indigo-800 rounded px-0.5">{part}</mark>
                                    : part
                                )
                              ) : wg.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                    {selectedWgNames.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selectedWgNames.map((wg) => (
                          <span key={wg.id} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 rounded-full px-2.5 py-1 border border-indigo-100">
                            {wg.name}
                            <button type="button" onClick={() => toggleWg(wg.id)} className="text-indigo-300 hover:text-red-500">{Icon.x}</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <SectionDivider icon={Icon.mapPin} title="Hizmet Bölgeleri" />
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                    <div className="flex gap-2 mb-3">
                      <select className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                        value={selectedProvince?.id ?? ''}
                        onChange={(e) => {
                          const p = provinces.find((x) => x.id === e.target.value);
                          if (p) { setSelectedProvince(p); loadServiceDistricts(p.id); }
                          else { setSelectedProvince(null); setServiceDistricts([]); }
                        }}>
                        <option value="">İl seçin...</option>
                        {provinces.map((p) => <option key={p.id} value={p.id}>{p.plateCode} - {p.name}</option>)}
                      </select>
                      {selectedProvince && (
                        <button type="button" onClick={() => addWholeProvince(selectedProvince)}
                          className="text-xs bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg border border-indigo-200 hover:bg-indigo-100 whitespace-nowrap">
                          Tüm İlçeleri Ekle
                        </button>
                      )}
                    </div>
                    {selectedProvince && serviceDistricts.length > 0 && (
                      <div className="max-h-28 overflow-y-auto grid grid-cols-3 gap-1.5 mb-3 bg-white rounded-lg p-3 border border-slate-100">
                        {serviceDistricts.map((d) => {
                          const checked = serviceAreas.some((sa) => sa.provinceId === selectedProvince.id && sa.districtId === d.id);
                          return (
                            <label key={d.id} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer hover:text-indigo-600">
                              <input type="checkbox" checked={checked} onChange={() => toggleServiceArea(selectedProvince.id, d.id)} className="rounded accent-indigo-600" />
                              {d.name}
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {serviceAreas.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {serviceAreas.map((sa, i) => {
                          const prov = provinces.find((p) => p.id === sa.provinceId);
                          const dist = serviceDistricts.find((d) => d.id === sa.districtId);
                          const label = sa.districtId ? `${prov?.name}/${dist?.name ?? sa.districtId}` : `${prov?.name} (Tümü)`;
                          return (
                            <span key={i} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 border border-blue-100">
                              {label}
                              <button type="button" onClick={() => {
                                const key = sa.districtId ? `${sa.provinceId}:${sa.districtId}` : `${sa.provinceId}:`;
                                setServiceAreas((p) => p.filter((x) => (x.districtId ? `${x.provinceId}:${x.districtId}` : `${x.provinceId}:`) !== key));
                              }} className="text-blue-400 hover:text-red-500">{Icon.x}</button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Section 4: CRM & Banka ── */}
              {activeSection === 4 && (
                <div>
                  <SectionDivider icon={Icon.tag} title="CRM Bilgileri" />
                  <div className="grid grid-cols-2 gap-4 mb-2">
                    <FormField label="Referans">
                      <input className={inp} placeholder="Bu Tedarikçiyi Kim Önerdi?" value={form.referral}
                        onChange={(e) => setForm((p) => ({ ...p, referral: e.target.value }))} />
                    </FormField>
                    <FormField label="Etiketler">
                      <div className="flex gap-1.5">
                        <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors"
                          placeholder="Etiket Yaz, Enter veya + Bas" value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
                        <button type="button" onClick={addTag}
                          className="bg-slate-100 text-slate-600 text-xs px-3 py-2 rounded-lg hover:bg-slate-200 flex items-center">{Icon.plus}</button>
                      </div>
                    </FormField>
                  </div>
                  {form.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {form.tags.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 rounded-full px-2.5 py-1 border border-amber-100">
                          {t}
                          <button type="button" onClick={() => setForm((p) => ({ ...p, tags: p.tags.filter((x) => x !== t) }))} className="text-amber-400 hover:text-red-500">{Icon.x}</button>
                        </span>
                      ))}
                    </div>
                  )}

                  <SectionDivider icon={Icon.bank} title="Banka Bilgileri" />
                  <div className="grid grid-cols-2 gap-4 mb-2">
                    <FormField label="IBAN">
                      <input className={inp} placeholder="TR00 0000 0000 0000 0000 0000 00" value={form.iban} onChange={(e) => setForm((p) => ({ ...p, iban: e.target.value }))} />
                    </FormField>
                    <FormField label="Banka Adı">
                      <input className={inp} placeholder="Opsiyonel" value={form.bankName} onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))} />
                    </FormField>
                  </div>

                  <div className="mt-5">
                    <FormField label="Notlar">
                      <textarea rows={4} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        placeholder="Tedarikçi Hakkında Ek Notlar..." value={form.notes}
                        onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
                    </FormField>
                  </div>
                </div>
              )}

              {/* ── Section 5: Evraklar ── */}
              {activeSection === 5 && (
                <div>
                  {/* Sözleşme Bilgileri */}
                  <SectionDivider icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  } title="Sözleşme Bilgileri" />
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <FormField label="Sözleşme Başlangıç Tarihi">
                      <input
                        type="text"
                        inputMode="numeric"
                        className={inp}
                        placeholder="GG.AA.YYYY"
                        maxLength={10}
                        value={isoToDisplayContract(form.contractStartDate)}
                        onChange={(e) => {
                          const masked = maskContractDate(e.target.value);
                          const iso = contractMaskToISO(masked);
                          setForm((p) => ({ ...p, contractStartDate: iso || masked }));
                        }}
                      />
                    </FormField>
                    <FormField label="Sözleşme Bitiş Tarihi">
                      <input
                        type="text"
                        inputMode="numeric"
                        className={inp}
                        placeholder="GG.AA.YYYY"
                        maxLength={10}
                        value={isoToDisplayContract(form.contractEndDate)}
                        onChange={(e) => {
                          const masked = maskContractDate(e.target.value);
                          const iso = contractMaskToISO(masked);
                          setForm((p) => ({ ...p, contractEndDate: iso || masked }));
                        }}
                      />
                      {form.contractEndDate && (() => {
                        const days = contractDaysLeft(form.contractEndDate);
                        if (days !== null && days < 0) {
                          return <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">&#x26A0; Sözleşme {Math.abs(days)} gün önce sona erdi</p>;
                        }
                        if (days !== null && days <= 30) {
                          return <p className="text-xs text-orange-500 mt-1.5 flex items-center gap-1">&#x26A0; Sözleşme {days} gün içinde bitiyor</p>;
                        }
                        return null;
                      })()}
                    </FormField>
                  </div>
                  <div className="mb-5">
                    <FormField label="Sözleşme Notları">
                      <textarea
                        rows={2}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        placeholder="Sözleşme Hakkında Notlar, Özel Şartlar..."
                        value={form.contractNotes}
                        onChange={(e) => setForm((p) => ({ ...p, contractNotes: e.target.value }))}
                      />
                    </FormField>
                  </div>

                  {/* Evrak Yükleme */}
                  <SectionDivider icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  } title="Evrak Yükleme" />
                  <div className="flex gap-3 items-end flex-wrap mb-2">
                    <div className="flex-1 min-w-48">
                      <label className="text-xs font-medium text-slate-500 block mb-1.5">Evrak Türü *</label>
                      <select
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        value={docSelectedType}
                        onChange={(e) => { setDocSelectedType(e.target.value); setDocCustomType(''); }}
                      >
                        <option value="">Seçin...</option>
                        {EVRAK_TURLERI_MODAL.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {docSelectedType === 'Diğer' && (
                        <input
                          className="mt-1.5 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                          placeholder="Evrak türünü yazın..."
                          value={docCustomType}
                          onChange={(e) => setDocCustomType(e.target.value)}
                        />
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        ref={docFileInputRef}
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const effectiveType = docSelectedType === 'Diğer' ? docCustomType.trim() : docSelectedType;
                          if (!effectiveType) return;
                          const pd: PendingDoc = {
                            id: `${Date.now()}-${Math.random()}`,
                            file,
                            type: docSelectedType,
                            customType: docCustomType,
                          };
                          setPendingDocs((p) => [...p, pd]);
                          setDocSelectedType('');
                          setDocCustomType('');
                          if (e.target) e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const effectiveType = docSelectedType === 'Diğer' ? docCustomType.trim() : docSelectedType;
                          if (effectiveType) docFileInputRef.current?.click();
                        }}
                        disabled={!docSelectedType || (docSelectedType === 'Diğer' && !docCustomType.trim())}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap font-medium"
                      >
                        📎 Dosya Seç
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">Desteklenen: PDF, JPG, PNG, Word, Excel — Maks. 20 MB</p>

                  {pendingDocs.length > 0 && (
                    <div className="space-y-2">
                      {pendingDocs.map((pd) => {
                        const effectiveType = pd.type === 'Diğer' ? pd.customType.trim() : pd.type;
                        const ext = pd.file.name.split('.').pop()?.toLowerCase() ?? '';
                        return (
                          <div key={pd.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                <span className="text-indigo-600 text-xs font-bold">{ext.toUpperCase() || 'DOC'}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{pd.file.name}</p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-xs mr-1">{effectiveType}</span>
                                  {fmtDocSize(pd.file.size)}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPendingDocs((p) => p.filter((x) => x.id !== pd.id))}
                              className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0 ml-2"
                            >
                              Sil
                            </button>
                          </div>
                        );
                      })}
                      <p className="text-xs text-slate-400 pt-1">
                        {pendingDocs.length} evrak kaydedildiğinde yüklenecek
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <div className="flex gap-1.5">
                {MODAL_SECTIONS.map((_, i) => (
                  <button key={i} type="button" onClick={() => setActiveSection(i)}
                    className={`w-2 h-2 rounded-full transition-all ${activeSection === i ? 'bg-indigo-600 w-4' : 'bg-slate-300 hover:bg-slate-400'}`} />
                ))}
              </div>
              <div className="flex gap-2">
                {activeSection > 0 && (
                  <button type="button" onClick={() => setActiveSection((s) => s - 1)}
                    className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                    ← Önceki
                  </button>
                )}
                {activeSection < MODAL_SECTIONS.length - 1 ? (
                  <button type="button" onClick={() => setActiveSection((s) => s + 1)}
                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    disabled={false}>
                    Sonraki →
                  </button>
                ) : (
                  <button type="button" onClick={handleSave} disabled={saving}
                    className="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
                    {saving ? 'Kaydediliyor...' : editVendor ? 'Güncelle' : 'Tedarikçi Ekle'}
                  </button>
                )}
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                  İptal
                </button>
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
