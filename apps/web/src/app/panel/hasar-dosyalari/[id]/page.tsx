'use client';

import { API, authHeader } from '@/utils/api';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import {
  repairReportStatusBadge,
  repairReportStatusLabel,
} from '@/utils/repair-report-status';
import { FinansRaporOzeti } from './_components/FinansRaporOzeti';
import { FinansTab } from './_components/tabs/FinansTab';
import { OnarimRaporuTab } from './_components/tabs/OnarimRaporuTab';
import { EvraklarTab } from './_components/tabs/EvraklarTab';
import { TakipTab } from './_components/tabs/TakipTab';
import { DosyaBilgileriDetay, resolveDosyaEksperi, resolveIhbarTarihi } from './_components/DosyaBilgileriDetay';
import { resolveHasarInsuredName } from '@/utils/claim-insured-display';
import { FinansOzetErisimPanel } from './_components/FinansOzetErisimPanel';
import {
  collectOfficeAssignees,
  FinVisConfig,
  resolveFinVisConfig,
} from './_components/financial-visibility-config';
import { resolveClaimIhbarKonusu, toTitleCaseTR, formatHasarAdresi } from '@/utils/text-helpers';
import { FieldSurveyBriefModal } from '@/components/field-survey/FieldSurveyBriefModal';
import { FieldSurveyBriefList } from '@/components/field-survey/FieldSurveyBriefList';
import { DelegationBanner } from '@/components/delegation/DelegationBanner';
import { PhoneContactActions } from '@/components/ui/PhoneContactActions';
import { buildClaimAssignmentWhatsAppMessage } from '@/utils/claim-whatsapp-message';
import { RevisionHistoryStrip } from '@/components/damage-reports/RevisionHistoryStrip';
import { ClaimStageStrip } from '@/components/damage-reports/ClaimStageStrip';
import {
  ClipboardList,
  FileText,
  FolderOpen,
  Settings2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { resolveOperationStatusLabel } from '@sigorta/shared';


function normalizeRoleCode(roleCode?: string | null): string | null {
  if (!roleCode) return null;
  return String(roleCode).trim().toLowerCase().replace(/\s+/g, '_');
}

function getCurrentUserRole(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    for (const key of ['user', 'currentUser']) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const u = JSON.parse(raw);
      const roleCode = normalizeRoleCode(u?.role?.code ?? u?.roleCode);
      if (roleCode) return roleCode;
    }
    return null;
  } catch { return null; }
}

function userHasPermission(code: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('user') ?? localStorage.getItem('currentUser');
    if (!raw) return false;
    const u = JSON.parse(raw);
    return Array.isArray(u?.permissions) && u.permissions.includes(code);
  } catch {
    return false;
  }
}

function canUserAssignClaim(userRoleCode: string | null, isFieldStaff: boolean): boolean {
  if (isFieldStaff) return false;
  if (userHasPermission('claim_file.assign')) return true;
  const role = normalizeRoleCode(userRoleCode);
  return role === 'admin' || role === 'office_staff' || role === 'manager' || role === 'ops_manager';
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('tr-TR');
}

// ─── Gruplandırılmış Tab Yapısı ───────────────────────────────────────────────
type GroupTab = 'genel-bilgiler' | 'raporlar' | 'evraklar' | 'finans' | 'operasyon';

const GROUP_TABS: { id: GroupTab; label: string; Icon: LucideIcon }[] = [
  { id: 'genel-bilgiler', label: 'Genel Bilgiler', Icon: ClipboardList },
  { id: 'raporlar',       label: 'Raporlar',       Icon: FileText },
  { id: 'evraklar',       label: 'Evraklar',        Icon: FolderOpen },
  { id: 'finans',         label: 'Finans',           Icon: Wallet },
  { id: 'operasyon',      label: 'Operasyon',        Icon: Settings2 },
];


function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <h4 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">{title}</h4>
      {children}
    </div>
  );
}

function CollapsibleSectionCard({
  title,
  children,
  defaultOpen = false,
  subtitle,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  subtitle?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/80 transition-colors"
      >
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
          {subtitle && !open && <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <span className="text-xs font-medium text-blue-600 shrink-0">{open ? 'Gizle' : 'Detayları Göster'}</span>
      </button>
      {open && <div className="px-4 pb-4 pt-0 border-t border-slate-100">{children}</div>}
    </div>
  );
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Düşük',
  normal: 'Normal',
  high: 'Yüksek',
  critical: 'Kritik',
};

function formatPriorityChip(priority: string | null | undefined): string | null {
  if (!priority) return null;
  const key = String(priority).trim().toLowerCase();
  return PRIORITY_LABELS[key] ?? toTitleCaseTR(priority);
}

function DosyaOzetiChipleri({ claim }: { claim: any }) {
  const ihbarTarihi = resolveIhbarTarihi(claim);
  const ihbarDisplay = ihbarTarihi !== '—' ? ihbarTarihi : null;

  const chips = [
    { label: 'İhbar', value: ihbarDisplay },
    { label: 'Öncelik', value: formatPriorityChip(claim.priority) },
    { label: 'SLA', value: fmtDate(claim.slaDueAt) },
  ].filter((c) => c.value && c.value !== '—');

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="inline-flex items-center gap-1 rounded-md bg-slate-100/80 px-2 py-0.5 text-[11px]"
        >
          <span className="text-slate-400">{chip.label}</span>
          <span className="font-medium text-slate-700">{chip.value}</span>
        </span>
      ))}
    </div>
  );
}


