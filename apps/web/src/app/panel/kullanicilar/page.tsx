'use client';

/**
 * MERIDYEN PRODUCT GUARDRAIL
 * Bu ekran teknik CRUD ekranı olarak genişletilemez.
 * İlgili ürün kararı:
 * docs/product/MERIDYEN_URUN_KARARI_ANAYASASI.md
 * docs/product/UI_GUARDRAIL_CHECKLIST.md
 */

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import axios from 'axios';
import { Archive, Check, Copy, KeyRound, Pencil, Plus, Search, UserCheck, X } from 'lucide-react';
import { PageLoadingState } from '@/components/ui/PageLoadingState';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { API, authHeader } from '@/utils/api';
import { validateEmail } from '@/utils/validators';
import {
  ACIL_YARDIM_ASSISTANT_CUSTOMER_SUB_TYPE,
  FIELD_OPERATION_AREA_OPTIONS,
  FIELD_OTHER_SUBJECT_LABEL,
  acilYardimAssistantCustomerName,
  departmentCodeMatchesArea,
  fieldOperationBranchOptions,
  findDepartmentForArea,
  isAcilYardimAssistantCustomer,
  operationAreaFromDepartmentCodes,
  sanitizeFieldOperationServiceBranches,
  showsAcilYardimCustomerScope,
  showsInsuranceCompanyScope,
  showsOperationsServiceAreaScope,
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
  onClose,
}: {
  title: string;
  description: string;
  email: string;
  temporaryPassword: string;
  mailMessage?: string;
  onClose: () => void;
}) {
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

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.2fr]">
        <div className="rounded-xl border border-emerald-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">E-posta</p>
          <p className="mt-1 break-all font-medium text-slate-800">{email}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Geçici Şifre</p>
          <TemporaryPasswordCopy value={temporaryPassword} />
        </div>
      </div>

      <p className={`mt-3 rounded-xl px-3 py-2 text-xs leading-5 ${
        mailMessage?.toLowerCase().includes('gönderilemedi')
          ? 'border border-amber-200 bg-amber-50 text-amber-900'
          : 'bg-white/70 text-slate-700'
      }`}>
        {mailMessage || 'Hoş geldin maili gönderimi denendi.'}
      </p>

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

interface ServiceBranch {
  id: string;
  name: string;
  type: 'hasar' | 'acil_yardim' | string;
  isActive?: boolean;
  sortOrder?: number;
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

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  archivedEmail?: string | null;
  archivedAt?: string | null;
  phone?: string | null;
  status: UserStatus;
  role?: Role | null;
  departmentMemberships?: DepartmentMembership[];
  serviceAreas?: ServiceAreaSelection[];
  userInsuranceCompanyScopes?: Array<{ insuranceCompanyId: string; insuranceCompany?: InsuranceCompany | null }>;
  lastLoginAt?: string | null;
  createdAt: string;
}

function isProtectedSystemAdmin(user: Pick<User, 'role'>) {
  return user.role?.code === 'admin';
}

type OperationArea = '' | 'hasar' | 'acil' | 'both';
type UserTaskCode = '' | 'management' | 'operations' | 'field_operations' | 'expert' | 'insurance_company_user' | 'finance';
type ManagementLevel = '' | 'admin' | 'manager';
type FormErrors = Partial<Record<keyof UserFormState, string>> & { general?: string };
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
  userTask: UserTaskCode;
  managementLevel: ManagementLevel;
  operationArea: OperationArea;
  insuranceCompanyIds: string[];
  acilYardimCustomerIds: string[];
  countrywide: boolean;
  serviceAreas: ServiceAreaSelection[];
  selectedSubjects: string[];
  otherSubjectNotes: string;
}

const DEFAULT_FORM: UserFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  userTask: '',
  managementLevel: '',
  operationArea: '',
  insuranceCompanyIds: [],
  acilYardimCustomerIds: [],
  countrywide: true,
  serviceAreas: [],
  selectedSubjects: [],
  otherSubjectNotes: '',
};

const USER_TASK_OPTIONS: Array<{ value: UserTaskCode; label: string; description: string }> = [
  { value: 'management', label: 'Meridyen Yönetim', description: 'Yönetici veya müdür yetki seviyesinde iç kullanıcı.' },
  { value: 'operations', label: 'Meridyen Dosya Sorumlusu', description: 'Hasar ve Acil Yardım dosyalarını ofisten yöneten Meridyen iç kullanıcısı.' },
  { value: 'field_operations', label: 'Meridyen Saha Operasyonu', description: 'Meridyen bünyesinde sahada tespit veya operasyon takibi yapan iç kullanıcı.' },
  { value: 'expert', label: 'Eksper', description: 'Eksper portalı ve eksper iş akışları için kullanıcı.' },
  { value: 'insurance_company_user', label: 'Sigorta Şirketi Kullanıcısı', description: 'Sigorta şirketi kapsamındaki portal kullanıcısı.' },
  { value: 'finance', label: 'Finans', description: 'Finans ve mali operasyon ekranlarını kullanan ekip üyesi.' },
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
  if (!role) return '—';
  if (role.code === 'admin') return 'Meridyen Yönetim';
  if (role.code === 'manager') return 'Meridyen Yönetim';
  if (role.code === 'office_staff') return 'Meridyen Dosya Sorumlusu';
  if (role.code === 'field_staff') return 'Meridyen Saha Operasyonu';
  if (role.code === 'expert' || role.code === 'adjuster') return 'Eksper';
  if (role.code === 'insurance_company_user') return 'Sigorta Şirketi Kullanıcısı';
  if (role.code === 'finance') return 'Finans';
  return role.name;
}

