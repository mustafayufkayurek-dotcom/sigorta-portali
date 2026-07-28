'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ClipboardCheck, FilePlus2, FileSearch, Wrench } from 'lucide-react';
import { DashboardShell, DashboardHeader } from '@/app/panel/_components';
import {
  ExpertFileDetailDrawer,
  type ExpertDrawerFile,
} from '@/components/eksper-portal/ExpertFileDetailDrawer';
import { ExpertFileDocumentsModal, ExpertFileNoteModal } from '@/components/eksper-portal/ExpertFileModals';
import InsuranceIhbarModal from '@/components/portal/InsuranceIhbarModal';
import { InsuranceDetailedStatsModal } from '@/components/portal/InsuranceDetailedStatsModal';
import { PortalWeeklyTrendCard } from '@/components/panel/portal-weekly-trend-card';
import { fmtDateTime } from '@/utils/date-helpers';
import {
  classifyInsuranceMonitoringFile,
  countInsuranceStages,
  filesForInsuranceChartPreference,
  insuranceFileNo,
  isInsuranceRepairProcess,
  partitionInsuranceFilesByTrack,
  sortInsuranceFilesByActivity,
  type InsuranceChartPreference,
  type InsuranceClaimLike,
} from '@/utils/insurance-portal-monitoring';
import { buildPortalWeeklyActivity } from '@/utils/portal-weekly-activity';
import { portalStatusLabel } from '@/utils/portal-file-flow-labels';
import {
  fetchPendingExternalApprovals,
  fetchPortalClaimFiles,
  hasPortalSessionToken,
} from '@/utils/portal-api';
import { hasInsuranceCompanyUserAccess, readInsurancePortalUser } from '@/utils/portal-insurance-scope';
import { formatClaimSubjectLabel } from '@/utils/text-helpers';

type DrawerTab = 'ozet' | 'belgeler' | 'operasyon' | 'notlar';

function toHomeDrawerFile(file: InsuranceClaimLike): ExpertDrawerFile {
  return {
    id: file.id,
    fileNo: insuranceFileNo(file),
    lossType: file.lossType,
    subject: file.subject,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    currentStatus: file.currentStatus
      ? {
          name: file.currentStatus.name,
          code: file.currentStatus.code,
          colorCode: file.currentStatus.colorCode,
          color: file.currentStatus.color,
        }
      : null,
  };
}

type PendingApproval = {
  id: string;
  createdAt?: string;
  expiresAt?: string;
  report?: {
    reportNo?: string;
    reportNumber?: string;
    totalSalesAmount?: number;
    totalAmount?: number;
    claimFile?: { id?: string; fileNo?: string; fileNumber?: string };
  };
};

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
  if (v == null) return '—';
  return v.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
}

