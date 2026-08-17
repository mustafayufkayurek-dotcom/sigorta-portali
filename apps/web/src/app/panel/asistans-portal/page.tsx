'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ClipboardCheck, FilePlus2, Hourglass, MapPin } from 'lucide-react';
import { DashboardShell, DashboardHeader } from '@/app/panel/_components';
import {
  ExpertFileDetailDrawer,
  type ExpertDrawerFile,
} from '@/components/eksper-portal/ExpertFileDetailDrawer';
import { InsuranceDetailedStatsModal } from '@/components/portal/InsuranceDetailedStatsModal';
import { PortalWeeklyTrendCard } from '@/components/panel/portal-weekly-trend-card';
import { SlidePanel } from '@/components/SlidePanel';
import { EmergencyCaseNewForm } from '@/components/emergency/EmergencyCaseNewForm';
import { fmtDateTime } from '@/utils/date-helpers';
import { formatTryAmount } from '@/utils/format-try-amount';
import {
  classifyAssistanceStage,
  countAssistanceStages,
  emergencyStatusLabel,
  type AssistanceCaseLike,
} from '@/utils/assistance-portal-stages';
import {
  insuranceFileNo,
  sortInsuranceFilesByActivity,
  type InsuranceClaimLike,
} from '@/utils/insurance-portal-monitoring';
import {
  buildPortalActivitySeries,
  buildPastMonthOptions,
  buildPastYearOptions,
  portalActivityRangeLabel,
  type PortalActivityRange,
} from '@/utils/portal-weekly-activity';
import {
  fetchPortalEmergencyCases,
  hasPortalSessionToken,
} from '@/utils/portal-api';
import { hasAssistanceCompanyUserAccess, readAssistancePortalUser } from '@/utils/portal-assistance-scope';

type AssistanceFile = InsuranceClaimLike & AssistanceCaseLike;

type DrawerTab = 'ozet' | 'belgeler' | 'operasyon' | 'notlar';

function toHomeDrawerFile(file: AssistanceFile): ExpertDrawerFile {
  const statusCode = file.currentStatus?.code ?? file.status ?? undefined;
  return {
    id: file.id,
    fileNo: insuranceFileNo(file),
    lossType: file.lossType,
    subject: file.subject,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    currentStatus: statusCode
      ? {
          name: emergencyStatusLabel(statusCode),
          code: String(statusCode),
          colorCode: file.currentStatus?.colorCode,
          color: file.currentStatus?.color,
        }
      : null,
  };
}

