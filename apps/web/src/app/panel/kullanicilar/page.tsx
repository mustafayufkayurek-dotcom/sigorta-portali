'use client';

/**
 * MERIDYEN PRODUCT GUARDRAIL
 * Bu ekran teknik CRUD ekranı olarak genişletilemez.
 * İlgili ürün kararı:
 * docs/product/MERIDYEN_URUN_KARARI_ANAYASASI.md
 * docs/product/UI_GUARDRAIL_CHECKLIST.md
 */

import { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import axios from 'axios';
import { Check, Copy, Plus, Search, UserCheck, Users, X } from 'lucide-react';
import { HintIcon } from '@/components/ui/HintIcon';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import { PhoneInput } from '@/components/PhoneInput';
import { PageLoadingState } from '@/components/ui/PageLoadingState';
import { SearchInput } from '@/components/ui/SearchInput';
import { DistrictCheckboxGrid } from '@/components/ui/DistrictCheckboxGrid';
import { GeographicRegionScopePanel } from '@/components/users/GeographicRegionScopePanel';
import {
  OperationalAccessGrantPanel,
  grantOperationalExtraAccess,
  resolveDefaultAuthorizationFlow,
} from '@/components/users/OperationalAccessGrantPanel';
import { WorkHoursGateToggle } from '@/components/users/WorkHoursGateToggle';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { ADDRESS_FIELD } from '@/constants/address-fields';
import {
  addWholeProvinceEntry,
  isDistrictAreaChecked,
  toggleDistrictArea,
} from '@/utils/service-area-helpers';
import {
  PanelListToolbarPickers,
  PanelTableColumnPicker,
  PanelTableColGroup,
  PanelTableScroll,
  PanelOrderedHeaderRow,
  PanelTableTd,
  TableColumnsProvider,
  usePanelTableColumns,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { AdminUserRowActions } from '@/components/users/AdminUserRowActions';
import { PortalRowActionsPicker } from '@/components/portal/PortalRowActionsPicker';
import { ADMIN_USER_ROW_ACTIONS } from '@/components/portal/portal-row-action-prefs';
import { usePortalRowActionPrefs } from '@/components/portal/use-portal-row-action-prefs';
import { formatPhoneDisplay } from '@/data/country-codes';
import { toTitleCaseTR } from '@/utils/text-helpers';
import {
  cycleClientSort,
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';
import { normalizeEmailAddress } from '@/utils/normalize-email';
import { API, authHeader } from '@/utils/api';
import { fetchProvinceDistricts } from '@/utils/fetch-province-districts';
import { ensureValidSession, getAccessToken } from '@/utils/auth-session';
import {
  getProvincesForRegionCode,
  getRegionCodeFromApiCode,
  getRegionNamesForSelectedIds,
  inferSelectedRegionIdsFromServiceAreas,
} from '@/utils/turkey-geographic-regions';
import { toInternationalFormat, validateEmail } from '@/utils/validators';
import {
  ACIL_YARDIM_ASSISTANT_CUSTOMER_SUB_TYPE,
  BROKER_CUSTOMER_SUB_TYPE,
  FIELD_OPERATION_AREA_OPTIONS,
  FIELD_OTHER_SUBJECT_LABEL,
  HASAR_EXPERT_CUSTOMER_SUB_TYPE,
  acilYardimAssistantCustomerName,
  brokerCustomerName,
  departmentCodeMatchesArea,
  displayPersonDuty,
  displayUserRoleName,
  emptyInvitePersonDraft,
  fieldStaffUsesServiceBranches,
  findDepartmentForArea,
  findRoleByCode,
  hasarExpertCustomerName,
  isAcilYardimAssistantCustomer,
  isBrokerCustomer,
  isCustomerCompanyUserTask,
  isHasarExpertCustomer,
  isCompleteOfficePersonPhone,
  officePersonToFormFields,
  operationAreaFromDepartmentCodes,
  roleCodesMatch,
  resolveOfficePersonPhone,
  selectedPortalOfficeCustomerId,
  showsAcilYardimCustomerScope,
  showsInsuranceCompanyScope,
  showsOperationsServiceAreaScope,
  showsUserOperationalAuthorization,
  showsMeridyenWorkHoursToggle,
  userInviteCardTitle,
  type InvitePersonDraft,
} from './_lib/user-invite-config';

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function TemporaryPasswordCopy({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await copyToClipboard(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-1 rounded-lg bg-slate-900 px-3 py-2 text-white">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="select-all break-all font-mono text-base font-semibold tracking-wide">{value}</p>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
          aria-label="Geçici şifreyi kopyala"
          title="Geçici şifreyi kopyala"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </button>
      </div>
      {copied && <p className="mt-2 text-xs font-medium text-emerald-200">Şifre kopyalandı.</p>}
    </div>
  );
}

function CredentialSuccessPanel({
  title,
  description,
  email,
  temporaryPassword,
  mailMessage,
  invites,
  onClose,
}: {
  title: string;
  description: string;
  email?: string;
  temporaryPassword?: string;
  mailMessage?: string;
  invites?: Array<{ email: string; temporaryPassword: string; mailMessage?: string }>;
  onClose: () => void;
}) {
  const rows = invites && invites.length > 0
    ? invites
    : email && temporaryPassword
      ? [{ email, temporaryPassword, mailMessage }]
      : [];

  return (
    <div className="px-6 py-5 text-sm text-emerald-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-semibold text-emerald-950">{title}</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">{description}</p>
          </div>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
          Tek seferlik
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.email} className="rounded-xl border border-emerald-200 bg-white p-3 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr]">
              <div>
                <p className="text-xs font-semibold tracking-wide text-emerald-600">E-posta</p>
                <p className="mt-1 break-all font-medium text-slate-800">{row.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-emerald-600">Geçici Şifre</p>
                <TemporaryPasswordCopy value={row.temporaryPassword} />
              </div>
            </div>
            <p className={`mt-3 rounded-xl px-3 py-2 text-xs leading-5 ${
              (row.mailMessage ?? mailMessage)?.toLowerCase().includes('gönderilemedi')
                ? 'border border-amber-200 bg-amber-50 text-amber-900'
                : 'bg-emerald-50 text-slate-700'
            }`}>
              {row.mailMessage || mailMessage || 'Hoş geldin maili gönderimi denendi.'}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex justify-end border-t border-emerald-200/80 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
        >
          Kapat
        </button>
      </div>
    </div>
  );
}

// ── Tipler ──────────────────────────────────────────────────────────────────

interface Role {
  id: string;
  name: string;
  code: string;
}

interface Department {
  id: string;
  code: string;
  name: string;
}

interface DepartmentMembership {
  departmentId: string;
  isPrimary?: boolean;
  department?: Department | null;
}

interface InsuranceCompany {
  id: string;
  name: string;
}

interface AcilYardimCustomer {
  id: string;
  name: string;
}

interface PortalOrganizationOption {
  id: string;
  name: string;
}

interface GeographicRegion {
  id: string;
  code: string;
  name: string;
}

interface Province {
  id: string;
  name: string;
  plateCode?: string;
}

interface District {
  id: string;
  name: string;
}

interface ServiceAreaSelection {
  provinceId: string;
  districtId: string | null;
  provinceName?: string;
  districtName?: string | null;
}

type UserStatus = 'active' | 'inactive' | 'archived' | 'suspended';

interface OperationalAccessGrantListItem {
  id: string;
  scopeType: string;
  grantType: string;
  accessLevel?: string;
  validFrom?: string;
  validTo?: string | null;
  principalUserId?: string | null;
  principalUser?: { id: string; firstName: string; lastName: string } | null;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  archivedEmail?: string | null;
  archivedAt?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  status: UserStatus;
  role?: Role | null;
  departmentMemberships?: DepartmentMembership[];
  operationalAccessGrants?: OperationalAccessGrantListItem[];
  serviceAreas?: ServiceAreaSelection[];
  userInsuranceCompanyScopes?: Array<{ insuranceCompanyId: string; insuranceCompany?: InsuranceCompany | null }>;
  userAssistantCustomerScopes?: Array<{ customerId: string; customer?: { id: string; companyName?: string | null; fullName?: string | null } | null }>;
  lastLoginAt?: string | null;
  createdAt: string;
  portalCustomerId?: string | null;
  workHoursRestricted?: boolean | null;
  adjuster?: { id?: string; name?: string | null; company?: string | null; phone?: string | null } | null;
}

const PROTECTED_SYSTEM_EMAILS = new Set([
  'admin@example.com',
  'admin@meridyenassistance.com',
]);

function isProtectedSystemAdmin(user: Pick<User, 'email' | 'archivedEmail'>) {
  const primary = (user.email ?? '').trim().toLowerCase();
  const archived = (user.archivedEmail ?? '').trim().toLowerCase();
  return PROTECTED_SYSTEM_EMAILS.has(primary) || PROTECTED_SYSTEM_EMAILS.has(archived);
}

type OperationArea = '' | 'hasar' | 'acil' | 'both';
type UserTaskCode = '' | 'management' | 'operations' | 'field_operations' | 'expert' | 'insurance_company_user' | 'broker' | 'assistance_company_user' | 'finance';
type ManagementLevel = '' | 'admin' | 'manager';
type FormErrors = Partial<Record<keyof Omit<UserFormState, 'invitePeople' | 'insuranceCompanyIds' | 'acilYardimCustomerIds' | 'serviceAreas' | 'selectedGeographicRegionIds' | 'selectedSubjects'>, string>>
  & {
    general?: string;
    insuranceCompanyIds?: string;
    acilYardimCustomerIds?: string;
    selectedGeographicRegionIds?: string;
    selectedSubjects?: string;
    invitePeople?: string;
  };
type ConfirmAction = {
  title: string;
  description: string;
  confirmLabel: string;
  variant?: 'danger' | 'default';
  onConfirm: () => Promise<void> | void;
};

interface UserFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  userTask: UserTaskCode;
  managementLevel: ManagementLevel;
  operationArea: OperationArea;
  insuranceCompanyIds: string[];
  insuranceCustomerId: string;
  expertCustomerId: string;
  brokerCustomerId: string;
  assistantCustomerId: string;
  acilYardimCustomerIds: string[];
  countrywide: boolean;
  serviceAreas: ServiceAreaSelection[];
  selectedGeographicRegionIds: string[];
  selectedSubjects: string[];
  otherSubjectNotes: string;
  extraAccessHasar: boolean;
  extraAccessAcil: boolean;
  workHoursRestricted: boolean | null;
  invitePeople: InvitePersonDraft[];
}

const DEFAULT_FORM: UserFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  jobTitle: '',
  userTask: '',
  managementLevel: '',
  operationArea: '',
  insuranceCompanyIds: [],
  insuranceCustomerId: '',
  expertCustomerId: '',
  brokerCustomerId: '',
  assistantCustomerId: '',
  acilYardimCustomerIds: [],
  countrywide: true,
  serviceAreas: [],
  selectedGeographicRegionIds: [],
  selectedSubjects: [],
  otherSubjectNotes: '',
  extraAccessHasar: false,
  extraAccessAcil: false,
  workHoursRestricted: null,
  invitePeople: [emptyInvitePersonDraft()],
};

const USER_TASK_OPTIONS: Array<{ value: UserTaskCode; label: string; description: string }> = [
  { value: 'management', label: 'Meridyen Yönetim', description: 'Yönetici veya müdür yetki seviyesinde iç kullanıcı.' },
  { value: 'operations', label: 'Meridyen Dosya Sorumlusu', description: 'Hasar ve Acil Yardım dosyalarını ofisten yöneten Meridyen iç kullanıcısı.' },
  { value: 'field_operations', label: 'Meridyen Saha Operasyonu', description: 'Meridyen bünyesinde sahada tespit veya operasyon takibi yapan iç kullanıcı.' },
  { value: 'finance', label: 'Finans', description: 'Finans ve mali operasyon ekranlarını kullanan ekip üyesi.' },
  { value: 'insurance_company_user', label: 'Sigorta Şirketi Kullanıcısı', description: 'Ayarlar’daki sigorta şirketinin portal kullanıcısı.' },
  { value: 'broker', label: 'Broker Kullanıcısı', description: 'Broker firması kapsamındaki portal kullanıcısı.' },
  { value: 'assistance_company_user', label: 'Asistans Firma Kullanıcısı', description: 'Asistans firması kapsamındaki portal kullanıcısı.' },
  { value: 'expert', label: 'Eksper', description: 'Eksper portalı ve eksper iş akışları için kullanıcı.' },
];

const OPERATION_AREA_OPTIONS: Array<{ value: Exclude<OperationArea, ''>; label: string }> = [
  { value: 'hasar', label: 'Hasar Onarım' },
  { value: 'acil', label: 'Acil Yardım' },
  { value: 'both', label: 'Her İkisi' },
];

// ── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

function normalizeUserStatus(status?: string | null): UserStatus {
  const value = String(status ?? '').trim().toLowerCase();
  if (value === 'active' || value === 'aktif') return 'active';
  if (value === 'inactive' || value === 'passive' || value === 'pasif') return 'inactive';
  if (value === 'archived' || value === 'arsiv' || value === 'arşiv') return 'archived';
  return 'suspended';
}

function canReinviteByEmail(status: UserStatus): boolean {
  return status === 'inactive' || status === 'archived';
}

function userMailbox(user: Pick<User, 'email' | 'archivedEmail'>): string {
  return normalizeEmailAddress(user.archivedEmail ?? user.email);
}

function normalizeUser(user: User): User {
  return {
    ...user,
    status: normalizeUserStatus(user.status),
  };
}

function statusLabel(status: UserStatus) {
  if (status === 'active') return 'Aktif';
  if (status === 'inactive') return 'Pasif';
  if (status === 'archived') return 'Arşiv';
  return 'Askıya Alındı';
}

function statusBadgeCls(status: UserStatus) {
  if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'inactive' || status === 'archived') return 'border-slate-200 bg-slate-50 text-slate-600';
  return 'border-red-200 bg-red-50 text-red-700';
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function displayRoleName(role?: Role | null) {
  return displayUserRoleName(role);
}

function isFieldStaffRole(role?: Role | null) {
  return roleCodesMatch(role?.code, 'field_staff');
}

function operationAreaFromMemberships(memberships?: DepartmentMembership[]): OperationArea {
  return operationAreaFromDepartmentCodes((memberships ?? []).map((item) => item.department?.code));
}

function operationAreaLabel(area: OperationArea) {
  if (area === 'hasar') return 'Hasar Onarım';
  if (area === 'acil') return 'Acil Yardım';
  if (area === 'both') return 'Her İkisi';
  return 'Saha tespit alanı seçilmedi';
}

/** Liste «Görev» sütunu: dosya sorumlusu kapsamı */
function operationAreaScopeLabel(area: OperationArea) {
  if (area === 'hasar') return 'Hasar';
  if (area === 'acil') return 'Acil';
  if (area === 'both') return 'Hasar - Acil';
  return null;
}

function grantScopeListLabel(scopeType: string): string {
  if (scopeType === 'both') return 'Hasar ve Acil Yardım';
  if (scopeType === 'acil_yardim') return 'Acil Yardım';
  if (scopeType === 'hasar') return 'Hasar';
  return scopeType;
}

function formatOperationalGrantListLabel(grant: OperationalAccessGrantListItem): string {
  const scope = grantScopeListLabel(grant.scopeType);
  if (grant.grantType === 'function_delegation') {
    return `Ek Yetki · ${scope}`;
  }
  if (grant.grantType === 'person_delegation') {
    const principal = grant.principalUser
      ? `${grant.principalUser.firstName} ${grant.principalUser.lastName} Adına`
      : 'Vekalet';
    return `İzin Vekaleti · ${principal} · ${scope}`;
  }
  return scope;
}

type RoleDisplayLines = {
  primary: string;
  secondary: string | null;
  extras: Array<{ id: string; label: string }>;
};

function displayRoleWithOperation(user: User): RoleDisplayLines {
  const extras = (user.operationalAccessGrants ?? []).map((grant) => ({
    id: grant.id,
    label: formatOperationalGrantListLabel(grant),
  }));

  if (roleCodesMatch(user.role?.code, 'admin')) {
    return { primary: 'Meridyen Yönetim', secondary: 'Yönetici', extras };
  }
  if (roleCodesMatch(user.role?.code, 'manager')) {
    return { primary: 'Meridyen Yönetim', secondary: 'Müdür', extras };
  }
  if (roleCodesMatch(user.role?.code, 'office_staff')) {
    const area = operationAreaFromMemberships(user.departmentMemberships);
    const scope = operationAreaScopeLabel(area);
    return {
      primary: 'Dosya Sorumlusu',
      secondary: scope ?? 'Kapsam Belirtilmedi',
      extras,
    };
  }
  if (!isFieldStaffRole(user.role)) {
    return { primary: displayRoleName(user.role), secondary: null, extras };
  }
  const area = operationAreaFromMemberships(user.departmentMemberships);
  return {
    primary: displayRoleName(user.role),
    secondary: `Saha Tespit: ${operationAreaLabel(area)}`,
    extras,
  };
}

function isUserInviteSelectableInsuranceCompany(company: InsuranceCompany) {
  const name = company.name.toLocaleLowerCase('tr-TR');
  return !(
    name.includes('d278') ||
    name.includes('lokal') ||
    name.includes('local') ||
    name.includes('test')
  );
}

// ── Bileşenler ───────────────────────────────────────────────────────────────

function Modal({
  title,
  subtitle,
  onClose,
  children,
  variant = 'default',
  size = 'md',
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'success';
  size?: 'md' | 'lg';
}) {
  const isSuccess = variant === 'success';
  const widthClass = isSuccess || size === 'lg' ? 'max-w-3xl' : 'max-w-2xl';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-xl shadow-2xl ring-1 ring-slate-900/10 ${
          isSuccess ? 'bg-emerald-50' : 'bg-white'
        } ${widthClass}`}
      >
        <div className={`flex items-center justify-between px-6 py-4 ${
          isSuccess ? 'border-b border-emerald-200 bg-emerald-50' : 'border-b border-slate-200 bg-white'
        }`}>
          <div className="min-w-0 pr-3">
            <h3 className={`text-base font-semibold ${isSuccess ? 'text-emerald-950' : 'text-slate-900'}`}>{title}</h3>
            {subtitle && (
              <p className={`mt-0.5 truncate text-xs ${isSuccess ? 'text-emerald-800' : 'text-slate-500'}`}>{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              isSuccess
                ? 'text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }`}
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={`min-h-0 overflow-y-auto ${isSuccess ? 'p-0' : 'px-6 py-5'}`}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-xs font-normal text-slate-400">(Zorunlu)</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

const inputCls =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

function OrganizationSelectList({
  title,
  items,
  selectedId,
  onSelect,
  testId,
}: {
  title: string;
  items: Array<{ id: string; name: string; disabled?: boolean; hint?: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
  testId: string;
}) {
  return (
    <div className="relative" data-testid={testId}>
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <SearchableSelect
        options={items
          .filter((company) => !company.disabled)
          .map((company) => ({ value: company.id, label: company.name, hint: company.hint }))}
        value={selectedId}
        onChange={onSelect}
        placeholder={title}
        emptyText="Eşleşen firma yok."
        fallbackLabel={items.find((company) => company.id === selectedId)?.name}
        disableBrowserAutocomplete
        inputClassName={`${inputCls} pl-9`}
      />
      <span className="sr-only" data-testid={`${testId}-popup`}>{title}</span>
    </div>
  );
}

// ── Ana Sayfa ────────────────────────────────────────────────────────────────

function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? payload.id ?? null;
  } catch {
    return null;
  }
}

const TABLE_LEADING_COL_WIDTH = 36;
const TABLE_ACTIONS_COL_WIDTH = 136;

const TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'name', label: 'Ad Soyad', defaultWidth: 240, minWidth: 180 },
  { id: 'email', label: 'E-posta', defaultWidth: 240, minWidth: 180 },
  { id: 'role', label: 'Görev', defaultWidth: 220, minWidth: 160 },
  { id: 'status', label: 'Durum', defaultWidth: 110, minWidth: 88 },
  { id: 'lastLogin', label: 'Son Giriş', defaultWidth: 120, minWidth: 96 },
];

