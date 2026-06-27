'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { TrDateInput } from '@/components/ui/TrDateInput';
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileText,
  Search,
  UserRound,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { apiClient, ApiError } from '@/lib/api-client';

type EntityKind = 'customer' | 'adjuster' | 'vendor';
type RiskLevel = 'low' | 'medium' | 'high' | 'none';
type CrmStatus = 'candidate' | 'contacted' | 'proposal_sent' | 'waiting' | 'active' | 'passive' | 'lost';
type NoteType = 'general' | 'phone_call' | 'meeting' | 'visit' | 'email';
type FollowUpStatus = 'open' | 'done' | 'postponed' | 'cancelled';
type CrmActionTab = 'note' | 'followup' | 'status' | 'email';
type CrmVisibility = 'everyone' | 'responsible' | 'managers';

type CrmEntity = {
  id: string;
  kind: EntityKind;
  name: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  district?: string | null;
  lastContact?: string | null;
  followUp?: string | null;
  operationCount: number;
  signal: string;
  risk: RiskLevel;
  satisfaction?: number | null;
  specialties: string[];
  source: any;
  detail?: any;
};

type CrmSummary = {
  crmStatus?: CrmStatus | null;
  lastContactAt?: string | null;
  lastNoteSummary?: string | null;
  openFollowUp?: {
    followUpId: string;
    title?: string | null;
    result?: string | null;
    dueAt?: string | null;
    status?: FollowUpStatus | null;
    ownerName?: string | null;
  } | null;
  noteCount?: number;
  followUpCount?: number;
};

type CrmActivityEvent = {
  id: string;
  action: string;
  createdAt: string;
  user?: { name?: string | null; email?: string | null } | null;
  value?: any;
};

type CrmActivity = {
  summary: CrmSummary;
  events: CrmActivityEvent[];
};

type CorporateEmailSignature = {
  companySignature: string;
  legalText: string;
};

type OperationMemoryCard = {
  label: string;
  value: string;
  detail?: string | null;
  tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose';
};

type OperationMemory = {
  shortSummary: {
    lastContact?: string | null;
    lastContactBy?: string | null;
    openFollowUp?: CrmSummary['openFollowUp'];
    latestOperation?: {
      type: string;
      id: string;
      title: string;
      status: string;
      date: string;
      href: string;
      meta?: string | null;
      signal?: string | null;
    } | null;
    risk?: { label: string; level: 'low' | 'medium' | 'high'; detail: string } | null;
  };
  cards: OperationMemoryCard[];
  signals: Array<{ label: string; level: 'low' | 'medium' | 'high'; detail: string }>;
  links: Array<{ label: string; href: string; type: string; status: string }>;
  customerOperationSummary?: {
    totalFiles: number;
    openFiles: number;
    totalRevenue: number;
    totalProfit: number;
    averageFileDurationDays: number | null;
    lastOperationDate: string | null;
    currency?: string;
  } | null;
  sources: {
    crmNotes: number;
    crmFollowUps: number;
    operations: number;
    auditLogs: number;
  };
};

function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

const kindLabels: Record<EntityKind, string> = {
  customer: 'Müşteri',
  adjuster: 'Eksper',
  vendor: 'Tedarikçi',
};

const kindIcons: Record<EntityKind, React.ComponentType<{ className?: string }>> = {
  customer: Building2,
  adjuster: UserRound,
  vendor: Briefcase,
};

const visibilityOptions: Array<{ value: CrmVisibility; label: string }> = [
  { value: 'everyone', label: 'Herkes' },
  { value: 'responsible', label: 'Sadece Sorumlular' },
  { value: 'managers', label: 'Sadece Yöneticiler' },
];

const statusLabels: Record<string, string> = {
  active: 'Aktif',
  passive: 'Pasif',
  suspended: 'Askıda',
  blacklisted: 'Riskli',
};

const riskLabels: Record<RiskLevel, string> = {
  none: 'Yok',
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
};

const riskClasses: Record<RiskLevel, string> = {
  none: 'bg-slate-100 text-slate-600 border-slate-200',
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-rose-50 text-rose-700 border-rose-200',
};

const crmStatusLabels: Record<CrmStatus, string> = {
  candidate: 'Aday',
  contacted: 'İlk Görüşme Yapıldı',
  proposal_sent: 'Teklif Verildi',
  waiting: 'Beklemede',
  active: 'Müşteri Kazanıldı',
  passive: 'Pasif',
  lost: 'Müşteri Kaybedildi',
};

const crmStatusOptions: Array<{ value: CrmStatus; label: string }> = [
  { value: 'candidate', label: 'Aday' },
  { value: 'contacted', label: 'İlk Görüşme Yapıldı' },
  { value: 'proposal_sent', label: 'Teklif Verildi' },
  { value: 'waiting', label: 'Beklemede' },
  { value: 'active', label: 'Müşteri Kazanıldı' },
  { value: 'passive', label: 'Pasif' },
  { value: 'lost', label: 'Müşteri Kaybedildi' },
];

const noteTypeOptions: Array<{ value: NoteType; label: string }> = [
  { value: 'general', label: 'Görüşme Notu' },
  { value: 'phone_call', label: 'Telefon Görüşmesi' },
  { value: 'meeting', label: 'Toplantı Notu' },
  { value: 'visit', label: 'Ziyaret Notu' },
  { value: 'email', label: 'E-posta Görüşmesi' },
];

const followUpStatusOptions: Array<{ value: FollowUpStatus; label: string }> = [
  { value: 'open', label: 'Açık' },
  { value: 'done', label: 'Kapandı' },
  { value: 'postponed', label: 'Ertelendi' },
  { value: 'cancelled', label: 'İptal' },
];

function visibilityLabel(value?: string | null) {
  return visibilityOptions.find((item) => item.value === value)?.label ?? 'Herkes';
}

