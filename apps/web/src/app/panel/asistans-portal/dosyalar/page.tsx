'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PortalPageHeader from '@/components/portal/PortalPageHeader';
import PortalMobileFileList from '@/components/portal/PortalMobileFileList';
import { InsuranceDosyalarActions } from '@/components/portal/InsuranceDosyalarActions';
import {
  ExpertFileDetailDrawer,
  type ExpertDrawerFile,
} from '@/components/eksper-portal/ExpertFileDetailDrawer';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTh,
  PanelTableTd,
  PanelTableFrame,
  PanelTableColGroup,
  SortablePanelTableTh,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { fmtDateTime } from '@/utils/date-helpers';
import { formatTryAmount } from '@/utils/format-try-amount';
import { resolveClaimDosyaKonusu, toTitleCaseTR } from '@/utils/text-helpers';
import {
  ASSISTANCE_STAGE_LABELS,
  classifyAssistanceStage,
  emergencyStatusLabel,
  parseAssistanceStageParam,
  type AssistanceStage,
} from '@/utils/assistance-portal-stages';
import {
  fetchAcilDosyaKonusuCatalog,
  fetchPortalEmergencyCases,
  hasPortalSessionToken,
} from '@/utils/portal-api';
import { hasAssistanceCompanyUserAccess, readAssistancePortalUser } from '@/utils/portal-assistance-scope';
import { expertStatusBadgeClass } from '@/utils/expert-dosyalar-ui';
import {
  cycleClientSort,
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';
import { SlidePanel } from '@/components/SlidePanel';
import { EmergencyCaseNewForm } from '@/components/emergency/EmergencyCaseNewForm';

type DrawerTab = 'ozet' | 'belgeler' | 'operasyon' | 'notlar';

const PORTAL_HOME = '/panel/asistans-portal';
const PORTAL_LABEL = 'Dosya Takip';
const CENTERED_COLS = new Set(['city', 'stage', 'status', 'assignedUser', 'actions']);
const RIGHT_COLS = new Set(['amount']);

const FILE_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'fileNumber', label: 'Dosya No', defaultWidth: 140, minWidth: 120 },
  { id: 'subject', label: 'Dosya Konusu', defaultWidth: 150, minWidth: 120, flex: true },
  { id: 'city', label: 'İl', defaultWidth: 150, minWidth: 120 },
  { id: 'stage', label: 'Aşama', defaultWidth: 130, minWidth: 110 },
  { id: 'status', label: 'Durum', defaultWidth: 120, minWidth: 100 },
  { id: 'amount', label: 'Dosya Bedeli', defaultWidth: 120, minWidth: 100 },
  { id: 'assignedUser', label: 'Meridyen Sorumlusu', defaultWidth: 180, minWidth: 150 },
  { id: 'createdAt', label: 'İhbar Tarihi', defaultWidth: 140, minWidth: 120 },
  { id: 'actions', label: 'İşlemler', defaultWidth: 128, minWidth: 112, pin: 'end', resizable: false },
];

type EmergencyRow = {
  id: string;
  fileNumber: string;
  fileNo?: string;
  issueType?: string;
  subject?: string;
  city?: string | null;
  district?: string | null;
  totalGelir?: number | null;
  status?: string | null;
  createdAt: string;
  updatedAt?: string;
  notificationDate?: string;
  assignedUserName?: string | null;
  currentStatus?: { name: string; code?: string };
};

function fileNoOf(f: EmergencyRow) {
  return f.fileNo ?? f.fileNumber ?? '—';
}

function locationOf(f: Pick<EmergencyRow, 'city' | 'district'>): string {
  const city = f.city?.trim() ? toTitleCaseTR(f.city.trim()) : '';
  const district = f.district?.trim() ? toTitleCaseTR(f.district.trim()) : '';
  if (city && district) return `${city}-${district}`;
  return city || district || '—';
}

function subjectOf(f: EmergencyRow, catalog?: string[]) {
  return resolveClaimDosyaKonusu(
    { lossType: f.issueType || f.subject },
    catalog,
  );
}