function formatRelativeTr(iso?: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün önce`;
  return fmtDateTime(iso);
}

function fmtMoney(v?: number) {
  return formatTryAmount(v);
}

function SummaryCard({
  label,
  value,
  href,
  tone = 'slate',
  icon,
  hint,
}: {
  label: string;
  value: number;
  href: string;
  tone?: 'slate' | 'amber' | 'brand' | 'emerald';
  icon: ReactNode;
  /** Tam ifade — hover / erişilebilirlik */
  hint?: string;
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-200 hover:border-amber-300'
      : tone === 'brand'
        ? 'border-brand-200 hover:border-brand-300'
        : tone === 'emerald'
          ? 'border-emerald-200 hover:border-emerald-300'
          : 'border-slate-200 hover:border-slate-300';
  const iconWrap =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-600'
      : tone === 'brand'
        ? 'bg-brand-50 text-brand-600'
        : tone === 'emerald'
          ? 'bg-emerald-50 text-emerald-600'
          : 'bg-slate-100 text-slate-600';
  const full = hint ?? label;
  return (
    <Link
      href={href}
      title={full}
      aria-label={`${full}: ${value}`}
      className={`group relative flex min-h-[5.5rem] min-w-0 flex-col overflow-hidden rounded-xl border bg-white px-3 pb-3 pt-2.5 shadow-sm transition hover:shadow-md ${toneClass}`}
    >
      <span
        className={`absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg transition group-hover:scale-105 ${iconWrap}`}
        aria-hidden
      >
        {icon}
      </span>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 px-7 text-center">
        <p className="w-full text-[11px] font-medium leading-tight text-slate-500">{label}</p>
        <p className="w-full text-[1.625rem] font-bold tabular-nums leading-none tracking-tight text-slate-900">
          {value}
        </p>
      </div>
    </Link>
  );
}

/**
 * Dosya Takip — yalnız Acil Yardım operasyonu.
 */
export default function AsistansPortalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [missingScope, setMissingScope] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [files, setFiles] = useState<AssistanceFile[]>([]);
  const [fileTotal, setFileTotal] = useState(0);
  const [userName, setUserName] = useState('Kullanıcı');
  const [companyName, setCompanyName] = useState('');
  const [drawerFileId, setDrawerFileId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('ozet');
  const [drawerSeed, setDrawerSeed] = useState<ExpertDrawerFile | null>(null);
  const notesRefreshToken = 0;
  const [activityRange, setActivityRange] = useState<PortalActivityRange>({ kind: 'last_days', days: 7 });
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [showNewCase, setShowNewCase] = useState(false);
  const [newCaseSession, setNewCaseSession] = useState(0);
  const [scopedCustomerId, setScopedCustomerId] = useState('');
  const [createdNotice, setCreatedNotice] = useState('');

  const reload = async () => {
    const emergencyRes = await fetchPortalEmergencyCases(100);
    const emergencyFiles: AssistanceFile[] = (emergencyRes?.data ?? []).map((raw: any) => {
      const statusCode = String(raw.status || 'GELEN');
      return {
        id: String(raw.id),
        fileNo: raw.fileNo || raw.caseNo || undefined,
        fileNumber: raw.fileNo || raw.caseNo || undefined,
        createdAt: raw.createdAt || raw.fileDate,
        updatedAt: raw.updatedAt || raw.createdAt,
        lastActivityAt: raw.updatedAt || raw.createdAt,
        notificationDate: raw.fileDate || raw.createdAt,
        sourceChannel: 'emergency',
        portalTrack: 'direct_process',
        subject: raw.issueType || raw.serviceType || undefined,
        lossType: raw.issueType || raw.serviceType || undefined,
        city: raw.city || null,
        totalGelir: typeof raw.totalGelir === 'number' ? raw.totalGelir : 0,
        status: statusCode,
        currentStatus: {
          code: statusCode,
          name: emergencyStatusLabel(statusCode),
        },
      };
    });
    setFiles(emergencyFiles);
    setFileTotal(emergencyFiles.length);
  };

  useEffect(() => {
    const { user, hasScope, customerIds, customerNames } = readAssistancePortalUser();
    if (!user) {
      router.push('/giris');
      return;
    }
    if (!hasAssistanceCompanyUserAccess(user)) {
      setLoading(false);
      setAccessDenied(true);
      return;
    }
    const first = typeof user.firstName === 'string' ? user.firstName : '';
    const last = typeof user.lastName === 'string' ? user.lastName : '';
    const name = `${first} ${last}`.trim();
    if (name) setUserName(name);
    if (customerIds[0]) {
      setScopedCustomerId(customerIds[0]);
    }
    if (customerNames[0]) setCompanyName(customerNames[0]);

    if (!hasScope) {
      setMissingScope(true);
      setLoading(false);
      return;
    }
    if (!hasPortalSessionToken()) {
      router.push('/giris');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Veriler yüklenemedi.';
        if (message === 'SESSION_REQUIRED') {
          router.push('/giris');
          return;
        }
        setLoadError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const stages = useMemo(() => countAssistanceStages(files), [files]);
  const weeklyTrend = useMemo(
    () => buildPortalActivitySeries(files, activityRange),
    [files, activityRange],
  );
  const pastMonthOptions = useMemo(() => buildPastMonthOptions(), []);
  const pastYearOptions = useMemo(() => buildPastYearOptions(), []);
  const activityRangeLabel = portalActivityRangeLabel(activityRange);
  const recentFiles = useMemo(
    () => sortInsuranceFilesByActivity(files).slice(0, 6) as AssistanceFile[],
    [files],
  );
  const sahadaFiles = useMemo(
    () =>
      sortInsuranceFilesByActivity(
        files.filter((f) => classifyAssistanceStage(f) === 'sahada'),
      ).slice(0, 4) as AssistanceFile[],
    [files],
  );
  const onayBekleyenFiles = useMemo(
    () =>
      sortInsuranceFilesByActivity(
        files.filter((f) => classifyAssistanceStage(f) === 'onay_bekleyen'),
      ).slice(0, 4) as AssistanceFile[],
    [files],
  );
  const drawerFile = useMemo(
    () => files.find((f) => f.id === drawerFileId) ?? null,
    [files, drawerFileId],
  );
  const drawerPanelFile: ExpertDrawerFile | null = drawerFile
    ? toHomeDrawerFile(drawerFile)
    : drawerSeed && drawerSeed.id === drawerFileId
      ? drawerSeed
      : null;

  const openDrawer = (id: string, tab: DrawerTab = 'ozet', seed?: ExpertDrawerFile) => {
    setDrawerTab(tab);
    setDrawerFileId(id);
    setDrawerSeed(seed && seed.id === id ? seed : null);
  };

  const closeDrawer = () => {
    setDrawerFileId(null);
    setDrawerSeed(null);
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
        <p className="text-sm text-slate-400">Yükleniyor...</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <div className="text-center">
          <p className="text-base font-semibold text-slate-800">Bu Sayfa Asistans Firma Kullanıcıları İçindir</p>
          <p className="mt-1 text-sm text-slate-500">
            Dosya Takip yalnızca asistans firma rolündeki kullanıcılar tarafından kullanılabilir.
          </p>
        </div>
        <Link
          href="/panel"
          className="mt-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Panele Dön
        </Link>
      </div>
    );
  }

  return (
    <DashboardShell>
      <div className="-mb-1 space-y-2 border-b border-slate-200/80 pb-2 dark:border-slate-800 [&>div:first-child]:border-b-0 [&>div:first-child]:pb-0">
        <DashboardHeader
          title="Dosya Takip"
          subtitle={companyName ? `${companyName} · ${userName}` : `Hoş Geldiniz, ${userName}`}
          hideDefaultActions
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewCaseSession((n) => n + 1);
                  setShowNewCase(true);
                }}
                disabled={!scopedCustomerId || missingScope}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
              >
                Yeni İhbar
              </button>
              <Link
                href="/panel/asistans-portal/dosyalar"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Tüm Dosyalar
              </Link>
              <Link
                href="/panel/asistans-portal/onaylar"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Bekleyen Onaylar
                {stages.onayBekleyen > 0 ? (
                  <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                    {stages.onayBekleyen > 99 ? '99+' : stages.onayBekleyen}
                  </span>
                ) : null}
              </Link>
            </div>
          }
        />
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      ) : null}

      {createdNotice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {createdNotice}
        </div>
      ) : null}

      {missingScope ? (
        <div className="rounded-xl border border-amber-200 bg-white px-6 py-16 text-center">
          <p className="font-medium text-slate-700">Asistans Firma Kapsamı Tanımlı Değil.</p>
          <p className="mt-2 text-sm text-slate-500">
            Hesabınıza bağlı asistans firması bulunamadı. Meridyen operasyon ekibinden kapsam ataması isteyin.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 gap-2">
            <div className="rounded-xl border border-brand-300 bg-brand-50/80 p-3 shadow-sm ring-1 ring-brand-200/70">
              <div className="mb-2 flex items-center gap-2 px-0.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-hidden />
                <p className="truncate text-xs font-semibold text-brand-800">Acil Yardım Takip</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SummaryCard
                  label="Yeni İhbar"
                  value={stages.yeniIhbar}
                  href="/panel/asistans-portal/dosyalar?stage=yeni_ihbar"
                  tone="brand"
                  icon={<FilePlus2 className="h-3.5 w-3.5" strokeWidth={2} />}
                />
                <SummaryCard
                  label="Sahada"
                  value={stages.sahada}
                  href="/panel/asistans-portal/dosyalar?stage=sahada"
                  tone="amber"
                  icon={<MapPin className="h-3.5 w-3.5" strokeWidth={2} />}
                />
                <SummaryCard
                  label="Onay Bekleyen"
                  value={stages.onayBekleyen}
                  href="/panel/asistans-portal/dosyalar?stage=onay_bekleyen"
                  tone="amber"
                  icon={<Hourglass className="h-3.5 w-3.5" strokeWidth={2} />}
                />
                <SummaryCard
                  label="Onaylanan"
                  value={stages.onaylanan}
                  href="/panel/asistans-portal/dosyalar?stage=onaylanan"
                  tone="emerald"
                  icon={<ClipboardCheck className="h-3.5 w-3.5" strokeWidth={2} />}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
            <section className="rounded-xl border border-brand-300 border-l-4 border-l-brand-600 bg-brand-50/40 p-3 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Acil Yardım Takip</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewCaseSession((n) => n + 1);
                      setShowNewCase(true);
                    }}
                    disabled={!scopedCustomerId}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
                  >
                    Yeni İhbar
                  </button>
                  <Link
                    href="/panel/asistans-portal/dosyalar"
                    className="text-xs font-semibold text-brand-600 hover:underline"
                  >
                    Liste →
                  </Link>
                </div>
              </div>
              <h3 className="mb-1.5 text-xs font-semibold text-slate-800">Güncel Hareketler</h3>
              {recentFiles.length === 0 ? (
                <div className="rounded-lg border border-dashed border-brand-100 bg-white py-5 text-center">
                  <p className="text-xs font-medium text-slate-500">Acil yardım dosyası yok</p>
                </div>
              ) : (
                <ul className="max-h-[9.5rem] space-y-1 overflow-y-auto pb-0.5">
                  {recentFiles.map((file) => {
                    const status = emergencyStatusLabel(file.currentStatus?.code ?? file.status);
                    return (
                      <li key={file.id}>
                        <button
                          type="button"
                          onClick={() => openDrawer(file.id, 'ozet')}
                          className="flex w-full min-w-0 items-start gap-2 rounded-lg bg-white/70 px-2.5 py-2 text-left transition hover:bg-white"
                        >
                          <span className="min-w-0 flex-1 overflow-hidden">
                            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <span className="truncate text-sm font-semibold text-slate-800">
                                {insuranceFileNo(file)}
                              </span>
                              <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                {status}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-slate-500">
                              {file.notificationDate || file.createdAt
                                ? fmtDateTime(file.notificationDate || file.createdAt)
                                : 'Acil Yardım'}
                              {file.lastActivityAt || file.updatedAt
                                ? ` · ${formatRelativeTr(file.lastActivityAt || file.updatedAt)}`
                                : ''}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-brand-300 border-l-4 border-l-brand-600 bg-brand-50/40 p-3 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Öncelikli Dosyalar</h2>
                <Link
                  href="/panel/asistans-portal/onaylar"
                  className="text-xs font-semibold text-brand-600 hover:underline"
                >
                  Onaylar →
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <article className="rounded-lg border border-brand-100 bg-white p-2.5">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-slate-800">Onay Bekleyen</h3>
                    <Link
                      href="/panel/asistans-portal/dosyalar?stage=onay_bekleyen"
                      className="text-[11px] font-semibold text-brand-600 hover:underline"
                    >
                      Tümü
                    </Link>
                  </div>
                  {onayBekleyenFiles.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-500">Onay bekleyen dosya yok</p>
                  ) : (
                    <ul className="space-y-1">
                      {onayBekleyenFiles.map((file) => (
                        <li key={file.id}>
                          <button
                            type="button"
                            onClick={() => openDrawer(file.id, 'ozet')}
                            className="flex w-full min-w-0 items-start justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50"
                          >
                            <span className="min-w-0 flex-1 overflow-hidden">
                              <span className="block truncate text-sm font-semibold text-slate-800">
                                {insuranceFileNo(file)}
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                                {emergencyStatusLabel(file.currentStatus?.code ?? file.status)}
                              </span>
                            </span>
                            <span className="shrink-0 pt-0.5 text-[11px] font-semibold tabular-nums text-slate-700">
                              {fmtMoney(typeof file.totalGelir === 'number' ? file.totalGelir : undefined)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
                <article className="rounded-lg border border-brand-100 bg-white p-2.5">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-slate-800">Sahada</h3>
                    <Link
                      href="/panel/asistans-portal/dosyalar?stage=sahada"
                      className="text-[11px] font-semibold text-brand-600 hover:underline"
                    >
                      Tümü
                    </Link>
                  </div>
                  {sahadaFiles.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-500">Sahada dosya yok</p>
                  ) : (
                    <ul className="space-y-1">
                      {sahadaFiles.map((file) => (
                        <li key={file.id}>
                          <button
                            type="button"
                            onClick={() => openDrawer(file.id, 'operasyon')}
                            className="flex w-full min-w-0 items-start gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50"
                          >
                            <span className="min-w-0 flex-1 overflow-hidden">
                              <span className="block truncate text-sm font-semibold text-slate-800">
                                {insuranceFileNo(file)}
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                                {emergencyStatusLabel(file.currentStatus?.code ?? file.status)}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>
            </section>
          </div>

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Göstergeler</h3>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowDetailedStats(true)}
                  className="rounded-lg border border-blue-700/30 bg-gradient-to-r from-blue-700 to-blue-800 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-blue-800 hover:to-blue-900"
                >
                  Detaylı İstatistik
                </button>
              </div>
            </div>
            <PortalWeeklyTrendCard
              title={`Dosya Hareketi · Acil Yardım · ${activityRangeLabel}`}
              data={weeklyTrend}
              emptyText="Seçilen dönemde acil yardım dosya hareketi görünmüyor."
              compact
              showEmptyChart
              headerAside={
                <>
                  {(
                    [
                      { days: 7 as const, label: 'Son 7 Gün' },
                      { days: 15 as const, label: 'Son 15 Gün' },
                      { days: 30 as const, label: 'Son 1 Ay' },
                    ] as const
                  ).map((opt) => {
                    const active =
                      activityRange.kind === 'last_days' && activityRange.days === opt.days;
                    return (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setActivityRange({ kind: 'last_days', days: opt.days })}
                        className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                          active
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                  <label className="sr-only" htmlFor="activity-month">
                    Ay Seç
                  </label>
                  <select
                    id="activity-month"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                    value={
                      activityRange.kind === 'month'
                        ? `${activityRange.year}-${activityRange.month}`
                        : ''
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      const [y, m] = v.split('-').map(Number);
                      setActivityRange({ kind: 'month', year: y, month: m });
                    }}
                  >
                    <option value="">Ay Seç</option>
                    {pastMonthOptions.map((opt) => (
                      <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <label className="sr-only" htmlFor="activity-year">
                    Yıl Seç
                  </label>
                  <select
                    id="activity-year"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                    value={activityRange.kind === 'year' ? String(activityRange.year) : ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      setActivityRange({ kind: 'year', year: Number(v) });
                    }}
                  >
                    <option value="">Yıl Seç</option>
                    {pastYearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </>
              }
            />
          </section>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-medium text-slate-800">Portföy:</span> {fileTotal} acil yardım dosyası.
          </div>
        </div>
      )}

      <InsuranceDetailedStatsModal
        open={showDetailedStats}
        onClose={() => setShowDetailedStats(false)}
        files={files}
        variant="assistance"
      />

      <ExpertFileDetailDrawer
        open={Boolean(drawerFileId && drawerPanelFile)}
        onClose={closeDrawer}
        file={drawerPanelFile}
        initialTab={drawerTab}
        audience="assistance"
        canUploadDocuments={true}
        onOpenDocuments={() => openDrawer(drawerFileId!, 'belgeler')}
        onOpenNote={() => openDrawer(drawerFileId!, 'notlar')}
        notesRefreshToken={notesRefreshToken}
      />

      <SlidePanel
        open={showNewCase}
        onClose={() => setShowNewCase(false)}
        title="Yeni İhbar"
        width={600}
        scrollContent={false}
      >
        {scopedCustomerId ? (
          <EmergencyCaseNewForm
            key={newCaseSession}
            variant="panel"
            lockedCustomerId={scopedCustomerId}
            lockedCustomerName={companyName}
            onCancel={() => setShowNewCase(false)}
            onSuccess={(caseId) => {
              setShowNewCase(false);
              setCreatedNotice('Dosya oluşturuldu');
              setTimeout(() => setCreatedNotice(''), 3000);
              void reload().then(() => {
                if (caseId) openDrawer(caseId, 'ozet');
              });
            }}
          />
        ) : (
          <div className="px-1 py-6 text-sm text-slate-600">
            Asistans firma kapsamı bulunamadı. Meridyen operasyon ekibinden kapsam ataması isteyin.
          </div>
        )}
      </SlidePanel>
    </DashboardShell>
  );
}