export default function KullanicilarPage() {
  const tableColumns = usePanelTableColumns('table-cols:kullanicilar-v4', TABLE_COLUMNS);
  const rowActions = usePortalRowActionPrefs('row-actions:kullanicilar-v1', ADMIN_USER_ROW_ACTIONS);
  const [clientSort, setClientSort] = useState<ClientSortState>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [insuranceCompanies, setInsuranceCompanies] = useState<InsuranceCompany[]>([]);
  const [acilYardimCustomers, setAcilYardimCustomers] = useState<AcilYardimCustomer[]>([]);
  const [hasarExpertCustomers, setHasarExpertCustomers] = useState<PortalOrganizationOption[]>([]);
  const [brokerCustomers, setBrokerCustomers] = useState<PortalOrganizationOption[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [geographicRegions, setGeographicRegions] = useState<GeographicRegion[]>([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState('');
  const [districts, setDistricts] = useState<District[]>([]);
  const provinceOptions = useMemo(
    () => provinces.map((p) => ({ value: p.id, label: p.name })),
    [provinces],
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [filterRoleId, setFilterRoleId] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdminOrManager, setIsAdminOrManager] = useState(false);

  // Seçim (toplu işlem)
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modal durumları
  const [modal, setModal] = useState<'add' | 'edit' | 'resetPwd' | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormState>(DEFAULT_FORM);
  const [officeUsers, setOfficeUsers] = useState<User[]>([]);
  const [officeContacts, setOfficeContacts] = useState<Array<{ name?: string | null; email?: string | null; phone?: string | null }>>([]);
  const [officeUsersLoading, setOfficeUsersLoading] = useState(false);
  const [selectedOfficeUserId, setSelectedOfficeUserId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [, setPersonErrors] = useState<Record<string, { firstName?: string; lastName?: string; email?: string; jobTitle?: string }>>({});
  const [inactiveDuplicateUser, setInactiveDuplicateUser] = useState<User | null>(null);
  const [createdCredential, setCreatedCredential] = useState<{
    email: string;
    temporaryPassword: string;
    mailMessage: string;
  } | null>(null);
  const [createdInvites, setCreatedInvites] = useState<Array<{
    email: string;
    temporaryPassword: string;
    mailMessage: string;
  }> | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Şifre sıfırlama
  const [resetPwdError, setResetPwdError] = useState('');
  const [resetCredential, setResetCredential] = useState<{
    email: string;
    temporaryPassword: string;
    mailMessage: string;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Veri yükleme ──────────────────────────────────────────────────────────

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const sessionOk = await ensureValidSession(API);
      if (!sessionOk || !getAccessToken()) {
        setLoadError('Oturum doğrulanamadı. Sayfayı yenileyin veya tekrar giriş yapın.');
        setUsers([]);
        return;
      }

      const params: any = { limit: 200, includeInactive: 'true' };
      const r = await axios.get(`${API}/users`, {
        headers: authHeader(),
        params,
      });
      const list = r.data?.data ?? r.data ?? [];
      setUsers(Array.isArray(list) ? list.map(normalizeUser) : []);
    } catch (err: any) {
      console.error('[Kullanicilar] loadUsers hata:', err?.response?.status, err?.response?.data ?? err?.message);
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setLoadError('Oturum süresi doldu. Çıkış yapıp tekrar giriş yapın.');
      } else if (axios.isAxiosError(err) && err.response?.status === 403) {
        setLoadError('Kullanıcı listesini görüntüleme yetkiniz yok.');
      } else {
        setLoadError('Kullanıcı listesi yüklenemedi. Tekrar deneyin.');
      }
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const setUserStatusInList = useCallback((userId: string, status: UserStatus) => {
    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, status } : user)));
    setSelected((prev) => {
      if (!prev.has(userId)) return prev;
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      const sessionOk = await ensureValidSession(API);
      if (!sessionOk || !getAccessToken()) {
        setRoles([]);
        return;
      }
      const r = await axios.get(`${API}/roles`, { headers: authHeader() });
      setRoles(r.data.data ?? []);
    } catch (err) {
      console.error('[Kullanicilar] loadRoles hata:', err);
      setRoles([]);
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/departments`, { headers: authHeader() });
      const list = r.data?.data ?? r.data ?? [];
      setDepartments(Array.isArray(list) ? list : []);
    } catch {
      setDepartments([]);
    }
  }, []);

  const loadInsuranceCompanies = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/insurance-companies`, {
        headers: authHeader(),
        params: { limit: 200, status: 'active' },
      });
      const list = r.data?.data ?? r.data ?? [];
      setInsuranceCompanies(
        Array.isArray(list)
          ? list
              .filter(isUserInviteSelectableInsuranceCompany)
              .sort((a: InsuranceCompany, b: InsuranceCompany) => a.name.localeCompare(b.name, 'tr'))
          : [],
      );
    } catch {
      setInsuranceCompanies([]);
    }
  }, []);

  const loadAcilYardimCustomers = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/customers`, {
        headers: authHeader(),
        params: {
          limit: 200,
          status: 'active',
          customerType: 'corporate',
          subType: ACIL_YARDIM_ASSISTANT_CUSTOMER_SUB_TYPE,
        },
      });
      const list = r.data?.data ?? r.data ?? [];
      setAcilYardimCustomers(
        Array.isArray(list)
          ? list
              .filter(isAcilYardimAssistantCustomer)
              .map((customer: any) => ({
                id: customer.id,
                name: acilYardimAssistantCustomerName(customer),
              }))
              .filter((customer: AcilYardimCustomer) => Boolean(customer.name))
              .sort((a: AcilYardimCustomer, b: AcilYardimCustomer) => a.name.localeCompare(b.name, 'tr'))
          : [],
      );
    } catch {
      setAcilYardimCustomers([]);
    }
  }, []);

  const loadHasarExpertCustomers = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/customers`, {
        headers: authHeader(),
        params: {
          limit: 200,
          status: 'active',
          customerType: 'corporate',
          subType: HASAR_EXPERT_CUSTOMER_SUB_TYPE,
        },
      });
      const list = r.data?.data ?? r.data ?? [];
      setHasarExpertCustomers(
        Array.isArray(list)
          ? list
              .filter(isHasarExpertCustomer)
              .map((customer: any) => ({
                id: customer.id,
                name: hasarExpertCustomerName(customer),
              }))
              .filter((customer: PortalOrganizationOption) => Boolean(customer.name))
              .sort((a: PortalOrganizationOption, b: PortalOrganizationOption) => a.name.localeCompare(b.name, 'tr'))
          : [],
      );
    } catch {
      setHasarExpertCustomers([]);
    }
  }, []);

  const loadBrokerCustomers = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/customers`, {
        headers: authHeader(),
        params: {
          limit: 200,
          status: 'active',
          customerType: 'corporate',
          subType: BROKER_CUSTOMER_SUB_TYPE,
        },
      });
      const list = r.data?.data ?? r.data ?? [];
      setBrokerCustomers(
        Array.isArray(list)
          ? list
              .filter(isBrokerCustomer)
              .map((customer: any) => ({
                id: customer.id,
                name: brokerCustomerName(customer),
              }))
              .filter((customer: PortalOrganizationOption) => Boolean(customer.name))
              .sort((a: PortalOrganizationOption, b: PortalOrganizationOption) => a.name.localeCompare(b.name, 'tr'))
          : [],
      );
    } catch {
      setBrokerCustomers([]);
    }
  }, []);

  const loadProvinces = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/locations/provinces`, { headers: authHeader() });
      const list = r.data?.data ?? r.data ?? [];
      setProvinces(Array.isArray(list) ? list : []);
    } catch {
      setProvinces([]);
    }
  }, []);

  const loadGeographicRegions = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/regions`, { headers: authHeader() });
      const list = r.data?.data ?? r.data ?? [];
      setGeographicRegions(Array.isArray(list) ? list : []);
    } catch {
      setGeographicRegions([]);
    }
  }, []);

  const fetchDistrictsForPanel = useCallback(async (provinceId: string, signal?: AbortSignal) => {
    if (!provinceId) return [];
    return fetchProvinceDistricts(provinceId, { signal, toastOnError: true });
  }, []);

  const loadDistricts = useCallback(async (provinceId: string) => {
    if (!provinceId) {
      setDistricts([]);
      return;
    }
    const list = await fetchProvinceDistricts(provinceId, { toastOnError: true });
    setDistricts(list);
  }, []);

  useEffect(() => {
    setCurrentUserId(getCurrentUserId());
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('user') ?? '{}';
      try {
        const parsed = JSON.parse(raw);
        const roleCode = String(parsed?.role?.code ?? '').toLowerCase();
        setIsAdminOrManager(roleCode === 'admin' || roleCode === 'manager');
      } catch { /* ignore */ }
    }
    loadUsers();
    loadRoles();
    loadDepartments();
    loadInsuranceCompanies();
    loadAcilYardimCustomers();
    loadHasarExpertCustomers();
    loadBrokerCustomers();
    loadProvinces();
    loadGeographicRegions();
  }, [loadUsers, loadRoles, loadDepartments, loadInsuranceCompanies, loadAcilYardimCustomers, loadHasarExpertCustomers, loadBrokerCustomers, loadProvinces, loadGeographicRegions]);

  useEffect(() => {
    if (modal !== 'edit' || form.userTask !== 'operations' || form.countrywide) return;
    if (form.selectedGeographicRegionIds.length > 0 || form.serviceAreas.length === 0) return;
    if (geographicRegions.length === 0 || provinces.length === 0) return;

    const inferred = inferSelectedRegionIdsFromServiceAreas(
      provinces,
      form.serviceAreas,
      geographicRegions,
    );
    if (inferred.length > 0) {
      setForm((prev) => ({ ...prev, selectedGeographicRegionIds: inferred }));
    }
  }, [
    modal,
    form.userTask,
    form.countrywide,
    form.serviceAreas,
    form.selectedGeographicRegionIds.length,
    geographicRegions,
    provinces,
  ]);

  const selectedOfficeId = selectedPortalOfficeCustomerId(form);
  const officePicker = useMemo(() => {
    if (form.userTask === 'expert') {
      return {
        label: 'Ekspertiz Firması',
        error: formErrors.expertCustomerId,
        items: hasarExpertCustomers,
        selectedId: form.expertCustomerId,
        selectedName: hasarExpertCustomers.find((company) => company.id === form.expertCustomerId)?.name ?? '',
        emptyLead: 'Aktif ekspertiz firması bulunamadı. Önce',
        emptyKind: 'ekspertiz firması',
        emptyLinkLabel: 'Müşteriler',
        musterilerHref: '/panel/musteriler?openAdd=1&subType=eksper_firmasi&entityType=corporate',
        buttonTestId: 'ekspertiz-firma-secim',
        placeholder: 'Ekspertiz firması seç',
        pickerTitle: 'Ekspertiz firması seç',
        applyKey: 'expertCustomerId' as const,
      };
    }
    if (form.userTask === 'insurance_company_user') {
      return {
        label: 'Sigorta Şirketi',
        error: formErrors.insuranceCustomerId,
        items: insuranceCompanies.map((company) => ({ id: company.id, name: company.name })),
        selectedId: form.insuranceCustomerId,
        selectedName: insuranceCompanies.find((company) => company.id === form.insuranceCustomerId)?.name ?? '',
        emptyLead: 'Ayarlar’da sigorta şirketi yok. Önce',
        emptyKind: 'sigorta şirketi',
        emptyLinkLabel: 'Ayarlar',
        musterilerHref: '/panel/ayarlar/sigorta-sirketleri',
        buttonTestId: 'sigorta-firma-secim',
        placeholder: 'Şirket adı yazın',
        pickerTitle: 'Şirket adı yazın',
        applyKey: 'insuranceCustomerId' as const,
      };
    }
    if (form.userTask === 'broker') {
      return {
        label: 'Broker Firması',
        error: formErrors.brokerCustomerId,
        items: brokerCustomers,
        selectedId: form.brokerCustomerId,
        selectedName: brokerCustomers.find((company) => company.id === form.brokerCustomerId)?.name ?? '',
        emptyLead: 'Aktif broker firması bulunamadı. Önce',
        emptyKind: 'broker firması',
        emptyLinkLabel: 'Müşteriler',
        musterilerHref: '/panel/musteriler?openAdd=1&subType=broker_firmasi&entityType=corporate',
        buttonTestId: 'broker-firma-secim',
        placeholder: 'Broker firması seç',
        pickerTitle: 'Broker firması seç',
        applyKey: 'brokerCustomerId' as const,
      };
    }
    if (form.userTask === 'assistance_company_user') {
      return {
        label: 'Asistans Firması',
        error: formErrors.assistantCustomerId,
        items: acilYardimCustomers,
        selectedId: form.assistantCustomerId,
        selectedName: acilYardimCustomers.find((company) => company.id === form.assistantCustomerId)?.name ?? '',
        emptyLead: 'Aktif asistans firması bulunamadı. Önce',
        emptyKind: 'asistans firması',
        emptyLinkLabel: 'Müşteriler',
        musterilerHref: '/panel/musteriler?openAdd=1&subType=asistan_firmasi&entityType=corporate',
        buttonTestId: 'asistans-firma-secim',
        placeholder: 'Asistans firması seç',
        pickerTitle: 'Asistans firması seç',
        applyKey: 'assistantCustomerId' as const,
      };
    }
    return null;
  }, [
    form.userTask,
    form.expertCustomerId,
    form.insuranceCustomerId,
    form.brokerCustomerId,
    form.assistantCustomerId,
    formErrors.expertCustomerId,
    formErrors.insuranceCustomerId,
    formErrors.brokerCustomerId,
    formErrors.assistantCustomerId,
    hasarExpertCustomers,
    insuranceCompanies,
    brokerCustomers,
    acilYardimCustomers,
  ]);

  useEffect(() => {
    if ((modal !== 'add' && modal !== 'edit') || !isCustomerCompanyUserTask(form.userTask) || !selectedOfficeId) {
      setOfficeUsers([]);
      setOfficeContacts([]);
      setOfficeUsersLoading(false);
      setSelectedOfficeUserId('');
      return;
    }
    setSelectedOfficeUserId('');
    let cancelled = false;
    setOfficeUsersLoading(true);
    void (async () => {
      try {
        const r = await axios.get(`${API}/users`, {
          headers: authHeader(),
          params: form.userTask === 'insurance_company_user'
            ? { insuranceCompanyId: selectedOfficeId, limit: 200, includeInactive: 'true', page: 1 }
            : { customerId: selectedOfficeId, limit: 200, includeInactive: 'true', page: 1 },
        });
        const list = r.data?.data ?? r.data ?? [];
        let contacts: Array<{ name?: string | null; email?: string | null; phone?: string | null }> = [];
        if (form.userTask !== 'insurance_company_user') {
          try {
            const office = await axios.get(`${API}/customers/${selectedOfficeId}`, { headers: authHeader() });
            contacts = office.data?.data?.contacts ?? office.data?.contacts ?? [];
          } catch {
            contacts = [];
          }
        }
        if (!cancelled) {
          setOfficeContacts(contacts);
          const people = (Array.isArray(list) ? list.map(normalizeUser) : []).map((person: User) => ({
            ...person,
            phone: resolveOfficePersonPhone(person, { contacts }) || person.phone,
          }));
          setOfficeUsers(people);
          if (modal === 'edit' && editingUser?.id) {
            setSelectedOfficeUserId(editingUser.id);
          }
        }
      } catch {
        if (!cancelled) setOfficeUsers([]);
      } finally {
        if (!cancelled) setOfficeUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modal, form.userTask, selectedOfficeId, editingUser?.id]);

  const selectOfficePerson = (person: User) => {
    const listed = users.find((row) => row.id === person.id);
    const fields = officePersonToFormFields(
      {
        ...person,
        phone: person.phone || listed?.phone || listed?.adjuster?.phone,
        adjuster: person.adjuster ?? listed?.adjuster,
      },
      { contacts: officeContacts },
    );
    setSelectedOfficeUserId(person.id);
    setForm((prev) => ({
      ...prev,
      firstName: fields.firstName,
      lastName: fields.lastName,
      email: fields.email,
      phone: fields.phone,
      jobTitle: fields.jobTitle,
    }));
    setFormErrors((prev) => ({
      ...prev,
      firstName: undefined,
      lastName: undefined,
      email: undefined,
      jobTitle: undefined,
      general: undefined,
    }));
  };

  // ── Filtreli liste ────────────────────────────────────────────────────────

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.role?.name ?? '').toLowerCase().includes(q);
    const matchStatus = !filterStatus || normalizeUserStatus(u.status) === filterStatus;
    const matchRole = !filterRoleId || u.role?.id === filterRoleId;
    return matchSearch && matchStatus && matchRole;
  });

  const sorted = useMemo(
    () =>
      sortRowsByClientSort(filtered, clientSort, (u, key) => {
        switch (key) {
          case 'name':
            return `${u.firstName} ${u.lastName}`.trim();
          case 'email':
            return u.email ?? '';
          case 'role':
            return u.role?.name ?? '';
          case 'status':
            return normalizeUserStatus(u.status);
          case 'lastLogin':
            return u.lastLoginAt ?? '';
          default:
            return null;
        }
      }),
    [filtered, clientSort],
  );

  const roleByCode = (code: string, ...aliases: string[]) => findRoleByCode(roles, code, ...aliases);
  const managementRoles = roles.filter(
    (role) => roleCodesMatch(role.code, 'admin') || roleCodesMatch(role.code, 'manager'),
  );
  const hasMultipleManagementRoles = managementRoles.length > 1;
  const selectedRole = (() => {
    if (form.userTask === 'management') {
      const level = form.managementLevel || (roleByCode('admin') ? 'admin' : 'manager');
      return roleByCode(level);
    }
    if (form.userTask === 'operations') return roleByCode('office_staff');
    if (form.userTask === 'field_operations') return roleByCode('field_staff');
    if (form.userTask === 'expert') return roleByCode('expert', 'adjuster');
    if (form.userTask === 'insurance_company_user') return roleByCode('insurance_company_user');
    if (form.userTask === 'broker') return roleByCode('broker_user');
    if (form.userTask === 'assistance_company_user') return roleByCode('assistance_company_user');
    if (form.userTask === 'finance') return roleByCode('finance');
    return undefined;
  })();
  const selectedRoleIsFieldStaff = form.userTask === 'field_operations';

  const taskFromRole = (role?: Role | null): { userTask: UserTaskCode; managementLevel: ManagementLevel } => {
    if (roleCodesMatch(role?.code, 'admin')) return { userTask: 'management', managementLevel: 'admin' };
    if (roleCodesMatch(role?.code, 'manager')) return { userTask: 'management', managementLevel: 'manager' };
    if (roleCodesMatch(role?.code, 'office_staff')) return { userTask: 'operations', managementLevel: '' };
    if (roleCodesMatch(role?.code, 'field_staff')) return { userTask: 'field_operations', managementLevel: '' };
    if (roleCodesMatch(role?.code, 'expert') || roleCodesMatch(role?.code, 'adjuster')) {
      return { userTask: 'expert', managementLevel: '' };
    }
    if (roleCodesMatch(role?.code, 'insurance_company_user')) {
      return { userTask: 'insurance_company_user', managementLevel: '' };
    }
    if (roleCodesMatch(role?.code, 'broker_user')) {
      return { userTask: 'broker', managementLevel: '' };
    }
    if (roleCodesMatch(role?.code, 'assistance_company_user')) {
      return { userTask: 'assistance_company_user', managementLevel: '' };
    }
    if (roleCodesMatch(role?.code, 'finance')) return { userTask: 'finance', managementLevel: '' };
    return { userTask: '', managementLevel: '' };
  };

  const buildDepartmentMemberships = (area: OperationArea) => {
    const selectedDepartments =
      area === 'both'
        ? [findDepartmentForArea(departments, 'hasar'), findDepartmentForArea(departments, 'acil')]
        : area === 'hasar'
          ? [findDepartmentForArea(departments, 'hasar')]
          : area === 'acil'
            ? [findDepartmentForArea(departments, 'acil')]
            : [];

    if (selectedDepartments.some((department) => !department)) {
      return null;
    }

    return (selectedDepartments.filter(Boolean) as Department[]).map((department, index) => ({
      departmentId: department.id,
      isPrimary: index === 0,
      roleScope: index === 0 ? 'primary' : 'secondary',
      isActive: true,
    }));
  };

  const buildResponsibilityAssignments = (
    area: OperationArea,
    serviceAreas: ServiceAreaSelection[],
    countrywide: boolean,
    selectedSubjects: string[] = [],
    acilCustomerIds: string[] = [],
    otherSubjectNotes = '',
    options?: {
      useGeographicRegions?: boolean;
      geographicRegionNames?: string[];
    },
  ) => {
    const memberships = buildDepartmentMemberships(area);
    if (!memberships) return null;

    const buildCoverageForDepartment = (departmentId: string) => {
      const department = departments.find((item) => item.id === departmentId);
      const coverageConfig: Record<string, unknown> = {};

      if (area === 'hasar') {
        return { coverageType: 'all', coverageConfig: {} };
      }

      const branchSubjects = selectedSubjects.filter((item) => item !== FIELD_OTHER_SUBJECT_LABEL);
      if (branchSubjects.length > 0) {
        coverageConfig.ihbarSubjects = branchSubjects;
      }
      if (selectedSubjects.includes(FIELD_OTHER_SUBJECT_LABEL) && otherSubjectNotes.trim()) {
        coverageConfig.otherNotes = otherSubjectNotes.trim();
      }
      if (department && departmentCodeMatchesArea(department.code, 'acil') && acilCustomerIds.length > 0) {
        coverageConfig.customerIds = acilCustomerIds;
      }

      if (Object.keys(coverageConfig).length === 0) {
        return { coverageType: 'all', coverageConfig: {} };
      }
      if (coverageConfig.customerIds) {
        return { coverageType: 'specific_customers', coverageConfig };
      }
      if (coverageConfig.otherNotes || coverageConfig.ihbarSubjects) {
        return { coverageType: 'specific_subjects', coverageConfig };
      }
      return { coverageType: 'all', coverageConfig };
    };

    if (countrywide || serviceAreas.length === 0) {
      return memberships.map((membership) => {
        const coverage = buildCoverageForDepartment(membership.departmentId);
        return {
          departmentId: membership.departmentId,
          regionType: 'countrywide',
          regionValues: [],
          coverageType: coverage.coverageType,
          coverageConfig: coverage.coverageConfig,
          priority: 0,
          isActive: true,
        };
      });
    }

    const districtValues = Array.from(new Set(
      serviceAreas
        .filter((item) => item.districtId)
        .map((item) => item.districtName ?? districts.find((district) => district.id === item.districtId)?.name)
        .filter((value): value is string => Boolean(value)),
    ));

    if (options?.useGeographicRegions) {
      const regionValues = options.geographicRegionNames ?? [];

      return memberships.flatMap((membership) => {
        const coverage = buildCoverageForDepartment(membership.departmentId);
        const department = departments.find((item) => item.id === membership.departmentId);
        if (department && departmentCodeMatchesArea(department.code, 'acil')) {
          return [{
            departmentId: membership.departmentId,
            regionType: 'countrywide',
            regionValues: [],
            coverageType: coverage.coverageType,
            coverageConfig: coverage.coverageConfig,
            priority: 0,
            isActive: true,
          }];
        }

        return [
          ...(regionValues.length > 0 ? [{
            departmentId: membership.departmentId,
            regionType: 'region',
            regionValues,
            coverageType: coverage.coverageType,
            coverageConfig: coverage.coverageConfig,
            priority: 0,
            isActive: true,
          }] : []),
          ...(districtValues.length > 0 ? [{
            departmentId: membership.departmentId,
            regionType: 'district',
            regionValues: districtValues,
            coverageType: coverage.coverageType,
            coverageConfig: coverage.coverageConfig,
            priority: 10,
            isActive: true,
          }] : []),
        ];
      });
    }

    const cityValues = Array.from(new Set(
      serviceAreas
        .filter((item) => !item.districtId)
        .map((item) => item.provinceName ?? provinces.find((province) => province.id === item.provinceId)?.name)
        .filter((value): value is string => Boolean(value)),
    ));

    return memberships.flatMap((membership) => {
      const coverage = buildCoverageForDepartment(membership.departmentId);
      const department = departments.find((item) => item.id === membership.departmentId);
      if (department && departmentCodeMatchesArea(department.code, 'acil')) {
        return [{
          departmentId: membership.departmentId,
          regionType: 'countrywide',
          regionValues: [],
          coverageType: coverage.coverageType,
          coverageConfig: coverage.coverageConfig,
          priority: 0,
          isActive: true,
        }];
      }

      return [
        ...(cityValues.length > 0 ? [{
          departmentId: membership.departmentId,
          regionType: 'city',
          regionValues: cityValues,
          coverageType: coverage.coverageType,
          coverageConfig: coverage.coverageConfig,
          priority: 0,
          isActive: true,
        }] : []),
        ...(districtValues.length > 0 ? [{
          departmentId: membership.departmentId,
          regionType: 'district',
          regionValues: districtValues,
          coverageType: coverage.coverageType,
          coverageConfig: coverage.coverageConfig,
          priority: 10,
          isActive: true,
        }] : []),
      ];
    });
  };

  const toggleInsuranceCompany = (companyId: string) => {
    setForm((prev) => ({
      ...prev,
      insuranceCompanyIds: prev.insuranceCompanyIds.includes(companyId)
        ? prev.insuranceCompanyIds.filter((id) => id !== companyId)
        : [...prev.insuranceCompanyIds, companyId],
    }));
    setFormErrors((prev) => ({ ...prev, insuranceCompanyIds: undefined, general: undefined }));
  };

  const allInsuranceCompaniesSelected =
    insuranceCompanies.length > 0
    && insuranceCompanies.every((company) => form.insuranceCompanyIds.includes(company.id));

  const toggleAllInsuranceCompanies = (checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      insuranceCompanyIds: checked ? insuranceCompanies.map((company) => company.id) : [],
    }));
    setFormErrors((prev) => ({ ...prev, insuranceCompanyIds: undefined, general: undefined }));
  };

  const toggleAcilYardimCustomer = (customerId: string) => {
    setForm((prev) => ({
      ...prev,
      acilYardimCustomerIds: prev.acilYardimCustomerIds.includes(customerId)
        ? prev.acilYardimCustomerIds.filter((id) => id !== customerId)
        : [...prev.acilYardimCustomerIds, customerId],
    }));
    setFormErrors((prev) => ({ ...prev, acilYardimCustomerIds: undefined, general: undefined }));
  };

  const allAcilYardimCustomersSelected =
    acilYardimCustomers.length > 0
    && acilYardimCustomers.every((customer) => form.acilYardimCustomerIds.includes(customer.id));

  const toggleAllAcilYardimCustomers = (checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      acilYardimCustomerIds: checked ? acilYardimCustomers.map((customer) => customer.id) : [],
    }));
    setFormErrors((prev) => ({ ...prev, acilYardimCustomerIds: undefined, general: undefined }));
  };

  const selectUserTask = (value: UserTaskCode) => {
    setForm((prev) => ({
      ...prev,
      userTask: value,
      managementLevel: value === 'management' ? prev.managementLevel : '',
      operationArea: value === 'field_operations' || value === 'operations'
        ? (value === prev.userTask ? prev.operationArea : '')
        : '',
      insuranceCompanyIds: value === 'operations' ? prev.insuranceCompanyIds : [],
      acilYardimCustomerIds: value === 'operations' ? prev.acilYardimCustomerIds : [],
      insuranceCustomerId: value === 'insurance_company_user' ? prev.insuranceCustomerId : '',
      expertCustomerId: value === 'expert' ? prev.expertCustomerId : '',
      brokerCustomerId: value === 'broker' ? prev.brokerCustomerId : '',
      assistantCustomerId: value === 'assistance_company_user' ? prev.assistantCustomerId : '',
      countrywide:
        value === 'operations'
          ? false
          : value === 'field_operations' || value === 'expert'
            ? prev.countrywide
            : true,
      serviceAreas: value === 'operations' || value === 'field_operations' || value === 'expert' ? prev.serviceAreas : [],
      selectedGeographicRegionIds: value === 'operations' ? prev.selectedGeographicRegionIds : [],
      selectedSubjects: value === 'field_operations' ? prev.selectedSubjects : [],
      otherSubjectNotes: value === 'field_operations' ? prev.otherSubjectNotes : '',
      extraAccessHasar: false,
      extraAccessAcil: false,
      workHoursRestricted: showsMeridyenWorkHoursToggle(value) ? prev.workHoursRestricted : null,
    }));
    setFormErrors((prev) => ({
      ...prev,
      userTask: undefined,
      managementLevel: undefined,
      insuranceCompanyIds: undefined,
      insuranceCustomerId: undefined,
      expertCustomerId: undefined,
      brokerCustomerId: undefined,
      assistantCustomerId: undefined,
      acilYardimCustomerIds: undefined,
      operationArea: undefined,
      selectedSubjects: undefined,
      general: undefined,
    }));
  };

  const selectOperationArea = (area: OperationArea) => {
    setForm((prev) => ({
      ...prev,
      operationArea: area,
      insuranceCompanyIds: area === 'acil' ? [] : prev.insuranceCompanyIds,
      acilYardimCustomerIds: area === 'hasar' ? [] : prev.acilYardimCustomerIds,
      selectedSubjects: prev.userTask === 'field_operations' ? [] : prev.selectedSubjects,
      otherSubjectNotes: prev.userTask === 'field_operations' ? '' : prev.otherSubjectNotes,
      // Hasar ve Acil: il / tüm ilçeler / ilçe seçimi açık kalır (acil’de countrywide zorlaması yok)
      ...(prev.userTask === 'operations' && (area === 'hasar' || area === 'acil' || area === 'both')
        ? { countrywide: false }
        : {}),
    }));
    setFormErrors((prev) => ({
      ...prev,
      operationArea: undefined,
      insuranceCompanyIds: undefined,
      acilYardimCustomerIds: undefined,
      selectedSubjects: undefined,
      otherSubjectNotes: undefined,
      general: undefined,
    }));
  };

  const toggleOperationsDistrict = (
    provinceId: string,
    districtId: string,
    districtsInProvince: { id: string; name: string }[],
  ) => {
    const province = provinces.find((item) => item.id === provinceId);
    setForm((prev) => ({
      ...prev,
      serviceAreas: toggleDistrictArea(
        prev.serviceAreas,
        provinceId,
        districtId,
        districtsInProvince,
        province?.name,
      ) as ServiceAreaSelection[],
    }));
  };

  const toggleGeographicRegion = (regionId: string, checked: boolean) => {
    const region = geographicRegions.find((item) => item.id === regionId);
    if (!region) return;
    const regionCode = getRegionCodeFromApiCode(region.code);
    if (!regionCode) return;
    const regionProvinces = getProvincesForRegionCode(regionCode, provinces);

    setForm((prev) => {
      const nextSelected = checked
        ? [...prev.selectedGeographicRegionIds.filter((id) => id !== regionId), regionId]
        : prev.selectedGeographicRegionIds.filter((id) => id !== regionId);

      let nextServiceAreas = [...prev.serviceAreas];
      if (checked) {
        for (const province of regionProvinces) {
          if (!nextServiceAreas.some((area) => area.provinceId === province.id && !area.districtId)) {
            nextServiceAreas.push({
              provinceId: province.id,
              districtId: null,
              provinceName: province.name,
            });
          }
        }
      } else {
        const provinceIds = new Set(regionProvinces.map((province) => province.id));
        nextServiceAreas = nextServiceAreas.filter((area) => !provinceIds.has(area.provinceId));
      }

      return {
        ...prev,
        countrywide: false,
        selectedGeographicRegionIds: nextSelected,
        serviceAreas: nextServiceAreas,
      };
    });
    setFormErrors((prev) => ({ ...prev, selectedGeographicRegionIds: undefined, general: undefined }));
  };

  const toggleServiceArea = (provinceId: string, districtId: string | null) => {
    const province = provinces.find((item) => item.id === provinceId);
    if (districtId) {
      setForm((prev) => ({
        ...prev,
        serviceAreas: toggleDistrictArea(
          prev.serviceAreas,
          provinceId,
          districtId,
          districts,
          province?.name,
        ) as ServiceAreaSelection[],
      }));
      return;
    }
    setForm((prev) => {
      const hasWhole = prev.serviceAreas.some((sa) => sa.provinceId === provinceId && !sa.districtId);
      return {
        ...prev,
        serviceAreas: hasWhole
          ? prev.serviceAreas.filter((sa) => !(sa.provinceId === provinceId && !sa.districtId))
          : addWholeProvinceEntry(prev.serviceAreas, provinceId, province?.name) as ServiceAreaSelection[],
      };
    });
  };

  const addWholeProvince = () => {
    if (!selectedProvinceId) return;
    toggleServiceArea(selectedProvinceId, null);
  };

  /** İl geneli tek kayıt — ilçe listesi yüklenmeden de çalışır (regresyon kilidi). */
  const addAllDistrictsInProvinceHandler = () => {
    if (!selectedProvinceId) return;
    const province = provinces.find((item) => item.id === selectedProvinceId);
    setForm((prev) => ({
      ...prev,
      countrywide: false,
      serviceAreas: addWholeProvinceEntry(
        prev.serviceAreas,
        selectedProvinceId,
        province?.name,
      ) as ServiceAreaSelection[],
    }));
  };

  // ── Seçim işlemleri ───────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(
        new Set(
          filtered
            .filter((u) => !isProtectedSystemAdmin(u) && u.id !== currentUserId)
            .map((u) => u.id),
        ),
      );
    }
  };

  const handleBulkDelete = async () => {
    const ids = filtered
      .filter((u) => selected.has(u.id))
      .map((u) => u.id)
      .filter(Boolean);

    if (ids.length === 0) return;

    setConfirmAction({
      title: 'Kullanıcıları arşivle',
      description: `${ids.length} kullanıcı arşivlenecek. Sistem yöneticileri ve mevcut oturum kullanıcısı bu işleme dahil edilmez.`,
      confirmLabel: 'Arşivle',
      variant: 'danger',
      onConfirm: async () => {
        setBulkDeleting(true);
        setActionMessage(null);
        try {
          await axios.post(
            `${API}/users/bulk-delete`,
            { ids },
            { headers: authHeader() },
          );
          setSelected(new Set());
          setActionMessage({ type: 'success', text: 'Seçili kullanıcılar arşivlendi.' });
          await loadUsers();
        } catch (err: any) {
          setActionMessage({ type: 'error', text: err?.response?.data?.message ?? 'Toplu arşivleme sırasında hata oluştu.' });
        } finally {
          setBulkDeleting(false);
          setConfirmAction(null);
        }
      },
    });
  };

  // ── Modal yönetimi ────────────────────────────────────────────────────────

  const openAdd = () => {
    setForm(DEFAULT_FORM);
    setSelectedProvinceId('');
    setDistricts([]);
    setFormError('');
    setFormErrors({});
    setPersonErrors({});
    setInactiveDuplicateUser(null);
    setCreatedCredential(null);
    setCreatedInvites(null);
    setEditingUser(null);
    setModal('add');
  };

  const openEdit = (u: User) => {
    const task = taskFromRole(u.role);
    setForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: toInternationalFormat(u.phone ?? u.adjuster?.phone ?? ''),
      jobTitle: u.jobTitle ?? '',
      userTask: task.userTask,
      managementLevel: task.managementLevel,
      operationArea: (isFieldStaffRole(u.role) || u.role?.code === 'office_staff') ? operationAreaFromMemberships(u.departmentMemberships) : '',
      insuranceCompanyIds: task.userTask === 'insurance_company_user'
        ? (u.userInsuranceCompanyScopes ?? []).map((scope) => scope.insuranceCompanyId).filter(Boolean)
        : (u.userInsuranceCompanyScopes ?? []).map((scope) => scope.insuranceCompanyId).filter(Boolean),
      insuranceCustomerId: task.userTask === 'insurance_company_user'
        ? ((u.userInsuranceCompanyScopes ?? []).map((scope) => scope.insuranceCompanyId).filter(Boolean)[0] ?? '')
        : '',
      expertCustomerId: task.userTask === 'expert' ? (u.portalCustomerId ?? '') : '',
      brokerCustomerId: task.userTask === 'broker' ? (u.portalCustomerId ?? '') : '',
      assistantCustomerId: task.userTask === 'assistance_company_user'
        ? ((u.userAssistantCustomerScopes ?? []).map((scope) => scope.customerId).filter(Boolean)[0] ?? u.portalCustomerId ?? '')
        : '',
      acilYardimCustomerIds: [],
      countrywide: (u.serviceAreas ?? []).length === 0,
      serviceAreas: (u.serviceAreas ?? []).map((area: any) => ({
        provinceId: area.provinceId,
        districtId: area.districtId ?? null,
        provinceName: area.province?.name ?? area.provinceName,
        districtName: area.district?.name ?? area.districtName ?? null,
      })),
      selectedGeographicRegionIds: task.userTask === 'operations' && (u.serviceAreas ?? []).length > 0
        ? inferSelectedRegionIdsFromServiceAreas(
          provinces,
          (u.serviceAreas ?? []).map((area: any) => ({
            provinceId: area.provinceId,
            districtId: area.districtId ?? null,
          })),
          geographicRegions,
        )
        : [],
      selectedSubjects: [],
      otherSubjectNotes: '',
      extraAccessHasar: false,
      extraAccessAcil: false,
      workHoursRestricted: u.workHoursRestricted ?? null,
      invitePeople: [emptyInvitePersonDraft()],
    });
    setSelectedProvinceId('');
    setDistricts([]);
    setFormError('');
    setFormErrors({});
    setPersonErrors({});
    setInactiveDuplicateUser(null);
    setCreatedCredential(null);
    setCreatedInvites(null);
    setEditingUser(u);
    setModal('edit');
  };

  const closeModal = () => {
    setModal(null);
    setEditingUser(null);
    setForm(DEFAULT_FORM);
    setFormError('');
    setFormErrors({});
    setPersonErrors({});
    setInactiveDuplicateUser(null);
    setCreatedCredential(null);
    setCreatedInvites(null);
    setResetPwdError('');
    setResetCredential(null);
  };

  const validateUserForm = () => {
    const nextErrors: FormErrors = {};
    const nextPersonErrors: Record<string, { firstName?: string; lastName?: string; email?: string; jobTitle?: string }> = {};
    if (!form.firstName.trim()) nextErrors.firstName = 'Ad zorunludur.';
    if (!form.lastName.trim()) nextErrors.lastName = 'Soyad zorunludur.';
    if (!form.email.trim()) nextErrors.email = 'E-posta zorunludur.';
    else if (!validateEmail(form.email)) nextErrors.email = 'Geçerli bir e-posta adresi girilmelidir.';
    if (!isCompleteOfficePersonPhone(form.phone)) nextErrors.phone = 'Telefon zorunludur.';
    if (!form.userTask) nextErrors.userTask = 'Kullanıcı türü seçimi zorunludur.';
    if (form.userTask === 'management' && hasMultipleManagementRoles && !form.managementLevel) {
      nextErrors.managementLevel = 'Yetki seviyesi seçilmelidir.';
    }
    if (form.userTask && roles.length === 0) {
      nextErrors.userTask = 'Rol listesi yüklenemedi. Sayfayı yenileyip tekrar deneyin.';
    } else if (form.userTask && !selectedRole) {
      nextErrors.userTask =
        'Seçilen görev için sistem rolü bulunamadı. Ayarlar → Roller bölümünden ilgili rol tanımını kontrol edin.';
    }
    if (selectedRoleIsFieldStaff && !form.operationArea) {
      nextErrors.operationArea = 'Hasar Onarım, Acil Yardım veya Her İkisi seçilmelidir.';
    }
    if (selectedRoleIsFieldStaff && fieldStaffUsesServiceBranches(form.operationArea)) {
      if (form.selectedSubjects.length === 0) {
        nextErrors.selectedSubjects = 'En az bir hizmet kolu seçilmelidir.';
      }
    }
    if (form.userTask === 'operations' && !form.operationArea) {
      nextErrors.operationArea = 'Dosya türü kapsamı seçilmelidir.';
    }
    if (form.userTask === 'insurance_company_user' && !form.insuranceCustomerId) {
      nextErrors.insuranceCustomerId = 'Sigorta şirketi seçilmelidir.';
    }
    if (form.userTask === 'expert' && !form.expertCustomerId) {
      nextErrors.expertCustomerId = 'Ekspertiz firması seçilmelidir.';
    }
    if (form.userTask === 'broker' && !form.brokerCustomerId) {
      nextErrors.brokerCustomerId = 'Broker firması seçilmelidir.';
    }
    if (form.userTask === 'assistance_company_user' && !form.assistantCustomerId) {
      nextErrors.assistantCustomerId = 'Asistans firması seçilmelidir.';
    }
    if (form.userTask === 'operations' && showsInsuranceCompanyScope(form.operationArea) && form.insuranceCompanyIds.length === 0) {
      nextErrors.insuranceCompanyIds = 'Sigorta şirketi seçilmelidir.';
    }
    if (form.userTask === 'operations' && showsAcilYardimCustomerScope(form.operationArea) && form.acilYardimCustomerIds.length === 0) {
      nextErrors.acilYardimCustomerIds = 'Acil yardım müşterisi seçilmelidir.';
    }
    if (
      form.userTask === 'operations'
      && showsOperationsServiceAreaScope(form.operationArea)
      && !form.countrywide
      && form.selectedGeographicRegionIds.length === 0
    ) {
      nextErrors.selectedGeographicRegionIds = 'En az bir coğrafi bölge seçilmelidir.';
    }
    setFormErrors(nextErrors);
    setPersonErrors(nextPersonErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validateUserForm()) {
      setFormError('Lütfen zorunlu alanları doldurun.');
      return;
    }
    setSaving(true);
    setFormError('');
    setFormErrors({});
    setInactiveDuplicateUser(null);
    try {
      const payload: any = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: normalizeEmailAddress(form.email),
        phone: form.phone || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
        roleId: selectedRole?.id,
      };

      if (selectedRoleIsFieldStaff || form.userTask === 'operations') {
        const departmentMemberships = buildDepartmentMemberships(form.operationArea);
        if (!departmentMemberships) {
          setFormErrors((prev) => ({
            ...prev,
            operationArea: 'Saha yetkinliği için gerekli sistem tanımları eksik.',
          }));
          setFormError('Saha yetkinliği için gerekli sistem tanımları eksik. Lütfen sistem yöneticisine bildirin.');
          setSaving(false);
          return;
        }
        payload.departmentMemberships = departmentMemberships;
      }

      if (form.userTask === 'operations' && showsInsuranceCompanyScope(form.operationArea)) {
        payload.insuranceCompanyIds = form.insuranceCompanyIds;
      }

      if (form.userTask === 'insurance_company_user' && form.insuranceCustomerId) {
        payload.insuranceCompanyIds = [form.insuranceCustomerId];
      }

      if (form.userTask === 'expert' && form.expertCustomerId) {
        payload.expertCustomerId = form.expertCustomerId;
        payload.portalCustomerId = form.expertCustomerId;
      }

      if (form.userTask === 'broker' && form.brokerCustomerId) {
        payload.brokerCustomerId = form.brokerCustomerId;
        payload.portalCustomerId = form.brokerCustomerId;
      }

      if (form.userTask === 'assistance_company_user' && form.assistantCustomerId) {
        payload.assistantCustomerIds = [form.assistantCustomerId];
        payload.portalCustomerId = form.assistantCustomerId;
      }

      if (form.userTask === 'operations' || selectedRoleIsFieldStaff || form.userTask === 'expert') {
        const includeServiceAreas = form.userTask === 'expert'
          || selectedRoleIsFieldStaff
          || showsOperationsServiceAreaScope(form.operationArea);
        if (includeServiceAreas) {
          payload.serviceAreas = form.countrywide ? [] : form.serviceAreas.map((area) => ({
            provinceId: area.provinceId,
            districtId: area.districtId,
          }));
        } else if (form.userTask === 'operations') {
          payload.serviceAreas = [];
        }
      }

      if (
        showsMeridyenWorkHoursToggle(form.userTask, selectedRole?.code)
        && form.workHoursRestricted !== null
      ) {
        payload.workHoursRestricted = form.workHoursRestricted === true;
      }

      if (form.userTask === 'operations') {
        const usesRegions = showsOperationsServiceAreaScope(form.operationArea);
        payload.responsibilityAssignments = buildResponsibilityAssignments(
          form.operationArea,
          usesRegions ? form.serviceAreas : [],
          usesRegions ? form.countrywide : true,
          [],
          form.acilYardimCustomerIds,
          '',
          usesRegions ? {
            useGeographicRegions: true,
            geographicRegionNames: getRegionNamesForSelectedIds(form.selectedGeographicRegionIds, geographicRegions),
          } : undefined,
        );
      }

      if (selectedRoleIsFieldStaff) {
        payload.responsibilityAssignments = buildResponsibilityAssignments(
          form.operationArea,
          form.serviceAreas,
          form.countrywide,
          fieldStaffUsesServiceBranches(form.operationArea) ? form.selectedSubjects : [],
          [],
          fieldStaffUsesServiceBranches(form.operationArea) ? form.otherSubjectNotes : '',
        );
      }

      if (modal === 'add') {
        const dupEmail = users.find((u) => userMailbox(u) === payload.email);
        const dupStatus = dupEmail ? normalizeUserStatus(dupEmail.status) : null;
        if (dupEmail && dupStatus && canReinviteByEmail(dupStatus)) {
          setInactiveDuplicateUser(dupEmail);
        } else {
          setInactiveDuplicateUser(null);
        }

        const response = await axios.post(`${API}/users`, payload, { headers: authHeader() });
        const created = response.data?.data;
        const mailMessage = created?.welcomeEmail?.message ?? 'Hoş geldin maili gönderimi denendi.';
        const oneTimePassword = created?.temporaryPassword;
        if (!oneTimePassword) {
          setFormError('Kullanıcı oluşturuldu ancak geçici şifre oluşturma cevabında görüntülenemedi. Kabul testine devam etmeyin.');
          await loadUsers();
          return;
        }
        const row = {
          email: created.email ?? payload.email,
          temporaryPassword: oneTimePassword,
          mailMessage: created?.reinvited
            ? `${mailMessage} Pasif/arşiv kullanıcı yeniden açıldı.`
            : mailMessage,
        };
        setCreatedInvites([row]);
        setCreatedCredential(row);
        setInactiveDuplicateUser(null);
        if (created?.id && (form.extraAccessAcil || form.extraAccessHasar)) {
          try {
            if (form.extraAccessAcil) await grantOperationalExtraAccess(created.id, 'acil_yardim');
            if (form.extraAccessHasar) await grantOperationalExtraAccess(created.id, 'hasar');
          } catch {
            setFormError('Kullanıcı eklendi. Yetkilendirme kaydı yazılamadı; kişi kaydından tekrar açın.');
          }
        }
        await loadUsers();
        return;
      } else if (modal === 'edit' && editingUser) {
        const response = await axios.patch(`${API}/users/${editingUser.id}`, payload, {
          headers: authHeader(),
        });
        const updated = response.data?.data;
        const oneTimePassword = updated?.temporaryPassword;
        if (oneTimePassword) {
          setCreatedCredential({
            email: updated?.email ?? editingUser.email,
            temporaryPassword: oneTimePassword,
            mailMessage:
              'Rol değişikliği nedeniyle yeni geçici şifre oluşturuldu. Kullanıcı bu şifreyle giriş yaptıktan sonra ilk girişte şifresini değiştirmek zorundadır.',
          });
          await loadUsers();
          return;
        }
      }
      closeModal();
      await loadUsers();
    } catch (err: any) {
      setFormError(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          'Bir hata oluştu.',
      );
    } finally {
      setSaving(false);
    }
  };

  const activateInactiveDuplicateUser = async () => {
    if (!inactiveDuplicateUser) return;
    setSaving(true);
    setFormError('');
    try {
      await axios.patch(
        `${API}/users/${inactiveDuplicateUser.id}`,
        { status: 'active' },
        { headers: authHeader() },
      );
      setUserStatusInList(inactiveDuplicateUser.id, 'active');
      setInactiveDuplicateUser(null);
      setActionMessage({ type: 'success', text: 'Kullanıcı aktifleştirildi.' });
      closeModal();
      await loadUsers();
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'Kullanıcı aktifleştirilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const openTemporaryPasswordForInactiveDuplicate = () => {
    if (!inactiveDuplicateUser) return;
    setEditingUser(inactiveDuplicateUser);
    setInactiveDuplicateUser(null);
    setFormError('');
    setFormErrors({});
    setCreatedCredential(null);
    setResetPwdError('');
    setResetCredential(null);
    setModal('resetPwd');
  };

  const handleToggleStatus = async (u: User) => {
    if (u.status === 'archived' || u.status === 'inactive') {
      setConfirmAction({
        title: 'Kullanıcıyı yeniden aktifleştir',
        description: `${u.firstName} ${u.lastName} (${u.archivedEmail ?? u.email}) kullanıcısı yeniden aktifleştirilecek.`,
        confirmLabel: 'Yeniden Aktifleştir',
        onConfirm: async () => {
          try {
            await axios.post(
              `${API}/users/${u.id}/reactivate`,
              {},
              { headers: authHeader() },
            );
            setUserStatusInList(u.id, 'active');
            setActionMessage({ type: 'success', text: 'Kullanıcı yeniden aktifleştirildi.' });
            await loadUsers();
          } catch (err: any) {
            setActionMessage({ type: 'error', text: err?.response?.data?.message ?? 'Kullanıcı yeniden aktifleştirilemedi.' });
          } finally {
            setConfirmAction(null);
          }
        },
      });
      return;
    }

    if (u.status === 'active') {
      setConfirmAction({
        title: 'Kullanıcıyı arşivle',
        description: `${u.firstName} ${u.lastName} (${u.email}) arşivlenecek. Bu kişi yazılıma giremez; açık ekranı kapanır. Diğer çalışanların işi durur.`,
        confirmLabel: 'Arşivle',
        variant: 'danger',
        onConfirm: async () => {
          try {
            await axios.delete(`${API}/users/${u.id}`, { headers: authHeader() });
            setUserStatusInList(u.id, 'archived');
            setActionMessage({ type: 'success', text: 'Kullanıcı arşivlendi.' });
            await loadUsers();
          } catch (err: any) {
            setActionMessage({ type: 'error', text: err?.response?.data?.message ?? 'Kullanıcı arşivlenemedi.' });
          } finally {
            setConfirmAction(null);
          }
        },
      });
    }
  };

  const handlePermanentDelete = async (u: User) => {
    setConfirmAction({
      title: 'Kullanıcıyı kalıcı sil',
      description: `${u.firstName} ${u.lastName} (${u.archivedEmail ?? u.email}) veritabanından kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      confirmLabel: 'Kalıcı Sil',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await axios.delete(`${API}/users/${u.id}/permanent`, { headers: authHeader() });
          setActionMessage({ type: 'success', text: 'Kullanıcı kalıcı olarak silindi.' });
          setSelected((prev) => {
            const next = new Set(prev);
            next.delete(u.id);
            return next;
          });
          await loadUsers();
        } catch (err: any) {
          setActionMessage({ type: 'error', text: err?.response?.data?.message ?? 'Kalıcı silme başarısız.' });
        } finally {
          setConfirmAction(null);
        }
      },
    });
  };

  const handleBulkStatus = async (newStatus: 'active' | 'inactive') => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    if (newStatus === 'inactive') {
      setConfirmAction({
        title: 'Girişi kapat',
        description: `Seçilen ${ids.length} kişi yazılıma giremez. Açık ekranları kapanır. Diğer çalışanların işi durur.`,
        confirmLabel: 'Pasif Yap',
        variant: 'danger',
        onConfirm: async () => {
          setConfirmAction(null);
          await applyBulkStatus(ids, 'inactive');
        },
      });
      return;
    }

    await applyBulkStatus(ids, newStatus);
  };

  const applyBulkStatus = async (ids: string[], newStatus: 'active' | 'inactive') => {
    setBulkDeleting(true);
    setActionMessage(null);
    try {
      await Promise.all(
        ids.map((id) =>
          axios.patch(
            `${API}/users/${id}`,
            { status: newStatus },
            { headers: authHeader() },
          ),
        ),
      );
      setActionMessage({
        type: 'success',
        text: newStatus === 'active'
          ? 'Seçili kullanıcılar aktifleştirildi.'
          : 'Seçili kullanıcılar pasifleştirildi.',
      });
      setSelected(new Set());
      await loadUsers();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.response?.data?.message ?? 'Seçili kullanıcıların durumu güncellenemedi.',
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editingUser) {
      setResetPwdError('Kullanıcı seçimi bulunamadı.');
      return;
    }
    setSaving(true);
    setResetPwdError('');
    setResetCredential(null);
    try {
      const response = await axios.post(
        `${API}/users/${editingUser.id}/temporary-password`,
        {},
        { headers: authHeader() },
      );
      const temporaryPassword = response.data?.data?.temporaryPassword;
      if (!temporaryPassword) {
        throw new Error('TEMPORARY_PASSWORD_MISSING');
      }
      setResetCredential({
        email: editingUser.email,
        temporaryPassword,
        mailMessage: 'Yeni geçici şifre oluşturuldu. Kullanıcı bu şifreyle giriş yaptıktan sonra ilk girişte şifresini değiştirmek zorundadır.',
      });
      await loadUsers();
    } catch (err: any) {
      setResetPwdError(err.response?.data?.message || 'Şifre sıfırlama başarısız.');
    } finally {
      setSaving(false);
    }
  };

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <TableColumnsProvider value={tableColumns}>
    <div className="min-w-0 overflow-x-hidden">
      <nav className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
        <Link href="/panel/ayarlar" className="transition-colors hover:text-brand-600">
          Ayarlar
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-600">Kullanıcılar</span>
      </nav>
      <div className="page-header !mb-3 sm:!mb-4">
        <div className="flex items-center gap-3">
          <div className="page-header-icon">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="page-title inline-flex items-center gap-1.5">
              Kullanıcılar
              <HintIcon text="Arşivle veya Pasif Yap deyince o kişi yazılıma giremez; açık ekranı kapanır. Diğer çalışanlar etkilenmez." />
            </h2>
          </div>
        </div>
        <div className="page-header-actions">
          <button type="button" onClick={openAdd} className="btn-primary justify-center">
            <Plus className="h-4 w-4" />
            Kullanıcı Ekle
          </button>
        </div>
      </div>

      <OpsFirstRunNotice
        noticeId={OPS_NOTICE.kullaniciGirisKapat.id}
        title={OPS_NOTICE.kullaniciGirisKapat.title}
        body={OPS_NOTICE.kullaniciGirisKapat.body}
        testId="kullanici-giris-kapat-seridi"
      />

      {actionMessage && (
        <div className={`mb-3 rounded-xl border px-4 py-3 text-sm ${
          actionMessage.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {actionMessage.text}
        </div>
      )}

      <div className="filter-bar !mb-3 !w-full !px-3 !py-2.5">
        <div className="panel-filter-bar">
          <div className="panel-filter-search-wrap sm:!min-w-[16rem] sm:!flex-[0_0_18rem]">
            <SearchInput
              placeholder="Ad, e-posta veya rol ara..."
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="panel-filter-control"
          >
            <option value="">Tümü</option>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
            <option value="archived">Arşiv</option>
          </select>
          <select
            value={filterRoleId}
            onChange={(e) => setFilterRoleId(e.target.value)}
            className="panel-filter-control sm:!flex-[0_0_12rem]"
          >
            <option value="">Tüm Görevler</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {displayRoleName(r)}
              </option>
            ))}
          </select>
          <PanelListToolbarPickers>
            <PanelTableColumnPicker tableColumns={tableColumns} />
            <PortalRowActionsPicker
              catalog={ADMIN_USER_ROW_ACTIONS}
              pinnedIds={rowActions.pinnedIds}
              onToggle={rowActions.toggle}
              onReset={rowActions.reset}
            />
          </PanelListToolbarPickers>
        </div>
        {selected.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
            <span className="text-sm font-medium text-slate-700">{selected.size} kullanıcı seçildi</span>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
            >
              {bulkDeleting ? 'Arşivleniyor...' : 'Seçilenleri Arşivle'}
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatus('active')}
              className="inline-flex h-9 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
              title="Pasif kullanıcıları yeniden aktif hale getirir."
            >
              Yeniden Aktifleştir
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatus('inactive')}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Pasif Yap
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-auto text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Seçimi Temizle
            </button>
          </div>
        )}
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-red-800">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="text-xs font-semibold text-red-700 bg-white border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-100"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {/* Tablo */}
      <div className="table-container ops-queue-table">
        {loading ? (
          <PageLoadingState compact />
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-slate-700">
              {loadError
                ? 'Kullanıcı listesi yüklenemedi.'
                : search || filterStatus || filterRoleId
                  ? 'Filtrelere uyan kullanıcı bulunamadı.'
                  : 'Henüz kullanıcı yok.'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {loadError
                ? 'Oturum sorunu olabilir; çıkış yapıp tekrar giriş yapmayı deneyin.'
                : search || filterStatus || filterRoleId
                  ? 'Arama veya filtreleri değiştirerek tekrar deneyin.'
                  : 'Yeni kullanıcı oluşturduğunuzda kayıtlar burada listelenir.'}
            </p>
          </div>
        ) : (
          <PanelTableScroll>
            <table
              className="w-full text-sm"
              style={panelTableLayoutStyle(tableColumns, {
                leadingWidths: [TABLE_LEADING_COL_WIDTH],
                trailingWidths: [TABLE_ACTIONS_COL_WIDTH],
              })}
            >
              <PanelTableColGroup
                leadingWidths={[TABLE_LEADING_COL_WIDTH]}
                trailingWidths={[TABLE_ACTIONS_COL_WIDTH]}
              />
              <thead>
                <tr className="table-head-row portal-table-head border-b border-slate-200">
                  <th className="box-border px-2 py-3 text-center" style={{ width: TABLE_LEADING_COL_WIDTH, minWidth: TABLE_LEADING_COL_WIDTH }}>
                    <button
                      type="button"
                      onClick={selectAll}
                      className={`mx-auto flex h-4 w-4 items-center justify-center rounded border transition-all ${
                        selected.size === filtered.length && filtered.length > 0
                          ? 'border-brand-600 bg-brand-600'
                          : 'border-slate-300 bg-white hover:border-blue-400'
                      }`}
                      aria-label="Tüm kullanıcıları seç"
                    >
                      {selected.size === filtered.length && filtered.length > 0 && (
                        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                      )}
                    </button>
                  </th>
                  <PanelOrderedHeaderRow
                    tableColumns={tableColumns}
                    sortKey={clientSort?.key ?? null}
                    sortDir={clientSort?.dir ?? 'asc'}
                    onSort={(k) => setClientSort((p) => cycleClientSort(p, k))}
                    thClass={(id) =>
                      id === 'status' || id === 'lastLogin'
                        ? 'table-th-center'
                        : 'table-th !text-left'
                    }
                  />
                  <th
                    className="box-border px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500"
                    style={{ width: TABLE_ACTIONS_COL_WIDTH, minWidth: TABLE_ACTIONS_COL_WIDTH }}
                  >
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((u) => {
                  const rowStatus = normalizeUserStatus(u.status);
                  const cells: Record<string, ReactNode> = {
                    name: (
                    <PanelTableTd
                      key="name"
                      colId="name"
                      className="px-4 py-2"
                      title={`${u.firstName} ${u.lastName}${u.phone ? ` · ${formatPhoneDisplay(u.phone)}` : ''}`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-semibold text-slate-700">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-950">
                            {u.firstName} {u.lastName}
                          </p>
                          {u.phone ? (
                            <p className="truncate text-[11px] tabular-nums leading-tight text-slate-400">
                              {formatPhoneDisplay(u.phone)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </PanelTableTd>
                    ),
                    email: (
                    <PanelTableTd key="email" colId="email" className="px-4 py-3 text-slate-600" title={u.email}>
                      <span className="block truncate">{u.email}</span>
                    </PanelTableTd>
                    ),
                    role: (
                    <PanelTableTd key="role" colId="role" className="px-4 py-2 align-middle">
                      {(() => {
                        const duty = displayPersonDuty(u);
                        const roleLines = u.role ? displayRoleWithOperation(u) : null;
                        const full = [duty, roleLines?.secondary, ...(roleLines?.extras.map((e) => e.label) ?? [])]
                          .filter(Boolean)
                          .join(' · ');
                        return (
                          <p className="truncate text-xs font-medium text-blue-800" title={full}>
                            {duty}
                          </p>
                        );
                      })()}
                    </PanelTableTd>
                    ),
                    status: (
                    <PanelTableTd key="status" colId="status" className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeCls(rowStatus)}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${rowStatus === 'active' ? 'bg-status-success' : 'bg-slate-400'}`}
                        />
                        {statusLabel(rowStatus)}
                      </span>
                    </PanelTableTd>
                    ),
                    lastLogin: (
                    <PanelTableTd key="lastLogin" colId="lastLogin" className="px-4 py-3 text-slate-500 text-xs">{fmtDate(u.lastLoginAt)}</PanelTableTd>
                    ),
                  };
                  return (
                  <tr
                    key={`${u.id}-${rowStatus}`}
                    className={`transition-colors hover:bg-slate-50 ${selected.has(u.id) ? 'bg-blue-50/50' : ''} ${rowStatus !== 'active' ? 'opacity-70' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="box-border px-2 py-3 text-center" style={{ width: TABLE_LEADING_COL_WIDTH, minWidth: TABLE_LEADING_COL_WIDTH }}>
                      {isProtectedSystemAdmin(u) || u.id === currentUserId ? (
                        <span
                          className="inline-flex h-4 w-4 rounded border border-slate-200 bg-slate-100"
                          title={u.id === currentUserId ? 'Kendi hesabınızı seçemezsiniz' : 'Sistem yöneticisi seçilemez'}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleSelect(u.id)}
                          className={`mx-auto flex h-4 w-4 items-center justify-center rounded border transition-all ${
                            selected.has(u.id) ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white hover:border-blue-400'
                          }`}
                          aria-label={`${u.firstName} ${u.lastName} seç`}
                        >
                          {selected.has(u.id) && (
                            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                          )}
                        </button>
                      )}
                    </td>
                    {tableColumns.prefs.orderedVisibleColumns.map((col) => cells[col.id] ?? null)}

                    {/* İşlemler */}
                    <td
                      className="box-border px-4 py-3 align-middle"
                      style={{ width: TABLE_ACTIONS_COL_WIDTH, minWidth: TABLE_ACTIONS_COL_WIDTH }}
                    >
                      <AdminUserRowActions
                        userId={u.id}
                        pinnedIds={rowActions.pinnedIds}
                        protectedAdmin={isProtectedSystemAdmin(u)}
                        isSelf={u.id === currentUserId}
                        status={rowStatus}
                        onEdit={() => openEdit(u)}
                        onResetPwd={() => {
                          setEditingUser(u);
                          setResetPwdError('');
                          setResetCredential(null);
                          setModal('resetPwd');
                        }}
                        onActivate={() => handleToggleStatus(u)}
                        onArchive={() => handleToggleStatus(u)}
                        onDelete={() => handlePermanentDelete(u)}
                      />
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </PanelTableScroll>
        )}

        {/* Alt bilgi */}
        {!loading && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-3.5">
            <p className="text-xs text-slate-500">
              {filtered.length} kullanıcı gösteriliyor
              {(search || filterStatus || filterRoleId) && ` (${users.length} toplam)`}
            </p>
          </div>
        )}
      </div>

      {/* ── Kullanıcı Ekle / Düzenle Modal ────────────────────────────── */}
      {(modal === 'add' || modal === 'edit') && (
        <Modal
          title={
            createdCredential
              ? modal === 'edit'
                ? 'Rol Değişikliği Tamamlandı'
                : 'Kullanıcı Eklendi'
              : userInviteCardTitle({
                  mode: modal === 'add' ? 'add' : 'edit',
                  taskLabel: USER_TASK_OPTIONS.find((option) => option.value === form.userTask)?.label,
                  personName: editingUser
                    ? `${editingUser.firstName} ${editingUser.lastName}`
                    : '',
                })
          }
          subtitle={
            !createdCredential && modal === 'edit' && editingUser
              ? editingUser.email
              : undefined
          }
          onClose={closeModal}
          variant={createdCredential ? 'success' : 'default'}
          size={!createdCredential && (modal === 'add' || modal === 'edit') ? 'lg' : 'md'}
        >
          {createdCredential ? (
            <CredentialSuccessPanel
              title={
                modal === 'edit'
                  ? 'Rol değişikliği tamamlandı.'
                  : (createdInvites?.length ?? 0) > 1
                    ? 'Kullanıcılar eklendi.'
                    : 'Kullanıcı eklendi.'
              }
              description={
                modal === 'edit'
                  ? 'Kullanıcının rolü güncellendi ve yeni geçici şifre üretildi. Bu şifre yalnızca bir kez görüntülenir.'
                  : formError && (createdInvites?.length ?? 0) > 0
                    ? formError
                    : (createdInvites?.length ?? 0) > 1
                      ? 'Kullanıcılar oluşturuldu ve geçici şifreler üretildi. Bu şifreler yalnızca bir kez görüntülenir.'
                      : 'Yeni kullanıcı oluşturuldu ve geçici şifre üretildi. Bu şifre yalnızca bir kez görüntülenir.'
              }
              email={createdCredential.email}
              temporaryPassword={createdCredential.temporaryPassword}
              mailMessage={createdCredential.mailMessage}
              invites={createdInvites ?? [createdCredential]}
              onClose={closeModal}
            />
          ) : (
          <div className="space-y-4">
            {formError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            {inactiveDuplicateUser && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                <p className="font-semibold">Pasif veya arşiv kullanıcı bulundu</p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  {inactiveDuplicateUser.firstName} {inactiveDuplicateUser.lastName} ({userMailbox(inactiveDuplicateUser)}) bu e-posta ile kayıtlı.
                  Yeni kayıt açmak yerine mevcut kullanıcı yeniden açılır.
                  Kaydet ile aynı e-posta yeniden aktifleştirilir; yeni geçici şifre üretilir.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={activateInactiveDuplicateUser}
                    disabled={saving}
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Aktifleştir
                  </button>
                  <button
                    type="button"
                    onClick={openTemporaryPasswordForInactiveDuplicate}
                    disabled={saving}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-60"
                  >
                    Yeni Geçici Şifre Ver
                  </button>
                </div>
              </div>
            )}

            {!createdCredential && (
              <>
            <div className="grid grid-cols-2 gap-3">
            <div className="order-1 col-span-2">
              <FormField label="Kullanıcı Türü" required error={formErrors.userTask}>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {USER_TASK_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => selectUserTask(option.value)}
                      className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                        form.userTask === option.value
                          ? 'border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-200'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </FormField>
            </div>

            {form.userTask === 'management' && hasMultipleManagementRoles && (
              <div className="order-2 col-span-2">
              <FormField label="Yetki Seviyesi" required error={formErrors.managementLevel}>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'admin' as ManagementLevel, label: 'Yönetici' },
                    { value: 'manager' as ManagementLevel, label: 'Müdür' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setForm({ ...form, managementLevel: option.value });
                        setFormErrors((prev) => ({ ...prev, managementLevel: undefined, general: undefined }));
                      }}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                        form.managementLevel === option.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </FormField>
              </div>
            )}

            {officePicker ? (
              <div className="order-2 col-span-2 space-y-3">
                <FormField label={officePicker.label} required error={officePicker.error}>
                  {officePicker.items.length === 0 ? (
                    <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      {officePicker.emptyLead}{' '}
                      <Link href={officePicker.musterilerHref} className="font-semibold underline">
                        {officePicker.emptyLinkLabel}
                      </Link>
                      {' '}üzerinden {officePicker.emptyKind} kaydı oluşturun.
                    </p>
                  ) : (
                    <OrganizationSelectList
                      title={officePicker.pickerTitle}
                      items={officePicker.items}
                      selectedId={officePicker.selectedId}
                      testId={officePicker.buttonTestId}
                      onSelect={(id) => {
                        setForm((prev) => ({ ...prev, [officePicker.applyKey]: id }));
                        setFormErrors((prev) => ({ ...prev, [officePicker.applyKey]: undefined, general: undefined }));
                      }}
                    />
                  )}
                </FormField>
                {selectedOfficeId ? (
                  <div className="space-y-2" data-testid="eksper-ofisi-personel-listesi">
                    <p className="text-sm font-semibold text-slate-800">Bu ofiste kayıtlı personel</p>
                    {officeUsersLoading ? (
                      <p className="text-xs text-slate-500">Yükleniyor…</p>
                    ) : officeUsers.length === 0 ? (
                      <p className="text-xs text-slate-500">Bu ofiste henüz personel yok.</p>
                    ) : (
                      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                        {officeUsers.map((person) => {
                          const selected = selectedOfficeUserId === person.id;
                          const canFill = modal === 'add';
                          return (
                            <li key={person.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (canFill) selectOfficePerson(person);
                                }}
                                aria-pressed={selected}
                                className={`w-full px-3 py-2 text-left transition-colors ${
                                  selected ? 'bg-blue-50' : canFill ? 'hover:bg-slate-50' : ''
                                }`}
                              >
                                <p className="text-sm font-medium text-slate-900">
                                  {person.firstName} {person.lastName}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {displayPersonDuty(person)}
                                  {person.email ? ` · ${person.email}` : ''}
                                  {person.phone ? ` · ${formatPhoneDisplay(person.phone)}` : ''}
                                </p>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {form.userTask === 'expert' && (
              <div className="order-2 col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Eksper Bölge Kapsamı</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Eksper kullanıcısının görev alabileceği il veya ilçeleri belirtir.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={form.countrywide}
                      onChange={(e) => setForm({ ...form, countrywide: e.target.checked, serviceAreas: e.target.checked ? [] : form.serviceAreas })}
                      className="rounded border-slate-300 text-brand-600"
                    />
                    Tüm Türkiye
                  </label>
                </div>
                {!form.countrywide && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="mb-3 flex gap-2">
                      <SearchableSelect
                        className="flex-1 min-w-0"
                        options={provinceOptions}
                        value={selectedProvinceId}
                        onChange={(provinceId) => {
                          setSelectedProvinceId(provinceId);
                          loadDistricts(provinceId);
                        }}
                        placeholder={ADDRESS_FIELD.provinceSearchPlaceholder}
                        emptyText={ADDRESS_FIELD.provinceSearchEmpty}
                        inputClassName="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                          {selectedProvinceId && (
                            <>
                              <button
                                type="button"
                                onClick={addWholeProvince}
                                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700"
                              >
                                Tüm İl
                              </button>
                              {districts.length > 0 && (
                                <button
                                  type="button"
                                  onClick={addAllDistrictsInProvinceHandler}
                                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700"
                                >
                                  Tüm İlçeler
                                </button>
                              )}
                            </>
                          )}
                    </div>
                    {selectedProvinceId && districts.length > 0 && (
                      <DistrictCheckboxGrid
                        districts={districts}
                        maxHeightClass="max-h-36"
                        gridClassName="grid gap-2 sm:grid-cols-3"
                        accentClass="accent-brand-600"
                        isChecked={(districtId) => isDistrictAreaChecked(form.serviceAreas, selectedProvinceId, districtId)}
                        onToggle={(districtId) => toggleServiceArea(selectedProvinceId, districtId)}
                      />
                    )}
                    {form.serviceAreas.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {form.serviceAreas.map((area) => (
                          <span key={`${area.provinceId}:${area.districtId ?? ''}`} className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            {area.districtId ? `${area.provinceName ?? area.provinceId} / ${area.districtName ?? area.districtId}` : `${area.provinceName ?? area.provinceId} (Tümü)`}
                            <button type="button" onClick={() => toggleServiceArea(area.provinceId, area.districtId)} className="text-blue-400 hover:text-status-danger">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

	            {form.userTask === 'operations' && (
	              <div className="order-2 col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
	                <p className="text-sm font-semibold text-slate-800">Dosya Sorumlusu Kapsamı</p>
	                <p className="mt-1 text-xs leading-5 text-slate-500">
	                  Meridyen Dosya Sorumlusunun hangi dosya türü, sigorta şirketi ve bölgeden sorumlu olacağını seçin.
	                </p>

	                <div className="mt-4 space-y-4">
	                  <FormField label="Dosya Türü" required error={formErrors.operationArea}>
	                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
	                      {OPERATION_AREA_OPTIONS.map((option) => (
	                        <button
	                          key={option.value}
	                          type="button"
	                          onClick={() => selectOperationArea(option.value)}
	                          className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
	                            form.operationArea === option.value
	                              ? 'border-blue-500 bg-blue-50 text-blue-700'
	                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
	                          }`}
	                        >
	                          {option.label}
	                        </button>
	                      ))}
	                    </div>
	                  </FormField>

	                  {showsInsuranceCompanyScope(form.operationArea) && (
	                  <div>
	                    <div className="mb-2 flex items-center justify-between gap-3">
	                      <p className="text-sm font-medium text-slate-700">Sigorta Şirketleri</p>
	                      {insuranceCompanies.length > 0 && (
	                        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
	                          <input
	                            type="checkbox"
	                            checked={allInsuranceCompaniesSelected}
	                            onChange={(e) => toggleAllInsuranceCompanies(e.target.checked)}
	                            className="rounded border-slate-300 text-brand-600"
	                          />
	                          Tüm Sigorta Şirketleri
	                        </label>
	                      )}
	                    </div>
	                    {formErrors.insuranceCompanyIds && (
	                      <p className="mb-2 text-xs text-red-600">{formErrors.insuranceCompanyIds}</p>
	                    )}
                    {insuranceCompanies.length === 0 ? (
                      <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        Aktif müşteri/şirket bulunamadı; kapsam seçilemez.
                      </p>
                    ) : (
                      <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
                        {insuranceCompanies.map((company) => (
                          <label key={company.id} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={allInsuranceCompaniesSelected || form.insuranceCompanyIds.includes(company.id)}
                              onChange={() => toggleInsuranceCompany(company.id)}
                              className="rounded border-slate-300 text-brand-600"
                            />
                            {company.name}
                          </label>
                        ))}
                      </div>
                    )}
	                  </div>
	                  )}

	                  {showsAcilYardimCustomerScope(form.operationArea) && (
	                  <div>
	                    <div className="mb-2 flex items-center justify-between gap-3">
	                      <p className="text-sm font-medium text-slate-700">Acil Yardım Müşterileri</p>
	                      {acilYardimCustomers.length > 0 && (
	                        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
	                          <input
	                            type="checkbox"
	                            checked={allAcilYardimCustomersSelected}
	                            onChange={(e) => toggleAllAcilYardimCustomers(e.target.checked)}
	                            className="rounded border-slate-300 text-brand-600"
	                          />
	                          Hepsini Seç
	                        </label>
	                      )}
	                    </div>
	                    {formErrors.acilYardimCustomerIds && (
	                      <p className="mb-2 text-xs text-red-600">{formErrors.acilYardimCustomerIds}</p>
	                    )}
                    {acilYardimCustomers.length === 0 ? (
                      <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        Aktif müşteri/şirket bulunamadı; kapsam seçilemez.
                      </p>
                    ) : (
                      <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
                        {acilYardimCustomers.map((customer) => (
                          <label key={customer.id} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={allAcilYardimCustomersSelected || form.acilYardimCustomerIds.includes(customer.id)}
                              onChange={() => toggleAcilYardimCustomer(customer.id)}
                              className="rounded border-slate-300 text-brand-600"
                            />
                            {customer.name}
                          </label>
                        ))}
                      </div>
                    )}
	                  </div>
	                  )}

	                  {showsOperationsServiceAreaScope(form.operationArea) && (
	                  <GeographicRegionScopePanel
	                    regions={geographicRegions}
	                    provinces={provinces}
	                    selectedRegionIds={form.selectedGeographicRegionIds}
	                    serviceAreas={form.serviceAreas}
	                    countrywide={form.countrywide}
	                    onCountrywideChange={(checked) => {
	                      setForm((prev) => ({
	                        ...prev,
	                        countrywide: checked,
	                        serviceAreas: checked ? [] : prev.serviceAreas,
	                        selectedGeographicRegionIds: checked ? [] : prev.selectedGeographicRegionIds,
	                      }));
	                      setFormErrors((prev) => ({ ...prev, selectedGeographicRegionIds: undefined, general: undefined }));
	                    }}
	                    onToggleRegion={toggleGeographicRegion}
	                    onToggleDistrict={toggleOperationsDistrict}
	                    onSelectAllDistrictsInProvince={(provinceId) => {
	                      const province = provinces.find((p) => p.id === provinceId);
	                      setForm((prev) => ({
	                        ...prev,
	                        countrywide: false,
	                        serviceAreas: addWholeProvinceEntry(
	                          prev.serviceAreas,
	                          provinceId,
	                          province?.name,
	                        ) as ServiceAreaSelection[],
	                      }));
	                      setFormErrors((prev) => ({
	                        ...prev,
	                        selectedGeographicRegionIds: undefined,
	                        general: undefined,
	                      }));
	                    }}
	                    loadDistricts={fetchDistrictsForPanel}
	                    error={formErrors.selectedGeographicRegionIds}
	                  />
	                  )}
	                </div>
	              </div>
	            )}

            {selectedRoleIsFieldStaff && (
              <div className="order-2 col-span-2 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Meridyen Saha Operasyonu Kapsamı</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Hasar tespit, Acil saha veya her ikisi. Aynı kayıtta durur; tedarikçi kartı ayrıdır.
                  </p>
                </div>

                <FormField label="Çalışma Alanı" required error={formErrors.operationArea}>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {FIELD_OPERATION_AREA_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => selectOperationArea(option.value)}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                          form.operationArea === option.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Bu kişi eksper değildir. Tedarikçiler ayrı kayıttır. Hasar ve Acil’de hizmet kolu aranmaz.
                  </p>
                </FormField>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Saha Bölge Kapsamı</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Saha kullanıcısının görev alabileceği il veya ilçeleri belirtir. Tedarikçi kapsamı değildir.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={form.countrywide}
                        onChange={(e) => setForm({ ...form, countrywide: e.target.checked, serviceAreas: e.target.checked ? [] : form.serviceAreas })}
                        className="rounded border-slate-300 text-brand-600"
                      />
                      Tüm Türkiye
                    </label>
                  </div>
                  {!form.countrywide && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="mb-3 flex gap-2">
                        <SearchableSelect
                          className="flex-1 min-w-0"
                          options={provinceOptions}
                          value={selectedProvinceId}
                          onChange={(provinceId) => {
                            setSelectedProvinceId(provinceId);
                            loadDistricts(provinceId);
                          }}
                          placeholder={ADDRESS_FIELD.provinceSearchPlaceholder}
                          emptyText={ADDRESS_FIELD.provinceSearchEmpty}
                          inputClassName="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                          {selectedProvinceId && (
                            <>
                              <button
                                type="button"
                                onClick={addWholeProvince}
                                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700"
                              >
                                Tüm İl
                              </button>
                              {districts.length > 0 && (
                                <button
                                  type="button"
                                  onClick={addAllDistrictsInProvinceHandler}
                                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700"
                                >
                                  Tüm İlçeler
                                </button>
                              )}
                            </>
                          )}
                      </div>
                      {selectedProvinceId && districts.length > 0 && (
                        <DistrictCheckboxGrid
                          districts={districts}
                          maxHeightClass="max-h-36"
                          gridClassName="grid gap-2 sm:grid-cols-3"
                          accentClass="accent-brand-600"
                          isChecked={(districtId) => isDistrictAreaChecked(form.serviceAreas, selectedProvinceId, districtId)}
                          onToggle={(districtId) => toggleServiceArea(selectedProvinceId, districtId)}
                        />
                      )}
                      {form.serviceAreas.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {form.serviceAreas.map((area) => (
                            <span key={`${area.provinceId}:${area.districtId ?? ''}`} className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              {area.districtId ? `${area.provinceName ?? area.provinceId} / ${area.districtName ?? area.districtId}` : `${area.provinceName ?? area.provinceId} (Tümü)`}
                              <button type="button" onClick={() => toggleServiceArea(area.provinceId, area.districtId)} className="text-blue-400 hover:text-status-danger">×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isAdminOrManager && showsUserOperationalAuthorization(form.userTask, editingUser?.role?.code) && (
              <div className="order-2 col-span-2">
                <OperationalAccessGrantPanel
                  userId={modal === 'edit' ? editingUser?.id : undefined}
                  compact
                  defaultFlow={modal === 'add' ? 'extra_access' : resolveDefaultAuthorizationFlow(editingUser?.role?.code, form.userTask)}
                  draftExtraAccess={{
                    hasar: form.extraAccessHasar,
                    acil_yardim: form.extraAccessAcil,
                  }}
                  onDraftExtraAccessChange={(scope, enabled) => {
                    setForm((prev) => ({
                      ...prev,
                      extraAccessHasar: scope === 'hasar' ? enabled : prev.extraAccessHasar,
                      extraAccessAcil: scope === 'acil_yardim' ? enabled : prev.extraAccessAcil,
                    }));
                  }}
                />
              </div>
            )}

            {form.userTask && (
              <div className="order-3 col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <FormField label="Ad" required error={formErrors.firstName}>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) => {
                        setForm({ ...form, firstName: e.target.value });
                        setFormErrors((prev) => ({ ...prev, firstName: undefined, general: undefined }));
                      }}
                      onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, firstName: v })); }}
                      className={inputCls}
                      placeholder="Ad"
                    />
                  </FormField>
                </div>
                <div>
                  <FormField label="Soyad" required error={formErrors.lastName}>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => {
                        setForm({ ...form, lastName: e.target.value });
                        setFormErrors((prev) => ({ ...prev, lastName: undefined, general: undefined }));
                      }}
                      onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, lastName: v })); }}
                      className={inputCls}
                      placeholder="Soyad"
                    />
                  </FormField>
                </div>
                <div className="col-span-2">
                  <FormField label="Görev">
                    <input
                      type="text"
                      value={form.jobTitle}
                      onChange={(e) => {
                        setForm({ ...form, jobTitle: e.target.value });
                        setFormErrors((prev) => ({ ...prev, jobTitle: undefined, general: undefined }));
                      }}
                      onBlur={(e) => { const v = toTitleCaseTR(e.target.value.trim()); if (v) setForm((p) => ({ ...p, jobTitle: v })); }}
                      className={inputCls}
                      placeholder="Görev"
                      maxLength={80}
                    />
                  </FormField>
                </div>
                <div className="col-span-2">
                  <FormField label="E-posta" required error={formErrors.email}>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => {
                        setForm({ ...form, email: e.target.value });
                        setFormErrors((prev) => ({ ...prev, email: undefined, general: undefined }));
                      }}
                      className={inputCls}
                      placeholder="ornek@sirket.com"
                    />
                  </FormField>
                </div>
                <div className="col-span-2">
                  <FormField label="Telefon" required error={formErrors.phone}>
                    <PhoneInput
                      value={form.phone}
                      onChange={(v) => {
                        setForm({ ...form, phone: v });
                        setFormErrors((prev) => ({ ...prev, phone: undefined, general: undefined }));
                      }}
                    />
                  </FormField>
                </div>
              </div>
            )}

            </div>

              </>
            )}

            {isAdminOrManager
              && showsMeridyenWorkHoursToggle(form.userTask, selectedRole?.code ?? editingUser?.role?.code)
              && (modal === 'add'
                ? !isCustomerCompanyUserTask(form.userTask)
                : editingUser != null
                  && !editingUser.portalCustomerId
                  && !isProtectedSystemAdmin(editingUser)) && (
              <WorkHoursGateToggle
                key={editingUser?.id ?? `add-${form.userTask}`}
                compact
                userId={modal === 'edit' ? editingUser?.id : undefined}
                roleCode={selectedRole?.code ?? editingUser?.role?.code}
                portalCustomerId={modal === 'edit' ? editingUser?.portalCustomerId : null}
                restrictedOverride={
                  modal === 'add' ? form.workHoursRestricted : editingUser?.workHoursRestricted
                }
                onSaved={(next) => {
                  setForm((prev) => ({ ...prev, workHoursRestricted: next }));
                  if (modal === 'edit') {
                    setEditingUser((prev) => (prev ? { ...prev, workHoursRestricted: next } : prev));
                  }
                }}
              />
            )}

            <div className="sticky bottom-0 z-10 -mx-6 -mb-5 flex gap-3 border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-8px_18px_rgba(15,23,42,0.06)]">
              <button
                type="button"
                onClick={closeModal}
                className="h-10 flex-1 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-10 flex-1 rounded-lg bg-brand-600 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : modal === 'add' ? 'Kullanıcı Ekle' : 'Değişiklikleri Kaydet'}
              </button>
            </div>
          </div>
          )}
        </Modal>
      )}

      {/* ── Yeni Geçici Şifre Modal ────────────────────────────────────────── */}
      {modal === 'resetPwd' && editingUser && (
        <Modal
          title={
            resetCredential
              ? `Geçici Şifre Oluşturuldu — ${editingUser.firstName} ${editingUser.lastName}`
              : `Geçici Şifre Üret — ${editingUser.firstName} ${editingUser.lastName}`
          }
          onClose={closeModal}
          variant={resetCredential ? 'success' : 'default'}
        >
          {resetCredential ? (
            <CredentialSuccessPanel
              title="Geçici şifre oluşturuldu."
              description="Yeni geçici şifre başarıyla oluşturuldu. Kullanıcı ilk girişte şifresini değiştirmek zorundadır."
              email={resetCredential.email}
              temporaryPassword={resetCredential.temporaryPassword}
              mailMessage={resetCredential.mailMessage}
              onClose={closeModal}
            />
          ) : (
          <div className="space-y-4">
            {resetPwdError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {resetPwdError}
              </div>
            )}
            <p className="text-sm text-slate-500">
              Bu kullanıcı için sistem tarafından yeni geçici şifre oluşturulur ve aynı anda kullanıcıya atanır. Kullanıcı bu şifreyle giriş yaptıktan sonra ilk girişte şifresini değiştirmek zorundadır.
            </p>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
              Geçici şifre yalnız işlem başarıyla tamamlandıktan sonra tek seferlik gösterilir.
            </div>
            <div className="sticky bottom-0 z-10 -mx-6 -mb-5 flex gap-3 border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-8px_18px_rgba(15,23,42,0.06)]">
              <button
                type="button"
                onClick={closeModal}
                className="h-10 flex-1 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={saving}
                className="h-10 flex-1 rounded-lg bg-status-warning text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : 'Geçici Şifre Üret'}
              </button>
            </div>
          </div>
          )}
        </Modal>
      )}

      {confirmAction && (
        <Modal title={confirmAction.title} onClose={() => setConfirmAction(null)}>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">{confirmAction.description}</p>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => confirmAction.onConfirm()}
                disabled={bulkDeleting}
                className={`h-10 rounded-lg px-4 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
                  confirmAction.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-brand-600 hover:bg-brand-700'
                }`}
              >
                {bulkDeleting ? 'İşleniyor...' : confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
    </TableColumnsProvider>
  );
}
