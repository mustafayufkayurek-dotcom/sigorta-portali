'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { provinces as STATIC_PROVINCES, districts as STATIC_DISTRICTS } from '@/data/turkey-locations';
import { ContactPhoneField } from '@/components/ContactPhoneField';
import { PhoneContactActions } from '@/components/ui/PhoneContactActions';
import { DistrictCheckboxGrid } from '@/components/ui/DistrictCheckboxGrid';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import {
  addAllDistrictsInProvince,
  isDistrictAreaChecked,
  toggleDistrictArea,
} from '@/utils/service-area-helpers';
import { useToast } from '@/contexts/ToastContext';
import { SlidePanel } from '@/components/SlidePanel';
import { VendorDiscoveryPanel, type ExternalVendorCandidate, type VendorDiscoverySearchContext } from '@/components/vendor-discovery/VendorDiscoveryPanel';
import { DeleteConfirmDialog } from '@/components/settings/SettingsModal';
import { LocationPickerModal, LocationPreview, type LatLng } from '@/components/LocationPickerModal';
import { relativeTime } from '@/utils/date-helpers';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { NeighborhoodSelect } from '@/components/ui/NeighborhoodSelect';
import { ADDRESS_FIELD } from '@/constants/address-fields';
import { validateIBAN } from '@/utils/validators';
import {
  VENDOR_CATEGORIES,
  VENDOR_DOC_OTHER_SELECT,
  HIZMET_KOLU_OTHER_KEY,
  isVendorTypeOther,
  isOtherDocumentTypeName,
  vendorCategoryShowsHasarKollari,
  vendorCategoryShowsAcilKollari,
  vendorTypeActivityPlaceholder,
  resolveVendorTypeHizmetMode,
  vendorTypeActivityLabel,
  vendorTypeQuickPicks,
  vendorTypeShowsWorkGroupGrid,
  vendorTypeSectionHint,
  vendorTypeModeBadge,
  formatVendorTypeLabel,
  formatVendorAddress,
  filterDocumentTypesForCategory,
  VENDOR_RELATION_SECTION_TITLE,
  VENDOR_RELATION_SECTION_HINT,
  VENDOR_FORM_SECTIONS,
  type VendorCategory,
  type VendorDocumentTypeRow,
  type VendorTypeHizmetMode,
} from '@/utils/vendor-form-helpers';
import {
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableTh,
  TableColumnsProvider,
  usePanelTableColumns,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';

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
type ContactPerson = {
  id?: string;
  firstName: string;
  lastName: string;
  title: string;
  phone: string;
  phoneType: 'gsm' | 'landline';
  extensionNo: string;
  email: string;
  birthDate: string;
};
type ContactInfoItem = { id?: string; type: string; value: string; label: string };

const emptyContact = (): ContactPerson => ({
  firstName: '', lastName: '', title: '', phone: '', phoneType: 'gsm', extensionNo: '', email: '', birthDate: '',
});

function mapVendorContactFromApi(c: Record<string, unknown>): ContactPerson {
  const fullName = String(c.fullName ?? '').trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    id: c.id as string | undefined,
    firstName: String(c.firstName ?? parts[0] ?? ''),
    lastName: String(c.lastName ?? parts.slice(1).join(' ') ?? ''),
    title: String(c.title ?? ''),
    phone: String(c.phone ?? ''),
    phoneType: c.phoneType === 'landline' ? 'landline' : 'gsm',
    extensionNo: String(c.phoneExtension ?? ''),
    email: String(c.email ?? ''),
    birthDate: c.birthDate ? String(c.birthDate).split('T')[0] : '',
  };
}

function contactDisplayLabel(c: ContactPerson, idx: number, kind: 'corporate' | 'individual'): string {
  const name = `${c.firstName} ${c.lastName}`.trim();
  if (name) return name;
  return kind === 'individual' ? `İlgili Kişi #${idx + 1}` : `Yetkili #${idx + 1}`;
}

function mapContactToPayload(c: ContactPerson) {
  return {
    id: c.id,
    fullName: `${c.firstName} ${c.lastName}`.trim(),
    firstName: c.firstName,
    lastName: c.lastName,
    title: c.title === '__other__' ? '' : c.title,
    phone: c.phone || null,
    phoneType: c.phoneType,
    phoneExtension: c.extensionNo || null,
    email: c.email || null,
    birthDate: c.birthDate || null,
  };
}
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
  category: 'hasar' as VendorCategory,
});

