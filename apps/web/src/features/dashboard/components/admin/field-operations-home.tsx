'use client';

/**
 * Saha Operasyon Merkezi — yalnız field_staff.
 * Veri: /claim-files + /tasks?assignedUserId=me
 * Dashboard API yok (403 → Next “N errors”). Telegram / ihbar / Carilerim yok.
 */

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock3,
  FolderOpen,
  ListTodo,
  StickyNote,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { CLAIM_LIST_OPEN_HREF } from '../../utils/claim-nav-href';
import {
  fieldStaffInspectionBadgeClass,
  fieldStaffInspectionReminder,
  fieldStaffInspectionStatus,
  fieldStaffInsuredName,
  fieldStaffPhone,
  fieldStaffAssignedListSplit,
} from '@/utils/field-staff-claim-view';
import { FieldInsuredContactActions } from '@/components/field-survey/FieldInsuredContactActions';
import { InspectionReminderBanner } from '@/components/field-survey/InspectionReminderBanner';

type ListFilter = 'assigned' | 'pending' | 'upcoming' | 'sla' | 'completed';

type FieldClaimRow = {
  id: string;
  fileNo?: string | null;
  insuredName?: string | null;
  insuredPhone?: string | null;
  priority?: string | null;
  lossType?: string | null;
  productBranch?: string | null;
  slaDueAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastActivityAt?: string | null;
  inspectionDone?: boolean | null;
  inspectionDoneAt?: string | null;
  statusChangedAt?: string | null;
  currentStatus?: { name?: string; code?: string; isClosedState?: boolean } | null;
  propertyAddress?: {
    addressLine?: string | null;
    city?: string | null;
    district?: string | null;
  } | null;
  customer?: {
    companyName?: string | null;
    shortName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
  } | null;
  insuranceCompany?: { name?: string | null } | null;
  claimSubject?: { name?: string | null } | null;
};

type ApiTask = {
  id: string;
  claimFileId: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  dueAt?: string | null;
  assignedUserId?: string | null;
  assignedUser?: { firstName?: string | null; lastName?: string | null } | null;
};

type ScheduleBucket = 'overdue' | 'today' | 'within24h' | 'within48h' | 'later';

type FieldTask = {
  id: string;
  claimId: string;
  fileNo: string;
  title: string;
  status: string;
  statusLabel: string;
  priority: string;
  priorityLabel: string;
  dueAt: string | null;
  timeLabel: string;
  ownerLabel: string;
  overdue: boolean;
  inScheduleWindow: boolean;
  scheduleBucket: ScheduleBucket;
  sortAt: number;
};

function fieldClaimHref(id?: string | null, section?: 'foto' | 'not'): string {
  if (!id) return CLAIM_LIST_OPEN_HREF;
  const base = `/panel/hasar-dosyalari/${encodeURIComponent(id)}`;
  if (section === 'foto') return `${base}?saha=foto`;
  if (section === 'not') return `${base}?saha=not`;
  return base;
}

function readCurrentUser(): { id?: string; firstName?: string; lastName?: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw) as { id?: string; firstName?: string; lastName?: string };
  } catch {
    return null;
  }
}