function stageOf(f: EmergencyRow): Exclude<AssistanceStage, 'other'> | 'other' {
  return classifyAssistanceStage(f);
}

function stageLabelOf(f: EmergencyRow) {
  const stage = stageOf(f);
  if (stage === 'other') return emergencyStatusLabel(f.status);
  return ASSISTANCE_STAGE_LABELS[stage];
}

function amountOf(f: EmergencyRow): number | null {
  if (typeof f.totalGelir === 'number' && Number.isFinite(f.totalGelir) && f.totalGelir > 0) {
    return f.totalGelir;
  }
  return null;
}

function ihbarAt(f: EmergencyRow) {
  return f.notificationDate || f.createdAt;
}

function mapEmergencyRow(raw: any): EmergencyRow {
  const statusCode = String(raw.status || 'GELEN');
  const assigned = raw.assignedUser;
  const assignedName = assigned
    ? `${assigned.firstName ?? ''} ${assigned.lastName ?? ''}`.trim() || null
    : null;
  return {
    id: String(raw.id),
    fileNumber: raw.fileNo || raw.caseNo || '—',
    fileNo: raw.fileNo || raw.caseNo,
    createdAt: raw.createdAt || raw.fileDate || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt,
    notificationDate: raw.fileDate || raw.createdAt,
    issueType: raw.issueType || raw.serviceType || undefined,
    subject: raw.issueType || raw.serviceType || undefined,
    city: raw.city || null,
    district: raw.district || null,
    totalGelir: typeof raw.totalGelir === 'number' ? raw.totalGelir : 0,
    status: statusCode,
    assignedUserName: assignedName,
    currentStatus: {
      code: statusCode,
      name: emergencyStatusLabel(statusCode),
    },
  };
}

function toDrawerFile(f: EmergencyRow, catalog?: string[]): ExpertDrawerFile {
  const statusCode = f.currentStatus?.code ?? f.status ?? undefined;
  return {
    id: f.id,
    fileNo: fileNoOf(f),
    lossType: f.issueType,
    subject: subjectOf(f, catalog),
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    notificationDate: f.notificationDate,
    currentStatus: statusCode
      ? {
          name: emergencyStatusLabel(statusCode),
          code: String(statusCode),
        }
      : null,
  };
}

function AsistansDosyalarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [files, setFiles] = useState<EmergencyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingScope, setMissingScope] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<AssistanceStage | 'all'>(() =>
    parseAssistanceStageParam(searchParams.get('stage')),
  );
  const [drawerFileId, setDrawerFileId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('ozet');
  const notesRefreshToken = 0;
  const [dosyaKonusuCatalog, setDosyaKonusuCatalog] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientSort, setClientSort] = useState<ClientSortState>(null);
  const [showNewCase, setShowNewCase] = useState(false);
  const [newCaseSession, setNewCaseSession] = useState(0);
  const [scopedCustomerId, setScopedCustomerId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const tableColumns = usePanelTableColumns(
    'table-cols:asistans-portal-dosyalar-v2',
    FILE_TABLE_COLUMNS,
  );

  const reloadFiles = async () => {
    const [em, catalog] = await Promise.all([
      fetchPortalEmergencyCases(100),
      fetchAcilDosyaKonusuCatalog().catch(() => [] as string[]),
    ]);
    const rows = (em.data ?? []).map(mapEmergencyRow);
    setFiles(rows);
    setTotal(rows.length);
    setDosyaKonusuCatalog(catalog);
  };

  useEffect(() => {
    setStageFilter(parseAssistanceStageParam(searchParams.get('stage')));
  }, [searchParams]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const stageCounts = useMemo(() => {
    const counts = {
      all: files.length,
      yeni_ihbar: 0,
      sahada: 0,
      onay_bekleyen: 0,
      onaylanan: 0,
    };
    for (const f of files) {
      const stage = classifyAssistanceStage(f);
      if (stage === 'yeni_ihbar') counts.yeni_ihbar += 1;
      else if (stage === 'sahada') counts.sahada += 1;
      else if (stage === 'onay_bekleyen') counts.onay_bekleyen += 1;
      else if (stage === 'onaylanan') counts.onaylanan += 1;
    }
    return counts;
  }, [files]);

  const filteredFiles = useMemo(() => {
    const byStage =
      stageFilter === 'all'
        ? files
        : files.filter((f) => classifyAssistanceStage(f) === stageFilter);
    const q = searchQuery.trim().toLocaleLowerCase('tr');
    const filtered = !q
      ? byStage
      : byStage.filter((f) => {
          const hay = [
            fileNoOf(f),
            subjectOf(f, dosyaKonusuCatalog),
            locationOf(f),
            stageLabelOf(f),
            emergencyStatusLabel(f.status),
            f.assignedUserName,
            formatTryAmount(amountOf(f)),
          ]
            .join(' ')
            .toLocaleLowerCase('tr');
          return hay.includes(q);
        });
    return sortRowsByClientSort(filtered, clientSort, (f, key) => {
      switch (key) {
        case 'fileNumber':
          return fileNoOf(f);
        case 'subject':
          return subjectOf(f, dosyaKonusuCatalog);
        case 'city':
          return locationOf(f);
        case 'stage':
          return stageLabelOf(f);
        case 'status':
          return emergencyStatusLabel(f.status);
        case 'amount':
          return amountOf(f) ?? -1;
        case 'assignedUser':
          return f.assignedUserName ?? '';
        case 'createdAt':
          return ihbarAt(f);
        default:
          return '';
      }
    });
  }, [files, stageFilter, searchQuery, clientSort, dosyaKonusuCatalog]);

  const drawerFile = useMemo(
    () =>
      filteredFiles.find((f) => f.id === drawerFileId) ??
      files.find((f) => f.id === drawerFileId) ??
      null,
    [files, filteredFiles, drawerFileId],
  );

  const openDrawer = (id: string, tab: DrawerTab = 'ozet') => {
    setDrawerTab(tab);
    setDrawerFileId(id);
  };

  const setStage = (next: AssistanceStage | 'all') => {
    setStageFilter(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'all') params.delete('stage');
    else params.set('stage', next);
    const qs = params.toString();
    router.replace(qs ? `/panel/asistans-portal/dosyalar?${qs}` : '/panel/asistans-portal/dosyalar');
  };

  const copyFileNo = async (f: EmergencyRow) => {
    try {
      await navigator.clipboard.writeText(fileNoOf(f));
      setToast('Dosya No Kopyalandı.');
    } catch {
      setToast('Kopyalama Başarısız.');
    }
  };

  useEffect(() => {
    const { user, hasScope, customerIds, customerNames } = readAssistancePortalUser();
    if (!user) {
      router.push('/giris');
      return;
    }
    if (!hasAssistanceCompanyUserAccess(user)) {
      router.push('/panel');
      return;
    }
    if (customerIds[0]) setScopedCustomerId(customerIds[0]);
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

    setError(null);
    reloadFiles()
      .catch((err: Error) => {
        if (err.message === 'SESSION_REQUIRED') {
          router.push('/giris');
          return;
        }
        setError(err.message ?? 'Dosyalar yüklenemedi.');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-500">Yükleniyor...</div>;
  }

  return (
    <div className="min-w-0 max-w-full space-y-3" data-testid="asistans-dosyalar">
      <PortalPageHeader
        portalHomeHref={PORTAL_HOME}
        portalHomeLabel={PORTAL_LABEL}
        currentLabel="Dosyalar"
        title="Dosyalar"
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
            <span className="w-fit shrink-0 rounded-full bg-brand-50 px-3 py-1 text-[12.5px] font-semibold text-brand-800 ring-1 ring-brand-100">
              {filteredFiles.length}/{total} Dosya
            </span>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'all' as const, label: 'Tümü', count: stageCounts.all },
            { id: 'yeni_ihbar' as const, label: ASSISTANCE_STAGE_LABELS.yeni_ihbar, count: stageCounts.yeni_ihbar },
            { id: 'sahada' as const, label: ASSISTANCE_STAGE_LABELS.sahada, count: stageCounts.sahada },
            { id: 'onay_bekleyen' as const, label: ASSISTANCE_STAGE_LABELS.onay_bekleyen, count: stageCounts.onay_bekleyen },
            { id: 'onaylanan' as const, label: ASSISTANCE_STAGE_LABELS.onaylanan, count: stageCounts.onaylanan },
          ] as const
        ).map((tab) => {
          const active = stageFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStage(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                active
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {toast ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm">
          {toast}
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-4 font-bold text-red-700 hover:text-red-900">
            &times;
          </button>
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
        <>
          {filteredFiles.length > 0 && (
            <PortalMobileFileList
              showInsurance={false}
              showAssigned
              items={filteredFiles.map((f) => ({
                id: f.id,
                fileNo: fileNoOf(f),
                subject: subjectOf(f, dosyaKonusuCatalog),
                statusName: stageLabelOf(f),
                createdAt: ihbarAt(f),
                assignedUser: f.assignedUserName || null,
                reporterLabel: locationOf(f) !== '—' ? locationOf(f) : null,
              }))}
              onItemClick={(id) => openDrawer(id, 'ozet')}
            />
          )}

          <TableColumnsProvider value={tableColumns}>
            <PanelTableFrame
              className="hidden overflow-hidden rounded-card border-[#E7E9EE] shadow-card md:block"
              toolbar={
                <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-2">
                  <div className="section-heading mb-0 shrink-0">
                    <span className="section-heading-bar" />
                    <span className="section-heading-text">Dosyalar</span>
                  </div>
                  <div className="flex flex-nowrap items-center gap-2 shrink-0">
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Dosya, Dosya Konusu, İl Ara…"
                      data-testid="asistans-dosyalar-search"
                      className="w-48 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                    <PanelTableColumnPicker tableColumns={tableColumns} />
                  </div>
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={panelTableLayoutStyle(tableColumns)}>
                  <PanelTableColGroup />
                  <thead className="bg-[#F5F6F8]">
                    <tr>
                      {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                        const thClass = CENTERED_COLS.has(col.id)
                          ? 'table-th-center !px-3 !py-2.5 text-[11px] font-semibold tracking-[0.02em] text-[#9AA3AF]'
                          : RIGHT_COLS.has(col.id)
                            ? '!px-3 !py-2.5 text-right text-[11px] font-semibold tracking-[0.02em] text-[#9AA3AF]'
                            : '!px-3 !py-2.5 text-left text-[11px] font-semibold tracking-[0.02em] text-[#9AA3AF]';
                        if (col.id === 'actions') {
                          return (
                            <PanelTableTh key={col.id} colId={col.id} resizable={false} className={thClass}>
                              {col.label}
                            </PanelTableTh>
                          );
                        }
                        return (
                          <SortablePanelTableTh
                            key={col.id}
                            colId={col.id}
                            className={thClass}
                            sortKey={col.id}
                            activeSortKey={clientSort?.key ?? null}
                            sortDir={clientSort?.dir ?? 'asc'}
                            onSort={(key) => setClientSort((prev) => cycleClientSort(prev, key))}
                          >
                            {col.label}
                          </SortablePanelTableTh>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E9EE] bg-white">
                    {filteredFiles.length === 0 ? (
                      <tr>
                        <td
                          colSpan={Math.max(tableColumns.prefs.orderedVisibleColumns.length, 1)}
                          className="px-4 py-14 text-center"
                        >
                          <p className="font-medium text-slate-500">
                            {error
                              ? 'Dosyalar yüklenemedi.'
                              : searchQuery.trim()
                                ? 'Aramaya Uyan Dosya Bulunamadı.'
                                : files.length === 0
                                  ? 'Henüz Acil Yardım Dosyası Bulunmuyor.'
                                  : stageFilter === 'all'
                                    ? 'Henüz Acil Yardım Dosyası Bulunmuyor.'
                                    : 'Bu Aşamada Dosya Bulunmuyor.'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredFiles.map((f) => (
                        <tr
                          key={f.id}
                          onClick={() => openDrawer(f.id, 'ozet')}
                          className={`cursor-pointer border-t border-slate-100 transition hover:bg-slate-50/80 ${
                            drawerFileId === f.id ? 'bg-brand-50/40' : 'bg-white'
                          }`}
                        >
                          {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                            switch (col.id) {
                              case 'fileNumber':
                                return (
                                  <PanelTableTd key={col.id} colId={col.id} className="px-3 py-2.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openDrawer(f.id, 'ozet');
                                      }}
                                      className="font-semibold text-slate-800 hover:text-brand-700"
                                    >
                                      {fileNoOf(f)}
                                    </button>
                                  </PanelTableTd>
                                );
                              case 'subject':
                                return (
                                  <PanelTableTd key={col.id} colId={col.id} className="px-3 py-2.5 text-slate-700">
                                    {subjectOf(f, dosyaKonusuCatalog)}
                                  </PanelTableTd>
                                );
                              case 'city':
                                return (
                                  <PanelTableTd key={col.id} colId={col.id} className="table-td-center px-3 py-2.5 text-slate-600">
                                    {locationOf(f)}
                                  </PanelTableTd>
                                );
                              case 'stage':
                                return (
                                  <PanelTableTd key={col.id} colId={col.id} className="table-td-center px-3 py-2.5">
                                    <span className={expertStatusBadgeClass(stageLabelOf(f))}>{stageLabelOf(f)}</span>
                                  </PanelTableTd>
                                );
                              case 'status':
                                return (
                                  <PanelTableTd key={col.id} colId={col.id} className="table-td-center px-3 py-2.5 text-slate-600">
                                    {emergencyStatusLabel(f.status)}
                                  </PanelTableTd>
                                );
                              case 'amount':
                                return (
                                  <PanelTableTd
                                    key={col.id}
                                    colId={col.id}
                                    className="px-3 py-2.5 text-right text-[13px] font-semibold tabular-nums text-[#10151F]"
                                  >
                                    {formatTryAmount(amountOf(f))}
                                  </PanelTableTd>
                                );
                              case 'assignedUser':
                                return (
                                  <PanelTableTd key={col.id} colId={col.id} className="table-td-center px-3 py-2.5 text-slate-600">
                                    {f.assignedUserName || '—'}
                                  </PanelTableTd>
                                );
                              case 'createdAt':
                                return (
                                  <PanelTableTd key={col.id} colId={col.id} className="px-3 py-2.5 text-slate-500">
                                    {fmtDateTime(ihbarAt(f))}
                                  </PanelTableTd>
                                );
                              case 'actions':
                                return (
                                  <PanelTableTd key={col.id} colId={col.id} className="table-td-center px-3 py-2.5">
                                    <InsuranceDosyalarActions
                                      rowId={f.id}
                                      onFileSummary={() => openDrawer(f.id, 'ozet')}
                                      onAddNote={() => openDrawer(f.id, 'notlar')}
                                      onDocuments={() => openDrawer(f.id, 'belgeler')}
                                      onHistory={() => openDrawer(f.id, 'notlar')}
                                      onCopyFileNo={() => void copyFileNo(f)}
                                    />
                                  </PanelTableTd>
                                );
                              default:
                                return null;
                            }
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </PanelTableFrame>
          </TableColumnsProvider>
        </>
      )}

      <ExpertFileDetailDrawer
        open={Boolean(drawerFileId && drawerFile)}
        onClose={() => setDrawerFileId(null)}
        file={drawerFile ? toDrawerFile(drawerFile, dosyaKonusuCatalog) : null}
        initialTab={drawerTab}
        audience="assistance"
        canUploadDocuments={true}
        onOpenDocuments={() => drawerFileId && openDrawer(drawerFileId, 'belgeler')}
        onOpenNote={() => drawerFileId && openDrawer(drawerFileId, 'notlar')}
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
              setToast('Dosya Oluşturuldu.');
              void reloadFiles().then(() => {
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
    </div>
  );
}

export default function AsistansDosyalarPage() {
  return (
    <Suspense
      fallback={<div className="flex h-64 items-center justify-center text-slate-500">Yükleniyor...</div>}
    >
      <AsistansDosyalarContent />
    </Suspense>
  );
}