type PendingDoc = {
  id: string;
  file: File;
  documentTypeId: string;
  documentTypeName: string;
  customLabel?: string;
};
function fmtDocSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function HizmetKoluGrid({
  title,
  items,
  selectedKeys,
  onToggle,
  onSelectAll,
  loading,
  emptyMessage,
  accent,
  customOther = '',
  onCustomOtherChange,
}: {
  title: string;
  items: { key: string; label: string }[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
  onSelectAll: (selectAll: boolean) => void;
  loading?: boolean;
  emptyMessage: string;
  accent: 'blue' | 'orange';
  customOther?: string;
  onCustomOtherChange?: (value: string) => void;
}) {
  const gridItems = onCustomOtherChange
    ? [
        ...items.filter((i) => i.key !== HIZMET_KOLU_OTHER_KEY && i.label.trim().toLowerCase() !== 'diğer' && i.label.trim().toLowerCase() !== 'diger'),
        { key: HIZMET_KOLU_OTHER_KEY, label: 'Diğer' },
      ]
    : items;
  const allSelected = items.length > 0 && items.every((i) => selectedKeys.includes(i.key));
  const otherSelected = selectedKeys.includes(HIZMET_KOLU_OTHER_KEY);
  const activeBtn = accent === 'blue'
    ? 'border-blue-500 bg-blue-50 text-blue-700'
    : 'border-orange-400 bg-orange-50 text-orange-700';
  const idleBtn = 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50';

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-700">{title}</p>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => onSelectAll(!allSelected)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-all font-medium ${
              allSelected ? 'border-slate-300 text-slate-500 hover:bg-slate-50' : activeBtn
            }`}
          >
            {allSelected ? 'Tümünü Kaldır' : 'Tümünü Seç'}
          </button>
        )}
      </div>
      {loading ? (
        <p className="text-xs text-slate-400 py-2">Hizmet kolları yükleniyor...</p>
      ) : gridItems.length === 0 ? (
        <p className="text-xs text-amber-700 py-1">{emptyMessage}</p>
      ) : (
        <>
          {items.length === 0 && onCustomOtherChange && (
            <p className="text-xs text-amber-700 mb-2">{emptyMessage}</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {gridItems.map((item) => {
              const selected = selectedKeys.includes(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onToggle(item.key)}
                  className={`text-left text-xs px-3 py-2 rounded-lg border transition-all font-medium ${
                    selected ? activeBtn : idleBtn
                  }`}
                >
                  {item.label === 'Diğer' ? item.label : toTitleCaseTR(item.label)}
                </button>
              );
            })}
          </div>
          {onCustomOtherChange && otherSelected && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-100">
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Diğer hizmet kolu açıklaması <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                className={`${inp} text-xs`}
                placeholder="Hizmet kolunu yazın..."
                value={customOther}
                onChange={(e) => onCustomOtherChange(e.target.value)}
                onBlur={(e) => {
                  const v = toTitleCaseTR(e.target.value.trim());
                  if (v) onCustomOtherChange(v);
                }}
              />
            </div>
          )}
          {(selectedKeys.filter((k) => k !== HIZMET_KOLU_OTHER_KEY).length > 0 || (otherSelected && customOther.trim())) && (
            <p className="text-[11px] text-slate-500 mt-2">
              {selectedKeys.filter((k) => k !== HIZMET_KOLU_OTHER_KEY).length + (otherSelected && customOther.trim() ? 1 : 0)} hizmet kolu seçildi
            </p>
          )}
        </>
      )}
    </div>
  );
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
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadDetail = useCallback(() => {
    if (!vendorId) return;
    setVendor(null);
    setDetailError(null);
    setLoadingDetail(true);
    axios
      .get(`${API}/vendors/${vendorId}`, { headers: authHeader() })
      .then((r) => setVendor(r.data.data ?? r.data))
      .catch((e) => {
        console.error(e);
        setVendor(null);
        setDetailError('Tedarikçi detayı yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.');
      })
      .finally(() => setLoadingDetail(false));
  }, [vendorId]);

  useEffect(() => {
    if (!open || !vendorId) return;
    loadDetail();
  }, [open, vendorId, loadDetail]);

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
  const acilBranches: string[] = Array.isArray(vendor?.serviceBranches) ? vendor.serviceBranches : [];

  return (
    <SlidePanel open={open} onClose={onClose} width={400}>
      {/* Custom header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-indigo-700 flex-shrink-0">
        <div>
          <p className="text-xs text-indigo-200 font-medium tracking-wide">Tedarikçi Özeti</p>
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
        <div className="space-y-3 animate-pulse p-4">{Array.from({length:5}).map((_,i)=><div key={i} className="h-12 rounded-lg bg-slate-200 dark:bg-slate-700"/>)}</div>
      ) : !vendor ? (
        <div className="flex flex-col items-center justify-center h-40 px-6 text-center gap-3">
          <p className="text-sm text-slate-500">{detailError ?? 'Veri alınamadı'}</p>
          <button
            type="button"
            onClick={loadDetail}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors"
          >
            Tekrar Dene
          </button>
        </div>
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
                <PhoneContactActions phone={vendor.phone} variant="panel" accent="indigo" />
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

          {/* Hizmet Kolları */}
          {(workGroups.length > 0 || acilBranches.length > 0) && (
            <div className="px-5 pt-4 pb-4 border-b border-slate-50">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 flex-shrink-0">{Icon.briefcase}</span>
                <p className="text-xs font-semibold text-slate-700 tracking-wide">Tedarikçi Hizmet Kolları</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {workGroups.map((vwg: any) => (
                  <span key={vwg.workGroupId ?? vwg.id} className="inline-flex items-center text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 border border-blue-100">
                    {vwg.workGroup?.name ?? vwg.name ?? vwg.workGroupId}
                  </span>
                ))}
                {acilBranches.map((name) => (
                  <span key={name} className="inline-flex items-center text-xs bg-orange-50 text-orange-700 rounded-full px-2.5 py-1 border border-orange-100">
                    {name}
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
                <p className="text-xs font-semibold text-slate-700 tracking-wide">Hizmet Bölgeleri</p>
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
                <p className="text-xs font-semibold text-slate-700 tracking-wide">Banka Bilgileri</p>
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
                <p className="text-xs font-semibold text-slate-700 tracking-wide">Referans</p>
              </div>
              <p className="text-sm text-slate-700">{vendor.referral}</p>
            </div>
          )}

          {/* Tags */}
          {vendor.tags && vendor.tags.length > 0 && (
            <div className="px-5 pt-4 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 flex-shrink-0">{Icon.tag}</span>
                <p className="text-xs font-semibold text-slate-700 tracking-wide">Etiketler</p>
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

// ── Satır işlemleri: Detay birincil; düzenle/sil ikincil menüde ───────────────
function VendorRowActionsMenu({
  isOpen,
  onToggle,
  onClose,
  onEdit,
  onDelete,
}: {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const updateMenuPos = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuW = 144;
    const menuH = 82;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuH + gap;
    setMenuPos({
      top: openUp ? rect.top - menuH - gap : rect.bottom + gap,
      left: Math.min(window.innerWidth - menuW - 8, Math.max(8, rect.right - menuW)),
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setMenuPos(null);
      return;
    }
    updateMenuPos();
    window.addEventListener('scroll', updateMenuPos, true);
    window.addEventListener('resize', updateMenuPos);
    return () => {
      window.removeEventListener('scroll', updateMenuPos, true);
      window.removeEventListener('resize', updateMenuPos);
    };
  }, [isOpen, updateMenuPos]);

  return (
    <>
      <div className="relative flex-shrink-0">
        <button
          ref={buttonRef}
          type="button"
          aria-label="Diğer işlemler"
          aria-expanded={isOpen}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-lg leading-none"
        >
          ···
        </button>
      </div>
      {isOpen && menuPos && typeof document !== 'undefined' && createPortal(
        <>
          <button type="button" className="fixed inset-0 z-[60] cursor-default" aria-label="Menüyü kapat" onClick={onClose} />
          <div
            className="fixed z-[61] min-w-[9rem] bg-white border border-slate-200 rounded-xl shadow-lg py-1"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); onEdit(); }}
              className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Düzenle
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); onDelete(); }}
              className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 border-t border-slate-100 transition-colors"
            >
              Sil…
            </button>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'name', label: 'Tedarikçi', defaultWidth: 200, minWidth: 140 },
  { id: 'type', label: 'Tür / Tip', defaultWidth: 118, minWidth: 108 },
  { id: 'contact', label: 'İletişim', defaultWidth: 180, minWidth: 120 },
  { id: 'location', label: 'Konum', defaultWidth: 140, minWidth: 100 },
  { id: 'jobCount', label: 'İş Sayısı', defaultWidth: 96, minWidth: 88 },
  { id: 'lastJob', label: 'Son İş', defaultWidth: 96, minWidth: 88 },
  { id: 'contractEnd', label: 'Sözleşme Bitiş', defaultWidth: 128, minWidth: 112 },
  { id: 'status', label: 'Durum', defaultWidth: 96, minWidth: 88 },
];

export default function VendorsPage() {
  const tableColumns = usePanelTableColumns('table-cols:tedarikciler', TABLE_COLUMNS);
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total: 0, activeCount: 0, corporateCount: 0 });
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
  const [showDiscoveryPanel, setShowDiscoveryPanel] = useState(false);
  const [pendingDiscoveryLink, setPendingDiscoveryLink] = useState<{ sessionId: string; externalId: string } | null>(null);
  const [editVendor, setEditVendor] = useState<any>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [gibLoading, setGibLoading] = useState(false);
  const [gibError, setGibError] = useState<string | null>(null);
  const [nviLoading, setNviLoading] = useState(false);
  const [nviResult, setNviResult] = useState<boolean | null>(null);

  const [ibanError, setIbanError] = useState<string | null>(null);
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

  const [contacts, setContacts] = useState<ContactPerson[]>([emptyContact()]);
  const [contactInfos, setContactInfos] = useState<ContactInfoItem[]>([emptyContactInfo()]);
  const [tagInput, setTagInput] = useState('');
  const [activeSection, setActiveSection] = useState(0);
  const [numericErrors, setNumericErrors] = useState<{ taxNumber?: string; identityNo?: string }>({});
  const [contactsOpen, setContactsOpen] = useState(false);

  // ── Split button kaydet modu ─────────────────────────────────────────────
  type SaveMode = 'close' | 'new' | 'detail';
  const [saveMode, setSaveMode] = useState<SaveMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('vendorSaveMode');
      if (stored === 'new' || stored === 'detail' || stored === 'close') return stored;
    }
    return 'close';
  });
  const [saveModeDropdownOpen, setSaveModeDropdownOpen] = useState(false);
  const saveModeDropdownRef = useRef<HTMLDivElement>(null);

  // ── Bekleyen evraklar (yeni kayıt formunda geçici) ────────────────────────
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [docSelectedTypeId, setDocSelectedTypeId] = useState('');
  const [docCustomType, setDocCustomType] = useState('');
  const [typeCustom, setTypeCustom] = useState('');
  const [documentTypes, setDocumentTypes] = useState<VendorDocumentTypeRow[]>([]);
  const [acilServiceBranches, setAcilServiceBranches] = useState<string[]>([]);
  const [serviceBranches, setServiceBranches] = useState<string[]>([]);
  const [customHasarKol, setCustomHasarKol] = useState('');
  const [customAcilKol, setCustomAcilKol] = useState('');
  const [typeActivityPicks, setTypeActivityPicks] = useState<string[]>([]);
  const [typeActivityCustom, setTypeActivityCustom] = useState('');
  const [typeActivityOtherOpen, setTypeActivityOtherOpen] = useState(false);
  const [hizmetKollariOpen, setHizmetKollariOpen] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
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
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        clearSelection(); load(); loadSummary();
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
    setGibError(null); setNviResult(null);
    setDuplicateConflicts({}); setShowDuplicateModal(false);
    setContacts([emptyContact()]); setContactInfos([emptyContactInfo()]);
    setTagInput(''); setActiveSection(0); setNumericErrors({}); setFieldErrors({}); setContactsOpen(false);
    setLocationCoords(null); setShowLocationPicker(false); setGeocodeMsg(null);
    setPendingDiscoveryLink(null);
    setPendingDocs([]); setDocSelectedTypeId(''); setDocCustomType(''); setTypeCustom(''); setServiceBranches([]); setCustomHasarKol(''); setCustomAcilKol(''); setTypeActivityPicks([]); setTypeActivityCustom(''); setTypeActivityOtherOpen(false); setHizmetKollariOpen(false); setIbanError(null);
  };

  const handleCategoryChange = (value: VendorCategory) => {
    setForm((p) => ({ ...p, category: value }));
    setDocSelectedTypeId('');
    setDocCustomType('');
    if (value === 'hasar') {
      setServiceBranches((p) => p.filter((x) => x !== HIZMET_KOLU_OTHER_KEY));
      setCustomAcilKol('');
    }
    if (value === 'acil') {
      setSelectedWorkGroupIds((p) => p.filter((x) => x !== HIZMET_KOLU_OTHER_KEY));
      setCustomHasarKol('');
    }
  };

  const toggleHasarWorkGroup = (id: string) => {
    if (id === HIZMET_KOLU_OTHER_KEY) {
      if (selectedWorkGroupIds.includes(HIZMET_KOLU_OTHER_KEY)) {
        setSelectedWorkGroupIds((p) => p.filter((x) => x !== HIZMET_KOLU_OTHER_KEY));
        setCustomHasarKol('');
      } else {
        setSelectedWorkGroupIds((p) => [...p, HIZMET_KOLU_OTHER_KEY]);
      }
      return;
    }
    setSelectedWorkGroupIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const toggleTypeActivityPick = (pick: string) => {
    setTypeActivityPicks((prev) => (prev.includes(pick) ? prev.filter((x) => x !== pick) : [...prev, pick]));
  };

  const applyServiceBranchFields = (
    branches: string[],
    acilPresets: string[],
    wgNames: string[],
    category: VendorCategory,
    hizmetMode: VendorTypeHizmetMode | null = null,
  ) => {
    const acilSet = new Set(acilPresets);
    const wgSet = new Set(wgNames);
    let orphan = branches.filter((s) => !acilSet.has(s) && !wgSet.has(s));
    const presetAcil = branches.filter((s) => acilSet.has(s));
    setServiceBranches(presetAcil);
    setCustomAcilKol('');
    setCustomHasarKol('');
    setTypeActivityPicks([]);
    setTypeActivityCustom('');
    setTypeActivityOtherOpen(false);

    const showsGrid = !!hizmetMode && vendorTypeShowsWorkGroupGrid(hizmetMode);

    if (showsGrid && vendorCategoryShowsAcilKollari(category) && orphan.length > 0) {
      setCustomAcilKol(orphan[0] ?? '');
      setServiceBranches([...presetAcil, HIZMET_KOLU_OTHER_KEY]);
      orphan = orphan.slice(1);
    }
    if (showsGrid && vendorCategoryShowsHasarKollari(category) && orphan.length > 0) {
      setCustomHasarKol(orphan[0] ?? '');
      setSelectedWorkGroupIds((prev) => [...prev.filter((id) => id !== HIZMET_KOLU_OTHER_KEY), HIZMET_KOLU_OTHER_KEY]);
      orphan = orphan.slice(1);
    }

    if (hizmetMode && !vendorTypeShowsWorkGroupGrid(hizmetMode) && orphan.length > 0) {
      const quickPicks = vendorTypeQuickPicks(hizmetMode);
      const matched: string[] = [];
      const customParts: string[] = [];
      for (const s of orphan) {
        const canonical = quickPicks.find((p) => p.toLocaleLowerCase('tr') === s.toLocaleLowerCase('tr'));
        if (canonical) matched.push(canonical);
        else customParts.push(s);
      }
      setTypeActivityPicks(matched);
      if (customParts.length) {
        setTypeActivityCustom(customParts.join(', '));
        setTypeActivityOtherOpen(true);
      }
    } else if (hizmetMode === 'taseron_grid' && orphan.length > 0) {
      setTypeActivityCustom(orphan.join(', '));
    }
  };

  const buildServiceBranchesPayload = () => {
    const merged = [...serviceBranches.filter((s) => acilServiceBranches.includes(s))];
    if (vendorCategoryShowsAcilKollari(form.category) && serviceBranches.includes(HIZMET_KOLU_OTHER_KEY) && customAcilKol.trim()) {
      merged.push(toTitleCaseTR(customAcilKol.trim()));
    }
    if (vendorCategoryShowsHasarKollari(form.category) && selectedWorkGroupIds.includes(HIZMET_KOLU_OTHER_KEY) && customHasarKol.trim()) {
      const hasarCustom = toTitleCaseTR(customHasarKol.trim());
      if (!merged.includes(hasarCustom)) merged.push(hasarCustom);
    }
    for (const pick of typeActivityPicks) {
      const note = toTitleCaseTR(pick.trim());
      if (note && !merged.includes(note)) merged.push(note);
    }
    if (typeActivityCustom.trim()) {
      const note = toTitleCaseTR(typeActivityCustom.trim());
      if (note && !merged.includes(note)) merged.push(note);
    }
    return [...new Set(merged)];
  };

  const toggleAcilServiceBranch = (name: string) => {
    if (name === HIZMET_KOLU_OTHER_KEY) {
      if (serviceBranches.includes(HIZMET_KOLU_OTHER_KEY)) {
        setServiceBranches((p) => p.filter((x) => x !== HIZMET_KOLU_OTHER_KEY));
        setCustomAcilKol('');
      } else {
        setServiceBranches((p) => [...p, HIZMET_KOLU_OTHER_KEY]);
      }
      return;
    }
    setServiceBranches((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));
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
      const list: string[] = r.data.data || [];
      const withOther = list.some((t) => isVendorTypeOther(t)) ? list : [...list, 'Diğer'];
      setVendorTypes(withOther);
    } catch {
      setVendorTypes(['Taşeron', 'Malzeme Tedarikçisi', 'Lojistik', 'Ekipman', 'Diğer']);
    }
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

  const loadSummary = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/vendors/summary`, { headers: authHeader() });
      const d = r.data.data ?? {};
      setSummary({
        total: d.total ?? 0,
        activeCount: d.activeCount ?? 0,
        corporateCount: d.corporateCount ?? 0,
      });
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
    } catch (e) {
      console.error(e);
      showToast('error', 'Tedarikçi listesi yüklenemedi. Mevcut kayıtlar korundu — tekrar deneyin.');
    } finally { setLoading(false); }
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

  const loadDocumentTypes = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/document-types`, {
        params: { status: 'active', entityScope: 'vendor' },
        headers: authHeader(),
      });
      setDocumentTypes(r.data.data ?? []);
    } catch {
      setDocumentTypes([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadProvinces(); loadWorkGroups(); loadVendorTypes(); loadDocumentTypes(); }, [loadProvinces, loadWorkGroups, loadVendorTypes, loadDocumentTypes]);

  useEffect(() => {
    setBranchesLoading(true);
    axios.get(`${API}/service-branches?type=acil_yardim&scope=vendor`, { headers: authHeader() })
      .then((r) => {
        const names = (r.data.data ?? []).map((b: { name: string }) => b.name as string);
        setAcilServiceBranches(names);
      })
      .catch(() => setAcilServiceBranches([]))
      .finally(() => setBranchesLoading(false));
  }, []);

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
      if (wgFilterRef.current && !wgFilterRef.current.contains(e.target as Node)) setWgFilterOpen(false);
      if (saveModeDropdownRef.current && !saveModeDropdownRef.current.contains(e.target as Node)) {
        setSaveModeDropdownOpen(false);
      }
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
        setDuplicateConflicts((p) => ({ ...p, phone: msg }));
        showToast('warning', msg);
      } else {
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
        setDuplicateConflicts((p) => ({ ...p, email: msg }));
        showToast('warning', msg);
      } else {
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
    if (districtId) {
      setServiceAreas((p) =>
        toggleDistrictArea(p, provinceId, districtId, serviceDistricts, selectedProvince?.name),
      );
      return;
    }
    const key = `${provinceId}:`;
    const exists = serviceAreas.some((sa) => !sa.districtId && `${sa.provinceId}:` === key);
    if (exists) setServiceAreas((p) => p.filter((sa) => sa.districtId || `${sa.provinceId}:` !== key));
    else setServiceAreas((p) => [...p, { provinceId, districtId: null }]);
  };

  const addAllDistrictsForProvince = (prov: Province) => {
    if (serviceDistricts.length === 0) return;
    setServiceAreas((p) => addAllDistrictsInProvince(p, prov.id, serviceDistricts, prov.name));
  };

  const handleAddVendorType = async () => {
    const t = newTypeName.trim();
    if (!t || vendorTypes.includes(t)) return;
    setSavingType(true);
    try {
      const updated = [...vendorTypes, t];
      await axios.put(`${API}/system-settings/vendor-types`, { types: updated }, { headers: authHeader() });
      setVendorTypes(updated); setNewTypeName(''); setShowAddType(false);
      showToast('success', `"${t}" türü eklendi`);
    } catch (e: any) { showToast('error', e?.response?.data?.message ?? 'Tür eklenemedi'); } finally { setSavingType(false); }
  };

  const openCreate = () => { setEditVendor(null); resetForm(); setShowModal(true); };

  const handleDiscoveryAddAsVendor = async (
    candidate: ExternalVendorCandidate,
    context: VendorDiscoverySearchContext,
  ) => {
    setShowDiscoveryPanel(false);
    try {
      const r = await axios.post(
        `${API}/vendor-discovery/import`,
        {
          externalId: candidate.externalId,
          sessionId: context.sessionId,
          candidate,
          city: context.city,
          district: context.districts?.length ? context.districts.join(', ') : undefined,
          serviceType: context.serviceType,
          minRating: Number(context.minRating),
        },
        { headers: authHeader() },
      );

      const prefill = r.data.data?.prefill;
      if (!prefill) {
        showToast('error', 'Aday bilgileri alınamadı.');
        return;
      }

      resetForm();
      setEditVendor(null);

      if (context.sessionId) {
        setPendingDiscoveryLink({ sessionId: context.sessionId, externalId: candidate.externalId });
      } else {
        setPendingDiscoveryLink(null);
      }

      const matchedProv = STATIC_PROVINCES.find(
        (p) => p.name.localeCompare(prefill.city ?? '', 'tr', { sensitivity: 'base' }) === 0,
      );

      setForm({
        ...emptyForm(),
        entityType: 'corporate',
        name: prefill.name ?? '',
        cityCode: matchedProv?.code ?? '',
        city: prefill.city ?? '',
        district: prefill.district ?? '',
        address: prefill.address ?? '',
        notes: prefill.notes ?? '',
        category: 'hasar',
      });

      if (prefill.phone) {
        setContactInfos([{ type: 'phone', value: prefill.phone, label: 'general' }]);
      }

      if (prefill.latitude != null && prefill.longitude != null) {
        setLocationCoords({ lat: prefill.latitude, lng: prefill.longitude });
      }

      setShowModal(true);
      showToast('success', `"${prefill.name}" tedarikçi formuna aktarıldı. Bilgileri kontrol edip kaydedin.`);
    } catch (e: any) {
      showToast('error', e?.response?.data?.message ?? 'Aday tedarikçi formuna aktarılamadı.');
    }
  };

  const openEdit = async (v: any) => {
    setEditVendor(v);
    const matchedProv = STATIC_PROVINCES.find((p) => p.name === v.city);
    const rawType = v.type ?? '';
    const typeIsPreset = !rawType || vendorTypes.includes(rawType);
    setTypeCustom(typeIsPreset ? '' : rawType);
    const loadEffectiveType = typeIsPreset ? rawType : rawType;
    const loadHizmetMode = loadEffectiveType ? resolveVendorTypeHizmetMode(loadEffectiveType) : null;
    const loadCategory = (['hasar', 'acil', 'her_ikisi'].includes(v.category) ? v.category : 'hasar') as VendorCategory;
    setForm({
      entityType: (v.entityType as 'corporate' | 'individual') || 'corporate',
      name: v.name,
      type: typeIsPreset ? rawType : 'Diğer',
      taxNumber: v.taxNumber ?? '',
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
      category: loadCategory,
    });
    applyServiceBranchFields(
      Array.isArray(v.serviceBranches) ? v.serviceBranches : [],
      acilServiceBranches,
      workGroups.map((wg) => wg.name),
      loadCategory,
      loadHizmetMode,
    );
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
      applyServiceBranchFields(
        Array.isArray(full.serviceBranches) ? full.serviceBranches : [],
        acilServiceBranches,
        (full.vendorWorkGroups || []).map((vwg: { workGroup?: { name?: string } }) => vwg.workGroup?.name ?? '').filter(Boolean),
        (['hasar', 'acil', 'her_ikisi'].includes(full.category) ? full.category : 'hasar') as VendorCategory,
        full.type ? resolveVendorTypeHizmetMode(full.type) : null,
      );
      setContacts(full.contacts?.length ? full.contacts.map((c: Record<string, unknown>) => mapVendorContactFromApi(c)) : [emptyContact()]);
      setContactInfos(full.contactInfos?.length ? full.contactInfos.map((ci: any) => ({ id: ci.id, type: ci.type ?? 'phone', value: ci.value ?? '', label: ci.label ?? 'general' })) : [emptyContactInfo()]);
    } catch { setContacts([emptyContact()]); setContactInfos([emptyContactInfo()]); }
    setHizmetKollariOpen(
      (v.vendorWorkGroups?.length ?? 0) > 0
      || (Array.isArray(v.serviceBranches) && v.serviceBranches.length > 0),
    );
    setSelectedProvince(null); setServiceDistricts([]); setActiveSection(0); setShowModal(true);
  };

  const handleSave = async (overrideSaveMode?: SaveMode) => {
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

    if (isVendorTypeOther(form.type) && !typeCustom.trim()) {
      showToast('warning', 'Tedarikçi türü "Diğer" seçildiğinde lütfen tür açıklamasını girin.');
      setActiveSection(0);
      return;
    }

    const saveEffectiveType = isVendorTypeOther(form.type) ? typeCustom.trim() || form.type : form.type;
    const saveHizmetMode = form.type ? resolveVendorTypeHizmetMode(saveEffectiveType) : null;
    if (saveHizmetMode && !vendorTypeShowsWorkGroupGrid(saveHizmetMode) && typeActivityPicks.length === 0 && !typeActivityCustom.trim()) {
      showToast('warning', `${vendorTypeActivityLabel(saveHizmetMode, saveEffectiveType)} alanını doldurun.`);
      setActiveSection(0);
      setHizmetKollariOpen(true);
      return;
    }

    if (selectedWorkGroupIds.includes(HIZMET_KOLU_OTHER_KEY) && !customHasarKol.trim()) {
      showToast('warning', 'Hasar hizmet kolunda "Diğer" seçildiğinde lütfen açıklamayı girin.');
      setActiveSection(0);
      return;
    }
    if (serviceBranches.includes(HIZMET_KOLU_OTHER_KEY) && !customAcilKol.trim()) {
      showToast('warning', 'Acil hizmet kolunda "Diğer" seçildiğinde lütfen açıklamayı girin.');
      setActiveSection(0);
      return;
    }

    // Çakışma varsa onay modalı göster
    if (Object.keys(duplicateConflicts).length > 0) {
      setShowDuplicateModal(true);
      return;
    }

    await doSave(overrideSaveMode ?? saveMode);
  };

  const doSave = async (effectiveSaveMode: SaveMode = saveMode) => {
    setShowDuplicateModal(false);
    setFieldErrors({});
    setSaving(true);
    const wasEdit = !!editVendor;
    try {
      const payload: any = {
        entityType: form.entityType, name: form.name,
        type: isVendorTypeOther(form.type)
          ? toTitleCaseTR(typeCustom.trim())
          : (form.type ? toTitleCaseTR(form.type) : undefined),
        category: form.category,
        address: form.address || null, city: form.city || null, district: form.district || null,
        neighborhood: form.neighborhood || null, streetName: form.streetName || null,
        buildingNo: form.buildingNo || null, doorNo: form.doorNo || null,
        latitude: locationCoords?.lat ?? null, longitude: locationCoords?.lng ?? null,
        iban: form.iban || null, bankName: form.bankName || null,
        referral: form.referral || null, tags: form.tags, notes: form.notes || null,
        contractStartDate: form.contractStartDate ? new Date(form.contractStartDate).toISOString() : null,
        contractEndDate: form.contractEndDate ? new Date(form.contractEndDate).toISOString() : null,
        contractNotes: form.contractNotes || null,
        serviceAreas, workGroupIds: selectedWorkGroupIds.filter((id) => id !== HIZMET_KOLU_OTHER_KEY),
        serviceBranches: buildServiceBranchesPayload(),
        contacts: contacts.filter((c) => c.firstName.trim() || c.lastName.trim()).map(mapContactToPayload),
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
      let savedVendorId: string | undefined = editVendor?.id;
      if (editVendor) {
        await axios.patch(`${API}/vendors/${editVendor.id}`, payload, { headers: authHeader() });
        // Upload pending docs for existing vendor
        if (pendingDocs.length > 0) {
          await Promise.allSettled(pendingDocs.map(async (pd) => {
            if (!pd.documentTypeId) return;
            const fd = new FormData();
            fd.append('file', pd.file);
            fd.append('documentTypeId', pd.documentTypeId);
            if (pd.customLabel) fd.append('customLabel', pd.customLabel);
            await axios.post(`${API}/vendors/${editVendor.id}/documents`, fd, {
              headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
            });
          }));
        }
      } else {
        const res = await axios.post(`${API}/vendors`, payload, { headers: authHeader() });
        savedVendorId = res.data.data?.id;
        // Upload pending docs for newly created vendor
        if (savedVendorId && pendingDocs.length > 0) {
          await Promise.allSettled(pendingDocs.map(async (pd) => {
            if (!pd.documentTypeId) return;
            const fd = new FormData();
            fd.append('file', pd.file);
            fd.append('documentTypeId', pd.documentTypeId);
            if (pd.customLabel) fd.append('customLabel', pd.customLabel);
            await axios.post(`${API}/vendors/${savedVendorId}/documents`, fd, {
              headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
            });
          }));
        }
      }

      if (!wasEdit && savedVendorId && pendingDiscoveryLink) {
        try {
          await axios.post(
            `${API}/vendor-discovery/link-import`,
            { ...pendingDiscoveryLink, vendorId: savedVendorId },
            { headers: authHeader() },
          );
        } catch {
          /* bağlama başarısız — tedarikçi kaydı yine de oluştu */
        }
        setPendingDiscoveryLink(null);
      }

      load();
      loadSummary();

      const successMsg = wasEdit ? 'Tedarikçi başarıyla güncellendi' : 'Tedarikçi başarıyla eklendi';
      if (effectiveSaveMode === 'close') {
        setShowModal(false);
        setEditVendor(null);
        resetForm();
        showToast('success', successMsg);
      } else if (effectiveSaveMode === 'new') {
        setEditVendor(null);
        resetForm();
        setShowModal(true);
        showToast('success', wasEdit ? 'Güncellendi — yeni tedarikçi formuna geçildi' : 'Eklendi — yeni tedarikçi formu açıldı');
      } else if (effectiveSaveMode === 'detail' && savedVendorId) {
        setShowModal(false);
        setEditVendor(null);
        resetForm();
        showToast('success', `${successMsg} — detay sayfasına yönlendiriliyor`);
        router.push(`/panel/tedarikciler/${savedVendorId}`);
      } else {
        setShowModal(false);
        setEditVendor(null);
        resetForm();
        showToast('success', successMsg);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Bilinmeyen bir hata oluştu';
      showToast('error', `İşlem başarısız: ${msg}`);
    } finally { setSaving(false); }
  };

  const requestDelete = (id: string, name: string) => {
    setRowMenuId(null);
    setDeleteError(null);
    setDeleteTarget({ id, name });
  };

  const runDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await axios.delete(`${API}/vendors/${deleteTarget.id}`, { headers: authHeader() });
      showToast('success', 'Tedarikçi silindi');
      setDeleteTarget(null);
      load();
      loadSummary();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Silme işlemi başarısız';
      setDeleteError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggleStatus = async (v: any) => {
    try { await axios.patch(`${API}/vendors/${v.id}`, { status: v.status === 'active' ? 'passive' : 'active' }, { headers: authHeader() }); load(); loadSummary(); } catch (e) { console.error(e); }
  };

  const upC = (i: number, f: keyof ContactPerson, v: string) => setContacts((p) => p.map((c, j) => j === i ? { ...c, [f]: v } : c));
  const upContact = (i: number, patch: Partial<ContactPerson>) => setContacts((p) => p.map((c, j) => j === i ? { ...c, ...patch } : c));
  const addTag = () => { const t = tagInput.trim(); if (t && !form.tags.includes(t)) setForm((p) => ({ ...p, tags: [...p.tags, t] })); setTagInput(''); };

  const handleIbanChange = (raw: string) => {
    setForm((p) => ({ ...p, iban: raw }));
    const compact = raw.replace(/\s/g, '').toUpperCase();
    if (compact.length === 0) {
      setIbanError(null);
      return;
    }
    if (compact.length === 26) {
      const result = validateIBAN(compact);
      if (result.valid) {
        setIbanError(null);
        if (result.bankName) {
          setForm((p) => ({ ...p, iban: raw, bankName: result.bankName ?? p.bankName }));
        }
      } else {
        setIbanError(result.error ?? 'Geçersiz IBAN');
      }
    } else {
      setIbanError(null);
    }
  };

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
  const MODAL_SECTIONS = [...VENDOR_FORM_SECTIONS];

  const provinceOptions = useMemo(
    () => provinces.map((p) => ({ value: p.id, label: p.name })),
    [provinces],
  );

  const scopedDocumentTypes = useMemo(
    () => filterDocumentTypesForCategory(documentTypes, form.category),
    [documentTypes, form.category],
  );

  const otherDocumentTypeId = scopedDocumentTypes.find((dt) => isOtherDocumentTypeName(dt.name))?.id ?? null;
  const vendorAddressLabel = formatVendorAddress(form);
  const docOtherSelected = docSelectedTypeId === VENDOR_DOC_OTHER_SELECT
    || isOtherDocumentTypeName(scopedDocumentTypes.find((dt) => dt.id === docSelectedTypeId)?.name ?? '');

  const effectiveVendorType = isVendorTypeOther(form.type) ? typeCustom.trim() || form.type : form.type;
  const hizmetMode = form.type ? resolveVendorTypeHizmetMode(effectiveVendorType) : null;
  const showHasarGrid = !!hizmetMode && vendorTypeShowsWorkGroupGrid(hizmetMode) && vendorCategoryShowsHasarKollari(form.category);
  const showAcilGrid = !!hizmetMode && vendorTypeShowsWorkGroupGrid(hizmetMode) && vendorCategoryShowsAcilKollari(form.category);

  const selectedHizmetKolCount =
    selectedWorkGroupIds.filter((id) => id !== HIZMET_KOLU_OTHER_KEY).length
    + serviceBranches.filter((s) => s !== HIZMET_KOLU_OTHER_KEY).length
    + (selectedWorkGroupIds.includes(HIZMET_KOLU_OTHER_KEY) && customHasarKol.trim() ? 1 : 0)
    + (serviceBranches.includes(HIZMET_KOLU_OTHER_KEY) && customAcilKol.trim() ? 1 : 0)
    + (hizmetMode && !vendorTypeShowsWorkGroupGrid(hizmetMode)
      ? typeActivityPicks.length + (typeActivityCustom.trim() ? 1 : 0)
      : (hizmetMode === 'taseron_grid' && typeActivityCustom.trim() ? 1 : 0));

  return (
    <TableColumnsProvider value={tableColumns}>
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Tedarikçiler</span>
      </nav>

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
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowDiscoveryPanel(true)} className="btn-secondary">
            Dış Kaynakta Ara
          </button>
          <button type="button" onClick={openCreate} className="btn-primary">
            {Icon.plus} Yeni Tedarikçi
          </button>
        </div>
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
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card px-4 py-2.5 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-400 tracking-wide leading-none">Toplam</p>
              <p className="text-base font-bold text-slate-800 leading-tight tabular-nums">{summary.total}</p>
            </div>
          </div>
          <div className="w-px h-7 bg-slate-100 flex-shrink-0" />
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-400 tracking-wide leading-none">Aktif</p>
              <p className="text-base font-bold text-emerald-700 leading-tight tabular-nums">{summary.activeCount}</p>
            </div>
          </div>
          <div className="w-px h-7 bg-slate-100 flex-shrink-0" />
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-400 tracking-wide leading-none">Kurumsal</p>
              <p className="text-base font-bold text-indigo-700 leading-tight tabular-nums">{summary.corporateCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card px-3 py-2.5 mb-5">
        <div className="panel-filter-bar">
          <div className="panel-filter-search-wrap">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              autoComplete="off"
              placeholder="Ad, Telefon, Vergi No..."
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

          <select className="panel-filter-control" value={entityTypeFilter} onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1); }}>
            <option value="">Tüm Tipler</option>
            <option value="individual">Bireysel</option>
            <option value="corporate">Kurumsal</option>
          </select>

          <select className="panel-filter-control" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
          </select>

          {vendorTypes.length > 0 && (
            <select className="panel-filter-control" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">Tüm Türler</option>
              {vendorTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}

          {workGroups.length > 0 && (
            <div className="relative flex-[1_1_calc(50%-0.25rem)] sm:flex-[0_0_8.75rem] min-w-[7.25rem]" ref={wgFilterRef}>
              <button
                type="button"
                onClick={() => setWgFilterOpen((o) => !o)}
                className={`flex items-center gap-1.5 panel-filter-control w-full ${
                  selectedWorkGroupIds_filter.length ? 'border-blue-400 bg-blue-50 text-blue-700' : ''
                }`}
              >
                {Icon.briefcase}
                <span className="truncate min-w-0">Faaliyet{selectedWorkGroupIds_filter.length > 0 && ` (${selectedWorkGroupIds_filter.length})`}</span>
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

          <select className="panel-filter-control" value={serviceRegionFilter} onChange={(e) => { setServiceRegionFilter(e.target.value); setPage(1); }}>
            <option value="">Tüm Bölgeler</option>
            {STATIC_PROVINCES.map((p) => (
              <option key={p.code} value={p.name}>{p.name}</option>
            ))}
          </select>

          <div className="flex-shrink-0 sm:ml-auto">
            <PanelTableColumnPicker tableColumns={tableColumns} />
          </div>
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

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => { if (!deleteLoading) { setDeleteTarget(null); setDeleteError(null); } }}
        onConfirm={runDeleteConfirm}
        deleting={deleteLoading}
        itemName={deleteTarget?.name}
        title="Tedarikçiyi Sil"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" tedarikçisi kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?`
            : undefined
        }
        error={deleteError ?? undefined}
      />

      {/* ── Table ── */}
      {loading ? (
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head-row">
                <tr>
                  <th className="table-th">İsim / Firma</th>
                  <th className="table-th">Branş</th>
                  <th className="table-th">Telefon</th>
                  <th className="table-th">Şehir</th>
                  <th className="table-th">Durum</th>
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
            <table className="w-full text-sm" style={panelTableLayoutStyle(tableColumns)}>
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
                  <PanelTableTh colId="name" className="table-th">Tedarikçi</PanelTableTh>
                  <PanelTableTh colId="type" className="table-th-center">Tür / Tip</PanelTableTh>
                  <PanelTableTh colId="contact" className="table-th">İletişim</PanelTableTh>
                  <PanelTableTh colId="location" className="table-th">Konum</PanelTableTh>
                  <PanelTableTh colId="jobCount" className="table-th-center">İş Sayısı</PanelTableTh>
                  <PanelTableTh colId="lastJob" className="table-th-center">Son İş</PanelTableTh>
                  <PanelTableTh colId="contractEnd" className="table-th-center">Sözleşme Bitiş</PanelTableTh>
                  <PanelTableTh colId="status" className="table-th-center">Durum</PanelTableTh>
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
                  <PanelTableTd colId="name" className="table-td">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${v.entityType === 'individual' ? 'bg-purple-500' : 'bg-indigo-600'}`}>
                        {v.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <Link href={`/panel/tedarikciler/${v.id}`} className="font-semibold text-slate-800 hover:text-blue-600 transition-colors">{v.name}</Link>
                        {v.type && <p className="text-xs text-slate-400 mt-0.5">{formatVendorTypeLabel(v.type)}</p>}
                      </div>
                    </div>
                  </PanelTableTd>
                  <PanelTableTd colId="type" className="table-td-center">
                    <div className="flex justify-center">
                      <span className={`inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${v.entityType === 'individual' ? 'bg-purple-50 text-purple-700' : 'bg-indigo-50 text-indigo-700'}`}>
                        {v.entityType === 'individual' ? Icon.user : Icon.building}
                        {v.entityType === 'individual' ? 'Bireysel' : 'Kurumsal'}
                      </span>
                    </div>
                  </PanelTableTd>
                  <PanelTableTd colId="contact" className="table-td">
                    <div className="space-y-1">
                      {v.email && (
                        <p className="text-xs text-slate-600 flex items-center gap-1.5">{Icon.mail}{v.email}</p>
                      )}
                      {v.phone && (
                        <PhoneContactActions phone={v.phone} variant="inline" accent="indigo" size="sm" />
                      )}
                      {!v.email && !v.phone && <span className="text-xs text-slate-300">—</span>}
                    </div>
                  </PanelTableTd>
                  <PanelTableTd colId="location" className="table-td">
                    {v.city ? (
                      <p className="text-xs text-slate-600 flex items-center gap-1">{Icon.mapPin}{v.city}{v.district ? ` / ${v.district}` : ''}</p>
                    ) : <span className="text-xs text-slate-300">—</span>}
                  </PanelTableTd>
                  <PanelTableTd colId="jobCount" className="table-td-center">
                    {(v._count?.costEntries ?? 0) > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                        {v._count.costEntries}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </PanelTableTd>
                  <PanelTableTd colId="lastJob" className="table-td-center">
                    {v.lastJobDate ? (
                      <span className="text-xs text-slate-500 whitespace-nowrap" title={new Date(v.lastJobDate).toLocaleDateString('tr-TR')}>
                        {relativeTime(v.lastJobDate)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </PanelTableTd>
                  <PanelTableTd colId="contractEnd" className="table-td-center">
                    {v.contractEndDate ? (() => {
                      const days = contractDaysLeft(v.contractEndDate);
                      const display = isoToDisplayContract(v.contractEndDate);
                      if (days !== null && days < 0) {
                        return <span className="inline-flex text-xs font-medium text-red-600 bg-red-50 rounded-full px-2 py-0.5 border border-red-200 whitespace-nowrap">{display}</span>;
                      }
                      if (days !== null && days <= 30) {
                        return <span className="inline-flex text-xs font-medium text-orange-600 bg-orange-50 rounded-full px-2 py-0.5 border border-orange-200 whitespace-nowrap">{display}</span>;
                      }
                      return <span className="text-xs text-slate-600 whitespace-nowrap">{display}</span>;
                    })() : <span className="text-xs text-slate-300">—</span>}
                  </PanelTableTd>
                  <PanelTableTd colId="status" className="table-td-center">
                    <button type="button" onClick={() => handleToggleStatus(v)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${v.status === 'active' ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${v.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`} />
                      {v.status === 'active' ? 'Aktif' : 'Pasif'}
                    </button>
                  </PanelTableTd>
                  <td className="table-td">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Link
                        href={`/panel/tedarikciler/${v.id}`}
                        className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                      >
                        Detay
                      </Link>
                      <VendorRowActionsMenu
                        isOpen={rowMenuId === v.id}
                        onToggle={() => setRowMenuId((cur) => (cur === v.id ? null : v.id))}
                        onClose={() => setRowMenuId(null)}
                        onEdit={() => openEdit(v)}
                        onDelete={() => requestDelete(v.id, v.name)}
                      />
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

      {/* ── Tedarikçi Formu (Sağ Drawer) ── */}
      <SlidePanel open={showModal} onClose={() => setShowModal(false)} width={640} scrollContent={false}>
        <div className="flex flex-col h-full min-h-0">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-indigo-500/30 bg-gradient-to-r from-indigo-600 to-indigo-700 flex-shrink-0">
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

            <div className="flex-1 overflow-y-auto p-6">
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
                      <select
                        className={inp}
                        value={form.type}
                        onChange={(e) => {
                          const next = e.target.value;
                          const prevEffective = isVendorTypeOther(form.type)
                            ? typeCustom.trim() || form.type
                            : form.type;
                          const nextEffective = isVendorTypeOther(next) ? typeCustom.trim() || next : next;
                          const prevMode = prevEffective ? resolveVendorTypeHizmetMode(prevEffective) : null;
                          const nextMode = nextEffective ? resolveVendorTypeHizmetMode(nextEffective) : null;
                          setForm((p) => ({ ...p, type: next }));
                          if (!isVendorTypeOther(next)) setTypeCustom('');
                          if (nextMode !== prevMode) {
                            setSelectedWorkGroupIds([]);
                            setCustomHasarKol('');
                            setServiceBranches([]);
                            setCustomAcilKol('');
                            setTypeActivityPicks([]);
                            setTypeActivityCustom('');
                            setTypeActivityOtherOpen(false);
                          }
                          if (next) setHizmetKollariOpen(true);
                        }}
                      >
                        <option value="">Tür Seçin...</option>
                        {vendorTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {isVendorTypeOther(form.type) && (
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-slate-500 mb-1.5">
                            Tür açıklaması <span className="text-red-400">*</span>
                          </label>
                          <input
                            className={inp}
                            placeholder="Tür açıklamasını yazın..."
                            value={typeCustom}
                            onChange={(e) => setTypeCustom(e.target.value)}
                          />
                        </div>
                      )}
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

                  {form.type && hizmetMode && (
                  <div className="mb-6 rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setHizmetKollariOpen((o) => !o)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                        <span className="text-indigo-600 flex-shrink-0">{Icon.briefcase}</span>
                        <span className="text-sm font-semibold text-slate-800">Tedarikçi Hizmet Kolları</span>
                        <span className="text-[10px] font-semibold tracking-wide bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {vendorTypeModeBadge(hizmetMode)}
                        </span>
                        {selectedHizmetKolCount > 0 && (
                          <span className="text-[11px] font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full flex-shrink-0">
                            {selectedHizmetKolCount} seçili
                          </span>
                        )}
                      </div>
                      <svg
                        className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${hizmetKollariOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {hizmetKollariOpen && (
                      <div key={hizmetMode} className="px-4 pb-4 border-t border-slate-100">
                            <p className="text-xs text-slate-500 mt-3 mb-3">
                              {vendorTypeSectionHint(hizmetMode, effectiveVendorType)}
                            </p>

                            <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-2.5">
                              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                {vendorTypeActivityLabel(hizmetMode, effectiveVendorType)}
                                {hizmetMode !== 'taseron_grid' && <span className="text-red-400"> *</span>}
                                {hizmetMode === 'taseron_grid' && (
                                  <span className="text-slate-400 font-normal"> (isteğe bağlı)</span>
                                )}
                              </label>

                              {vendorTypeQuickPicks(hizmetMode).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                  {vendorTypeQuickPicks(hizmetMode).map((pick) => (
                                    <button
                                      key={pick}
                                      type="button"
                                      onClick={() => toggleTypeActivityPick(pick)}
                                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                                        typeActivityPicks.includes(pick)
                                          ? 'border-indigo-400 bg-white text-indigo-700 font-medium'
                                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                      }`}
                                    >
                                      {pick}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => setTypeActivityOtherOpen((o) => !o)}
                                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                                      typeActivityOtherOpen
                                        ? 'border-indigo-400 bg-white text-indigo-700 font-medium'
                                        : 'border-dashed border-slate-200 text-slate-500 hover:border-slate-300'
                                    }`}
                                  >
                                    Diğer
                                  </button>
                                </div>
                              )}

                              {(hizmetMode === 'taseron_grid' || typeActivityOtherOpen || vendorTypeQuickPicks(hizmetMode).length === 0) && (
                                <input
                                  type="text"
                                  className={`${inp} text-xs`}
                                  placeholder={vendorTypeActivityPlaceholder(effectiveVendorType)}
                                  value={typeActivityCustom}
                                  onChange={(e) => setTypeActivityCustom(e.target.value)}
                                  onBlur={(e) => {
                                    const v = toTitleCaseTR(e.target.value.trim());
                                    if (v) setTypeActivityCustom(v);
                                  }}
                                />
                              )}

                              {typeActivityPicks.length > 0 && (
                                <p className="text-[11px] text-indigo-600 mt-2">
                                  {typeActivityPicks.length} grup seçildi
                                </p>
                              )}
                            </div>

                            {showHasarGrid && (
                              <HizmetKoluGrid
                                title="Hasar Onarım — Tedarikçi Hizmet Kolları"
                                items={workGroups.map((wg) => ({ key: wg.id, label: wg.name }))}
                                selectedKeys={selectedWorkGroupIds}
                                onToggle={toggleHasarWorkGroup}
                                onSelectAll={(all) => setSelectedWorkGroupIds(all ? workGroups.map((wg) => wg.id) : [])}
                                emptyMessage="Hasar hizmet kolu bulunamadı. Ayarlar → Tedarikçi Hizmet Kolları → Hasar sekmesinden tanımlayın."
                                accent="blue"
                                customOther={customHasarKol}
                                onCustomOtherChange={setCustomHasarKol}
                              />
                            )}
                            {showAcilGrid && (
                              <HizmetKoluGrid
                                title="Acil Yardım — Tedarikçi Hizmet Kolları"
                                items={acilServiceBranches.map((name) => ({ key: name, label: name }))}
                                selectedKeys={serviceBranches}
                                onToggle={toggleAcilServiceBranch}
                                onSelectAll={(all) => setServiceBranches(all ? [...acilServiceBranches] : [])}
                                loading={branchesLoading}
                                emptyMessage="Acil hizmet kolu bulunamadı. Ayarlar → Tedarikçi Hizmet Kolları → Acil sekmesinden ekleyin."
                                accent="orange"
                                customOther={customAcilKol}
                                onCustomOtherChange={setCustomAcilKol}
                              />
                            )}

                            {!vendorTypeShowsWorkGroupGrid(hizmetMode) && (
                              <p className="text-[11px] text-slate-400 mt-1">
                                Bu tür için usta/iş kolu listesi gösterilmez.
                              </p>
                            )}
                      </div>
                    )}
                  </div>
                  )}

                  <SectionDivider icon={Icon.briefcase} title="Hizmet Kategorisi" />
                  <div className="grid grid-cols-3 gap-2 mb-6">
                    {VENDOR_CATEGORIES.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleCategoryChange(value)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-medium border-2 transition-all text-center ${
                          form.category === value
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

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
                        <div className="col-span-2">
                        <FormField label="Vergi No">
                          <div className="flex gap-2">
                            <input className={`flex-1 border rounded-lg px-3 py-2 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${numericErrors.taxNumber ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                              placeholder="10 Haneli VKN" maxLength={10} value={form.taxNumber}
                              onChange={(e) => handleNumericChange('taxNumber', e.target.value)} />
                            <button type="button" onClick={handleGibQuery} disabled={gibLoading || !form.taxNumber}
                              className="bg-indigo-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap h-[38px]">
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
                        </div>
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
                                  <span className="text-xs font-semibold text-slate-500">{contactDisplayLabel(c, idx, 'individual')}</span>
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
                                  <div className="col-span-2">
                                  <FormField label="Telefon">
                                    <ContactPhoneField
                                      phone={c.phone}
                                      phoneType={c.phoneType}
                                      extensionNo={c.extensionNo}
                                      onPhoneChange={(v) => upC(idx, 'phone', v)}
                                      onPhoneTypeChange={(t) => upContact(idx, { phoneType: t, extensionNo: '' })}
                                      onExtensionChange={(v) => upC(idx, 'extensionNo', v)}
                                      onPhoneBlur={idx === 0 ? (v) => {
                                        const digits = v.replace(/\D/g, '');
                                        if (digits.length >= 10) handlePhoneDuplicateCheck(digits);
                                      } : undefined}
                                    />
                                  </FormField>
                                  </div>
                                  <FormField label="E-posta">
                                    <input type="email" className={inp} placeholder="ornek@mail.com" value={c.email}
                                      onChange={(e) => upC(idx, 'email', e.target.value)}
                                      onBlur={() => { if (idx === 0 && c.email.trim()) handleEmailDuplicateCheck(c.email.trim()); }}
                                    />
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
                              <span className="text-xs font-semibold text-slate-500">{contactDisplayLabel(c, idx, 'corporate')}</span>
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
                              <div className="col-span-2">
                              <FormField label="Telefon">
                                <ContactPhoneField
                                  phone={c.phone}
                                  phoneType={c.phoneType}
                                  extensionNo={c.extensionNo}
                                  onPhoneChange={(v) => upC(idx, 'phone', v)}
                                  onPhoneTypeChange={(t) => upContact(idx, { phoneType: t, extensionNo: '' })}
                                  onExtensionChange={(v) => upC(idx, 'extensionNo', v)}
                                  onPhoneBlur={idx === 0 ? (v) => {
                                    const digits = v.replace(/\D/g, '');
                                    if (digits.length >= 10) handlePhoneDuplicateCheck(digits);
                                  } : undefined}
                                />
                              </FormField>
                              </div>
                              <FormField label="E-posta">
                                <input type="email" className={inp} placeholder="ornek@sirket.com" value={c.email}
                                  onChange={(e) => upC(idx, 'email', e.target.value)}
                                  onBlur={() => { if (idx === 0 && c.email.trim()) handleEmailDuplicateCheck(c.email.trim()); }}
                                />
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

              {/* ── Section 2: Adres & Hizmet ── */}
              {activeSection === 2 && (
                <div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
                  <SectionDivider icon={Icon.mapPin} title="Adres Bilgileri" />
                  <div className="grid grid-cols-2 gap-4 mb-2">
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
                    <FormField label={ADDRESS_FIELD.district}>
                      <select className={inp} value={form.district} disabled={!form.cityCode}
                        onChange={(e) => setForm((p) => ({ ...p, district: e.target.value, neighborhood: '' }))}>
                        <option value="">{ADDRESS_FIELD.districtPlaceholder}</option>
                        {(form.cityCode ? (STATIC_DISTRICTS[form.cityCode] ?? []) : []).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </FormField>
                    <div className="col-span-2">
                      <FormField label={ADDRESS_FIELD.neighborhood}>
                        <NeighborhoodSelect
                          provinceName={form.city}
                          districtName={form.district}
                          value={form.neighborhood}
                          onChange={(v) => setForm((p) => ({ ...p, neighborhood: v }))}
                          inputClassName={inp}
                        />
                      </FormField>
                    </div>
                    <FormField label={ADDRESS_FIELD.street}>
                      <input className={inp} placeholder={ADDRESS_FIELD.streetPlaceholder}
                        value={form.streetName}
                        onChange={(e) => setForm((p) => ({ ...p, streetName: e.target.value }))}
                        onBlur={(e) => {
                          const v = toTitleCaseTR(e.target.value.trim());
                          if (v) setForm((p) => ({ ...p, streetName: v }));
                        }} />
                    </FormField>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label={ADDRESS_FIELD.buildingNo}>
                        <input className={inp} placeholder={ADDRESS_FIELD.buildingNoPlaceholder}
                          value={form.buildingNo}
                          onChange={(e) => setForm((p) => ({ ...p, buildingNo: e.target.value }))} />
                      </FormField>
                      <FormField label={ADDRESS_FIELD.doorNo}>
                        <input className={inp} placeholder={ADDRESS_FIELD.doorNoPlaceholder}
                          value={form.doorNo}
                          onChange={(e) => setForm((p) => ({ ...p, doorNo: e.target.value }))} />
                      </FormField>
                    </div>
                    <div className="col-span-2">
                      <FormField label={ADDRESS_FIELD.openAddress}>
                        <textarea rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                          placeholder={ADDRESS_FIELD.openAddressPlaceholder} value={form.address}
                          onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
                      </FormField>
                    </div>
                    {/* Konum araçları */}
                    <div className="col-span-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={geocoding || !vendorAddressLabel}
                          onClick={() => handleGeocodeAddress(form.city, form.district, form.neighborhood, form.streetName, form.buildingNo)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                          title={!vendorAddressLabel ? 'Önce adres bilgisi girin' : undefined}
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
                    {!vendorAddressLabel && (
                      <p className="col-span-2 text-xs text-slate-400">Konum bulmak için il ve en az bir adres alanı doldurun.</p>
                    )}
                    {vendorAddressLabel && (
                      <div className="col-span-2 text-xs px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-slate-600">
                        <span className="font-medium text-slate-500">Adres özeti: </span>{vendorAddressLabel}
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
                          addressLabel={vendorAddressLabel || undefined}
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
                  </div>

                  {(selectedWgNames.length > 0 || serviceBranches.length > 0) && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 mb-4">
                      <p className="text-xs font-medium text-slate-600 mb-2">Seçili hizmet kolları (Temel Bilgiler)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedWgNames.map((wg) => (
                          <span key={wg.id} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 border border-blue-100">{wg.name}</span>
                        ))}
                        {serviceBranches.map((b) => (
                          <span key={b} className="text-xs bg-orange-50 text-orange-700 rounded-full px-2.5 py-1 border border-orange-100">{b}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <SectionDivider icon={Icon.mapPin} title="Hizmet Bölgeleri" />
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                    <div className="flex gap-2 mb-3">
                      <SearchableSelect
                        className="flex-1 min-w-0"
                        options={provinceOptions}
                        value={selectedProvince?.id ?? ''}
                        onChange={(provinceId) => {
                          const p = provinces.find((x) => x.id === provinceId);
                          if (p) { setSelectedProvince(p); loadServiceDistricts(p.id); }
                          else { setSelectedProvince(null); setServiceDistricts([]); }
                        }}
                        placeholder={ADDRESS_FIELD.provinceSearchPlaceholder}
                        emptyText={ADDRESS_FIELD.provinceSearchEmpty}
                        inputClassName="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
                      {selectedProvince && (
                        <button type="button" onClick={() => addAllDistrictsForProvince(selectedProvince)}
                          className="text-xs bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg border border-indigo-200 hover:bg-indigo-100 whitespace-nowrap">
                          Tüm İlçeleri Ekle
                        </button>
                      )}
                    </div>
                    {selectedProvince && serviceDistricts.length > 0 && (
                      <DistrictCheckboxGrid
                        districts={serviceDistricts}
                        maxHeightClass="max-h-28"
                        gridClassName="grid grid-cols-3 gap-1.5"
                        isChecked={(districtId) => isDistrictAreaChecked(serviceAreas, selectedProvince.id, districtId)}
                        onToggle={(districtId) => toggleServiceArea(selectedProvince.id, districtId)}
                        className="mb-3"
                      />
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

              {/* ── Section 3: İlişki Özeti & Finans ── */}
              {activeSection === 3 && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <SectionDivider icon={Icon.tag} title={VENDOR_RELATION_SECTION_TITLE} />
                  <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5 mb-4 leading-relaxed">
                    {VENDOR_RELATION_SECTION_HINT}
                  </p>
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
                  <FormField label="Kayıt Notu">
                    <textarea rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      placeholder="İlk kayıt sırasında kısa not (detaylı görüşme geçmişi CRM modülünde tutulur)..."
                      value={form.notes}
                      onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
                  </FormField>
                  </div>

                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
                  <SectionDivider icon={Icon.bank} title="Finans & Banka" />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="IBAN" error={ibanError ?? undefined}>
                      <input
                        className={ibanError ? inpError : inp}
                        placeholder="TR00 0000 0000 0000 0000 0000 00"
                        value={form.iban}
                        onChange={(e) => handleIbanChange(e.target.value)}
                      />
                      {form.bankName && !ibanError && (
                        <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">✓ {form.bankName}</p>
                      )}
                    </FormField>
                    <FormField label="Banka Adı">
                      <input className={inp} placeholder="IBAN ile otomatik dolar" value={form.bankName}
                        onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))} />
                    </FormField>
                  </div>
                  </div>
                </div>
              )}

              {/* ── Section 4: Evraklar ── */}
              {activeSection === 4 && (
                <div>
                  {/* Sözleşme — kategoriye göre */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
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
                  </div>

                  {/* Evrak Yükleme */}
                  <SectionDivider icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  } title="Evrak Yükleme" />
                  <div className="space-y-2 mb-2">
                    <div className="flex flex-wrap gap-3 items-end">
                      <div className="flex-1 min-w-48">
                        <label className="text-xs font-medium text-slate-500 block mb-1.5">Evrak Türü *</label>
                        <select
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                          value={docSelectedTypeId}
                          onChange={(e) => {
                            setDocSelectedTypeId(e.target.value);
                            setDocCustomType('');
                          }}
                        >
                          <option value="">Seçin...</option>
                          {scopedDocumentTypes.map((dt) => (
                            <option key={dt.id} value={dt.id}>
                              {dt.name}
                            </option>
                          ))}
                          {!scopedDocumentTypes.some((dt) => isOtherDocumentTypeName(dt.name)) && (
                            <option value={VENDOR_DOC_OTHER_SELECT}>Diğer</option>
                          )}
                        </select>
                        {docOtherSelected && (
                          <input
                            className="mt-1.5 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            placeholder="Evrak türünü yazın..."
                            value={docCustomType}
                            onChange={(e) => setDocCustomType(e.target.value)}
                          />
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <input
                          type="file"
                          ref={docFileInputRef}
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file || !docSelectedTypeId) return;
                            const isManualOther = docSelectedTypeId === VENDOR_DOC_OTHER_SELECT
                              || isOtherDocumentTypeName(scopedDocumentTypes.find((dt) => dt.id === docSelectedTypeId)?.name ?? '');
                            const customLabel = isManualOther ? docCustomType.trim() : '';
                            if (isManualOther && !customLabel) return;
                            const typeId = docSelectedTypeId === VENDOR_DOC_OTHER_SELECT
                              ? otherDocumentTypeId
                              : docSelectedTypeId;
                            if (!typeId) return;
                            const dt = scopedDocumentTypes.find((d) => d.id === typeId);
                            if (!dt) return;
                            const displayName = isManualOther ? customLabel : dt.name;
                            setPendingDocs((p) => [...p, {
                              id: `${Date.now()}-${Math.random()}`,
                              file,
                              documentTypeId: typeId,
                              documentTypeName: displayName,
                              customLabel: isManualOther ? customLabel : undefined,
                            }]);
                            setDocSelectedTypeId('');
                            setDocCustomType('');
                            if (e.target) e.target.value = '';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!docSelectedTypeId) return;
                            if (docOtherSelected) {
                              if (docCustomType.trim() && otherDocumentTypeId) docFileInputRef.current?.click();
                              return;
                            }
                            docFileInputRef.current?.click();
                          }}
                          disabled={
                            !docSelectedTypeId
                            || (docOtherSelected && (!docCustomType.trim() || !otherDocumentTypeId))
                          }
                          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap font-medium"
                        >
                          Dosya Seç
                        </button>
                      </div>
                    </div>
                    {scopedDocumentTypes.length === 0 && (
                      <p className="text-xs text-amber-600">
                        Henüz evrak türü tanımlı değil.{' '}
                        <Link href="/panel/ayarlar/evrak-turleri" className="underline font-medium">
                          Ayarlar → Evrak Türleri
                        </Link>
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-3">Desteklenen: PDF, JPG, PNG, Word, Excel — Maks. 20 MB</p>

                  {pendingDocs.length > 0 && (
                    <div className="space-y-2">
                      {pendingDocs.map((pd) => {
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
                                  <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-xs mr-1">{pd.documentTypeName}</span>
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

            {/* Panel Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
              <div className="flex gap-1.5">
                {MODAL_SECTIONS.map((_, i) => (
                  <button key={i} type="button" onClick={() => setActiveSection(i)}
                    className={`w-2 h-2 rounded-full transition-all ${activeSection === i ? 'bg-indigo-600 w-4' : 'bg-slate-300 hover:bg-slate-400'}`} />
                ))}
              </div>
              <div className="flex gap-2 items-center">
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
                  <div ref={saveModeDropdownRef} className="relative flex items-stretch">
                    <button
                      type="button"
                      onClick={() => handleSave()}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2 text-sm bg-indigo-600 text-white rounded-l-xl hover:bg-indigo-700 disabled:opacity-50 font-medium border-r border-indigo-500 transition-colors"
                    >
                      {saving && (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      {saving ? 'Kaydediliyor...' : saveMode === 'close' ? 'Kaydet ve Kapat' : saveMode === 'new' ? 'Kaydet ve Yeni Ekle' : 'Kaydet ve Detaya Git'}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setSaveModeDropdownOpen((o) => !o)}
                      className="flex items-center justify-center px-2.5 bg-indigo-600 text-white rounded-r-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      aria-label="Kaydetme seçenekleri"
                    >
                      <svg className={`w-3.5 h-3.5 transition-transform duration-150 ${saveModeDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {saveModeDropdownOpen && (
                      <div className="absolute bottom-full right-0 mb-2 bg-white border border-slate-200 rounded-xl shadow-xl py-1 min-w-[220px] z-50">
                        {([
                          { mode: 'close' as const, label: 'Kaydet ve Kapat', desc: 'Listeye geri dön', icon: '✓' },
                          { mode: 'new' as const, label: 'Kaydet ve Yeni Ekle', desc: 'Formu sıfırla, devam et', icon: '+' },
                          { mode: 'detail' as const, label: 'Kaydet ve Detaya Git', desc: 'Tedarikçi detay sayfası', icon: '→' },
                        ] as const).map(({ mode, label, desc, icon }) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => {
                              setSaveMode(mode);
                              localStorage.setItem('vendorSaveMode', mode);
                              setSaveModeDropdownOpen(false);
                              handleSave(mode);
                            }}
                            className={`w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-indigo-50 transition-colors ${saveMode === mode ? 'bg-indigo-50' : ''}`}
                          >
                            <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${saveMode === mode ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              {saveMode === mode ? '✓' : icon}
                            </span>
                            <div>
                              <p className={`text-xs font-medium ${saveMode === mode ? 'text-indigo-700' : 'text-slate-700'}`}>{label}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                  İptal
                </button>
              </div>
            </div>
        </div>
      </SlidePanel>

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
              <button type="button" onClick={() => doSave(saveMode)}
                className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium">
                Yine de Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      <VendorDiscoveryPanel
        open={showDiscoveryPanel}
        onClose={() => setShowDiscoveryPanel(false)}
        provinces={provinces}
        onAddAsVendor={handleDiscoveryAddAsVendor}
      />
    </div>
    </TableColumnsProvider>
  );
}