function priorityLabel(priority?: string | null): { text: string; className: string } {
  const p = String(priority ?? '').toLowerCase();
  if (p === 'critical' || p === 'urgent' || p === 'öncelikli') {
    return { text: 'Kritik', className: 'bg-red-50 text-status-danger ring-1 ring-red-100' };
  }
  if (p === 'high' || p === 'yüksek') {
    return { text: 'Yüksek', className: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100' };
  }
  if (p === 'low' || p === 'düşük') {
    return { text: 'Düşük', className: 'bg-slate-50 text-slate-600 ring-1 ring-slate-200' };
  }
  // Mockup / saha dili: orta öncelik
  return { text: 'Orta', className: 'bg-slate-50 text-slate-700 ring-1 ring-slate-200' };
}

function statusLabel(status?: string | null): string {
  const s = String(status ?? '').toLowerCase();
  if (s === 'completed' || s === 'done') return 'Tamamlandı';
  if (s === 'in_progress' || s === 'active') return 'Devam Ediyor';
  return 'Görev Bekleniyor';
}

function formatClock(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function startOfLocalDay(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfLocalDay(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function relativeTimeLabel(iso?: string | null): string {
  if (!iso) return 'Tarih yok';
  const due = new Date(iso).getTime();
  if (Number.isNaN(due)) return 'Tarih yok';
  const now = Date.now();
  const dayEnd = endOfLocalDay(now);
  if (due < now) {
    const days = Math.max(1, Math.ceil((now - due) / 864e5));
    return `${days} gün gecikti`;
  }
  if (due <= dayEnd) return 'Bugün';
  const tomorrowEnd = dayEnd + 864e5;
  if (due <= tomorrowEnd) return 'Yarın';
  if (due - now <= 48 * 36e5) return '48 saat içinde';
  return formatClock(iso);
}

function deriveTaskTitle(claim: FieldClaimRow): string {
  if (fieldStaffInspectionStatus(claim).done) return 'Tespit tamamlandı';
  const name = String(claim.currentStatus?.name ?? '').toLocaleLowerCase('tr-TR');
  if (/foto|görsel/.test(name)) return 'Tespit fotoğrafları tamamlanacak';
  if (/not/.test(name)) return 'Tespit notu girilecek';
  if (/belge|evrak/.test(name)) return 'Ek belge alınacak';
  if (/ön inceleme|pre_review|keşif|tespit|ziyaret/.test(name)) return 'Tespit yapılacak';
  return 'Saha işlemi bekleniyor';
}

function useFieldAssignedClaims(includeClosed: boolean, enabled: boolean, limit = 40) {
  return useQuery({
    queryKey: ['field-operations-home-claims', includeClosed, limit],
    enabled,
    retry: 1,
    throwOnError: false,
    queryFn: async () => {
      const res = await apiClient.getWithMeta<FieldClaimRow[], { total?: number }>('/claim-files', {
        limit,
        statusCode: includeClosed ? 'closed' : 'open',
      });
      return {
        items: res.data ?? [],
        total: res.meta?.total ?? (res.data ?? []).length,
      };
    },
  });
}

function useMyOpenTasks(userId: string | undefined) {
  return useQuery({
    queryKey: ['field-operations-home-tasks', userId],
    enabled: Boolean(userId),
    retry: 1,
    throwOnError: false,
    queryFn: async () => {
      const res = await apiClient.getWithMeta<ApiTask[], { total?: number }>('/tasks', {
        limit: 50,
        assignedUserId: userId!,
      });
      return (res.data ?? []).filter((t) => {
        const s = String(t.status ?? '').toLowerCase();
        return s !== 'completed' && s !== 'cancelled' && s !== 'done';
      });
    },
  });
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-xs text-slate-500">{text}</p>;
}

function KpiButton({
  label,
  value,
  active,
  tone,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string | number;
  active: boolean;
  tone: 'brand' | 'warning' | 'upcoming' | 'danger' | 'success';
  icon: typeof FolderOpen;
  onClick: () => void;
}) {
  const toneMap = {
    brand: 'text-brand-600 bg-brand-50',
    warning: 'text-amber-800 bg-amber-50',
    upcoming: 'text-amber-800 bg-amber-50',
    danger: 'text-status-danger bg-red-50',
    success: 'text-status-success bg-green-50',
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[60px] items-center gap-2.5 rounded-xl border bg-white px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        active
          ? 'border-brand-500 ring-1 ring-brand-200'
          : 'border-slate-200 hover:border-brand-200'
      }`}
    >
      <span className={`inline-flex shrink-0 rounded-lg p-1.5 ${toneMap[tone]}`}>
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-bold tabular-nums leading-none text-slate-950">
          {value}
        </span>
        <span className="mt-0.5 block text-[11px] font-semibold leading-snug text-slate-700">
          {label}
        </span>
      </span>
    </button>
  );
}

function ActionLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: typeof Camera;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      {children}
    </Link>
  );
}

function scheduleBucketFor(dueAt: string | null, overdue: boolean): ScheduleBucket {
  if (overdue) return 'overdue';
  if (!dueAt) return 'today';
  const dueMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueMs)) return 'later';
  const now = Date.now();
  const dayEnd = endOfLocalDay(now);
  if (dueMs <= dayEnd) return 'today';
  if (dueMs - now <= 24 * 36e5) return 'within24h';
  if (dueMs - now <= 48 * 36e5) return 'within48h';
  return 'later';
}

function toFieldTask(
  task: ApiTask,
  fileNo: string,
  ownerFallback: string,
): FieldTask {
  const dueAt = task.dueAt ?? null;
  const dueMs = dueAt ? new Date(dueAt).getTime() : Number.POSITIVE_INFINITY;
  const now = Date.now();
  const overdue = dueAt != null && !Number.isNaN(dueMs) && dueMs < now;
  const scheduleBucket = scheduleBucketFor(dueAt, overdue);
  const inScheduleWindow =
    scheduleBucket === 'overdue' ||
    scheduleBucket === 'today' ||
    scheduleBucket === 'within24h' ||
    scheduleBucket === 'within48h';
  const owner = task.assignedUser
    ? `${task.assignedUser.firstName ?? ''} ${task.assignedUser.lastName ?? ''}`.trim()
    : ownerFallback;
  const prio = priorityLabel(task.priority);
  return {
    id: task.id,
    claimId: task.claimFileId,
    fileNo,
    title: task.title || 'Saha görevi',
    status: task.status,
    statusLabel: statusLabel(task.status),
    priority: task.priority,
    priorityLabel: prio.text,
    dueAt,
    timeLabel: relativeTimeLabel(dueAt),
    ownerLabel: owner || 'Saha',
    overdue,
    inScheduleWindow,
    scheduleBucket,
    sortAt: Number.isFinite(dueMs) ? dueMs : startOfLocalDay(),
  };
}

export function FieldOperationsHome() {
  const [filter, setFilter] = useState<ListFilter>('assigned');
  const [me, setMe] = useState<{ id?: string; firstName?: string; lastName?: string } | null>(null);

  useEffect(() => {
    setMe(readCurrentUser());
  }, []);

  const myName = `${me?.firstName ?? ''} ${me?.lastName ?? ''}`.trim() || 'Saha';

  const openClaimsQuery = useFieldAssignedClaims(false, true, 40);
  const closedClaimsQuery = useFieldAssignedClaims(true, true, 20);
  const tasksQuery = useMyOpenTasks(me?.id);

  const openClaims = openClaimsQuery.data?.items ?? [];
  const { pendingInspection, inspectionDone } = useMemo(
    () => fieldStaffAssignedListSplit(openClaims),
    [openClaims],
  );
  const claimById = useMemo(() => {
    const m = new Map<string, FieldClaimRow>();
    for (const c of openClaims) m.set(c.id, c);
    return m;
  }, [openClaims]);

  /** Bekleyen Tespit Dosyaları: API görevleri; yoksa atanmış açık dosyalardan türetilir */
  const requestedTasks = useMemo((): FieldTask[] => {
    const apiTasks = tasksQuery.data ?? [];
    if (apiTasks.length > 0) {
      const pendingIds = new Set(pendingInspection.map((c) => c.id));
      return apiTasks
        .filter((t) => pendingIds.has(t.claimFileId))
        .map((t) => {
          const claim = claimById.get(t.claimFileId);
          const fileNo = claim?.fileNo ?? '—';
          return toFieldTask(t, fileNo, myName);
        })
        .sort((a, b) => {
          if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
          return a.sortAt - b.sortAt;
        });
    }

    // API boşsa: yalnızca atanmış açık dosyalardan operasyonel talep (sahte liste değil)
    return pendingInspection
      .filter((c) => c.currentStatus?.isClosedState !== true)
      .map((c) =>
        toFieldTask(
          {
            id: `derived-${c.id}`,
            claimFileId: c.id,
            title: deriveTaskTitle(c),
            priority: c.priority ?? 'normal',
            status: 'pending',
            dueAt: c.slaDueAt ?? null,
            assignedUserId: me?.id ?? null,
          },
          c.fileNo ?? '—',
          myName,
        ),
      )
      .sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        return a.sortAt - b.sortAt;
      });
  }, [tasksQuery.data, pendingInspection, claimById, myName, me?.id]);

  /** Bugün / Yaklaşan: Gecikme riski → Bugün → 24 saat (görev listesinin kopyası değil) */
  const scheduleGroups = useMemo(() => {
    const overdue = requestedTasks.filter((t) => t.scheduleBucket === 'overdue');
    const today = requestedTasks.filter((t) => t.scheduleBucket === 'today');
    const within24h = requestedTasks.filter((t) => t.scheduleBucket === 'within24h');
    const within48h = requestedTasks.filter((t) => t.scheduleBucket === 'within48h');
    const byTime = (a: FieldTask, b: FieldTask) => a.sortAt - b.sortAt;
    return {
      overdue: overdue.sort(byTime),
      today: today.sort(byTime),
      within24h: within24h.sort(byTime),
      within48h: within48h.sort(byTime),
    };
  }, [requestedTasks]);

  const scheduleTasks = useMemo(
    () => [
      ...scheduleGroups.overdue,
      ...scheduleGroups.today,
      ...scheduleGroups.within24h,
      ...scheduleGroups.within48h,
    ].slice(0, 10),
    [scheduleGroups],
  );

  const primaryTaskByClaim = useMemo(() => {
    const m = new Map<string, FieldTask>();
    for (const t of requestedTasks) {
      if (!m.has(t.claimId)) m.set(t.claimId, t);
    }
    return m;
  }, [requestedTasks]);

  const openCount = pendingInspection.length;
  const pendingCount = requestedTasks.length;
  const upcomingCount = scheduleTasks.length;
  const slaCount = requestedTasks.filter((t) => t.overdue).length;
  const completedCount = inspectionDone.length + (closedClaimsQuery.data?.items?.length ?? 0);

  const filteredFiles = useMemo(() => {
    if (filter === 'pending') {
      const ids = new Set(requestedTasks.map((t) => t.claimId));
      return pendingInspection.filter((c) => ids.has(c.id));
    }
    if (filter === 'upcoming') {
      const ids = new Set(scheduleTasks.map((t) => t.claimId));
      return pendingInspection.filter((c) => ids.has(c.id));
    }
    if (filter === 'sla') {
      return pendingInspection.filter((c) => {
        const t = primaryTaskByClaim.get(c.id);
        if (t?.overdue) return true;
        if (!c.slaDueAt) return false;
        const due = new Date(c.slaDueAt).getTime();
        return !Number.isNaN(due) && due < Date.now();
      });
    }
    if (filter === 'completed') {
      return [...inspectionDone, ...(closedClaimsQuery.data?.items ?? [])];
    }
    return pendingInspection;
  }, [
    filter,
    pendingInspection,
    inspectionDone,
    requestedTasks,
    scheduleTasks,
    primaryTaskByClaim,
    closedClaimsQuery.data?.items,
  ]);

  const recentOwn = useMemo(() => {
    return [...openClaims]
      .sort((a, b) => {
        const ta = new Date(a.lastActivityAt ?? a.updatedAt ?? 0).getTime();
        const tb = new Date(b.lastActivityAt ?? b.updatedAt ?? 0).getTime();
        return tb - ta;
      })
      .slice(0, 5)
      .map((c) => ({
        fileNo: c.fileNo ?? '—',
        when: c.lastActivityAt ?? c.updatedAt,
        label: 'Dosya güncellendi',
      }));
  }, [openClaims]);

  const loading = openClaimsQuery.isLoading || (!!me?.id && tasksQuery.isLoading);
  const kpisFailed = openClaimsQuery.isError;

  const inspectionReminder = useMemo(
    () => fieldStaffInspectionReminder(openClaims),
    [openClaims],
  );

  const listSubtitle =
    filter === 'completed'
      ? 'Tespiti yapılan dosyalar'
      : filter === 'sla'
        ? 'SLA / gecikme riski taşıyan dosyalar'
        : filter === 'upcoming'
          ? 'Bugün ve yakın zaman penceresindeki işler'
          : filter === 'pending'
            ? 'Açık görev / talep bulunan dosyalar'
            : 'Yalnızca tespit bekleyen atanmış dosyalar';

  return (
    <div className="space-y-4">
      {!loading && inspectionReminder.pendingCount > 0 ? (
        <InspectionReminderBanner
          message={inspectionReminder.message}
          href={CLAIM_LIST_OPEN_HREF}
          testId="saha-tespit-hatirlatma"
        />
      ) : null}

      <section aria-label="Saha Özeti" className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[60px] animate-pulse rounded-xl bg-slate-100" />
            ))
          : kpisFailed
            ? (
              <p className="col-span-2 text-sm text-slate-600 lg:col-span-5">
                Dosya özeti yüklenemedi. Lütfen sayfayı yenileyin.
              </p>
            )
          : (
            <>
              <KpiButton
                icon={FolderOpen}
                label="Atanan Dosyalar"
                value={openCount}
                tone="brand"
                active={filter === 'assigned'}
                onClick={() => setFilter('assigned')}
              />
              <KpiButton
                icon={ListTodo}
                label="Bekleyen Görevler"
                value={pendingCount}
                tone="warning"
                active={filter === 'pending'}
                onClick={() => setFilter('pending')}
              />
              <KpiButton
                icon={Clock3}
                label="Yaklaşan İşler"
                value={upcomingCount}
                tone="upcoming"
                active={filter === 'upcoming'}
                onClick={() => setFilter('upcoming')}
              />
              <KpiButton
                icon={AlertTriangle}
                label="SLA Riski"
                value={slaCount}
                tone="danger"
                active={filter === 'sla'}
                onClick={() => setFilter('sla')}
              />
              <KpiButton
                icon={CheckCircle2}
                label="Tespiti Yapılanlar"
                value={completedCount}
                tone="success"
                active={filter === 'completed'}
                onClick={() => setFilter('completed')}
              />
            </>
          )}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section className="xl:col-span-8">
          <div className="mb-2.5">
            <h2 className="text-base font-semibold text-slate-950">
              {filter === 'completed' ? 'Tespiti Yapılanlar' : 'Bana Atanan Dosyalar'}
            </h2>
            <p className="text-xs text-slate-500">{listSubtitle}</p>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : openClaimsQuery.isError ? (
            <EmptyState text="Dosyalar yüklenemedi. Lütfen sayfayı yenileyin." />
          ) : filteredFiles.length === 0 ? (
            <EmptyState text="Bu görünümde gösterilecek dosya yok." />
          ) : (
            <ul className="space-y-3">
              {filteredFiles.slice(0, 12).map((claim) => {
                const task = primaryTaskByClaim.get(claim.id);
                const prio = priorityLabel(task?.priority ?? claim.priority);
                const insured = fieldStaffInsuredName(claim);
                const phone = fieldStaffPhone(claim);
                const inspection = fieldStaffInspectionStatus(claim);
                const cityLine = [claim.propertyAddress?.city, claim.propertyAddress?.district]
                  .filter(Boolean)
                  .join(' / ');
                const subject =
                  claim.claimSubject?.name ||
                  claim.lossType ||
                  claim.productBranch ||
                  'Hasar Dosyası';

                return (
                  <li
                    key={claim.id}
                    className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/[0.03] transition hover:border-brand-200"
                    data-testid="saha-merkez-dosya-karti"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-brand-50/70 via-white to-white px-3.5 py-2.5 sm:px-4">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="font-mono text-sm font-bold text-slate-950">
                          {claim.fileNo ?? '—'}
                        </span>
                        <span
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${fieldStaffInspectionBadgeClass(inspection.done)}`}
                          data-testid="saha-tespit-rozet"
                        >
                          {inspection.label}
                        </span>
                        {task?.overdue ? (
                          <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-status-danger ring-1 ring-red-100">
                            Gecikme
                          </span>
                        ) : task?.inScheduleWindow ? (
                          <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-100">
                            Yaklaşan
                          </span>
                        ) : null}
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${prio.className}`}
                        >
                          {prio.text}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Son işlem:{' '}
                        <span className="font-medium text-slate-700">
                          {formatClock(claim.lastActivityAt ?? claim.updatedAt)}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 p-3.5 sm:p-4 lg:flex-row lg:items-stretch lg:justify-between">
                      <div className="min-w-0 flex-[1.4] space-y-2.5">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                            <p className="text-[11px] font-medium text-slate-500">Sigortalı</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-950">
                              {insured !== '—' ? insured : '—'}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                            <p className="text-[11px] font-medium text-slate-500">Konu / Yer</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-900">{subject}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">{cityLine || '—'}</p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-brand-100 bg-brand-50/25 px-3 py-2.5">
                          <p className="text-[11px] font-medium text-slate-500">İletişim</p>
                          <div className="mt-1.5">
                            <FieldInsuredContactActions
                              claim={{
                                id: claim.id,
                                fileNo: claim.fileNo,
                                insuredName: claim.insuredName ?? insured,
                                propertyAddress: claim.propertyAddress,
                              }}
                              phone={phone}
                            />
                          </div>
                        </div>

                        {task ? (
                          <div className="rounded-xl border border-slate-100 px-3 py-2 text-xs text-slate-700">
                            <p>
                              <span className="font-semibold text-slate-900">Görev:</span>{' '}
                              {task.title}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {task.statusLabel} · {task.priorityLabel} · {task.timeLabel}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">Açık görev / talep yok</p>
                        )}
                      </div>

                      <div className="flex w-full shrink-0 flex-col justify-center gap-1.5 border-t border-slate-100 pt-3 lg:w-[11.5rem] lg:border-l lg:border-t-0 lg:pl-3.5 lg:pt-0">
                        <ActionLink href={fieldClaimHref(claim.id, 'foto')} icon={Camera}>
                          Tespit Fotoğrafları
                        </ActionLink>
                        <ActionLink href={fieldClaimHref(claim.id, 'not')} icon={StickyNote}>
                          Tespit Notları
                        </ActionLink>
                        <Link
                          href={fieldClaimHref(claim.id)}
                          className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-brand-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                          Dosyaya Git
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-3 xl:col-span-4 xl:min-w-0">
          {/* Bekleyen Tespit Dosyaları — saha kuyruğu */}
          <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.03]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-950">Bekleyen Tespit Dosyaları</h2>
              {pendingCount > 0 ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  {pendingCount}
                </span>
              ) : null}
            </div>
            {loading ? (
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
            ) : requestedTasks.length === 0 ? (
              <EmptyState text="Bekleyen tespit dosyası yok." />
            ) : (
              <ul className="space-y-1.5">
                {requestedTasks.slice(0, 10).map((task) => {
                  const claim = claimById.get(task.claimId);
                  const insured = claim ? fieldStaffInsuredName(claim) : '—';
                  const phone = claim ? fieldStaffPhone(claim) : '';
                  return (
                    <li
                      key={task.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/70 px-2.5 py-2.5 transition hover:border-brand-200 hover:bg-brand-50/40"
                      data-testid="saha-merkez-bekleyen-kart"
                    >
                      <Link href={fieldClaimHref(task.claimId)} className="block">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-900">
                            <span className="font-mono text-slate-500">{task.fileNo}</span>
                            {' — '}
                            {task.title}
                          </p>
                          <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                            {task.timeLabel}
                          </span>
                        </div>
                        {insured !== '—' ? (
                          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-700">
                            {insured}
                          </p>
                        ) : null}
                        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span>
                            {task.statusLabel} · {task.priorityLabel}
                          </span>
                          <span className="font-semibold text-brand-600">İşleme Git →</span>
                        </div>
                      </Link>
                      {claim && phone ? (
                        <FieldInsuredContactActions
                          claim={{
                            id: claim.id,
                            fileNo: claim.fileNo,
                            insuredName: claim.insuredName ?? insured,
                            propertyAddress: claim.propertyAddress,
                          }}
                          phone={phone}
                          compact
                          className="mt-1.5"
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Bugün / Yaklaşan — zaman özeti (görev listesi kopyası değil) */}
          <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.03]">
            <div className="mb-2">
              <h2 className="text-sm font-semibold text-slate-950">Bugün / Yaklaşan İşler</h2>
              <p className="text-[11px] text-slate-500">Neyi ne zaman yapmalıyım?</p>
            </div>
            {loading ? (
              <div className="h-8 animate-pulse rounded-lg bg-slate-100" />
            ) : scheduleTasks.length === 0 ? (
              <EmptyState text="Bugün veya yaklaşan iş yok." />
            ) : (
              <ul className="space-y-1.5">
                {(
                  [
                    {
                      key: 'overdue',
                      label: 'Gecikme Riski',
                      items: scheduleGroups.overdue,
                      tone: 'text-status-danger',
                    },
                    {
                      key: 'today',
                      label: 'Bugün',
                      items: scheduleGroups.today,
                      tone: 'text-amber-800',
                    },
                    {
                      key: 'within24h',
                      label: '24 Saat',
                      items: scheduleGroups.within24h,
                      tone: 'text-brand-700',
                    },
                    {
                      key: 'within48h',
                      label: '48 Saat',
                      items: scheduleGroups.within48h,
                      tone: 'text-slate-600',
                    },
                  ] as const
                )
                  .filter((g) => g.items.length > 0)
                  .map((group) => {
                    const next = group.items[0];
                    const claim = claimById.get(next.claimId);
                    const phone = claim ? fieldStaffPhone(claim) : '';
                    const insured = claim ? fieldStaffInsuredName(claim) : '—';
                    return (
                      <li
                        key={group.key}
                        className="rounded-xl border border-slate-100 bg-slate-50/70 px-2.5 py-2.5 transition hover:border-brand-200 hover:bg-brand-50/40"
                        data-testid="saha-merkez-yaklasan-kart"
                      >
                        <Link href={fieldClaimHref(next.claimId)} className="block">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-semibold ${group.tone}`}>
                              {group.label}
                              <span className="ml-1.5 tabular-nums text-slate-500">
                                · {group.items.length} iş
                              </span>
                            </span>
                            <span className="shrink-0 text-[11px] font-semibold text-brand-600">
                              Git →
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-600">
                            En yakın:{' '}
                            <span className="font-mono font-semibold text-slate-800">
                              {next.fileNo}
                            </span>
                            {' · '}
                            {next.timeLabel}
                            {next.dueAt ? ` · ${formatClock(next.dueAt)}` : ''}
                          </p>
                        </Link>
                        {claim && phone ? (
                          <FieldInsuredContactActions
                            claim={{
                              id: claim.id,
                              fileNo: claim.fileNo,
                              insuredName: claim.insuredName ?? insured,
                              propertyAddress: claim.propertyAddress,
                            }}
                            phone={phone}
                            compact
                            className="mt-1.5"
                          />
                        ) : null}
                      </li>
                    );
                  })}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <h2 className="mb-1.5 text-sm font-semibold text-slate-950">Son İşlemlerim</h2>
            {loading ? (
              <div className="h-6 animate-pulse rounded-lg bg-slate-100" />
            ) : recentOwn.length === 0 ? (
              <EmptyState text="Henüz kendi işleminiz görünmüyor. Atama sonrası burada listelenir." />
            ) : (
              <ul className="space-y-0.5">
                {recentOwn.map((item, idx) => (
                  <li
                    key={`${item.fileNo}-${item.when}-${idx}`}
                    className="flex items-baseline justify-between gap-2 py-1 text-xs"
                  >
                    <span className="min-w-0 truncate text-slate-700">
                      <span className="font-mono text-slate-500">{item.fileNo}</span>
                      {' · '}
                      {item.label}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatClock(item.when)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