function listOf<T>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function fmtDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtCurrency(value?: number | null, currency = 'TRY') {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function isPositiveMetric(value?: number | null) {
  return Number(value ?? 0) > 0;
}

function compactCurrency(value?: number | null, currency = 'TRY') {
  return isPositiveMetric(value) ? fmtCurrency(value, currency) : 'Finansal veri yok';
}

function inputDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function toIsoDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function isOpenFollow(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function relationshipKey(entity: Pick<CrmEntity, 'kind' | 'id'>) {
  return `${entity.kind}:${entity.id}`;
}

function defaultCrmStatus(entity: CrmEntity): CrmStatus {
  if (entity.status === 'passive' || entity.status === 'suspended') return 'passive';
  if (entity.status === 'blacklisted') return 'lost';
  return 'active';
}

function effectiveCrmStatus(entity: CrmEntity, summary?: CrmSummary): CrmStatus {
  return summary?.crmStatus ?? defaultCrmStatus(entity);
}

function effectiveFollowUpDate(entity: CrmEntity, summary?: CrmSummary) {
  return summary?.openFollowUp?.dueAt ?? entity.followUp;
}

function effectiveFollowUpText(summary?: CrmSummary) {
  return summary?.openFollowUp?.result || summary?.openFollowUp?.title || null;
}

function isFollowUpEvent(event: CrmActivityEvent) {
  return event.action === 'crm.follow_up.created' || event.action === 'crm.follow_up.updated';
}

function emailPreviewText(message: string, signature?: CorporateEmailSignature | null) {
  return [
    message.trim(),
    '---',
    'Kullanıcı imzası gönderim sırasında otomatik eklenecek.',
    signature?.companySignature?.trim() || '',
    signature?.legalText?.trim() || '',
  ].filter(Boolean).join('\n\n');
}

function eventLabel(event: CrmActivityEvent) {
  if (event.action === 'crm.note.created') return noteTypeOptions.find((item) => item.value === event.value?.noteType)?.label ?? 'CRM Notu';
  if (event.action === 'crm.follow_up.created') return 'Takip Oluşturuldu';
  if (event.action === 'crm.follow_up.updated') return 'Takip Güncellendi';
  if (event.action === 'crm.status.changed') return 'Durum Değişti';
  if (event.action === 'crm.email.sent') return 'E-posta Gönderildi';
  return 'CRM Olayı';
}

function eventText(event: CrmActivityEvent) {
  if (event.action === 'crm.status.changed') {
    const status = event.value?.status as CrmStatus | undefined;
    return status ? crmStatusLabels[status] : 'Durum güncellendi';
  }
  if (event.action === 'crm.email.sent') {
    return event.value?.subject ?? 'E-posta gönderildi';
  }
  return event.value?.summary ?? event.value?.title ?? event.value?.result ?? '-';
}

function nameFromCustomer(customer: any) {
  return (
    customer.name ||
    customer.companyName ||
    customer.fullName ||
    [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
    'İsimsiz müşteri'
  );
}

function normalizeCustomer(customer: any): CrmEntity {
  const count = Number(customer?._count?.claimFiles ?? customer?._count?.files ?? customer?.claimFiles?.length ?? 0);
  const followUp = customer.followUpDate ?? null;
  const satisfaction = customer.satisfactionScore == null ? null : Number(customer.satisfactionScore);
  return {
    id: customer.id,
    kind: 'customer',
    name: nameFromCustomer(customer),
    typeLabel: customer.customerType === 'corporate' || customer.entityType === 'corporate' || customer.type === 'corporate'
      ? 'Kurumsal'
      : 'Bireysel',
    status: customer.status ?? 'active',
    statusLabel: statusLabels[customer.status] ?? customer.status ?? 'Aktif',
    phone: customer.phone,
    email: customer.email,
    city: customer.city,
    district: customer.district,
    lastContact: customer.updatedAt ?? customer.createdAt ?? null,
    followUp,
    operationCount: count,
    signal: satisfaction ? `Memnuniyet ${satisfaction}/5` : followUp ? 'Takip var' : count > 0 ? `${count} dosya` : 'Yeni ilişki',
    risk: customer.status === 'blacklisted' ? 'high' : followUp ? 'medium' : 'none',
    satisfaction,
    specialties: Array.isArray(customer.serviceBranches) ? customer.serviceBranches : [],
    source: customer,
  };
}

function normalizeAdjuster(adjuster: any, performance: Record<string, any>): CrmEntity {
  const perf = performance[adjuster.id] ?? {};
  const score = Number(perf.performanceScore ?? perf.score ?? 0);
  const total = Number(perf.total ?? perf.totalAssignments ?? adjuster.assignments?.length ?? 0);
  const risk: RiskLevel = score > 0 && score < 60 ? 'medium' : 'none';
  return {
    id: adjuster.id,
    kind: 'adjuster',
    name: adjuster.name || [adjuster.firstName, adjuster.lastName].filter(Boolean).join(' ') || 'İsimsiz eksper',
    typeLabel: adjuster.company ? 'Eksper firması' : 'Eksper',
    status: adjuster.status ?? 'active',
    statusLabel: statusLabels[adjuster.status] ?? adjuster.status ?? 'Aktif',
    phone: adjuster.phone,
    email: adjuster.email,
    city: adjuster.city,
    district: adjuster.region,
    lastContact: adjuster.updatedAt ?? adjuster.createdAt ?? null,
    followUp: null,
    operationCount: total,
    signal: score ? `Skor ${score}` : total ? `${total} iş` : 'Performans yok',
    risk,
    specialties: Array.isArray(adjuster.specialties) ? adjuster.specialties : [],
    source: adjuster,
    detail: { performance: perf },
  };
}

function normalizeVendor(vendor: any): CrmEntity {
  const contracts = Number(vendor.vendorContracts?.length ?? vendor._count?.vendorContracts ?? 0);
  const jobs = Number(vendor.assignedClaimFiles?.length ?? vendor._count?.assignedClaimFiles ?? 0);
  const riskLevel = String(vendor.riskScore?.riskLevel ?? '').toLowerCase();
  const risk: RiskLevel = riskLevel === 'high' ? 'high' : riskLevel === 'medium' ? 'medium' : riskLevel === 'low' ? 'low' : 'none';
  const followUp = vendor.contractEndDate ?? null;
  return {
    id: vendor.id,
    kind: 'vendor',
    name: vendor.name || 'İsimsiz tedarikçi',
    typeLabel: vendor.category === 'acil' ? 'Acil Yardım' : vendor.category === 'her_ikisi' ? 'Hasar + Acil' : 'Hasar',
    status: vendor.status ?? 'active',
    statusLabel: statusLabels[vendor.status] ?? vendor.status ?? 'Aktif',
    phone: vendor.phone || vendor.authorizedPhone,
    email: vendor.email || vendor.authorizedEmail,
    city: vendor.city,
    district: vendor.district,
    lastContact: vendor.updatedAt ?? vendor.createdAt ?? null,
    followUp,
    operationCount: jobs + contracts,
    signal: risk !== 'none' ? `Risk ${riskLabels[risk]}` : contracts ? `${contracts} sözleşme` : jobs ? `${jobs} iş` : 'Yeni iş ortağı',
    risk,
    specialties: Array.isArray(vendor.vendorWorkGroups)
      ? vendor.vendorWorkGroups.map((x: any) => x.workGroup?.name ?? x.name).filter(Boolean)
      : [],
    source: vendor,
  };
}

function entityPath(entity: CrmEntity) {
  if (entity.kind === 'customer') return `/panel/musteriler/${entity.id}`;
  if (entity.kind === 'adjuster') return `/panel/eksperler/${entity.id}`;
  return `/panel/tedarikciler/${entity.id}`;
}

function PoolSummaryItem({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'blue' | 'amber' | 'rose' }) {
  const tones = {
    slate: 'text-slate-700',
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
  };
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-slate-500">
      <span>{label}</span>
      <strong className={`text-xs font-semibold ${tones[tone]}`}>{value}</strong>
    </span>
  );
}

function DecisionMetric({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'blue' | 'amber' | 'emerald' | 'rose' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-800',
    blue: 'border-blue-100 bg-blue-50 text-blue-800',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-800',
    rose: 'border-rose-100 bg-rose-50 text-rose-800',
  };
  return (
    <div className={`min-h-[58px] min-w-0 rounded-lg border px-2 py-2 ${tones[tone]}`}>
      <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-xs font-bold">{value}</p>
    </div>
  );
}

function OperationMemoryCardView({ label, value, detail, tone = 'slate' }: OperationMemoryCard) {
  const tones = {
    slate: 'border-slate-200 bg-white',
    blue: 'border-blue-200 bg-blue-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    amber: 'border-amber-200 bg-amber-50',
    rose: 'border-rose-200 bg-rose-50',
  };
  return (
    <div className={`min-h-[66px] rounded-md border p-2 ${tones[tone]}`}>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-950">{value ? (value.includes('T') ? fmtDateTime(value) : value) : '-'}</p>
      {detail && <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{detail.includes('T') ? fmtDateTime(detail) : detail}</p>}
    </div>
  );
}

function KindBadge({ entity }: { entity: CrmEntity }) {
  const Icon = kindIcons[entity.kind];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-500">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span>
        <span className="block text-xs font-semibold text-slate-700">{kindLabels[entity.kind]}</span>
        <span className="block text-[11px] text-slate-500">{entity.typeLabel}</span>
      </span>
    </span>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-500">
      <span>{label}</span>
      <TrDateInput
        value={value}
        onChange={onChange}
        className="h-10 rounded-md border border-slate-200 px-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400"
      />
    </label>
  );
}

function buildMemoryCards(entity: CrmEntity) {
  if (entity.kind === 'customer') {
    return [
      { label: 'Son Temas', value: fmtDate(entity.lastContact), detail: 'Görüşme özeti yok', tone: 'blue' as const },
      { label: 'Sonraki Aksiyon', value: entity.followUp ? fmtDate(entity.followUp) : 'Planlanmamış', detail: entity.followUp ? 'Takip var' : 'Aksiyon beklemiyor', tone: entity.followUp ? 'amber' as const : 'slate' as const },
      { label: 'Açık Takip Özeti', value: entity.followUp ? 'Takip var' : 'Yok', detail: entity.followUp ? fmtDate(entity.followUp) : 'Bekleyen takip yok', tone: entity.followUp ? 'amber' as const : 'slate' as const },
      { label: 'Operasyon Değeri', value: `${entity.operationCount} dosya`, detail: 'Ciro/kar canlı hafıza ile gelir', tone: 'emerald' as const },
    ];
  }
  if (entity.kind === 'adjuster') {
    return [
      { label: 'Uzmanlık', value: entity.specialties.slice(0, 2).join(', ') || 'Tanımlı değil', tone: 'blue' as const },
      { label: 'Son Atama', value: fmtDate(entity.lastContact), tone: 'slate' as const },
      { label: 'Performans', value: entity.signal, tone: entity.risk === 'medium' ? 'amber' as const : 'emerald' as const },
      { label: 'Toplam İş', value: `${entity.operationCount}`, tone: 'slate' as const },
    ];
  }
  return [
    { label: 'Bölge', value: [entity.city, entity.district].filter(Boolean).join(' / ') || 'Tanımlı değil', tone: 'blue' as const },
    { label: 'Son İş', value: fmtDate(entity.lastContact), tone: 'slate' as const },
    { label: 'Risk', value: riskLabels[entity.risk], tone: entity.risk === 'high' ? 'rose' as const : entity.risk === 'medium' ? 'amber' as const : 'emerald' as const },
    { label: 'Sözleşme', value: entity.followUp ? fmtDate(entity.followUp) : 'Kayıt yok', tone: entity.followUp ? 'amber' as const : 'slate' as const },
  ];
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <div>
        <p className="text-sm font-semibold text-slate-800">Filtreye uygun ilişki bulunamadı</p>
        <p className="mt-1 text-xs text-slate-500">Havuzu yeniden taramak için filtreleri temizleyin veya kaynak ekrana gidin.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onReset} className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700">
          Filtreleri temizle
        </button>
        <Link href="/panel/musteriler" className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:border-blue-200 hover:text-blue-700">
          Müşteriler
        </Link>
        <Link href="/panel/eksperler" className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:border-blue-200 hover:text-blue-700">
          Eksperler
        </Link>
        <Link href="/panel/tedarikciler" className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:border-blue-200 hover:text-blue-700">
          Tedarikçiler
        </Link>
      </div>
    </div>
  );
}