function SummaryCard({
  label,
  value,
  href,
  tone = 'slate',
  icon,
}: {
  label: string;
  value: number;
  href: string;
  tone?: 'slate' | 'amber' | 'brand' | 'emerald';
  icon: ReactNode;
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
  return (
    <Link
      href={href}
      className={`relative rounded-xl border bg-white px-2.5 py-3 shadow-sm transition hover:shadow-md ${toneClass}`}
    >
      <span
        className={`absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md ${iconWrap}`}
        aria-hidden
      >
        {icon}
      </span>
      <div className="text-center">
        <p className="mx-auto flex min-h-[2.25rem] max-w-[9.5rem] items-center justify-center text-[11px] font-medium leading-snug text-slate-500">
          {label}
        </p>
        <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</p>
      </div>
    </Link>
  );
}

/**
 * Dosya Takip — iki amaç:
 * 1) Eksper ihbarlı dosya takibi
 * 2) Departman ihbarlı dosya takibi
 */
export default function SigortaPortalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [missingScope, setMissingScope] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [files, setFiles] = useState<InsuranceClaimLike[]>([]);
  const [fileTotal, setFileTotal] = useState(0);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [userName, setUserName] = useState('Kullanıcı');
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showIhbar, setShowIhbar] = useState(false);
  const [drawerFileId, setDrawerFileId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('ozet');
  const [drawerSeed, setDrawerSeed] = useState<ExpertDrawerFile | null>(null);
  const [noteFileId, setNoteFileId] = useState<string | null>(null);
  const [docsFileId, setDocsFileId] = useState<string | null>(null);
  const [notesRefreshToken, setNotesRefreshToken] = useState(0);
  const [chartPreference, setChartPreference] = useState<InsuranceChartPreference>('total');
  const [showDetailedStats, setShowDetailedStats] = useState(false);

  const reload = async () => {
    const [filesRes, approvalsRes] = await Promise.all([
      fetchPortalClaimFiles(100),
      fetchPendingExternalApprovals(),
    ]);
    setFiles((filesRes?.data ?? []) as InsuranceClaimLike[]);
    setFileTotal(filesRes?.meta?.total ?? (filesRes?.data ?? []).length);
    setApprovals(approvalsRes as PendingApproval[]);
  };

  useEffect(() => {
    const { user, hasScope, companyIds, companyNames } = readInsurancePortalUser();
    if (!user) {
      router.push('/giris');
      return;
    }
    if (!hasInsuranceCompanyUserAccess(user)) {
      setLoading(false);
      setAccessDenied(true);
      return;
    }
    const first = typeof user.firstName === 'string' ? user.firstName : '';
    const last = typeof user.lastName === 'string' ? user.lastName : '';
    const name = `${first} ${last}`.trim();
    if (name) setUserName(name);
    if (companyIds[0]) setCompanyId(companyIds[0]);
    if (companyNames[0]) setCompanyName(companyNames[0]);

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

  const { expertMonitor, directProcess } = useMemo(
    () => partitionInsuranceFilesByTrack(files),
    [files],
  );
  const expertStages = useMemo(() => countInsuranceStages(expertMonitor), [expertMonitor]);
  const directStages = useMemo(() => countInsuranceStages(directProcess), [directProcess]);
  const preferenceFiles = useMemo(
    () => filesForInsuranceChartPreference(files, chartPreference),
    [files, chartPreference],
  );
  const weeklyTrend = useMemo(
    () => buildPortalWeeklyActivity(preferenceFiles),
    [preferenceFiles],
  );
  const preferenceLabel =
    chartPreference === 'expert_monitor'
      ? 'Eksper İhbarlı'
      : chartPreference === 'direct_process'
        ? 'Departman İhbarlı'
        : 'Toplam Portföy';
  const expertRecent = useMemo(
    () => sortInsuranceFilesByActivity(expertMonitor).slice(0, 4),
    [expertMonitor],
  );
  const directTespit = useMemo(
    () =>
      sortInsuranceFilesByActivity(
        directProcess.filter((f) => classifyInsuranceMonitoringFile(f) === 'tespit'),
      ).slice(0, 3),
    [directProcess],
  );
  const directRepair = useMemo(
    () =>
      sortInsuranceFilesByActivity(directProcess.filter((f) => isInsuranceRepairProcess(f))).slice(0, 2),
    [directProcess],
  );
  const priorityApprovals = approvals.slice(0, 5);
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
          <p className="text-base font-semibold text-slate-800">Bu Sayfa Sigorta Şirketi Kullanıcıları İçindir</p>
          <p className="mt-1 text-sm text-slate-500">
            Dosya Takip yalnızca sigorta şirketi rolündeki kullanıcılar tarafından kullanılabilir.
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
          subtitle={`Hoş Geldiniz, ${userName}`}
          hideDefaultActions
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/panel/sigorta-portal/dosyalar"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Tüm Dosyalar
              </Link>
              <Link
                href="/panel/sigorta-portal/onaylar"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Bekleyen Onaylar
                {approvals.length > 0 ? (
                  <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                    {approvals.length > 99 ? '99+' : approvals.length}
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

      {missingScope ? (
        <div className="rounded-xl border border-amber-200 bg-white px-6 py-16 text-center">
          <p className="font-medium text-slate-700">Sigorta şirketi kapsamı tanımlı değil.</p>
          <p className="mt-2 text-sm text-slate-500">
            Hesabınıza bağlı sigorta şirketi bulunamadı. Meridyen operasyon ekibinden kapsam ataması isteyin.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-300 bg-slate-100/90 p-2 shadow-sm ring-1 ring-slate-200/80">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-700" aria-hidden />
                <p className="text-[11px] font-semibold text-slate-800">Eksper İhbarlı Dosya Takibi</p>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <SummaryCard
                  label="Yeni İhbar"
                  value={expertStages.yeni}
                  href="/panel/sigorta-portal/dosyalar?track=expert"
                  tone="brand"
                  icon={<FilePlus2 className="h-3.5 w-3.5" strokeWidth={2} />}
                />
                <SummaryCard
                  label="Tespit Aşamasında"
                  value={expertStages.tespit}
                  href="/panel/sigorta-portal/dosyalar?track=expert"
                  tone="amber"
                  icon={<FileSearch className="h-3.5 w-3.5" strokeWidth={2} />}
                />
                <SummaryCard
                  label="Onaylanan"
                  value={expertStages.onaylanan}
                  href="/panel/sigorta-portal/dosyalar?track=expert"
                  tone="emerald"
                  icon={<ClipboardCheck className="h-3.5 w-3.5" strokeWidth={2} />}
                />
                <SummaryCard
                  label="Onarım Aşamasında"
                  value={expertStages.onarim}
                  href="/panel/sigorta-portal/dosyalar?track=expert"
                  tone="slate"
                  icon={<Wrench className="h-3.5 w-3.5" strokeWidth={2} />}
                />
              </div>
            </div>
            <div className="rounded-xl border border-brand-300 bg-brand-50/80 p-2 shadow-sm ring-1 ring-brand-200/70">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-brand-600" aria-hidden />
                <p className="text-[11px] font-semibold text-brand-800">Departman İhbarlı Dosya Takibi</p>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <SummaryCard
                  label="Yeni İhbar"
                  value={directStages.yeni}
                  href="/panel/sigorta-portal/dosyalar?track=direct"
                  tone="brand"
                  icon={<FilePlus2 className="h-3.5 w-3.5" strokeWidth={2} />}
                />
                <SummaryCard
                  label="Tespit Aşamasında"
                  value={directStages.tespit}
                  href="/panel/sigorta-portal/dosyalar?track=direct"
                  tone="amber"
                  icon={<FileSearch className="h-3.5 w-3.5" strokeWidth={2} />}
                />
                <SummaryCard
                  label="Onaylanan"
                  value={directStages.onaylanan}
                  href="/panel/sigorta-portal/dosyalar?track=direct"
                  tone="emerald"
                  icon={<ClipboardCheck className="h-3.5 w-3.5" strokeWidth={2} />}
                />
                <SummaryCard
                  label="Onarım Aşamasında"
                  value={directStages.onarim}
                  href="/panel/sigorta-portal/dosyalar?track=direct"
                  tone="slate"
                  icon={<Wrench className="h-3.5 w-3.5" strokeWidth={2} />}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
            <section className="rounded-xl border border-slate-300 border-l-4 border-l-slate-700 bg-slate-50/60 p-3 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Eksper İhbarlı Dosya Takibi</h2>
                <Link
                  href="/panel/sigorta-portal/dosyalar?track=expert"
                  className="text-xs font-semibold text-brand-600 hover:underline"
                >
                  Liste →
                </Link>
              </div>
              <h3 className="mb-1.5 text-xs font-semibold text-slate-800">Güncel Hareketler</h3>
              {expertRecent.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white py-5 text-center">
                  <p className="text-xs font-medium text-slate-500">Eksper tarafında izlenecek dosya yok</p>
                </div>
              ) : (
                <ul className="max-h-[9.5rem] space-y-0.5 overflow-y-auto">
                  {expertRecent.map((file) => {
                    const status = portalStatusLabel(file.currentStatus?.code, file.currentStatus?.name);
                    return (
                      <li key={file.id}>
                        <button
                          type="button"
                          onClick={() => openDrawer(file.id, 'ozet')}
                          className="flex w-full items-start gap-3 rounded-lg bg-white/70 px-2 py-1.5 text-left transition hover:bg-white"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-800">{insuranceFileNo(file)}</span>
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                {status}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {formatClaimSubjectLabel(file.lossType, undefined, file.subject)}
                              {file.notificationDate || file.createdAt
                                ? ` · ${fmtDateTime(file.notificationDate || file.createdAt)}`
                                : ''}
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
                <h2 className="text-sm font-semibold text-slate-900">Departman İhbarlı Dosya Takibi</h2>
                <button
                  type="button"
                  onClick={() => setShowIhbar(true)}
                  disabled={!companyId}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
                >
                  Yeni İhbar
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <article className="rounded-lg border border-brand-100 bg-white p-2.5">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-slate-800">Bekleyen Onaylar</h3>
                    <Link href="/panel/sigorta-portal/onaylar" className="text-[11px] font-semibold text-brand-600 hover:underline">
                      Tümü
                    </Link>
                  </div>
                  {priorityApprovals.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-500">Bekleyen onay yok</p>
                  ) : (
                    <ul className="max-h-[7.5rem] space-y-0.5 overflow-y-auto">
                      {priorityApprovals.map((a) => {
                        const fileId = a.report?.claimFile?.id;
                        const fileNo = a.report?.claimFile?.fileNo ?? a.report?.claimFile?.fileNumber ?? '—';
                        const amount = a.report?.totalSalesAmount ?? a.report?.totalAmount;
                        return (
                          <li key={a.id}>
                            {fileId ? (
                              <button
                                type="button"
                                onClick={() => openDrawer(fileId, 'ozet', { id: fileId, fileNo })}
                                className="flex w-full items-start justify-between gap-2 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-slate-50"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold text-slate-800">{fileNo}</span>
                                  <span className="mt-0.5 block text-[11px] text-slate-500">
                                    {a.report?.reportNo ?? a.report?.reportNumber ?? 'Rapor'}
                                  </span>
                                </span>
                                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-700">
                                  {fmtMoney(amount)}
                                </span>
                              </button>
                            ) : (
                              <Link
                                href="/panel/sigorta-portal/onaylar"
                                className="flex items-start justify-between gap-2 rounded-lg px-1.5 py-1.5 transition hover:bg-slate-50"
                              >
                                <span className="text-sm font-semibold text-slate-800">{fileNo}</span>
                                <span className="text-[11px] font-semibold tabular-nums">{fmtMoney(amount)}</span>
                              </Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </article>
                <article className="rounded-lg border border-brand-100 bg-white p-2.5">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-slate-800">Tespit Süreci</h3>
                    <Link
                      href="/panel/sigorta-portal/dosyalar?track=direct"
                      className="text-[11px] font-semibold text-brand-600 hover:underline"
                    >
                      Tümü
                    </Link>
                  </div>
                  {directTespit.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-500">Tespit sürecinde dosya yok</p>
                  ) : (
                    <ul className="max-h-[7.5rem] space-y-0.5 overflow-y-auto">
                      {directTespit.map((file) => (
                        <li key={file.id}>
                          <button
                            type="button"
                            onClick={() => openDrawer(file.id, 'operasyon')}
                            className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-slate-50"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-slate-800">{insuranceFileNo(file)}</span>
                              <span className="mt-0.5 block text-[11px] text-slate-500">
                                {portalStatusLabel(file.currentStatus?.code, file.currentStatus?.name)}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>
              {directRepair.length > 0 ? (
                <div className="mt-2">
                  <h3 className="mb-1.5 text-xs font-semibold text-slate-800">Onarım Süreci</h3>
                  <ul className="space-y-0.5">
                    {directRepair.map((file) => (
                      <li key={file.id}>
                        <button
                          type="button"
                          onClick={() => openDrawer(file.id, 'operasyon')}
                          className="flex w-full items-start gap-3 rounded-lg bg-white px-2 py-1.5 text-left transition hover:bg-slate-50"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="text-sm font-semibold text-slate-800">{insuranceFileNo(file)}</span>
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {portalStatusLabel(file.currentStatus?.code, file.currentStatus?.name)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          </div>

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Göstergeler</h3>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'total' as const, label: 'Toplam' },
                    { id: 'expert_monitor' as const, label: 'Eksper İhbarlı' },
                    { id: 'direct_process' as const, label: 'Departman İhbarlı' },
                  ] as const
                ).map((opt) => {
                  const active = chartPreference === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setChartPreference(opt.id)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                        active
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
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
              title={`Haftalık Dosya Hareketi · ${preferenceLabel}`}
              data={weeklyTrend}
              emptyText={`${preferenceLabel} için bu hafta dosya hareketi görünmüyor.`}
              compact
            />
          </section>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-medium text-slate-800">Portföy:</span> {fileTotal} dosya
            {' · '}
            Eksper takibi {expertMonitor.length}
            {' · '}
            Doğrudan süreç {directProcess.length}.{' '}
            <Link href="/panel/sigorta-portal/operasyon-agi" className="font-semibold text-brand-600 hover:underline">
              Operasyon Ağı
            </Link>
          </div>
        </div>
      )}

      {companyId ? (
        <InsuranceIhbarModal
          open={showIhbar}
          onClose={() => setShowIhbar(false)}
          lockedInsuranceCompanyId={companyId}
          lockedInsuranceCompanyName={companyName || undefined}
          onSuccess={async () => {
            setShowIhbar(false);
            try {
              await reload();
            } catch {
              /* ignore */
            }
          }}
        />
      ) : null}

      <InsuranceDetailedStatsModal
        open={showDetailedStats}
        onClose={() => setShowDetailedStats(false)}
        files={files}
      />

      <ExpertFileDetailDrawer
        open={Boolean(drawerFileId && drawerPanelFile)}
        onClose={closeDrawer}
        file={drawerPanelFile}
        initialTab={drawerTab}
        onOpenDocuments={() => drawerFileId && setDocsFileId(drawerFileId)}
        onOpenNote={() => drawerFileId && setNoteFileId(drawerFileId)}
        notesRefreshToken={notesRefreshToken}
      />
      <ExpertFileDocumentsModal
        open={Boolean(docsFileId)}
        claimFileId={docsFileId}
        onClose={() => setDocsFileId(null)}
      />
      <ExpertFileNoteModal
        open={Boolean(noteFileId)}
        claimFileId={noteFileId}
        onClose={() => setNoteFileId(null)}
        onSaved={() => {
          setNotesRefreshToken((n) => n + 1);
          setNoteFileId(null);
        }}
      />
    </DashboardShell>
  );
}