function DosyaSayfaUstu({
  claim,
  onBack,
  reportEditHref,
  onClaimUpdated,
  focusSigortali = false,
  openEdit = false,
}: {
  claim: any;
  onBack: () => void;
  reportEditHref?: string | null;
  onClaimUpdated?: (patch: Partial<any>) => void;
  focusSigortali?: boolean;
  openEdit?: boolean;
}) {
  const ihbarChip = resolveClaimIhbarKonusu(claim);
  const insuredLine = resolveHasarInsuredName(claim);
  const insuredPhone = typeof claim.insuredPhone === 'string' ? claim.insuredPhone.trim() : '';
  const latestReport = claim.latestRepairReport;
  const dosyaEksperi = resolveDosyaEksperi(claim, null);
  const sigortaSirketi = claim.insuranceCompany?.name?.trim();

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-slate-100">
        <button type="button" onClick={onBack} className="text-slate-400 hover:text-slate-700 text-sm shrink-0 mt-0.5">
          ← Geri
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-lg font-bold text-slate-900">{claim.fileNo}</h2>
            {sigortaSirketi && (
              <span className="text-xs text-slate-500">
                Sigorta Şirketi: <span className="font-semibold text-slate-700">{sigortaSirketi}</span>
              </span>
            )}
            <span className="text-xs text-slate-500">
              Eksper: <span className={`font-semibold ${dosyaEksperi === 'Atanmamış' ? 'text-amber-700' : 'text-slate-700'}`}>{dosyaEksperi}</span>
            </span>
            {(claim.operationStatusLabel || claim.currentStatus?.code || claim.currentStatus?.name) && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                <span className="w-2 h-2 rounded-full" style={{ background: claim.currentStatus?.color ?? '#6B7280' }} />
                {claim.operationStatusLabel
                  ?? resolveOperationStatusLabel({
                    claimStatusCode: claim.currentStatus?.code,
                    reportStatus: latestReport?.status,
                    approval72hExceeded: Boolean(claim.approval72hExceeded),
                  })}
              </span>
            )}
          </div>
          {insuredLine !== '—' && (
            <p className="text-sm font-medium text-slate-700 mt-0.5">
              {insuredLine}
              {insuredPhone && (
                <>
                  <span className="text-slate-300 mx-1.5">·</span>
                  <a href={`tel:${insuredPhone.replace(/\s/g, '')}`} className="text-slate-600 hover:text-blue-700 hover:underline tabular-nums">
                    {insuredPhone}
                  </a>
                </>
              )}
            </p>
          )}
          {insuredLine === '—' && insuredPhone && (
            <p className="text-sm font-medium text-slate-700 mt-0.5">
              <a href={`tel:${insuredPhone.replace(/\s/g, '')}`} className="text-slate-600 hover:text-blue-700 hover:underline tabular-nums">
                {insuredPhone}
              </a>
            </p>
          )}
          <div className="mt-2 max-w-xl">
            <ClaimStageStrip
              source={{
                reportStatus: latestReport?.status ?? null,
                claimStatusCode: claim.currentStatus?.code ?? null,
                claimFile: claim,
              }}
              compact
            />
          </div>
          {ihbarChip !== '—' && <p className="text-xs text-slate-500 mt-0.5">{ihbarChip}</p>}
        </div>
        {latestReport && (
          <div className="flex flex-col items-end gap-2 shrink-0 ml-auto min-w-0 max-w-full w-full sm:w-auto">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${repairReportStatusBadge(latestReport.status)}`}>
                {repairReportStatusLabel(latestReport.status)}
              </span>
              {reportEditHref && (
                <Link
                  href={reportEditHref}
                  className="text-xs font-medium text-amber-800 hover:underline whitespace-nowrap"
                >
                  Rapora Git →
                </Link>
              )}
            </div>
            {latestReport.id && (
              <div className="w-full max-w-md">
                <RevisionHistoryStrip reportId={latestReport.id} compact />
              </div>
            )}
          </div>
        )}
      </div>

      {claim.customer && (
        <div className="px-4 py-2.5 bg-blue-50/60 border-b border-blue-100/80 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              {(claim.customer.fullName ?? claim.customer.companyName ?? '?').charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] text-blue-500 leading-none mb-0.5">Müşteri</p>
              {claim.customer.id ? (
                <Link href={`/panel/musteriler/${claim.customer.id}`} className="text-sm font-semibold text-blue-900 hover:underline truncate block">
                  {claim.customer.fullName ?? claim.customer.companyName ?? '—'}
                </Link>
              ) : (
                <p className="text-sm font-semibold text-blue-900 truncate">{claim.customer.fullName ?? claim.customer.companyName ?? '—'}</p>
              )}
            </div>
          </div>
          {claim.customer.phone && (
            <div>
              <p className="text-[10px] text-blue-500 leading-none mb-0.5">Telefon</p>
              <a href={`tel:${claim.customer.phone}`} className="text-sm font-medium text-blue-800 hover:underline">{claim.customer.phone}</a>
            </div>
          )}
          {claim.customer.email && (
            <div className="min-w-0">
              <p className="text-[10px] text-blue-500 leading-none mb-0.5">E-Posta</p>
              <a href={`mailto:${claim.customer.email}`} className="text-sm font-medium text-blue-800 hover:underline truncate block">{claim.customer.email}</a>
            </div>
          )}
        </div>
      )}

      {claim.propertyAddress && (
        <div className="px-4 py-2 text-xs text-slate-600 flex items-start gap-2 border-b border-slate-100">
          <span className="text-slate-400 shrink-0">Hasar Adresi</span>
          <span className="font-medium">{formatHasarAdresi(claim.propertyAddress)}</span>
        </div>
      )}

      <DosyaBilgileriDetay
        claim={claim}
        onClaimUpdated={onClaimUpdated}
        initialOpen={focusSigortali || openEdit || !!claim.latestRepairReport?.id}
        initialEditOpen={openEdit}
        repairReportId={claim.latestRepairReport?.id}
      />
    </div>
  );
}

// ─── Senaryo B: Bu Dosyada Kimler Var? (Komuta Merkezi) ─────────────────────

function AssignPopover({
  title,
  accent,
  children,
  wide = false,
  align = 'left',
}: {
  title: string;
  accent: 'blue' | 'teal' | 'purple';
  children: React.ReactNode;
  wide?: boolean;
  align?: 'left' | 'right';
}) {
  const frame = {
    blue: 'border-blue-200 bg-white shadow-xl ring-1 ring-blue-100',
    teal: 'border-teal-200 bg-white shadow-xl ring-1 ring-teal-100',
    purple: 'border-purple-200 bg-white shadow-xl ring-1 ring-purple-100',
  }[accent];

  return (
    <div
      className={`absolute top-full z-50 mt-2 rounded-xl border p-3 ${frame} ${wide ? 'w-[min(100%,24rem)] max-h-[min(70vh,28rem)]' : 'w-[min(100%,20rem)] max-h-[min(70vh,22rem)]'} overflow-y-auto ${align === 'right' ? 'right-0' : 'left-0'}`}
      role="dialog"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="mb-2 text-sm font-semibold text-slate-800">{title}</p>
      {children}
    </div>
  );
}

function DosyadaKimlerVarCard({
  claim,
  userRoleCode,
  isFieldStaff,
  onClaimUpdated,
  embedded = false,
}: {
  claim: any;
  userRoleCode: string | null;
  isFieldStaff: boolean;
  onClaimUpdated?: (patch: Partial<any>) => void;
  embedded?: boolean;
}) {
  const canAssign = canUserAssignClaim(userRoleCode, isFieldStaff);

  const [officeSuggestions, setOfficeSuggestions] = useState<any[]>([]);
  const [fieldSuggestions, setFieldSuggestions] = useState<any[]>([]);
  const [officeSuggLoading, setOfficeSuggLoading] = useState(false);
  const [fieldSuggLoading, setFieldSuggLoading] = useState(false);
  const [assigningOffice, setAssigningOffice] = useState<string | null>(null);
  const [assigningField, setAssigningField] = useState<string | null>(null);
  const [currentOfficeUser, setCurrentOfficeUser] = useState(claim.assignedOfficeUser);
  const [currentFieldUser, setCurrentFieldUser] = useState(claim.assignedFieldUser);
  const [currentInspectorVendor, setCurrentInspectorVendor] = useState(claim.assignedInspectorVendor);
  const [currentSuppliers, setCurrentSuppliers] = useState<any[]>(() => {
    if (Array.isArray(claim.assignedSuppliers) && claim.assignedSuppliers.length > 0) {
      return claim.assignedSuppliers;
    }
    return claim.assignedSupplier ? [claim.assignedSupplier] : [];
  });

  const [vendors, setVendors] = useState<any[]>([]);
  const [vendorSuggestions, setVendorSuggestions] = useState<any[]>([]);
  const [vendorSuggLoading, setVendorSuggLoading] = useState(false);
  const [inspectorVendors, setInspectorVendors] = useState<any[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [inspectorVendorsLoading, setInspectorVendorsLoading] = useState(false);
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [selectedInspectorVendorId, setSelectedInspectorVendorId] = useState(claim.assignedInspectorVendorId ?? '');
  const [assigningSupplier, setAssigningSupplier] = useState(false);
  const [removingSupplierId, setRemovingSupplierId] = useState<string | null>(null);
  const [assigningInspectorVendor, setAssigningInspectorVendor] = useState(false);
  const [assignNote, setAssignNote] = useState('');
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');
  const [staffPool, setStaffPool] = useState<{ office: any[]; field: any[] }>({ office: [], field: [] });
  const [manualOfficeId, setManualOfficeId] = useState('');
  const [manualFieldId, setManualFieldId] = useState('');
  const [activePanel, setActivePanel] = useState<'office' | 'field' | 'supplier' | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activePanel) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setActivePanel(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [activePanel]);

  useEffect(() => {
    setCurrentOfficeUser(claim.assignedOfficeUser);
    setCurrentFieldUser(claim.assignedFieldUser);
    setCurrentInspectorVendor(claim.assignedInspectorVendor);
    const nextSuppliers = Array.isArray(claim.assignedSuppliers) && claim.assignedSuppliers.length > 0
      ? claim.assignedSuppliers
      : (claim.assignedSupplier ? [claim.assignedSupplier] : []);
    setCurrentSuppliers(nextSuppliers);
    setSelectedInspectorVendorId(claim.assignedInspectorVendorId ?? '');
  }, [
    claim.id,
    claim.assignedOfficeUser,
    claim.assignedFieldUser,
    claim.assignedInspectorVendor,
    claim.assignedInspectorVendorId,
    claim.assignedSupplier,
    claim.assignedSupplierId,
    claim.assignedSuppliers,
  ]);

  const assignedSupplierIdSet = new Set(currentSuppliers.map((s) => s.id));

  const resolvedCity = claim?.propertyAddress?.city?.trim()
    && !['belirtilmemiş', 'belirtilmemis', 'belirtilmedi'].includes(
      claim.propertyAddress.city.trim().toLocaleLowerCase('tr-TR'),
    )
    ? claim.propertyAddress.city.trim()
    : null;
  const resolvedDistrict = claim?.propertyAddress?.district?.trim()
    && !['belirtilmemiş', 'belirtilmemis', 'belirtilmedi'].includes(
      claim.propertyAddress.district.trim().toLocaleLowerCase('tr-TR'),
    )
    ? claim.propertyAddress.district.trim()
    : null;
  const regionLabel = resolvedCity
    ? `${resolvedCity}${resolvedDistrict ? ` / ${resolvedDistrict}` : ''}`
    : null;

  const whatsappTespitçi = buildClaimAssignmentWhatsAppMessage(claim, 'Tespitçi');
  const whatsappTedarikçi = buildClaimAssignmentWhatsAppMessage(claim, 'Tedarikçi');

  const vendorPhone = (v: { phone?: string | null; authorizedPhone?: string | null } | null | undefined) =>
    v?.authorizedPhone?.trim() || v?.phone?.trim() || null;

  useEffect(() => {
    if (!claim?.id) return;
    setOfficeSuggLoading(true);
    axios.get(`${API}/claim-files/${claim.id}/suggest-responsible`, { headers: authHeader() })
      .then((r) => setOfficeSuggestions(r.data.data || []))
      .catch(() => setOfficeSuggestions([]))
      .finally(() => setOfficeSuggLoading(false));
  }, [claim?.id]);

  useEffect(() => {
    if (!claim?.id) return;
    setFieldSuggLoading(true);
    axios.get(`${API}/claim-files/${claim.id}/suggest-responsible?role=field_staff`, { headers: authHeader() })
      .then((r) => setFieldSuggestions(r.data.data || []))
      .catch(() => setFieldSuggestions([]))
      .finally(() => setFieldSuggLoading(false));
  }, [claim?.id]);

  useEffect(() => {
    if (!canAssign || !activePanel || activePanel === 'supplier') return;
    const role = activePanel === 'field' ? 'field_staff' : 'office_staff';
    axios
      .get(`${API}/claim-files/assignable-staff?role=${role}`, { headers: authHeader() })
      .then((r) => {
        const list = r.data?.data ?? [];
        const users = Array.isArray(list) ? list : [];
        setStaffPool((prev) => ({
          office: role === 'office_staff' ? users : prev.office,
          field: role === 'field_staff' ? users : prev.field,
        }));
      })
      .catch(() => {
        setStaffPool((prev) => ({
          office: role === 'office_staff' ? [] : prev.office,
          field: role === 'field_staff' ? [] : prev.field,
        }));
      });
  }, [canAssign, activePanel]);

  useEffect(() => {
    if (!canAssign || activePanel !== 'supplier' || !claim?.id) return;
    setVendorsLoading(true);
    setVendorSuggLoading(true);
    const loadAllActive = () =>
      axios.get(`${API}/vendors?status=active&limit=100`, { headers: authHeader() })
        .then((r2) => {
          const list = r2.data.data?.vendors ?? r2.data.data ?? [];
          setVendors(Array.isArray(list) ? list : []);
          setVendorSuggestions(Array.isArray(list) ? list : []);
        })
        .catch(() => {
          setVendors([]);
          setVendorSuggestions([]);
        });

    Promise.all([
      axios.get(`${API}/claim-files/${claim.id}/vendors/nearby?purpose=supplier`, { headers: authHeader() }),
      axios.get(`${API}/claim-files/${claim.id}/vendors/recommended?limit=3`, { headers: authHeader() }),
    ])
      .then(async ([nearbyRes, recommendRes]) => {
        const nearby = nearbyRes.data.data ?? [];
        const recommended = recommendRes.data.data ?? [];
        if (nearby.length > 0) {
          setVendors(nearby);
          setVendorSuggestions(recommended);
          return;
        }
        if (recommended.length > 0) {
          setVendors(recommended);
          setVendorSuggestions(recommended);
          return;
        }
        // Bölge yok / eşleşme yok: operasyon atayabilsin diye tüm aktifler
        await loadAllActive();
      })
      .catch(() => loadAllActive())
      .finally(() => {
        setVendorsLoading(false);
        setVendorSuggLoading(false);
      });
  }, [canAssign, activePanel, claim?.id, resolvedCity]);

  useEffect(() => {
    if (!canAssign || activePanel !== 'field' || !claim?.id) return;
    setInspectorVendorsLoading(true);
    axios.get(`${API}/claim-files/${claim.id}/vendors/nearby?purpose=inspector`, { headers: authHeader() })
      .then((r) => setInspectorVendors(r.data.data ?? []))
      .catch(() => setInspectorVendors([]))
      .finally(() => setInspectorVendorsLoading(false));
  }, [canAssign, activePanel, claim?.id]);

  const formatUserName = (user: any) =>
    user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || '—' : 'Atanmamış';

  const userInitial = (user: any, fallback = '?') => {
    const name = user?.firstName ?? user?.name ?? '';
    return (name.charAt(0) || fallback).toUpperCase();
  };

  const togglePanel = (panel: 'office' | 'field' | 'supplier') => {
    setActivePanel((prev) => (prev === panel ? null : panel));
    setAssignError('');
    setAssignSuccess('');
  };

  const handleAssignOffice = async (userId: string) => {
    setAssigningOffice(userId);
    setAssignError('');
    setAssignSuccess('');
    try {
      const r = await axios.post(`${API}/claim-files/${claim.id}/assign`, { assignedOfficeUserId: userId }, { headers: authHeader() });
      const updated = r.data?.data ?? r.data;
      const assigned = updated?.assignedOfficeUser
        ?? officeSuggestions.find((s) => s.user.id === userId)?.user
        ?? staffPool.office.find((u) => u.id === userId);
      setCurrentOfficeUser(assigned ?? null);
      onClaimUpdated?.({ assignedOfficeUser: assigned, assignedOfficeUserId: userId });
      setActivePanel(null);
      setAssignSuccess('Dosya sorumlusu güncellendi.');
    } catch (e: any) {
      setAssignError(e?.response?.data?.message ?? 'Atama başarısız.');
    } finally {
      setAssigningOffice(null);
    }
  };

  const handleAssignField = async (userId: string) => {
    setAssigningField(userId);
    setAssignError('');
    setAssignSuccess('');
    try {
      const r = await axios.post(`${API}/claim-files/${claim.id}/assign`, { assignedFieldUserId: userId }, { headers: authHeader() });
      const updated = r.data?.data ?? r.data;
      const assigned = updated?.assignedFieldUser
        ?? fieldSuggestions.find((s) => s.user.id === userId)?.user
        ?? staffPool.field.find((u) => u.id === userId);
      setCurrentFieldUser(assigned ?? null);
      onClaimUpdated?.({ assignedFieldUser: assigned, assignedFieldUserId: userId });
      setActivePanel(null);
      setAssignSuccess('Saha tespitçisi güncellendi.');
    } catch (e: any) {
      setAssignError(e?.response?.data?.message ?? 'Atama başarısız.');
    } finally {
      setAssigningField(null);
    }
  };

  const handleAssignInspectorVendor = async () => {
    if (!selectedInspectorVendorId) { setAssignError('Tespitçi tedarikçi seçiniz.'); return; }
    setAssigningInspectorVendor(true);
    setAssignError('');
    setAssignSuccess('');
    try {
      const r = await axios.post(
        `${API}/claim-files/${claim.id}/assign-inspector-vendor`,
        { vendorId: selectedInspectorVendorId, note: assignNote },
        { headers: authHeader() },
      );
      const updated = r.data?.data ?? r.data;
      const vendor = updated?.assignedInspectorVendor ?? inspectorVendors.find((v) => v.id === selectedInspectorVendorId);
      if (vendor) {
        setCurrentInspectorVendor(vendor);
        setCurrentFieldUser(null);
        onClaimUpdated?.({
          assignedInspectorVendor: vendor,
          assignedInspectorVendorId: updated?.assignedInspectorVendorId ?? selectedInspectorVendorId,
          inspectorAssignedAt: updated?.inspectorAssignedAt,
          assignedFieldUser: null,
          assignedFieldUserId: null,
        });
      }
      setActivePanel(null);
      setAssignSuccess('Tespitçi (tedarikçi) güncellendi.');
    } catch (e: any) {
      setAssignError(e?.response?.data?.message ?? 'Tespitçi atanamadı.');
    } finally {
      setAssigningInspectorVendor(false);
    }
  };

  const handleAssignSupplier = async () => {
    const toAssign = selectedVendorIds.filter((id) => !assignedSupplierIdSet.has(id));
    if (toAssign.length === 0) {
      setAssignError(selectedVendorIds.length > 0
        ? 'Seçilen tedarikçiler zaten atanmış.'
        : 'En az bir tedarikçi seçiniz.');
      return;
    }
    setAssigningSupplier(true);
    setAssignError('');
    setAssignSuccess('');
    try {
      const r = await axios.post(
        `${API}/claim-files/${claim.id}/assign-supplier`,
        { supplierIds: toAssign, note: assignNote },
        { headers: authHeader() },
      );
      const updated = r.data?.data ?? r.data;
      const suppliers: any[] = Array.isArray(updated?.assignedSuppliers) && updated.assignedSuppliers.length > 0
        ? updated.assignedSuppliers
        : (updated?.assignedSupplier ? [updated.assignedSupplier] : currentSuppliers);
      setCurrentSuppliers(suppliers);
      setSelectedVendorIds([]);
      onClaimUpdated?.({
        assignedSupplier: suppliers[0] ?? null,
        assignedSupplierId: updated?.assignedSupplierId ?? suppliers[0]?.id ?? null,
        assignedSuppliers: suppliers,
        supplierAssignments: updated?.supplierAssignments,
        supplierAssignedAt: updated?.supplierAssignedAt,
      });
      const waList = Array.isArray(updated?.assignmentWhatsApps) ? updated.assignmentWhatsApps : [];
      const wa = updated?.assignmentWhatsApp ?? waList[0];
      if (wa?.url) {
        window.open(wa.url, '_blank', 'noopener,noreferrer');
      }
      // Ek WhatsApp'ları kısa aralıkla aç (tarayıcı engeli riski — ilk yeterli)
      for (const extra of waList.slice(1, 3)) {
        if (extra?.url) window.open(extra.url, '_blank', 'noopener,noreferrer');
      }
      setAssignSuccess(
        toAssign.length === 1
          ? (wa?.url ? 'Tedarikçi atandı — WhatsApp şablonu açıldı.' : 'Tedarikçi atandı.')
          : `${toAssign.length} tedarikçi atandı.`,
      );
    } catch (e: any) {
      setAssignError(e?.response?.data?.message ?? 'Tedarikçi atanamadı.');
    } finally {
      setAssigningSupplier(false);
    }
  };

  const handleRemoveSupplier = async (vendorId: string) => {
    setRemovingSupplierId(vendorId);
    setAssignError('');
    setAssignSuccess('');
    try {
      const r = await axios.delete(
        `${API}/claim-files/${claim.id}/suppliers/${vendorId}`,
        { headers: authHeader() },
      );
      const updated = r.data?.data ?? r.data;
      const suppliers: any[] = Array.isArray(updated?.assignedSuppliers)
        ? updated.assignedSuppliers
        : (updated?.assignedSupplier ? [updated.assignedSupplier] : []);
      setCurrentSuppliers(suppliers);
      onClaimUpdated?.({
        assignedSupplier: suppliers[0] ?? null,
        assignedSupplierId: updated?.assignedSupplierId ?? suppliers[0]?.id ?? null,
        assignedSuppliers: suppliers,
        supplierAssignments: updated?.supplierAssignments,
        supplierAssignedAt: updated?.supplierAssignedAt ?? null,
      });
      setAssignSuccess('Tedarikçi kaldırıldı.');
    } catch (e: any) {
      setAssignError(e?.response?.data?.message ?? 'Tedarikçi kaldırılamadı.');
    } finally {
      setRemovingSupplierId(null);
    }
  };

  const toggleVendorSelect = (vendorId: string) => {
    if (assignedSupplierIdSet.has(vendorId)) return;
    setSelectedVendorIds((prev) =>
      prev.includes(vendorId) ? prev.filter((id) => id !== vendorId) : [...prev, vendorId],
    );
  };

  const renderStaffAssignBlock = (
    suggestions: any[],
    loading: boolean,
    currentUserId: string | undefined,
    assigningId: string | null,
    onAssign: (userId: string) => void,
    manualPool: any[],
    manualSelectedId: string,
    onManualSelectId: (id: string) => void,
    accentClass: string,
  ) => {
    if (!canAssign) return null;
    if (loading) return <p className="text-xs text-slate-400 mt-2">Öneriler yükleniyor...</p>;

    const hasRegional = suggestions.some((s) => s.province?.name);
    const suggestionLabel = hasRegional ? 'Bölgeye Göre Öneriler' : 'Önerilen Personel';

    return (
      <div className="mt-1 pt-1 flex flex-col gap-3">
        {suggestions.length > 0 ? (
          <>
            <p className="text-[11px] font-medium text-slate-500">{suggestionLabel}</p>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {suggestions.map((s) => {
                const isCurrent = currentUserId === s.user.id;
                const isAssigning = assigningId === s.user.id;
                return (
                  <button
                    key={s.user.id}
                    type="button"
                    onClick={() => onAssign(s.user.id)}
                    disabled={isAssigning || isCurrent}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs disabled:opacity-50 ${isCurrent ? 'border-slate-200 bg-slate-100 text-slate-500' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}
                    title={s.province?.name ? `${s.province.name}${s.district ? ` / ${s.district.name}` : ''} · ${s.activeFileCount} aktif dosya` : `${s.activeFileCount} aktif dosya`}
                  >
                    <span className="font-medium text-slate-800">{s.user.firstName} {s.user.lastName}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] text-white ${accentClass}`}>
                      {isAssigning ? '...' : isCurrent ? 'Atandı' : 'Ata'}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
        {manualPool.length > 0 ? (
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <select
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={manualSelectedId}
              onChange={(e) => onManualSelectId(e.target.value)}
            >
              <option value="">Listeden personel seç...</option>
              {manualPool.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => manualSelectedId && onAssign(manualSelectedId)}
              disabled={!manualSelectedId || assigningId === manualSelectedId || currentUserId === manualSelectedId}
              className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 shrink-0 ${accentClass}`}
            >
              {assigningId === manualSelectedId ? 'Atanıyor...' : 'Ata'}
            </button>
          </div>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-slate-500">Atanabilir personel bulunamadı.</p>
        ) : null}
      </div>
    );
  };

  const assignmentCards = (
    <>
      {(assignError || assignSuccess) && (
        <div className="mb-3 space-y-2">
          {assignError && <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{assignError}</div>}
          {assignSuccess && <div className="px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700">{assignSuccess}</div>}
        </div>
      )}

      <div ref={panelRef} className="relative grid grid-cols-1 gap-3 overflow-visible md:grid-cols-2 lg:grid-cols-3">
        {/* Dosya Sorumlusu */}
        <div className={`relative overflow-visible rounded-xl border p-3 flex flex-col min-h-[88px] ${activePanel === 'office' ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-50/70' : 'border-slate-200 bg-slate-50/70'}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-medium text-slate-500">Dosya Sorumlusu</p>
            {canAssign && (
              <button
                type="button"
                onClick={() => togglePanel('office')}
                className="text-[11px] font-medium text-blue-600 hover:text-blue-800 shrink-0"
              >
                {activePanel === 'office' ? 'Kapat' : 'Değiştir'}
              </button>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
              {currentOfficeUser ? userInitial(currentOfficeUser) : '—'}
            </div>
            <p className={`text-base font-semibold truncate ${currentOfficeUser ? 'text-slate-900' : 'text-slate-400 italic'}`}>
              {formatUserName(currentOfficeUser)}
            </p>
          </div>
          {claim.activeDelegation && (
            <div className="mt-2.5">
              <DelegationBanner delegation={claim.activeDelegation} />
            </div>
          )}
          {canAssign && activePanel === 'office' && (
            <AssignPopover title="Dosya Sorumlusu Seç" accent="blue">
              {renderStaffAssignBlock(
                officeSuggestions,
                officeSuggLoading,
                currentOfficeUser?.id,
                assigningOffice,
                handleAssignOffice,
                staffPool.office,
                manualOfficeId,
                setManualOfficeId,
                'bg-blue-600',
              )}
            </AssignPopover>
          )}
        </div>

        {/* Saha Tespitçisi */}
        <div className={`relative overflow-visible rounded-xl border p-3 flex flex-col min-h-[88px] ${activePanel === 'field' ? 'border-teal-400 ring-2 ring-teal-200 bg-teal-50/70' : 'border-teal-200 bg-teal-50/50'}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-medium text-slate-500">Saha Tespitçisi</p>
            {canAssign && (
              <button
                type="button"
                onClick={() => togglePanel('field')}
                className="text-[11px] font-medium text-teal-600 hover:text-teal-800 shrink-0"
              >
                {activePanel === 'field' ? 'Kapat' : 'Değiştir'}
              </button>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2.5 min-w-0">
            {currentInspectorVendor ? (
              <>
                <div className="w-9 h-9 rounded-full bg-teal-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                  {currentInspectorVendor.name?.charAt(0) ?? 'T'}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-slate-900 truncate">{currentInspectorVendor.name}</p>
                  <p className="text-[10px] text-teal-700">Tespitçi Tedarikçi</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-9 h-9 rounded-full bg-teal-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                  {currentFieldUser ? userInitial(currentFieldUser) : '—'}
                </div>
                <p className={`text-base font-semibold truncate ${currentFieldUser ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                  {formatUserName(currentFieldUser)}
                </p>
              </>
            )}
          </div>
          {(currentFieldUser?.phone || vendorPhone(currentInspectorVendor)) && (
            <div className="mt-2">
              <PhoneContactActions
                phone={currentFieldUser?.phone ?? vendorPhone(currentInspectorVendor)}
                whatsappMessage={whatsappTespitçi}
                accent="teal"
                size="sm"
              />
            </div>
          )}
          {canAssign && activePanel === 'field' && (
            <AssignPopover title="Saha Personeli Seç" accent="teal" wide>
              {regionLabel ? (
                <p className="mb-2 text-[11px] text-slate-500">Bölge: {regionLabel}</p>
              ) : (
                <p className="mb-2 text-[11px] text-amber-700">
                  Bölge Belirtilmemiş — Bölge Filtresi Uygulanmıyor
                </p>
              )}
              {renderStaffAssignBlock(
                fieldSuggestions,
                fieldSuggLoading,
                currentFieldUser?.id,
                assigningField,
                handleAssignField,
                staffPool.field,
                manualFieldId,
                setManualFieldId,
                'bg-teal-600',
              )}
              <div className="mt-3 border-t border-teal-100 pt-3">
                <p className="mb-1 text-sm font-semibold text-slate-800">Tespitçi Tedarikçi Seç</p>
                <p className="mb-2 text-[11px] text-slate-500">
                  Tedarikçi kaydında &quot;Tespitçi Olarak Görevlendir&quot; işaretli firmalar listelenir.
                </p>
                {inspectorVendorsLoading ? (
                  <p className="text-xs text-slate-400">Tespitçi tedarikçiler yükleniyor...</p>
                ) : inspectorVendors.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    {regionLabel
                      ? `${regionLabel} bölgesinde tespitçi tedarikçi bulunamadı.`
                      : 'Uygun Tespitçi Tedarikçi Bulunamadı.'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                    <select
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                      value={selectedInspectorVendorId}
                      onChange={(e) => setSelectedInspectorVendorId(e.target.value)}
                    >
                      <option value="">Tespitçi tedarikçi seç...</option>
                      {inspectorVendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}{v.city ? ` · ${v.city}` : ''}{v.district ? ` / ${v.district}` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAssignInspectorVendor}
                      disabled={assigningInspectorVendor || !selectedInspectorVendorId}
                      className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 shrink-0"
                    >
                      {assigningInspectorVendor ? 'Atanıyor...' : 'Ata'}
                    </button>
                  </div>
                )}
              </div>
            </AssignPopover>
          )}
        </div>

        {/* Tedarikçi (çoklu — teklif toplama) */}
        <div className={`relative overflow-visible rounded-xl border p-3 flex flex-col min-h-[88px] md:col-span-2 lg:col-span-1 ${activePanel === 'supplier' ? 'border-purple-400 ring-2 ring-purple-200 bg-purple-50/70' : 'border-purple-200 bg-purple-50/50'}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-medium text-slate-500">
              Tedarikçi{currentSuppliers.length > 1 ? `ler (${currentSuppliers.length})` : ''}
            </p>
            {canAssign && (
              <button
                type="button"
                onClick={() => togglePanel('supplier')}
                className="text-[11px] font-medium text-purple-600 hover:text-purple-800 shrink-0"
              >
                {activePanel === 'supplier' ? 'Kapat' : 'Değiştir'}
              </button>
            )}
          </div>
          <div className="mt-1.5 min-w-0 space-y-2">
            {currentSuppliers.length > 0 ? (
              currentSuppliers.map((s) => (
                <div key={s.id} className="flex items-start gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-purple-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {s.name?.charAt(0) ?? '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-purple-900 truncate">{s.name}</p>
                    {vendorPhone(s) && (
                      <div className="mt-1">
                        <PhoneContactActions
                          phone={vendorPhone(s)}
                          whatsappMessage={whatsappTedarikçi}
                          accent="purple"
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-400 text-sm font-bold flex items-center justify-center shrink-0">—</div>
                <p className="text-base font-semibold text-slate-400 italic">Atanmamış</p>
              </div>
            )}
          </div>
          {canAssign && activePanel === 'supplier' && (
            <AssignPopover title="Tedarikçi Seç" accent="purple" align="right">
              {regionLabel ? (
                <p className="mb-2 text-[11px] text-slate-500">Bölge: {regionLabel}</p>
              ) : (
                <p className="mb-2 text-[11px] text-amber-700">
                  Bölge Belirtilmemiş — Tüm Aktif Tedarikçiler Listeleniyor
                </p>
              )}
              {currentSuppliers.length > 0 && (
                <div className="mb-3 rounded-lg border border-purple-100 bg-purple-50/80 p-2">
                  <p className="mb-1.5 text-[11px] font-medium text-slate-600">Atanmış Tedarikçiler</p>
                  <ul className="space-y-1 max-h-28 overflow-y-auto">
                    {currentSuppliers.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-purple-900 truncate">{s.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSupplier(s.id)}
                          disabled={removingSupplierId === s.id}
                          className="shrink-0 text-[11px] font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {removingSupplierId === s.id ? 'Kaldırılıyor...' : 'Kaldır'}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {vendorsLoading || vendorSuggLoading ? (
                <p className="text-xs text-slate-400">Tedarikçiler yükleniyor...</p>
              ) : vendors.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {regionLabel
                    ? `${regionLabel} bölgesinde uygun tedarikçi yok.`
                    : 'Uygun Tedarikçi Bulunamadı.'}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {vendorSuggestions.length > 0 && (
                    <div>
                      <p className="text-[11px] font-medium text-slate-500 mb-1.5">Önerilen İlk 3 Tedarikçi</p>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {vendorSuggestions.slice(0, 3).map((v) => {
                          const already = assignedSupplierIdSet.has(v.id);
                          const selected = selectedVendorIds.includes(v.id);
                          return (
                            <button
                              key={v.id}
                              type="button"
                              disabled={already}
                              onClick={() => toggleVendorSelect(v.id)}
                              className={`w-full text-left rounded-lg border px-2.5 py-2 text-xs disabled:opacity-60 ${
                                already
                                  ? 'border-purple-200 bg-purple-50 text-purple-700'
                                  : selected
                                    ? 'border-purple-400 bg-purple-100 text-purple-900'
                                    : 'border-slate-200 bg-white hover:border-purple-200'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold truncate">{v.name}</span>
                                {v.rank != null && (
                                  <span className="text-[10px] text-slate-400 shrink-0">#{v.rank}</span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                                {[
                                  v.avgServiceScore != null ? `Kalite ${v.avgServiceScore}` : null,
                                  v.avgCost != null ? `Ort. ${Number(v.avgCost).toLocaleString('tr-TR')} ₺` : null,
                                  v.avgResponseTime != null ? `Müdahale ${v.avgResponseTime} sa` : null,
                                  v.completedFileCount != null ? `${v.completedFileCount} dosya` : null,
                                ].filter(Boolean).join(' · ') || 'Operasyon verisi birikiyor'}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] font-medium text-slate-500 mb-1.5">Listeden Seç (Çoklu)</p>
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white">
                      {vendors.map((v) => {
                        const already = assignedSupplierIdSet.has(v.id);
                        const selected = selectedVendorIds.includes(v.id);
                        return (
                          <label
                            key={v.id}
                            className={`flex items-start gap-2.5 px-3 py-2 text-sm ${
                              already ? 'bg-purple-50/60 cursor-default' : 'cursor-pointer hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-400"
                              checked={already || selected}
                              disabled={already}
                              onChange={() => toggleVendorSelect(v.id)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium text-slate-800 truncate">{v.name}</span>
                              <span className="block text-[11px] text-slate-400 truncate">
                                {[v.city, v.district].filter(Boolean).join(' / ') || '—'}
                                {already ? ' · Atandı' : ''}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAssignSupplier}
                    disabled={assigningSupplier || selectedVendorIds.filter((id) => !assignedSupplierIdSet.has(id)).length === 0}
                    className="w-full px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-60"
                  >
                    {assigningSupplier
                      ? 'Atanıyor...'
                      : selectedVendorIds.filter((id) => !assignedSupplierIdSet.has(id)).length > 1
                        ? `Seçilenleri Ata (${selectedVendorIds.filter((id) => !assignedSupplierIdSet.has(id)).length})`
                        : 'Seçileni Ata'}
                  </button>
                  <p className="text-[10px] text-slate-400">
                    {vendors.length} tedarikçi listeleniyor. Dosyaya birden fazla tedarikçi atanabilir (mobilyacı, boyacı, sıvacı…).
                  </p>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    value={assignNote}
                    onChange={(e) => setAssignNote(e.target.value)}
                    placeholder="Not (Opsiyonel)..."
                  />
                </div>
              )}
            </AssignPopover>
          )}
        </div>
      </div>
    </>
  );

  if (embedded) return assignmentCards;

  return (
    <SectionCard title="Bu Dosyada Kimler Var?">
      {assignmentCards}
    </SectionCard>
  );
}

function DosyaKomutaPaneli({
  claim,
  userRoleCode,
  isFieldStaff,
  onClaimUpdated,
  finansErisimSlot,
}: {
  claim: any;
  userRoleCode: string | null;
  isFieldStaff: boolean;
  onClaimUpdated?: (patch: Partial<any>) => void;
  finansErisimSlot?: ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100">
        <h4 className="text-sm font-semibold text-slate-800">Bu Dosyada Kimler Var?</h4>
        <div className="mt-2">
          <DosyaOzetiChipleri claim={claim} />
        </div>
      </div>
      <div className="overflow-visible p-4">
        <DosyadaKimlerVarCard
          claim={claim}
          userRoleCode={userRoleCode}
          isFieldStaff={isFieldStaff}
          onClaimUpdated={onClaimUpdated}
          embedded
        />
      </div>
      {finansErisimSlot && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-100">
          {finansErisimSlot}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Genel ────────────────────────────────────────────────────────────────
function GenelTab({
  claim,
  isFieldStaff,
  userRoleCode,
  onClaimUpdated,
}: {
  claim: any;
  isFieldStaff: boolean;
  userRoleCode: string | null;
  onClaimUpdated?: (patch: Partial<any>) => void;
}) {
  const [finVisConfig, setFinVisConfig] = useState<FinVisConfig>(() => resolveFinVisConfig(claim));
  const [savingFinVis, setSavingFinVis] = useState(false);
  const canViewFinancials = claim.canViewFinancials !== false;
  const canManageFinVisibility = claim.canManageFinancialVisibility === true
    || userRoleCode === 'admin'
    || userRoleCode === 'manager'
    || userRoleCode === 'ops_manager';
  const officeAssignees = collectOfficeAssignees(claim);

  useEffect(() => {
    setFinVisConfig(resolveFinVisConfig(claim));
  }, [claim.id, claim.financialVisibilityConfig, claim.hideFinancialFromAssignees]);

  const saveFinVisConfig = async (next: FinVisConfig) => {
    setSavingFinVis(true);
    setFinVisConfig(next);
    try {
      const payload = {
        financialVisibilityConfig: {
          roles: next.roles,
          roleModes: next.roleModes,
          userOverrides: Object.fromEntries(
            Object.entries(next.userOverrides).filter(([, v]) => v === 'allow' || v === 'deny'),
          ),
        },
      };
      await axios.patch(`${API}/claim-files/${claim.id}`, payload, { headers: authHeader() });
      onClaimUpdated?.({
        financialVisibilityConfig: payload.financialVisibilityConfig,
        hideFinancialFromAssignees: false,
      });
    } catch (e: any) {
      setFinVisConfig(resolveFinVisConfig(claim));
      alert(e?.response?.data?.message ?? 'Ayar kaydedilemedi');
    } finally {
      setSavingFinVis(false);
    }
  };

  return (
    <div className="space-y-4">
      {!isFieldStaff && !canViewFinancials && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-500">
            Finans rapor özeti, erişim kısıtı nedeniyle görüntülenemiyor.
          </p>
        </div>
      )}

      <DosyaKomutaPaneli
        claim={claim}
        userRoleCode={userRoleCode}
        isFieldStaff={isFieldStaff}
        onClaimUpdated={onClaimUpdated}
        finansErisimSlot={
          canManageFinVisibility ? (
            <FinansOzetErisimPanel
              config={finVisConfig}
              saving={savingFinVis}
              officeAssignees={officeAssignees}
              onChange={(next) => void saveFinVisConfig(next)}
            />
          ) : undefined
        }
      />

      {claim.statusHistory?.length > 0 && (
        <CollapsibleSectionCard
          title="Durum Geçmişi"
          subtitle={`${claim.statusHistory.length} kayıt`}
          defaultOpen={false}
        >
          <div className="space-y-3 pt-3">
            {claim.statusHistory.map((h: any) => (
              <div key={h.id} className="flex items-start gap-3 text-sm">
                <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <div>
                  <span className="text-slate-500">{new Date(h.changedAt).toLocaleString('tr-TR')}</span>
                  {' · '}
                  <span className="font-medium">{h.fromStatus?.name ?? '—'} → {h.toStatus?.name}</span>
                  {' · '}
                  <span className="text-slate-500">{h.changedByUser?.firstName} {h.changedByUser?.lastName}</span>
                  {h.note && <p className="text-slate-400 text-xs mt-0.5">{h.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSectionCard>
      )}
    </div>
  );
}


// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ClaimFileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusSigortali = searchParams.get('sigortali') === '1';
  const openEdit = searchParams.get('edit') === '1';
  const aksiyonParam = searchParams.get('aksiyon');
  const grupParam = searchParams.get('grup');
  const altParam = searchParams.get('alt');
  /** Operasyon → Onay Talep Et (72s): doğrudan raporlar grubuna */
  const initialGroup: GroupTab =
    aksiyonParam === 'onay-talep'
      ? 'raporlar'
      : grupParam === 'operasyon' || grupParam === 'raporlar' || grupParam === 'evraklar' || grupParam === 'finans' || grupParam === 'genel-bilgiler'
      ? (grupParam as GroupTab)
      : 'genel-bilgiler';
  const initialOpsSub =
    altParam === 'gecmis' || altParam === 'iletisim' || altParam === 'gorevler' || altParam === 'randevular'
      ? altParam
      : undefined;
  const [claim, setClaim] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<GroupTab>(initialGroup);
  const [userRoleCode, setUserRoleCode] = useState<string | null>(null);
  const [fieldSurveyOpen, setFieldSurveyOpen] = useState(false);
  const [fieldSurveyRefreshKey, setFieldSurveyRefreshKey] = useState(0);

  const canEditFieldSurvey = userHasPermission('claim_file.update');

  useEffect(() => {
    setUserRoleCode(getCurrentUserRole());
  }, []);

  const isFieldStaff = userRoleCode === 'field_staff';
  const canViewFinancials = claim?.canViewFinancials !== false;
  const reportEditHref = claim?.latestRepairReport?.id
    ? `/panel/hasar-dosyalari/${id}/onarim-raporu/${claim.latestRepairReport.id}`
    : null;

  useEffect(() => {
    if (!id) return;
    setLoadError(null);
    axios.get(`${API}/claim-files/${id}`, { headers: authHeader() })
      .then((r) => setClaim(r.data.data))
      .catch((err) => {
        const status = err?.response?.status;
        const msg = err?.response?.data?.message;
        setLoadError(status === 403
          ? 'Bu dosyaya erişim izniniz yok.'
          : status === 404
            ? 'Dosya bulunamadı.'
            : Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Dosya yüklenirken hata oluştu.'));
        setClaim(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-slate-400 py-16 text-center">Yükleniyor...</div>;
  if (!claim) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-slate-500">{loadError ?? 'Dosya Bulunamadı.'}</p>
        <button type="button" onClick={() => router.push('/panel/operasyon')} className="text-sm text-blue-600 hover:underline">
          Operasyon sayfasına dön
        </button>
      </div>
    );
  }

  return (
    <div>
      <DosyaSayfaUstu
        claim={claim}
        onBack={() => router.push('/panel/hasar-dosyalari')}
        reportEditHref={reportEditHref}
        onClaimUpdated={(patch) => setClaim((c: any) => ({ ...c, ...patch }))}
        focusSigortali={focusSigortali}
        openEdit={openEdit}
      />

      {canEditFieldSurvey && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setFieldSurveyOpen(true)}
            className="btn-secondary text-sm"
          >
            Saha Keşif Ölçüsü
          </button>
        </div>
      )}

      <FieldSurveyBriefList claimFileId={id!} refreshKey={fieldSurveyRefreshKey} />

      <FieldSurveyBriefModal
        open={fieldSurveyOpen}
        onClose={() => setFieldSurveyOpen(false)}
        claimFileId={id!}
        claimFileNo={claim.fileNo}
        defaultPhone={
          claim.assignedSuppliers?.[0]?.phone
          ?? claim.assignedSupplier?.phone
          ?? claim.customer?.phone
          ?? null
        }
        onSaved={() => setFieldSurveyRefreshKey((k) => k + 1)}
      />

      {!isFieldStaff && canViewFinancials && activeGroup !== 'finans' && (
        <div className="mb-4">
          <FinansRaporOzeti
            claim={claim}
            compact
            onOpenFinansTab={() => setActiveGroup('finans')}
            reportEditHref={reportEditHref}
          />
        </div>
      )}

      {/* Tabs — kaydırınca üstte kalır */}
      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 mb-4 bg-[#f8fafc]/95 backdrop-blur-sm">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit flex-wrap shadow-sm">
        {GROUP_TABS.filter((tab) => {
          if (isFieldStaff && tab.id === 'finans') return false;
          if (tab.id === 'finans' && !canViewFinancials) return false;
          return true;
        }).map((tab) => {
          const Icon = tab.Icon;
          const active = activeGroup === tab.id;
          return (
          <button type="button" key={tab.id} onClick={() => setActiveGroup(tab.id)} className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${active ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon className={`h-3.5 w-3.5 ${active ? 'text-slate-700' : 'text-slate-400'}`} strokeWidth={1.75} />
            {tab.label}
          </button>
          );
        })}
        </div>
      </div>

      {/* Tab Content */}
      {activeGroup === 'genel-bilgiler' && (
        <GenelTab
          claim={claim}
          isFieldStaff={isFieldStaff}
          userRoleCode={userRoleCode}
          onClaimUpdated={(patch) => setClaim((c: any) => ({ ...c, ...patch }))}
        />
      )}
      {activeGroup === 'raporlar' && (
        <OnarimRaporuTab claimId={id!} />
      )}
      {activeGroup === 'evraklar' && (
        <EvraklarTab claimId={id!} claim={claim} />
      )}
      {activeGroup === 'finans' && !isFieldStaff && canViewFinancials && (
        <FinansTab
          claim={claim}
          claimId={id!}
          reportEditHref={reportEditHref}
        />
      )}
      {activeGroup === 'operasyon' && (
        <TakipTab claimId={id!} claim={claim} initialSubTab={initialOpsSub} />
      )}
    </div>
  );
}