export default function CrmPage() {
  const [entities, setEntities] = useState<CrmEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CrmEntity | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [kindFilter, setKindFilter] = useState<EntityKind | ''>('');
  const [openFollowOnly, setOpenFollowOnly] = useState(false);
  const [riskFilter, setRiskFilter] = useState('');
  const [crmSummaries, setCrmSummaries] = useState<Record<string, CrmSummary>>({});
  const [crmActivity, setCrmActivity] = useState<CrmActivity | null>(null);
  const [operationMemory, setOperationMemory] = useState<OperationMemory | null>(null);
  const [corporateSignature, setCorporateSignature] = useState<CorporateEmailSignature | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<CrmStatus>('active');
  const [statusVisibility, setStatusVisibility] = useState<CrmVisibility>('everyone');
  const [activeActionTab, setActiveActionTab] = useState<CrmActionTab>('note');
  const [noteForm, setNoteForm] = useState({ occurredAt: todayInputDate(), noteType: 'general' as NoteType, visibility: 'everyone' as CrmVisibility, summary: '', body: '' });
  const [followUpForm, setFollowUpForm] = useState({ dueAt: todayInputDate(), status: 'open' as FollowUpStatus, visibility: 'everyone' as CrmVisibility, result: '' });
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', message: '', visibility: 'everyone' as CrmVisibility });
  const noteSummaryRef = useRef<HTMLTextAreaElement | null>(null);

  function resetFilters() {
    setSearch('');
    setKindFilter('');
    setStatusFilter('');
    setRiskFilter('');
    setOpenFollowOnly(false);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [customers, vendors, adjusters, performanceRows, signature] = await Promise.all([
          apiClient.get<any[]>('/customers', { limit: 100 }),
          apiClient.get<any[]>('/vendors', { limit: 100 }),
          apiClient.get<any[]>('/adjusters', { limit: 100 }),
          apiClient.get<any[]>('/adjusters/performance').catch(() => []),
          apiClient.get<CorporateEmailSignature>('/system-settings/corporate-email-signature').catch(() => null),
        ]);

        const performance = performanceRows.reduce<Record<string, any>>((acc, row) => {
          if (row?.id) acc[row.id] = row;
          if (row?.adjusterId) acc[row.adjusterId] = row;
          return acc;
        }, {});

        const next = [
          ...listOf<any>(customers).map(normalizeCustomer),
          ...listOf<any>(adjusters).map((item) => normalizeAdjuster(item, performance)),
          ...listOf<any>(vendors).map(normalizeVendor),
        ];

        if (!cancelled) {
          setEntities(next);
          setCorporateSignature(signature);
          setSelected((prev) => prev ?? next[0] ?? null);
          if (next.length > 0) {
            const summaries = await apiClient.post<Record<string, CrmSummary>>('/crm/relationships/summaries', {
              relationships: next.map((item) => ({ kind: item.kind, id: item.id })),
            });
            if (!cancelled) setCrmSummaries(summaries ?? {});
          }
        }
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'CRM verisi alınamadı'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshCrmActivity(entity: CrmEntity) {
    setActivityLoading(true);
    setActionError(null);
    try {
      const data = await apiClient.get<CrmActivity>(`/crm/relationships/${entity.kind}/${entity.id}/activity`);
      const key = relationshipKey(entity);
      const nextSummary = data.summary ?? {};
      setCrmActivity(data);
      setCrmSummaries((prev) => ({ ...prev, [key]: nextSummary }));
      setEntities((prev) => prev.map((item) => {
        if (relationshipKey(item) !== key) return item;
        return {
          ...item,
          followUp: nextSummary.openFollowUp?.dueAt ?? null,
          signal: nextSummary.openFollowUp ? effectiveFollowUpText(nextSummary) ?? 'Takip var' : item.signal,
          risk: nextSummary.openFollowUp ? 'medium' : item.risk,
        };
      }));
      setSelected((prev) => {
        if (!prev || relationshipKey(prev) !== key) return prev;
        return {
          ...prev,
          followUp: nextSummary.openFollowUp?.dueAt ?? null,
          signal: nextSummary.openFollowUp ? effectiveFollowUpText(nextSummary) ?? 'Takip var' : prev.signal,
          risk: nextSummary.openFollowUp ? 'medium' : prev.risk,
        };
      });
      setStatusDraft(effectiveCrmStatus(entity, nextSummary));
    } catch (err) {
      setActionError(apiErrorMessage(err, 'CRM aktivitesi alınamadı'));
    } finally {
      setActivityLoading(false);
    }
  }

  async function refreshOperationMemory(entity: CrmEntity) {
    try {
      const data = await apiClient.get<OperationMemory>(`/crm/relationships/${entity.kind}/${entity.id}/memory`);
      setOperationMemory(data ?? null);
    } catch {
      setOperationMemory(null);
    }
  }

  useEffect(() => {
    if (!selected) {
      setCrmActivity(null);
      return;
    }
    const summary = crmSummaries[relationshipKey(selected)];
    setStatusDraft(effectiveCrmStatus(selected, summary));
    setStatusVisibility('everyone');
    setActiveActionTab('note');
    setNoteForm({ occurredAt: todayInputDate(), noteType: 'general', visibility: 'everyone', summary: '', body: '' });
    setFollowUpForm({ dueAt: inputDate(summary?.openFollowUp?.dueAt) || todayInputDate(), status: 'open', visibility: 'everyone', result: '' });
    setEmailForm({
      to: selected.email || '',
      subject: `${selected.name} - Görüşme takibi`,
      message: 'Merhaba,\n\nSon görüşmemizle ilgili takip notumuzu paylaşmak isteriz.',
      visibility: 'everyone',
    });
    refreshCrmActivity(selected);
    refreshOperationMemory(selected);
  }, [selected?.kind, selected?.id]);

  async function saveStatus() {
    if (!selected) return;
    setSavingAction('status');
    setActionError(null);
    try {
      await apiClient.patch(`/crm/relationships/${selected.kind}/${selected.id}/status`, { status: statusDraft, visibility: statusVisibility });
      await refreshCrmActivity(selected);
      await refreshOperationMemory(selected);
    } catch (err) {
      setActionError(apiErrorMessage(err, 'CRM durumu kaydedilemedi'));
    } finally {
      setSavingAction(null);
    }
  }

  async function saveNote() {
    if (!selected) return;
    setSavingAction('note');
    setActionError(null);
    try {
      await apiClient.post(`/crm/relationships/${selected.kind}/${selected.id}/notes`, {
        noteType: noteForm.noteType,
        summary: noteForm.summary,
        body: noteForm.body,
        occurredAt: toIsoDate(noteForm.occurredAt),
        visibility: noteForm.visibility,
      });
      setNoteForm({ occurredAt: todayInputDate(), noteType: 'general', visibility: 'everyone', summary: '', body: '' });
      await refreshCrmActivity(selected);
      await refreshOperationMemory(selected);
    } catch (err) {
      setActionError(apiErrorMessage(err, 'CRM notu kaydedilemedi'));
    } finally {
      setSavingAction(null);
    }
  }

  async function saveFollowUp() {
    if (!selected) return;
    setSavingAction('follow-up');
    setActionError(null);
    try {
      await apiClient.post(`/crm/relationships/${selected.kind}/${selected.id}/follow-ups`, {
        status: followUpForm.status,
        title: followUpForm.result,
        result: followUpForm.result,
        dueAt: toIsoDate(followUpForm.dueAt),
        visibility: followUpForm.visibility,
      });
      setFollowUpForm({ dueAt: todayInputDate(), status: 'open', visibility: 'everyone', result: '' });
      setActiveActionTab('followup');
      await refreshCrmActivity(selected);
      await refreshOperationMemory(selected);
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Takip kaydedilemedi'));
    } finally {
      setSavingAction(null);
    }
  }

  async function sendCrmEmail() {
    if (!selected) return;
    setSavingAction('email');
    setActionError(null);
    try {
      await apiClient.post(`/crm/relationships/${selected.kind}/${selected.id}/email`, {
        to: emailForm.to,
        subject: emailForm.subject,
        message: emailForm.message,
        visibility: emailForm.visibility,
      });
      await refreshCrmActivity(selected);
      await refreshOperationMemory(selected);
    } catch (err) {
      setActionError(apiErrorMessage(err, 'E-posta gönderilemedi'));
    } finally {
      setSavingAction(null);
    }
  }

  const statusOptions = useMemo(() => crmStatusOptions.map((item) => item.label), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return entities.filter((item) => {
      const itemSummary = crmSummaries[relationshipKey(item)];
      const itemStatus = effectiveCrmStatus(item, itemSummary);
      const itemStatusLabel = crmStatusLabels[itemStatus];
      const itemFollowUp = effectiveFollowUpDate(item, itemSummary);
      if (q) {
        const haystack = [item.name, kindLabels[item.kind], item.typeLabel, item.phone, item.email, item.city, item.signal].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');
        if (!haystack.includes(q)) return false;
      }
      if (kindFilter && item.kind !== kindFilter) return false;
      if (statusFilter && itemStatusLabel !== statusFilter) return false;
      if (openFollowOnly && !isOpenFollow(itemFollowUp)) return false;
      if (riskFilter && item.risk !== riskFilter) return false;
      return true;
    });
  }, [crmSummaries, entities, kindFilter, openFollowOnly, riskFilter, search, statusFilter]);

  const summary = useMemo(() => {
    const follow = entities.filter((item) => isOpenFollow(effectiveFollowUpDate(item, crmSummaries[relationshipKey(item)]))).length;
    const risk = entities.filter((item) => item.risk === 'medium' || item.risk === 'high').length;
    const operations = entities.reduce((sum, item) => sum + item.operationCount, 0);
    return { total: entities.length, follow, risk, operations };
  }, [crmSummaries, entities]);

  const selectedCards = selected ? buildMemoryCards(selected) : [];
  const selectedSummary = selected ? crmSummaries[relationshipKey(selected)] : undefined;
  const selectedCrmStatus = selected ? effectiveCrmStatus(selected, selectedSummary) : 'active';
  const customerOperationSummary = operationMemory?.customerOperationSummary ?? null;
  const selectedFollowUpEvents = useMemo(() => (crmActivity?.events ?? []).filter(isFollowUpEvent), [crmActivity]);
  const currentEmailPreview = useMemo(
    () => emailPreviewText(emailForm.message, corporateSignature),
    [emailForm.message, corporateSignature],
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-2 sm:px-5 lg:px-5">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-2">
        <header className="flex flex-col gap-1.5 border-b border-slate-200 pb-1.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.02em] text-blue-600">
              Operasyon İlişkileri <span className="mx-1 text-slate-300">&gt;</span> CRM
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 shadow-sm">
            <PoolSummaryItem label="Toplam ilişki" value={`${summary.total}`} />
            <PoolSummaryItem label="Açık takip" value={summary.follow > 0 ? `${summary.follow}` : 'Yok'} tone={summary.follow ? 'amber' : 'slate'} />
            <PoolSummaryItem label="Risk sinyali" value={summary.risk > 0 ? `${summary.risk}` : 'Yok'} tone={summary.risk ? 'rose' : 'slate'} />
            <PoolSummaryItem label="Operasyon bağı" value={summary.operations > 0 ? `${summary.operations}` : 'Yok'} tone={summary.operations ? 'blue' : 'slate'} />
          </div>
        </header>

        <div className="grid gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_minmax(150px,0.85fr)_minmax(130px,0.75fr)_minmax(115px,0.65fr)_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ad, telefon, e-posta veya sinyal ara"
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <select
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value as EntityKind | '')}
            className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-blue-400"
          >
            <option value="">Tüm ilişkiler</option>
            <option value="customer">Müşteri ilişkileri</option>
            <option value="adjuster">Eksper ilişkileri</option>
            <option value="vendor">Tedarikçi ilişkileri</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-blue-400"
          >
            <option value="">Durum</option>
            {statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value)}
            className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-blue-400"
          >
            <option value="">Risk</option>
            <option value="none">Yok</option>
            <option value="low">Düşük</option>
            <option value="medium">Orta</option>
            <option value="high">Yüksek</option>
          </select>
          <label className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-600">
            <input type="checkbox" checked={openFollowOnly} onChange={(event) => setOpenFollowOnly(event.target.checked)} />
            Açık takip
          </label>
        </div>

        <section className="grid gap-3 xl:grid-cols-[minmax(360px,0.4fr)_minmax(0,0.6fr)] 2xl:grid-cols-[minmax(420px,0.38fr)_minmax(0,0.62fr)]">
          <div className="min-w-0 space-y-2">

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-2.5 py-2">
                <p className="text-xs font-semibold uppercase text-slate-500">İlişki Havuzu</p>
                <p className="mt-0.5 text-xs text-slate-600">Seçilen ilişki sağdaki workspace alanında açılır.</p>
              </div>

              <div className="max-h-[calc(100vh-250px)] min-h-[390px] divide-y divide-slate-100 overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">Yükleniyor</div>
                ) : filtered.length === 0 ? (
                  <EmptyState onReset={resetFilters} />
                ) : filtered.map((item) => {
                  const itemSummary = crmSummaries[relationshipKey(item)];
                  const itemStatus = effectiveCrmStatus(item, itemSummary);
                  const itemFollowUp = effectiveFollowUpDate(item, itemSummary);
                  const isSelected = selected?.id === item.id && selected?.kind === item.kind;
                  return (
                    <button
                      key={`${item.kind}-${item.id}`}
                      type="button"
                      onClick={() => setSelected(item)}
                      className={`block w-full px-2.5 py-2 text-left transition ${isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold leading-snug text-slate-950">{item.name}</p>
                          <div className="mt-1">
                            <KindBadge entity={item} />
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className={`rounded-full border px-1.5 py-0.5 text-[11px] font-semibold ${riskClasses[item.risk]}`}>{riskLabels[item.risk]}</span>
                          <StatusBadge label={crmStatusLabels[itemStatus]} variant={itemStatus === 'active' ? 'success' : itemStatus === 'waiting' || itemStatus === 'proposal_sent' ? 'warning' : itemStatus === 'lost' || itemStatus === 'passive' ? 'neutral' : 'info'} />
                        </div>
                      </div>
                      <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[11px] text-slate-600">
                        <span>Son: {fmtDate(itemSummary?.lastContactAt ?? item.lastContact)}</span>
                        <span>Takip: {itemFollowUp ? fmtDate(itemFollowUp) : '-'}</span>
                        <span>Bağ: {item.operationCount}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {selected ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-blue-600">{kindLabels[selected.kind]} · {selected.typeLabel}</p>
                      <h2 className="mt-0.5 text-base font-bold text-slate-950">{selected.name}</h2>
                      <p className="mt-0.5 text-xs text-slate-500">{[selected.city, selected.district].filter(Boolean).join(' / ') || 'Konum yok'}</p>
                    </div>
                    <StatusBadge label={crmStatusLabels[selectedCrmStatus]} variant={selectedCrmStatus === 'active' ? 'success' : selectedCrmStatus === 'waiting' || selectedCrmStatus === 'proposal_sent' ? 'warning' : selectedCrmStatus === 'lost' || selectedCrmStatus === 'passive' ? 'neutral' : 'info'} />
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="min-w-0">
                      <p className="mb-1.5 text-xs font-semibold text-blue-700">İlişki Takibi</p>
                      <div className="grid grid-cols-2 gap-2 min-[1180px]:grid-cols-4">
                        <DecisionMetric label="Son Temas" value={fmtDate(operationMemory?.shortSummary?.lastContact ?? selectedSummary?.lastContactAt ?? selected.lastContact)} tone="blue" />
                        <DecisionMetric label="Açık Takip" value={selectedSummary?.openFollowUp ? selectedSummary.openFollowUp.title ?? 'Takip var' : 'Yok'} tone={selectedSummary?.openFollowUp ? 'amber' : 'slate'} />
                        <DecisionMetric label="Planlama" value={effectiveFollowUpText(selectedSummary) ?? 'Planlanmamış'} tone={selectedSummary?.openFollowUp ? 'amber' : 'slate'} />
                        <DecisionMetric label="Aksiyon" value={selectedSummary?.lastNoteSummary ?? selected.signal ?? 'Bekleyen yok'} tone={selectedSummary?.lastNoteSummary ? 'blue' : 'slate'} />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="mb-1.5 text-xs font-semibold text-emerald-700">Performans ve Operasyon Özeti</p>
                      <div className="grid grid-cols-2 gap-2 min-[1180px]:grid-cols-4">
                        <DecisionMetric label="Operasyon Bağı" value={selected.operationCount > 0 ? `${selected.operationCount}` : 'Yok'} tone={selected.operationCount > 0 ? 'blue' : 'slate'} />
                        <DecisionMetric label="Toplam Dosya" value={isPositiveMetric(customerOperationSummary?.totalFiles) ? `${customerOperationSummary?.totalFiles}` : selected.operationCount > 0 ? `${selected.operationCount}` : 'Dosya yok'} tone={(customerOperationSummary?.totalFiles ?? selected.operationCount) > 0 ? 'emerald' : 'slate'} />
                        <DecisionMetric label="Açık Dosya" value={isPositiveMetric(customerOperationSummary?.openFiles) ? `${customerOperationSummary?.openFiles}` : 'Açık dosya yok'} tone={isPositiveMetric(customerOperationSummary?.openFiles) ? 'amber' : 'slate'} />
                        <DecisionMetric label="Finansal Etki" value={compactCurrency(customerOperationSummary?.totalProfit ?? customerOperationSummary?.totalRevenue, customerOperationSummary?.currency)} tone={isPositiveMetric(customerOperationSummary?.totalProfit ?? customerOperationSummary?.totalRevenue) ? 'emerald' : 'slate'} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-b border-slate-200 bg-slate-100 px-2.5 pt-2">
                  <div className="flex flex-wrap items-end gap-1">
                    {[
                      { key: 'note' as CrmActionTab, label: 'Not Ekle' },
                      { key: 'followup' as CrmActionTab, label: 'Takip Oluştur' },
                      { key: 'status' as CrmActionTab, label: 'Durum Değiştir' },
                      { key: 'email' as CrmActionTab, label: 'E-posta Gönder' },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveActionTab(tab.key)}
                        className={`relative -mb-px min-h-[30px] min-w-[96px] rounded-t-md border px-2 text-[11px] font-semibold transition ${
                          activeActionTab === tab.key
                            ? 'z-10 border-slate-300 border-b-white bg-white text-slate-950 shadow-sm'
                            : 'border-slate-300 bg-gradient-to-b from-white to-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-b border-slate-200 bg-white p-3">
                  {activeActionTab === 'note' && (
                    <section>
                      <div className="grid gap-2.5 md:grid-cols-3">
                        <DateField
                          label="Tarih"
                          value={noteForm.occurredAt}
                          onChange={(value) => setNoteForm((prev) => ({ ...prev, occurredAt: value }))}
                        />
                        <label className="grid gap-1 text-xs font-semibold text-slate-500">
                          Not Tipi
                          <select
                            value={noteForm.noteType}
                            onChange={(event) => setNoteForm((prev) => ({ ...prev, noteType: event.target.value as NoteType }))}
                            className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-normal text-slate-700 outline-none focus:border-blue-400"
                          >
                            {noteTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                        </label>
                        <label className="grid gap-1 text-xs font-semibold text-slate-500">
                          Görünürlük
                          <select
                            value={noteForm.visibility}
                            onChange={(event) => setNoteForm((prev) => ({ ...prev, visibility: event.target.value as CrmVisibility }))}
                            className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-normal text-slate-700 outline-none focus:border-blue-400"
                          >
                            {visibilityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                        </label>
                      </div>
                      <label className="mt-2 grid gap-1 text-xs font-semibold text-slate-500">
                        Not Özeti
                        <textarea
                          ref={noteSummaryRef}
                          value={noteForm.summary}
                          onChange={(event) => setNoteForm((prev) => ({ ...prev, summary: event.target.value }))}
                          rows={3}
                          placeholder="Görüşme özeti"
                          className="min-h-[68px] rounded-md border border-slate-200 px-2.5 py-2 text-xs font-normal text-slate-700 outline-none focus:border-blue-400"
                        />
                      </label>
                      <div className="mt-2.5 flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500">Sorumlu kişi: Oturumdaki kullanıcı</span>
                        <button type="button" onClick={saveNote} disabled={savingAction === 'note' || !noteForm.summary.trim()} className="inline-flex h-8 items-center justify-center rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                          {savingAction === 'note' ? 'Kaydediliyor' : 'Not Ekle'}
                        </button>
                      </div>
                    </section>
                  )}

                  {activeActionTab === 'followup' && (
                    <section>
                      <div className="grid gap-2.5 md:grid-cols-3">
                        <DateField
                          label="Takip Tarihi"
                          value={followUpForm.dueAt}
                          onChange={(value) => setFollowUpForm((prev) => ({ ...prev, dueAt: value }))}
                        />
                        <label className="grid gap-1 text-xs font-semibold text-slate-500">
                          Durum
                          <select
                            value={followUpForm.status}
                            onChange={(event) => setFollowUpForm((prev) => ({ ...prev, status: event.target.value as FollowUpStatus }))}
                            className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-normal text-slate-700 outline-none focus:border-blue-400"
                          >
                            {followUpStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                        </label>
                        <label className="grid gap-1 text-xs font-semibold text-slate-500">
                          Görünürlük
                          <select
                            value={followUpForm.visibility}
                            onChange={(event) => setFollowUpForm((prev) => ({ ...prev, visibility: event.target.value as CrmVisibility }))}
                            className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-normal text-slate-700 outline-none focus:border-blue-400"
                          >
                            {visibilityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                        </label>
                      </div>
                      <label className="mt-2 grid gap-1 text-xs font-semibold text-slate-500">
                        Sonuç
                        <textarea
                          value={followUpForm.result}
                          onChange={(event) => setFollowUpForm((prev) => ({ ...prev, result: event.target.value }))}
                          rows={2}
                          placeholder="Sonraki aksiyon veya sonuç"
                          className="min-h-[60px] rounded-md border border-slate-200 px-2.5 py-2 text-xs font-normal text-slate-700 outline-none focus:border-blue-400"
                        />
                      </label>
                      <div className="mt-2.5 flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500">Sorumlu kişi: Oturumdaki kullanıcı</span>
                        <button type="button" onClick={saveFollowUp} disabled={savingAction === 'follow-up' || !followUpForm.result.trim()} className="inline-flex h-8 items-center justify-center rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                          {savingAction === 'follow-up' ? 'Kaydediliyor' : 'Takip Oluştur'}
                        </button>
                      </div>
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-slate-700">Takip Geçmişi</p>
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">{selectedFollowUpEvents.length} kayıt</span>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {selectedFollowUpEvents.length ? selectedFollowUpEvents.map((event) => (
                            <div key={event.id} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-semibold text-slate-800">{eventText(event)}</span>
                                <span className="text-slate-500">{fmtDateTime(event.value?.dueAt ?? event.createdAt)}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-slate-500">
                                <span>{followUpStatusOptions.find((item) => item.value === event.value?.status)?.label ?? 'Açık'}</span>
                                <span>·</span>
                                <span>{event.value?.ownerName ?? event.user?.name ?? 'Kullanıcı'}</span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-600">{visibilityLabel(event.value?.visibility)}</span>
                              </div>
                            </div>
                          )) : (
                            <div className="rounded-md border border-dashed border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-500">
                              Bu ilişki için takip geçmişi henüz oluşmadı.
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  )}

                  {activeActionTab === 'status' && (
                    <section>
                      <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <label className="grid gap-1 text-xs font-semibold text-slate-500">
                          Yeni Durum
                          <select
                            value={statusDraft}
                            onChange={(event) => setStatusDraft(event.target.value as CrmStatus)}
                            className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-normal text-slate-700 outline-none focus:border-blue-400"
                          >
                            {crmStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                        </label>
                        <label className="grid gap-1 text-xs font-semibold text-slate-500">
                          Görünürlük
                          <select
                            value={statusVisibility}
                            onChange={(event) => setStatusVisibility(event.target.value as CrmVisibility)}
                            className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-normal text-slate-700 outline-none focus:border-blue-400"
                          >
                            {visibilityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                        </label>
                        <button type="button" onClick={saveStatus} disabled={savingAction === 'status'} className="self-end inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                          {savingAction === 'status' ? 'Kaydediliyor' : 'Durumu Kaydet'}
                        </button>
                      </div>
                    </section>
                  )}

                  {activeActionTab === 'email' && (
                    <section>
                      <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_170px]">
                        <label className="grid gap-1 text-xs font-semibold text-slate-500">
                          Alıcı
                          <input
                            type="email"
                            value={emailForm.to}
                            onChange={(event) => setEmailForm((prev) => ({ ...prev, to: event.target.value }))}
                            placeholder="E-posta bilgisi yok"
                            className="h-9 rounded-md border border-slate-200 px-2.5 text-xs font-normal text-slate-700 outline-none focus:border-blue-400"
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-semibold text-slate-500">
                          Konu
                          <input
                            value={emailForm.subject}
                            onChange={(event) => setEmailForm((prev) => ({ ...prev, subject: event.target.value }))}
                            className="h-9 rounded-md border border-slate-200 px-2.5 text-xs font-normal text-slate-700 outline-none focus:border-blue-400"
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-semibold text-slate-500">
                          Görünürlük
                          <select
                            value={emailForm.visibility}
                            onChange={(event) => setEmailForm((prev) => ({ ...prev, visibility: event.target.value as CrmVisibility }))}
                            className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-normal text-slate-700 outline-none focus:border-blue-400"
                          >
                            {visibilityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                          </select>
                        </label>
                      </div>
                      <label className="mt-2 grid gap-1 text-xs font-semibold text-slate-500">
                        E-posta İçeriği
                        <textarea
                          value={emailForm.message}
                          onChange={(event) => setEmailForm((prev) => ({ ...prev, message: event.target.value }))}
                          className="min-h-[92px] rounded-md border border-slate-200 px-2.5 py-2 text-xs font-normal text-slate-700 outline-none"
                        />
                      </label>
                      <div className="mt-2.5 rounded-lg border border-blue-200 bg-blue-50/60 p-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-blue-800">Gönderilecek E-posta Önizlemesi</p>
                          <span className="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                            Mesaj + İmza
                          </span>
                        </div>
                        <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-md border border-blue-100 bg-white p-2.5 text-xs leading-5 text-slate-700">
                          {currentEmailPreview}
                        </pre>
                      </div>
                      <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-700">E-posta İmza Önizlemesi</p>
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${corporateSignature?.companySignature || corporateSignature?.legalText ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                            {corporateSignature?.companySignature || corporateSignature?.legalText ? 'Kurumsal imza bağlı' : 'Kurumsal imza boş'}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-1.5 text-xs leading-5 text-slate-600 lg:grid-cols-3">
                          <div className="rounded-md border border-slate-200 bg-white p-2">
                            <p className="font-semibold text-slate-700">Kullanıcı İmzası</p>
                            <p>Oturumdaki kullanıcı adı ve e-posta bilgisi gönderim sırasında backend tarafından eklenir.</p>
                          </div>
                          <div className="rounded-md border border-slate-200 bg-white p-2">
                            <p className="font-semibold text-slate-700">Şirket İmzası</p>
                            <p className="whitespace-pre-line">{corporateSignature?.companySignature || 'Kurumsal imza ayarı boş.'}</p>
                          </div>
                          <div className="rounded-md border border-slate-200 bg-white p-2">
                            <p className="font-semibold text-slate-700">Yasal Metin</p>
                            <p className="whitespace-pre-line">{corporateSignature?.legalText || 'Yasal metin ayarı boş.'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500">Kullanıcı imzası, şirket imzası ve yasal metin gönderimde otomatik eklenir.</span>
                        <button
                          type="button"
                          onClick={sendCrmEmail}
                          disabled={savingAction === 'email' || !emailForm.to.trim() || !emailForm.subject.trim() || !emailForm.message.trim()}
                          className="inline-flex h-8 items-center justify-center rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {savingAction === 'email' ? 'Gönderiliyor' : 'E-posta Gönder'}
                        </button>
                      </div>
                    </section>
                  )}

                  {actionError && (
                    <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                      {actionError}
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 p-3">
                  <details className="rounded-lg border border-slate-200 bg-white" open>
                    <summary className="cursor-pointer px-2.5 py-1.5 text-xs font-semibold text-slate-600">Operasyon Hafızası</summary>
                    <div className="border-t border-slate-100 p-2.5">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs">
                        <div className="grid gap-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Görüşme özeti</span>
                            <span className="truncate font-semibold text-slate-950">{selectedSummary?.lastNoteSummary ?? 'Kayıt yok'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Son operasyon</span>
                            <span className="truncate font-semibold text-slate-950">{operationMemory?.shortSummary?.latestOperation?.title ?? 'Kayıt yok'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Risk</span>
                            <StatusBadge label={operationMemory?.shortSummary?.risk?.label ?? riskLabels[selected.risk]} variant={operationMemory?.shortSummary?.risk?.level === 'high' || selected.risk === 'high' ? 'danger' : operationMemory?.shortSummary?.risk ? 'warning' : 'success'} />
                          </div>
                        </div>
                      </div>
                      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                        {(operationMemory?.cards?.length ? operationMemory.cards : selectedCards).slice(0, 4).map((card) => (
                          <OperationMemoryCardView key={card.label} {...card} />
                        ))}
                      </div>
                    </div>
                  </details>

                  <details className="rounded-lg border border-slate-200 bg-white">
                    <summary className="cursor-pointer px-2.5 py-1.5 text-xs font-semibold text-slate-600">Notlar, Takipler ve Zaman Çizgisi</summary>
                    <div className="border-t border-slate-100 p-2.5">
                      <div className="space-y-1.5">
                        {activityLoading ? (
                          <div className="rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-500">Yükleniyor</div>
                        ) : crmActivity?.events?.length ? (
                          crmActivity.events.map((event) => {
                            const Icon = event.action === 'crm.status.changed' ? CheckCircle2 : event.action.includes('follow_up') ? CalendarClock : FileText;
                            return (
                              <div key={event.id} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="inline-flex items-center gap-2 text-slate-600"><Icon className="h-4 w-4 text-slate-400" />{eventLabel(event)}</span>
                                  <span className="text-xs text-slate-500">{fmtDateTime(event.value?.occurredAt ?? event.value?.dueAt ?? event.createdAt)}</span>
                                </div>
                                <p className="mt-1 font-medium text-slate-800">{eventText(event)}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  <span>{event.value?.ownerName ?? event.user?.name ?? 'Kullanıcı'}</span>
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-600">
                                    {visibilityLabel(event.value?.visibility)}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-200 px-2.5 py-2 text-sm text-slate-500">
                            İlk not veya takip kaydedildiğinde burada görünür.
                          </div>
                        )}
                      </div>
                    </div>
                  </details>

                  <details className="rounded-lg border border-slate-200 bg-white">
                    <summary className="cursor-pointer px-2.5 py-1.5 text-xs font-semibold text-slate-600">Operasyon Bağlantıları</summary>
                    <div className="grid gap-1.5 border-t border-slate-100 p-2.5">
                      {operationMemory?.links?.length ? operationMemory.links.map((link) => (
                        <Link key={`${link.type}-${link.label}`} href={link.href} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm hover:border-blue-200 hover:bg-blue-50">
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-slate-800">{link.label}</span>
                            <span className="block truncate text-xs text-slate-500">{link.status}</span>
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                        </Link>
                      )) : (
                        <div className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-500">
                          Bağlı operasyon kaydı bulunamadı.
                        </div>
                      )}
                    </div>
                  </details>

                  <Link href={entityPath(selected)} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                    Varlik detayina git <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[390px] items-center justify-center p-6 text-center text-sm text-slate-500">
                İlişki kaydı seçin
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