function isFieldStaffRole(role?: Role | null) {
  return role?.code === 'field_staff';
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

function displayRoleWithOperation(user: User) {
  if (user.role?.code === 'admin') return 'Meridyen Yönetim · Yönetici';
  if (user.role?.code === 'manager') return 'Meridyen Yönetim · Müdür';
  if (!isFieldStaffRole(user.role)) return displayRoleName(user.role);
  const area = operationAreaFromMemberships(user.departmentMemberships);
  return `${displayRoleName(user.role)} · Saha Tespit: ${operationAreaLabel(area)}`;
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
  onClose,
  children,
  variant = 'default',
  size = 'md',
}: {
  title: string;
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
          <h3 className={`text-base font-semibold ${isSuccess ? 'text-emerald-950' : 'text-slate-900'}`}>{title}</h3>
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

// ── Ana Sayfa ────────────────────────────────────────────────────────────────

function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('accessToken');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? payload.id ?? null;
  } catch {
    return null;
  }
}

export default function KullanicilarPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [insuranceCompanies, setInsuranceCompanies] = useState<InsuranceCompany[]>([]);
  const [acilYardimCustomers, setAcilYardimCustomers] = useState<AcilYardimCustomer[]>([]);
  const [serviceBranches, setServiceBranches] = useState<ServiceBranch[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState('');
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [filterRoleId, setFilterRoleId] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Seçim (toplu işlem)
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modal durumları
  const [modal, setModal] = useState<'add' | 'edit' | 'resetPwd' | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [inactiveDuplicateUser, setInactiveDuplicateUser] = useState<User | null>(null);
  const [createdCredential, setCreatedCredential] = useState<{
    email: string;
    temporaryPassword: string;
    mailMessage: string;
  } | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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
    try {
      const params: any = { limit: 200, includeInactive: 'true' };
      const r = await axios.get(`${API}/users`, {
        headers: authHeader(),
        params,
      });
      const list = r.data?.data ?? r.data ?? [];
      setUsers(Array.isArray(list) ? list.map(normalizeUser) : []);
    } catch (err: any) {
      console.error('[Kullanicilar] loadUsers hata:', err?.response?.status, err?.response?.data ?? err?.message);
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
      const r = await axios.get(`${API}/roles`, { headers: authHeader() });
      setRoles(r.data.data ?? []);
    } catch {
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
      setInsuranceCompanies(Array.isArray(list) ? list.filter(isUserInviteSelectableInsuranceCompany) : []);
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

  const loadServiceBranches = useCallback(async () => {
    try {
      const [hasar, acil] = await Promise.all([
        axios.get(`${API}/service-branches?type=hasar`, { headers: authHeader() }),
        axios.get(`${API}/service-branches?type=acil_yardim`, { headers: authHeader() }),
      ]);
      const normalize = (response: any): ServiceBranch[] => {
        const list = response.data?.data ?? response.data ?? [];
        return Array.isArray(list) ? list : [];
      };
      const hasarBranches = normalize(hasar);
      const acilBranches = normalize(acil);
      setServiceBranches(
        [
          ...sanitizeFieldOperationServiceBranches(hasarBranches, 'hasar'),
          ...sanitizeFieldOperationServiceBranches(acilBranches, 'acil_yardim'),
        ]
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'tr')),
      );
    } catch {
      setServiceBranches([]);
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

  const loadDistricts = useCallback(async (provinceId: string) => {
    if (!provinceId) {
      setDistricts([]);
      return;
    }
    try {
      const r = await axios.get(`${API}/locations/provinces/${provinceId}/districts`, { headers: authHeader() });
      const list = r.data?.data ?? r.data ?? [];
      setDistricts(Array.isArray(list) ? list : []);
    } catch {
      setDistricts([]);
    }
  }, []);

  useEffect(() => {
    setCurrentUserId(getCurrentUserId());
    loadUsers();
    loadRoles();
    loadDepartments();
    loadInsuranceCompanies();
    loadAcilYardimCustomers();
    loadServiceBranches();
    loadProvinces();
  }, [loadUsers, loadRoles, loadDepartments, loadInsuranceCompanies, loadAcilYardimCustomers, loadServiceBranches, loadProvinces]);

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

  const roleByCode = (code: string) => roles.find((role) => role.code === code);
  const managementRoles = roles.filter((role) => role.code === 'admin' || role.code === 'manager');
  const hasMultipleManagementRoles = managementRoles.length > 1;
  const selectedRole = (() => {
    if (form.userTask === 'management') {
      const level = form.managementLevel || (roleByCode('admin') ? 'admin' : 'manager');
      return roleByCode(level);
    }
    if (form.userTask === 'operations') return roleByCode('office_staff');
    if (form.userTask === 'field_operations') return roleByCode('field_staff');
    if (form.userTask === 'expert') return roleByCode('expert') ?? roleByCode('adjuster');
    if (form.userTask === 'insurance_company_user') return roleByCode('insurance_company_user');
    if (form.userTask === 'finance') return roleByCode('finance');
    return undefined;
  })();
  const selectedRoleIsFieldStaff = form.userTask === 'field_operations';
  const selectedServiceBranches = form.operationArea === 'hasar' || form.operationArea === 'acil'
    ? fieldOperationBranchOptions(serviceBranches, form.operationArea)
    : [];

  const taskFromRole = (role?: Role | null): { userTask: UserTaskCode; managementLevel: ManagementLevel } => {
    if (role?.code === 'admin') return { userTask: 'management', managementLevel: 'admin' };
    if (role?.code === 'manager') return { userTask: 'management', managementLevel: 'manager' };
    if (role?.code === 'office_staff') return { userTask: 'operations', managementLevel: '' };
    if (role?.code === 'field_staff') return { userTask: 'field_operations', managementLevel: '' };
    if (role?.code === 'expert' || role?.code === 'adjuster') return { userTask: 'expert', managementLevel: '' };
    if (role?.code === 'insurance_company_user') return { userTask: 'insurance_company_user', managementLevel: '' };
    if (role?.code === 'finance') return { userTask: 'finance', managementLevel: '' };
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
  ) => {
    const memberships = buildDepartmentMemberships(area);
    if (!memberships) return null;

    const buildCoverageForDepartment = (departmentId: string) => {
      const department = departments.find((item) => item.id === departmentId);
      const coverageConfig: Record<string, unknown> = {};
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

    const cityValues = Array.from(new Set(
      serviceAreas
        .filter((item) => !item.districtId)
        .map((item) => item.provinceName ?? provinces.find((province) => province.id === item.provinceId)?.name)
        .filter((value): value is string => Boolean(value)),
    ));
    const districtValues = Array.from(new Set(
      serviceAreas
        .filter((item) => item.districtId)
        .map((item) => item.districtName ?? districts.find((district) => district.id === item.districtId)?.name)
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

  const toggleAcilYardimCustomer = (customerId: string) => {
    setForm((prev) => ({
      ...prev,
      acilYardimCustomerIds: prev.acilYardimCustomerIds.includes(customerId)
        ? prev.acilYardimCustomerIds.filter((id) => id !== customerId)
        : [...prev.acilYardimCustomerIds, customerId],
    }));
    setFormErrors((prev) => ({ ...prev, acilYardimCustomerIds: undefined, general: undefined }));
  };

  const selectSingleInsuranceCompany = (companyId: string) => {
    setForm((prev) => ({ ...prev, insuranceCompanyIds: [companyId] }));
    setFormErrors((prev) => ({ ...prev, insuranceCompanyIds: undefined, general: undefined }));
  };

  const selectUserTask = (value: UserTaskCode) => {
    setForm((prev) => ({
      ...prev,
      userTask: value,
      managementLevel: value === 'management' ? prev.managementLevel : '',
      operationArea: value === 'field_operations' || value === 'operations'
        ? (value === prev.userTask ? prev.operationArea : '')
        : '',
      insuranceCompanyIds: value === 'operations' || value === 'insurance_company_user'
        ? prev.insuranceCompanyIds.slice(0, value === 'insurance_company_user' ? 1 : undefined)
        : [],
      acilYardimCustomerIds: value === 'operations' ? prev.acilYardimCustomerIds : [],
      countrywide: value === 'operations' || value === 'field_operations' || value === 'expert' ? prev.countrywide : true,
      serviceAreas: value === 'operations' || value === 'field_operations' || value === 'expert' ? prev.serviceAreas : [],
      selectedSubjects: value === 'field_operations' ? prev.selectedSubjects : [],
    }));
    setFormErrors((prev) => ({
      ...prev,
      userTask: undefined,
      managementLevel: undefined,
      insuranceCompanyIds: undefined,
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
      ...(prev.userTask === 'operations' && area === 'acil'
        ? { serviceAreas: [], countrywide: true }
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

  const toggleSelectedSubject = (value: string) => {
    setForm((prev) => ({
      ...prev,
      selectedSubjects: prev.selectedSubjects.includes(value)
        ? prev.selectedSubjects.filter((item) => item !== value)
        : [...prev.selectedSubjects, value],
      otherSubjectNotes: value === FIELD_OTHER_SUBJECT_LABEL && prev.selectedSubjects.includes(value)
        ? ''
        : prev.otherSubjectNotes,
    }));
    setFormErrors((prev) => ({ ...prev, selectedSubjects: undefined, otherSubjectNotes: undefined, general: undefined }));
  };

  const toggleServiceArea = (provinceId: string, districtId: string | null) => {
    const province = provinces.find((item) => item.id === provinceId);
    const district = districtId ? districts.find((item) => item.id === districtId) : null;
    const key = `${provinceId}:${districtId ?? ''}`;
    setForm((prev) => {
      const exists = prev.serviceAreas.some((item) => `${item.provinceId}:${item.districtId ?? ''}` === key);
      return {
        ...prev,
        serviceAreas: exists
          ? prev.serviceAreas.filter((item) => `${item.provinceId}:${item.districtId ?? ''}` !== key)
          : [
              ...prev.serviceAreas.filter((item) => districtId || item.provinceId !== provinceId),
              {
                provinceId,
                districtId,
                provinceName: province?.name,
                districtName: district?.name ?? null,
              },
            ],
      };
    });
  };

  const addWholeProvince = () => {
    if (!selectedProvinceId) return;
    toggleServiceArea(selectedProvinceId, null);
  };

  const addAllDistrictsInProvince = () => {
    if (!selectedProvinceId || districts.length === 0) return;
    const province = provinces.find((item) => item.id === selectedProvinceId);
    setForm((prev) => {
      const withoutProvinceDistricts = prev.serviceAreas.filter(
        (area) => !(area.provinceId === selectedProvinceId && area.districtId),
      );
      const districtEntries = districts.map((district) => ({
        provinceId: selectedProvinceId,
        districtId: district.id,
        provinceName: province?.name,
        districtName: district.name,
      }));
      return { ...prev, serviceAreas: [...withoutProvinceDistricts, ...districtEntries] };
    });
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
    setInactiveDuplicateUser(null);
    setCreatedCredential(null);
    setEditingUser(null);
    setModal('add');
  };

  const openEdit = (u: User) => {
    const task = taskFromRole(u.role);
    setForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone ?? '',
      userTask: task.userTask,
      managementLevel: task.managementLevel,
      operationArea: (isFieldStaffRole(u.role) || u.role?.code === 'office_staff') ? operationAreaFromMemberships(u.departmentMemberships) : '',
      insuranceCompanyIds: task.userTask === 'insurance_company_user'
        ? (u.userInsuranceCompanyScopes ?? []).map((scope) => scope.insuranceCompanyId).filter(Boolean).slice(0, 1)
        : (u.userInsuranceCompanyScopes ?? []).map((scope) => scope.insuranceCompanyId).filter(Boolean),
      acilYardimCustomerIds: [],
      countrywide: (u.serviceAreas ?? []).length === 0,
      serviceAreas: (u.serviceAreas ?? []).map((area: any) => ({
        provinceId: area.provinceId,
        districtId: area.districtId ?? null,
        provinceName: area.province?.name ?? area.provinceName,
        districtName: area.district?.name ?? area.districtName ?? null,
      })),
      selectedSubjects: [],
      otherSubjectNotes: '',
    });
    setSelectedProvinceId('');
    setDistricts([]);
    setFormError('');
    setFormErrors({});
    setInactiveDuplicateUser(null);
    setCreatedCredential(null);
    setEditingUser(u);
    setModal('edit');
  };

  const closeModal = () => {
    setModal(null);
    setEditingUser(null);
    setForm(DEFAULT_FORM);
    setFormError('');
    setFormErrors({});
    setInactiveDuplicateUser(null);
    setCreatedCredential(null);
    setResetPwdError('');
    setResetCredential(null);
  };

  const validateUserForm = () => {
    const nextErrors: FormErrors = {};
    if (!form.firstName.trim()) nextErrors.firstName = 'Ad zorunludur.';
    if (!form.lastName.trim()) nextErrors.lastName = 'Soyad zorunludur.';
    if (!form.email.trim()) nextErrors.email = 'E-posta zorunludur.';
    else if (!validateEmail(form.email)) nextErrors.email = 'Geçerli bir e-posta adresi girilmelidir.';
    if (!form.userTask) nextErrors.userTask = 'Bu kişi kim? seçimi zorunludur.';
    if (form.userTask === 'management' && hasMultipleManagementRoles && !form.managementLevel) {
      nextErrors.managementLevel = 'Yetki seviyesi seçilmelidir.';
    }
    if (form.userTask && !selectedRole) {
      nextErrors.userTask = 'Seçilen görev için sistem rolü bulunamadı.';
    }
    if (selectedRoleIsFieldStaff && !form.operationArea) {
      nextErrors.operationArea = 'Hasar Onarım veya Acil Yardım seçilmelidir.';
    }
    if (selectedRoleIsFieldStaff && form.operationArea) {
      const hasBranch = form.selectedSubjects.some((item) => item !== FIELD_OTHER_SUBJECT_LABEL);
      const hasOther = form.selectedSubjects.includes(FIELD_OTHER_SUBJECT_LABEL);
      if (!hasBranch && !hasOther) {
        nextErrors.selectedSubjects = 'En az bir hizmet branşı seçilmelidir.';
      }
      if (hasOther && !form.otherSubjectNotes.trim()) {
        nextErrors.otherSubjectNotes = 'Diğer seçildiğinde açıklama girilmelidir.';
      }
    }
    if (form.userTask === 'operations' && !form.operationArea) {
      nextErrors.operationArea = 'Dosya türü kapsamı seçilmelidir.';
    }
    if (form.userTask === 'insurance_company_user' && form.insuranceCompanyIds.length !== 1) {
      nextErrors.insuranceCompanyIds = 'Sigorta şirketi seçilmelidir.';
    }
    if (form.userTask === 'operations' && showsInsuranceCompanyScope(form.operationArea) && form.insuranceCompanyIds.length === 0) {
      nextErrors.insuranceCompanyIds = 'Sigorta şirketi seçilmelidir.';
    }
    if (form.userTask === 'operations' && showsAcilYardimCustomerScope(form.operationArea) && form.acilYardimCustomerIds.length === 0) {
      nextErrors.acilYardimCustomerIds = 'Acil yardım müşterisi seçilmelidir.';
    }
    setFormErrors(nextErrors);
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
        phone: form.phone || undefined,
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

      if (form.userTask === 'insurance_company_user') {
        payload.insuranceCompanyIds = form.insuranceCompanyIds.slice(0, 1);
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

      if (form.userTask === 'operations') {
        const usesRegions = showsOperationsServiceAreaScope(form.operationArea);
        payload.responsibilityAssignments = buildResponsibilityAssignments(
          form.operationArea,
          usesRegions ? form.serviceAreas : [],
          usesRegions ? form.countrywide : true,
          [],
          form.acilYardimCustomerIds,
        );
      }

      if (selectedRoleIsFieldStaff) {
        payload.responsibilityAssignments = buildResponsibilityAssignments(
          form.operationArea,
          form.serviceAreas,
          form.countrywide,
          form.selectedSubjects,
          [],
          form.otherSubjectNotes,
        );
      }

      if (modal === 'add') {
        const normalizedEmail = form.email.trim().toLowerCase();
        const dupEmail = users.find((u) => u.email.toLowerCase() === normalizedEmail);
        const dupStatus = dupEmail ? normalizeUserStatus(dupEmail.status) : null;

        if (dupStatus === 'active') {
          setFormError('Bu e-posta adresiyle aktif bir kullanıcı zaten mevcut!');
          setSaving(false);
          return;
        }

        if (dupEmail && dupStatus && canReinviteByEmail(dupStatus)) {
          setInactiveDuplicateUser(dupEmail);
        } else {
          setInactiveDuplicateUser(null);
        }

        payload.email = normalizedEmail;
        const response = await axios.post(
          `${API}/users`,
          payload,
          { headers: authHeader() },
        );
        const created = response.data?.data;
        const mailMessage = created?.welcomeEmail?.message ?? 'Hoş geldin maili gönderimi denendi.';
        const oneTimePassword = created?.temporaryPassword;
        if (oneTimePassword) {
          setCreatedCredential({
            email: created.email ?? payload.email,
            temporaryPassword: oneTimePassword,
            mailMessage: created?.reinvited
              ? `${mailMessage} Pasif/arşiv kullanıcı yeniden davet edildi.`
              : mailMessage,
          });
          setInactiveDuplicateUser(null);
          await loadUsers();
          return;
        } else {
          setFormError('Kullanıcı oluşturuldu ancak geçici şifre oluşturma cevabında görüntülenemedi. Kabul testine devam etmeyin.');
          await loadUsers();
          return;
        }
      } else if (modal === 'edit' && editingUser) {
        await axios.patch(`${API}/users/${editingUser.id}`, payload, {
          headers: authHeader(),
        });
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
    if (u.status === 'archived') {
      setConfirmAction({
        title: 'Kullanıcıyı yeniden aktifleştir',
        description: `${u.firstName} ${u.lastName} (${u.archivedEmail ?? u.email}) kullanıcısı arşivden çıkarılacak.`,
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

    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    if (newStatus === 'inactive') {
      setConfirmAction({
        title: 'Kullanıcıyı pasifleştir',
        description: `${u.firstName} ${u.lastName} (${u.email}) kullanıcısı pasif hale getirilecek.`,
        confirmLabel: 'Pasifleştir',
        variant: 'danger',
        onConfirm: async () => {
          try {
            await axios.patch(
              `${API}/users/${u.id}`,
              { status: newStatus },
              { headers: authHeader() },
            );
            setUserStatusInList(u.id, 'inactive');
            setActionMessage({ type: 'success', text: 'Kullanıcı pasifleştirildi.' });
            await loadUsers();
          } catch (err: any) {
            setActionMessage({ type: 'error', text: err?.response?.data?.message ?? 'Kullanıcı durumu güncellenemedi.' });
          } finally {
            setConfirmAction(null);
          }
        },
      });
      return;
    }
    try {
      const response = await axios.patch(
        `${API}/users/${u.id}`,
        { status: newStatus },
        { headers: authHeader() },
      );
      const updatedUser = response.data?.data;
      if (updatedUser?.id) {
        setUsers((prev) => prev.map((item) => (item.id === updatedUser.id ? normalizeUser({ ...item, ...updatedUser }) : item)));
      } else {
        setUserStatusInList(u.id, 'active');
      }
      setActionMessage({ type: 'success', text: 'Kullanıcı aktifleştirildi.' });
      await loadUsers();
      setUserStatusInList(u.id, 'active');
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.response?.data?.message ?? 'Kullanıcı durumu güncellenemedi.' });
    }
  };

  const handleBulkStatus = async (newStatus: 'active' | 'inactive') => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

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
    <div className="space-y-6">
      <Link
        href="/panel/ayarlar"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-700"
      >
        ← Ayarlar
      </Link>
      {/* Başlık */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">Kullanıcı Yönetimi</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sistem kullanıcılarını görüntüleyin ve yönetin.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Kullanıcı Davet Et
        </button>
      </div>

      {actionMessage && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          actionMessage.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {actionMessage.text}
        </div>
      )}

      {/* Filtreler */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad, e-posta veya rol ara..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 min-w-[150px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Tümü</option>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
            <option value="archived">Arşiv</option>
          </select>
          <select
            value={filterRoleId}
            onChange={(e) => setFilterRoleId(e.target.value)}
            className="h-10 min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Tüm Görevler</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {displayRoleName(r)}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Arşivlenen kullanıcılar veri hafızası korunarak saklanır ve Arşiv filtresinden yeniden aktifleştirilebilir.
        </p>

        {/* Toplu işlem toolbar */}
        {selected.size > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
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

      {/* Tablo */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <PageLoadingState text="Kullanıcılar yükleniyor" compact />
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-slate-700">
              {search || filterStatus || filterRoleId
                ? 'Filtrelere uyan kullanıcı bulunamadı.'
                : 'Henüz kullanıcı yok.'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {search || filterStatus || filterRoleId
                ? 'Arama veya filtreleri değiştirerek tekrar deneyin.'
                : 'Yeni kullanıcı oluşturduğunuzda kayıtlar burada listelenir.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left">
                    <button
                      type="button"
                      onClick={selectAll}
                      className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                        selected.size === filtered.length && filtered.length > 0
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-slate-300 bg-white hover:border-blue-400'
                      }`}
                      aria-label="Tüm kullanıcıları seç"
                    >
                      {selected.size === filtered.length && filtered.length > 0 && (
                        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ad Soyad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    E-posta
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Görev
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Durum
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Son Giriş
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => {
                  const rowStatus = normalizeUserStatus(u.status);
                  return (
                  <tr
                    key={`${u.id}-${rowStatus}`}
                    className={`transition-colors hover:bg-slate-50 ${selected.has(u.id) ? 'bg-blue-50/50' : ''} ${rowStatus !== 'active' ? 'opacity-70' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3">
                      {isProtectedSystemAdmin(u) || u.id === currentUserId ? (
                        <span
                          className="inline-flex h-4 w-4 rounded border border-slate-200 bg-slate-100"
                          title={u.id === currentUserId ? 'Kendi hesabınızı seçemezsiniz' : 'Sistem yöneticisi seçilemez'}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleSelect(u.id)}
                          className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                            selected.has(u.id) ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white hover:border-blue-400'
                          }`}
                          aria-label={`${u.firstName} ${u.lastName} seç`}
                        >
                          {selected.has(u.id) && (
                            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                          )}
                        </button>
                      )}
                    </td>

                    {/* Ad Soyad */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-950">
                            {u.firstName} {u.lastName}
                          </p>
                          {u.phone && (
                            <p className="text-xs text-slate-400">{u.phone}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* E-posta */}
                    <td className="px-4 py-3 text-slate-600">
                      <span className="break-all">{u.email}</span>
                    </td>

                    {/* Rol */}
                    <td className="px-4 py-3">
                      {u.role ? (
                        <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                          {displayRoleWithOperation(u)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Durum */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeCls(rowStatus)}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${rowStatus === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        />
                        {statusLabel(rowStatus)}
                      </span>
                    </td>

                    {/* Son Giriş */}
                    <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(u.lastLoginAt)}</td>

                    {/* İşlemler */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Düzenle */}
                        {isProtectedSystemAdmin(u) ? (
                          <div className="relative group">
                            <button
                              type="button"
                              disabled
                              title="Sistem yöneticisi düzenlenemez"
                              className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-lg text-slate-200"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:block z-10">
                              <div className="bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                                Sistem yöneticisi düzenlenemez
                                <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-800" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            title="Düzenle"
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}

                        {!isProtectedSystemAdmin(u) && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUser(u);
                              setResetPwdError('');
                              setResetCredential(null);
                              setModal('resetPwd');
                            }}
                            title="Geçici Şifre Üret"
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-amber-50 hover:text-amber-700"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                        )}

                        {(rowStatus === 'inactive' || rowStatus === 'archived') && !isProtectedSystemAdmin(u) && u.id !== currentUserId && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            className="inline-flex h-9 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                            title="Arşiv veya pasif kullanıcıyı yeniden aktif hale getirir."
                          >
                            Yeniden Aktifleştir
                          </button>
                        )}

                        {rowStatus === 'active' && !isProtectedSystemAdmin(u) && u.id !== currentUserId && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                            title="Kullanıcıyı silmez; pilot ve operasyon güvenliği için pasif hale getirir."
                          >
                            <Archive className="h-3.5 w-3.5" />
                            Arşivle
                          </button>
                        )}

                        {/* Aktif/Pasif Toggle */}
                        {isProtectedSystemAdmin(u) ? (
                          <div className="relative group">
                            <button
                              type="button"
                              disabled
                              className="relative inline-flex items-center h-5 w-9 shrink-0 rounded-full cursor-not-allowed opacity-40 bg-green-500"
                            >
                              <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 translate-x-4" />
                            </button>
                            <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:block z-10">
                              <div className="bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                                Sistem yöneticisi düzenlenemez
                                <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-800" />
                              </div>
                            </div>
                          </div>
                        ) : u.id === currentUserId ? (
                          <div
                            title="Kendi hesabınızı pasife alamazsınız"
                            className="relative group"
                          >
                            <button
                              type="button"
                              disabled
                              className={`relative inline-flex items-center h-5 w-9 shrink-0 rounded-full cursor-not-allowed opacity-40 ${
                                rowStatus === 'active' ? 'bg-green-500' : 'bg-slate-300'
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                                  rowStatus === 'active' ? 'translate-x-4' : 'translate-x-0.5'
                                }`}
                              />
                            </button>
                            <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:block z-10">
                              <div className="bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                                Kendi hesabınızı pasife alamazsınız
                                <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-800" />
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Alt bilgi */}
        {!loading && (
          <div className="px-4 py-3 border-t border-slate-50 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {filtered.length} kullanıcı gösteriliyor
              {(search || filterStatus || filterRoleId) && ` (${users.length} toplam)`}
            </p>
          </div>
        )}
      </div>

      {/* ── Kullanıcı Davet Et / Düzenle Modal ────────────────────────────── */}
      {(modal === 'add' || modal === 'edit') && (
        <Modal
          title={createdCredential ? 'Davet Tamamlandı' : modal === 'add' ? 'Kullanıcı Davet Et' : 'Kullanıcıyı Düzenle'}
          onClose={closeModal}
          variant={createdCredential ? 'success' : 'default'}
          size={modal === 'add' && !createdCredential ? 'lg' : 'md'}
        >
          {createdCredential ? (
            <CredentialSuccessPanel
              title="Kullanıcı daveti tamamlandı."
              description="Yeni kullanıcı oluşturuldu ve geçici şifre üretildi. Bu şifre yalnızca bir kez görüntülenir."
              email={createdCredential.email}
              temporaryPassword={createdCredential.temporaryPassword}
              mailMessage={createdCredential.mailMessage}
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
                  {inactiveDuplicateUser.firstName} {inactiveDuplicateUser.lastName} bu e-posta ile kayıtlı.
                  Davet Gönder ile aynı e-posta yeniden aktifleştirilir; yeni geçici şifre üretilir.
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
            {modal === 'add' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Davet bilgileri tek ekranda tamamlanır.</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Önce görev tipini seçin; sigorta şirketi, eksper veya Meridyen personeli ayrımı buna göre açılır. Boş bırakılırsa sistem geçici şifre üretir.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
            <div className="order-1 col-span-2">
              <FormField label="Bu kişi kim?" required error={formErrors.userTask}>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {USER_TASK_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => selectUserTask(option.value)}
                      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                        form.userTask === option.value
                          ? 'border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-200'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Tedarikçiler kullanıcı rolü olarak değil; Tedarikçiler ekranında ayrı kayıt olarak yönetilir.
                </p>
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

            {form.userTask === 'insurance_company_user' && (
              <div className="order-2 col-span-2">
              <FormField label="Sigorta Şirketi" required error={formErrors.insuranceCompanyIds}>
                {insuranceCompanies.length === 0 ? (
                  <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Aktif sigorta şirketi bulunamadı; sigorta şirketi kullanıcısı kaydedilemez.
                  </p>
                ) : (
                  <div className="grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
                    {insuranceCompanies.map((company) => (
                      <label key={company.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="radio"
                          name="insurance-company-user-company"
                          checked={form.insuranceCompanyIds[0] === company.id}
                          onChange={() => selectSingleInsuranceCompany(company.id)}
                          className="border-slate-300 text-blue-600"
                        />
                        {company.name}
                      </label>
                    ))}
                  </div>
                )}
                <p className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
                  Sigorta Şirketi Kullanıcısı yalnız bir sigorta şirketine bağlıdır. Çoklu şirket kapsamı Meridyen Dosya Sorumlusu için kullanılır.
                </p>
              </FormField>
              </div>
            )}

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
                      className="rounded border-slate-300 text-blue-600"
                    />
                    Tüm Türkiye
                  </label>
                </div>
                {!form.countrywide && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="mb-3 flex gap-2">
                      <select
                        value={selectedProvinceId}
                        onChange={(e) => {
                          setSelectedProvinceId(e.target.value);
                          loadDistricts(e.target.value);
                        }}
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="">İl seçin...</option>
                        {provinces.map((province) => (
                          <option key={province.id} value={province.id}>
                            {province.name}
                          </option>
                        ))}
                      </select>
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
                                  onClick={addAllDistrictsInProvince}
                                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700"
                                >
                                  Tüm İlçeler
                                </button>
                              )}
                            </>
                          )}
                    </div>
                    {selectedProvinceId && districts.length > 0 && (
                      <div className="grid max-h-36 gap-2 overflow-y-auto rounded-lg bg-slate-50 p-2 sm:grid-cols-3">
                        {districts.map((district) => (
                          <label key={district.id} className="flex items-center gap-1.5 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={form.serviceAreas.some((area) => area.provinceId === selectedProvinceId && area.districtId === district.id)}
                              onChange={() => toggleServiceArea(selectedProvinceId, district.id)}
                              className="rounded border-slate-300 text-blue-600"
                            />
                            {district.name}
                          </label>
                        ))}
                      </div>
                    )}
                    {form.serviceAreas.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {form.serviceAreas.map((area) => (
                          <span key={`${area.provinceId}:${area.districtId ?? ''}`} className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            {area.districtId ? `${area.provinceName ?? area.provinceId} / ${area.districtName ?? area.districtId}` : `${area.provinceName ?? area.provinceId} (Tümü)`}
                            <button type="button" onClick={() => toggleServiceArea(area.provinceId, area.districtId)} className="text-blue-400 hover:text-red-500">×</button>
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
	                    <p className="mb-2 text-sm font-medium text-slate-700">Sigorta Şirketleri</p>
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
	                              checked={form.insuranceCompanyIds.includes(company.id)}
	                              onChange={() => toggleInsuranceCompany(company.id)}
	                              className="rounded border-slate-300 text-blue-600"
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
	                    <p className="mb-2 text-sm font-medium text-slate-700">Acil Yardım Müşterileri</p>
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
	                              checked={form.acilYardimCustomerIds.includes(customer.id)}
	                              onChange={() => toggleAcilYardimCustomer(customer.id)}
	                              className="rounded border-slate-300 text-blue-600"
	                            />
	                            {customer.name}
	                          </label>
	                        ))}
	                      </div>
	                    )}
	                  </div>
	                  )}

	                  {showsOperationsServiceAreaScope(form.operationArea) && (
	                  <div>
	                    <div className="mb-2 flex items-center justify-between gap-3">
	                      <p className="text-sm font-medium text-slate-700">Bölgeler</p>
	                      <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
	                        <input
	                          type="checkbox"
	                          checked={form.countrywide}
	                          onChange={(e) => setForm({ ...form, countrywide: e.target.checked, serviceAreas: e.target.checked ? [] : form.serviceAreas })}
	                          className="rounded border-slate-300 text-blue-600"
	                        />
	                        Tüm Türkiye
	                      </label>
	                    </div>
	                    {!form.countrywide && (
	                      <div className="rounded-xl border border-slate-200 bg-white p-3">
	                        <div className="mb-3 flex gap-2">
	                          <select
	                            value={selectedProvinceId}
	                            onChange={(e) => {
	                              setSelectedProvinceId(e.target.value);
	                              loadDistricts(e.target.value);
	                            }}
	                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
	                          >
	                            <option value="">İl seçin...</option>
	                            {provinces.map((province) => (
	                              <option key={province.id} value={province.id}>
	                                {province.name}
	                              </option>
	                            ))}
	                          </select>
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
                                  onClick={addAllDistrictsInProvince}
                                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700"
                                >
                                  Tüm İlçeler
                                </button>
                              )}
                            </>
                          )}
	                        </div>
	                        {selectedProvinceId && districts.length > 0 && (
	                          <div className="grid max-h-36 gap-2 overflow-y-auto rounded-lg bg-slate-50 p-2 sm:grid-cols-3">
	                            {districts.map((district) => (
	                              <label key={district.id} className="flex items-center gap-1.5 text-xs text-slate-600">
	                                <input
	                                  type="checkbox"
	                                  checked={form.serviceAreas.some((area) => area.provinceId === selectedProvinceId && area.districtId === district.id)}
	                                  onChange={() => toggleServiceArea(selectedProvinceId, district.id)}
	                                  className="rounded border-slate-300 text-blue-600"
	                                />
	                                {district.name}
	                              </label>
	                            ))}
	                          </div>
	                        )}
	                        {form.serviceAreas.length > 0 && (
	                          <div className="mt-3 flex flex-wrap gap-1.5">
	                            {form.serviceAreas.map((area) => (
	                              <span key={`${area.provinceId}:${area.districtId ?? ''}`} className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
	                                {area.districtId ? `${area.provinceName ?? area.provinceId} / ${area.districtName ?? area.districtId}` : `${area.provinceName ?? area.provinceId} (Tümü)`}
	                                <button type="button" onClick={() => toggleServiceArea(area.provinceId, area.districtId)} className="text-blue-400 hover:text-red-500">×</button>
	                              </span>
	                            ))}
	                          </div>
	                        )}
	                      </div>
	                    )}
	                  </div>
	                  )}
	                </div>
	              </div>
	            )}

            {selectedRoleIsFieldStaff && (
              <div className="order-2 col-span-2 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Meridyen Saha Operasyonu Kapsamı</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Önce Hasar Onarım mı Acil Yardım mı çalışacağını seçin; ardından yaptığı işleri işaretleyin.
                  </p>
                </div>

                <FormField label="Çalışma Alanı" required error={formErrors.operationArea}>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                    Bu kişi Eksper değildir ve Tedarikçi değildir. Tedarikçiler ayrı kayıt olarak yönetilir.
                  </p>
                </FormField>

                {form.operationArea && (
                  <FormField
                    label={form.operationArea === 'hasar' ? 'Hasar Onarım — Hizmet Branşları' : 'Acil Yardım — Hizmet Branşları'}
                    required
                    error={formErrors.selectedSubjects}
                  >
                    {selectedServiceBranches.length === 0 ? (
                      <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                        Bu çalışma alanı için aktif hizmet branşı bulunamadı. Liste Ayarlar → Hizmet Branşları ekranından gelir.
                      </p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {selectedServiceBranches.map((branch) => (
                          <label
                            key={branch.id}
                            className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                              form.selectedSubjects.includes(branch.name)
                                ? 'border-blue-500 bg-blue-50 text-blue-800'
                                : 'border-slate-200 bg-white text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={form.selectedSubjects.includes(branch.name)}
                              onChange={() => toggleSelectedSubject(branch.name)}
                              className="mt-0.5 rounded border-slate-300 text-blue-600"
                            />
                            <span>{branch.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {form.operationArea === 'hasar' && form.selectedSubjects.includes(FIELD_OTHER_SUBJECT_LABEL) && (
                      <div className="mt-3">
                        <FormField label="Diğer — İlave Bilgiler ve Notlar" error={formErrors.otherSubjectNotes}>
                          <textarea
                            rows={3}
                            value={form.otherSubjectNotes}
                            onChange={(e) => {
                              setForm((prev) => ({ ...prev, otherSubjectNotes: e.target.value }));
                              setFormErrors((prev) => ({ ...prev, otherSubjectNotes: undefined, general: undefined }));
                            }}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                            placeholder="Tanımlı iş kollarının dışında yaptığı işleri yazın..."
                          />
                        </FormField>
                      </div>
                    )}
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Liste Ayarlar → Hizmet Branşları ekranındaki iş kolu tanımlarından gelir.
                    </p>
                  </FormField>
                )}

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
                        className="rounded border-slate-300 text-blue-600"
                      />
                      Tüm Türkiye
                    </label>
                  </div>
                  {!form.countrywide && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="mb-3 flex gap-2">
                        <select
                          value={selectedProvinceId}
                          onChange={(e) => {
                            setSelectedProvinceId(e.target.value);
                            loadDistricts(e.target.value);
                          }}
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        >
                          <option value="">İl seçin...</option>
                          {provinces.map((province) => (
                            <option key={province.id} value={province.id}>
                              {province.name}
                            </option>
                          ))}
                        </select>
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
                                  onClick={addAllDistrictsInProvince}
                                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700"
                                >
                                  Tüm İlçeler
                                </button>
                              )}
                            </>
                          )}
                      </div>
                      {selectedProvinceId && districts.length > 0 && (
                        <div className="grid max-h-36 gap-2 overflow-y-auto rounded-lg bg-slate-50 p-2 sm:grid-cols-3">
                          {districts.map((district) => (
                            <label key={district.id} className="flex items-center gap-1.5 text-xs text-slate-600">
                              <input
                                type="checkbox"
                                checked={form.serviceAreas.some((area) => area.provinceId === selectedProvinceId && area.districtId === district.id)}
                                onChange={() => toggleServiceArea(selectedProvinceId, district.id)}
                                className="rounded border-slate-300 text-blue-600"
                              />
                              {district.name}
                            </label>
                          ))}
                        </div>
                      )}
                      {form.serviceAreas.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {form.serviceAreas.map((area) => (
                            <span key={`${area.provinceId}:${area.districtId ?? ''}`} className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              {area.districtId ? `${area.provinceName ?? area.provinceId} / ${area.districtName ?? area.districtId}` : `${area.provinceName ?? area.provinceId} (Tümü)`}
                              <button type="button" onClick={() => toggleServiceArea(area.provinceId, area.districtId)} className="text-blue-400 hover:text-red-500">×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {form.userTask && (
              <>
                <div className="order-3">
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
                <div className="order-3">
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
                <div className="order-3 col-span-2">
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
                <div className="order-3 col-span-2">
                  <FormField label="Telefon">
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className={inputCls}
                      placeholder="0532 123 45 67"
                    />
                  </FormField>
                </div>
              </>
            )}

            </div>

              </>
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
                className="h-10 flex-1 rounded-lg bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : modal === 'add' ? 'Davet Gönder' : 'Değişiklikleri Kaydet'}
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
                className="h-10 flex-1 rounded-lg bg-amber-500 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
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
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {bulkDeleting ? 'İşleniyor...' : confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
