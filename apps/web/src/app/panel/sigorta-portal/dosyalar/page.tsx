'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PortalPageHeader from '@/components/portal/PortalPageHeader';
import PortalMobileFileList from '@/components/portal/PortalMobileFileList';
import { InsuranceDosyalarActions } from '@/components/portal/InsuranceDosyalarActions';
import {
  ExpertFileDetailDrawer,
  type ExpertDrawerFile,
} from '@/components/eksper-portal/ExpertFileDetailDrawer';
import { ExpertFileDocumentsModal, ExpertFileNoteModal } from '@/components/eksper-portal/ExpertFileModals';
import { PhoneContactActions } from '@/components/ui/PhoneContactActions';
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
import { formatClaimSubjectLabel } from '@/utils/text-helpers';
import { portalStatusLabel } from '@/utils/portal-file-flow-labels';
import { fetchPortalClaimFiles, hasPortalSessionToken } from '@/utils/portal-api';
import { hasInsuranceCompanyUserAccess, readInsurancePortalUser } from '@/utils/portal-insurance-scope';
import { classifyInsuranceFileTrack, type InsuranceFileTrack } from '@/utils/insurance-portal-monitoring';
import { expertStatusBadgeClass } from '@/utils/expert-dosyalar-ui';
import {
  cycleClientSort,
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';

type TrackFilter = 'all' | InsuranceFileTrack;

const SIGORTA_PORTAL_HOME = '/panel/sigorta-portal';
const SIGORTA_PORTAL_LABEL = 'Dosya Takip';
const CENTERED_COLS = new Set(['subject', 'status', 'actions']);
const RIGHT_COLS = new Set(['amount']);

const SIGORTA_FILE_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'fileNumber', label: 'Dosya No', defaultWidth: 130, minWidth: 110 },
  { id: 'subject', label: 'Konu', defaultWidth: 140, minWidth: 110, flex: true },
  { id: 'status', label: 'Durum', defaultWidth: 120, minWidth: 96 },
  { id: 'amount', label: 'Dosya Bedeli', defaultWidth: 120, minWidth: 100 },
  { id: 'reporter', label: 'İhbar Eden', defaultWidth: 150, minWidth: 120 },
  { id: 'assignedUser', label: 'Meridyen Sorumlusu', defaultWidth: 220, minWidth: 180 },
  { id: 'createdAt', label: 'İhbar Tarihi', defaultWidth: 140, minWidth: 120 },
  { id: 'actions', label: 'İşlemler', defaultWidth: 128, minWidth: 112, pin: 'end', resizable: false },
];

type PortalUserRef = {
  id?: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
};

interface ClaimFile {
  id: string;
  fileNumber: string;
  fileNo?: string;
  lossType?: string;
  sourceChannel?: string | null;
  createdAt: string;
  updatedAt?: string;
  lastActivityAt?: string | null;
  notificationDate?: string;
  subject?: string;
  description?: string;
  insuredName?: string;
  incidentDate?: string;
  slaDueAt?: string;
  delayRisk?: boolean;
  operationStatusLabel?: string;
  nextAction?: string;
  invoicedAmount?: number | null;
  currentStatus?: { name: string; code?: string; colorCode?: string; color?: string };
  insuranceCompany?: { id?: string; name: string };
  assignedFieldUser?: PortalUserRef | null;
  assignedOfficeUser?: PortalUserRef | null;
  currentResponsibleUser?: PortalUserRef | null;
  assignedAdjuster?: { id?: string; firstName?: string; lastName?: string } | null;
  propertyAddress?: { city?: string | null; district?: string | null } | null;
  claimSubject?: { id?: string; name?: string | null } | null;
  latestRepairReport?: { totalSalesAmount?: number | null; status?: string | null } | null;
  statusHistory?: Array<{
    changedAt?: string;
    changedByUser?: {
      firstName?: string;
      lastName?: string;
      role?: { code?: string; name?: string } | null;
    } | null;
  }>;
}

function parseTrackParam(raw: string | null): TrackFilter {
  if (raw === 'expert' || raw === 'expert_monitor') return 'expert_monitor';
  if (raw === 'direct' || raw === 'direct_process') return 'direct_process';
  return 'all';
}

type DrawerTab = 'ozet' | 'belgeler' | 'operasyon' | 'notlar';

function fileNoOf(f: ClaimFile) {
  return f.fileNo ?? f.fileNumber ?? '—';
}

function meridyenOwnerUser(f: ClaimFile): PortalUserRef | null {
  return f.assignedOfficeUser || f.assignedFieldUser || f.currentResponsibleUser || null;
}

function meridyenOwnerName(f: ClaimFile) {
  const u = meridyenOwnerUser(f);
  if (!u) return '—';
  const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  return name || '—';
}

function meridyenOwnerPhone(f: ClaimFile) {
  const phone = meridyenOwnerUser(f)?.phone?.trim();
  return phone || null;
}

function dosyaBedeliOf(f: ClaimFile): number | null {
  const sales = f.latestRepairReport?.totalSalesAmount;
  if (typeof sales === 'number' && Number.isFinite(sales) && sales > 0) return sales;
  if (typeof f.invoicedAmount === 'number' && f.invoicedAmount > 0) return f.invoicedAmount;
  if (typeof sales === 'number' && Number.isFinite(sales)) return sales;
  return null;
}

function fmtMoney(v: number | null) {
  return formatTryAmount(v);
}

function reporterOf(f: ClaimFile): { name: string; role: string } {
  const user = f.statusHistory?.[0]?.changedByUser;
  if (!user) return { name: '—', role: '' };
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || '—';
  const role = (user.role?.name || '').trim();
  return { name, role };
}

function ihbarAt(f: ClaimFile) {
  return f.notificationDate || f.createdAt;
}

function toDrawerFile(f: ClaimFile): ExpertDrawerFile {
  return {
    id: f.id,
    fileNo: fileNoOf(f),
    lossType: f.lossType,
    subject: f.subject,
    description: f.description,
    insuredName: f.insuredName,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    incidentDate: f.incidentDate,
    notificationDate: f.notificationDate,
    slaDueAt: f.slaDueAt,
    delayRisk: f.delayRisk,
    operationStatusLabel: f.operationStatusLabel,
    nextAction: f.nextAction,
    insuranceCompany: f.insuranceCompany,
    currentStatus: f.currentStatus
      ? { name: f.currentStatus.name, code: f.currentStatus.code, colorCode: f.currentStatus.colorCode }
      : null,
  };
}

export default function SigortaDosyalarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [files, setFiles] = useState<ClaimFile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingScope, setMissingScope] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [trackFilter, setTrackFilter] = useState<TrackFilter>(() =>
    parseTrackParam(searchParams.get('track')),
  );
  const [noteFileId, setNoteFileId] = useState<string | null>(null);
  const [docsFileId, setDocsFileId] = useState<string | null>(null);
  const [drawerFileId, setDrawerFileId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('ozet');
  const [notesRefreshToken, setNotesRefreshToken] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientSort, setClientSort] = useState<ClientSortState>(null);
  const tableColumns = usePanelTableColumns('table-cols:sigorta-portal-dosyalar-v3', SIGORTA_FILE_TABLE_COLUMNS);

  useEffect(() => {
    setTrackFilter(parseTrackParam(searchParams.get('track')));
  }, [searchParams]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const filteredFiles = useMemo(() => {
    const byTrack =
      trackFilter === 'all'
        ? files
        : files.filter((f) => classifyInsuranceFileTrack(f) === trackFilter);
    const q = searchQuery.trim().toLocaleLowerCase('tr');
    const filtered = !q
      ? byTrack
      : byTrack.filter((f) => {
          const reporter = reporterOf(f);
          const hay = [
            fileNoOf(f),
            formatClaimSubjectLabel(f.lossType, undefined, f.subject ?? f.claimSubject?.name),
            portalStatusLabel(f.currentStatus?.code, f.currentStatus?.name),
            meridyenOwnerName(f),
            reporter.name,
            reporter.role,
            fmtMoney(dosyaBedeliOf(f)),
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
          return formatClaimSubjectLabel(f.lossType, undefined, f.subject ?? f.claimSubject?.name);
        case 'status':
          return portalStatusLabel(f.currentStatus?.code, f.currentStatus?.name);
        case 'amount':
          return dosyaBedeliOf(f) ?? -1;
        case 'reporter':
          return reporterOf(f).name;
        case 'assignedUser':
          return meridyenOwnerName(f);
        case 'createdAt':
          return ihbarAt(f);
        default:
          return '';
      }
    });
  }, [files, trackFilter, searchQuery, clientSort]);

  const drawerFile = useMemo(
    () => filteredFiles.find((f) => f.id === drawerFileId) ?? files.find((f) => f.id === drawerFileId) ?? null,
    [files, filteredFiles, drawerFileId],
  );

  const setTrack = (next: TrackFilter) => {
    setTrackFilter(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'all') params.delete('track');
    else params.set('track', next === 'expert_monitor' ? 'expert' : 'direct');
    const qs = params.toString();
    router.replace(qs ? `/panel/sigorta-portal/dosyalar?${qs}` : '/panel/sigorta-portal/dosyalar');
  };

  const expertCount = useMemo(
    () => files.filter((f) => classifyInsuranceFileTrack(f) === 'expert_monitor').length,
    [files],
  );
  const directCount = useMemo(
    () => files.filter((f) => classifyInsuranceFileTrack(f) === 'direct_process').length,
    [files],
  );

  const openDrawer = (id: string, tab: DrawerTab = 'ozet') => {
    setDrawerTab(tab);
    setDrawerFileId(id);
  };

  const copyFileNo = async (f: ClaimFile) => {
    const no = fileNoOf(f);
    try {
      await navigator.clipboard.writeText(no);
      setToast('Dosya No Kopyalandı.');
    } catch {
      setToast('Kopyalama Başarısız.');
    }
  };

  useEffect(() => {
    const { user, hasScope } = readInsurancePortalUser();
    if (!user) {
      router.push('/giris');
      return;
    }
    if (!hasInsuranceCompanyUserAccess(user)) {
      router.push('/panel');
      return;
    }
    if (!hasScope) {
      setMissingScope(true);
      setLoading(false);
      return;
    }

    setError(null);
    setMissingScope(false);
    if (!hasPortalSessionToken()) {
      router.push('/giris');
      return;
    }
    fetchPortalClaimFiles(100)
      .then((res) => {
        setFiles((res?.data ?? []) as ClaimFile[]);
        setTotal(res?.meta?.total ?? 0);
      })
      .catch((err: Error) => {
        if (err.message === 'SESSION_REQUIRED') {
          router.push('/giris');
          return;
        }
        setError(err.message ?? 'Dosyalar yüklenemedi.');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Yükleniyor...</div>;

  return (
    <div className="min-w-0 max-w-full space-y-3" data-testid="sigorta-dosyalar">
      <PortalPageHeader
        portalHomeHref={SIGORTA_PORTAL_HOME}
        portalHomeLabel={SIGORTA_PORTAL_LABEL}
        currentLabel="Dosyalar"
        title="Dosyalar"
        actions={
          <span className="w-fit shrink-0 rounded-full bg-brand-50 px-3 py-1 text-[12.5px] font-semibold text-brand-800 ring-1 ring-brand-100">
            {filteredFiles.length}/{total} Dosya
          </span>
        }
      />
      <p className="text-[13px] text-[#9AA3AF]">İhbar Edilen Hasar Dosyaları</p>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'all' as const, label: 'Toplam', count: files.length },
            { id: 'expert_monitor' as const, label: 'Eksper İhbarlı', count: expertCount },
            { id: 'direct_process' as const, label: 'Departman İhbarlı', count: directCount },
          ] as const
        ).map((tab) => {
          const active = trackFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTrack(tab.id)}
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

      {toast && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm">
          {toast}
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-4 font-bold text-red-700 hover:text-red-900">
            &times;
          </button>
        </div>
      )}

      {missingScope ? (
        <div className="rounded-xl border border-amber-200 bg-white px-6 py-16 text-center">
          <p className="font-medium text-slate-700">Sigorta Şirketi Kapsamı Tanımlı Değil.</p>
          <p className="mt-2 text-sm text-slate-500">
            Hesabınıza bağlı sigorta şirketi bulunamadı. Meridyen operasyon ekibinden kapsam ataması isteyin.
          </p>
        </div>
      ) : (
        <>
          {filteredFiles.length > 0 && (
          <PortalMobileFileList
            showInsurance={false}
            showAssigned
            items={filteredFiles.map((f) => {
              const reporter = reporterOf(f);
              return {
                id: f.id,
                fileNo: fileNoOf(f),
                subject: formatClaimSubjectLabel(f.lossType, undefined, f.subject ?? f.claimSubject?.name),
                statusName: portalStatusLabel(f.currentStatus?.code, f.currentStatus?.name),
                statusColor: f.currentStatus?.colorCode,
                createdAt: ihbarAt(f),
                assignedUser: meridyenOwnerName(f) === '—' ? null : meridyenOwnerName(f),
                reporterLabel:
                  reporter.name === '—'
                    ? null
                    : reporter.role
                      ? `${reporter.name} · ${reporter.role}`
                      : reporter.name,
              };
            })}
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
                      placeholder="Dosya, Konu, Sorumlu Ara…"
                      data-testid="sigorta-dosyalar-search"
                      className="w-48 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 bg-white"
                      title="Dosya No, Konu veya Sorumluya Göre Ara"
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
                            <PanelTableTh
                              key={col.id}
                              colId={col.id}
                              resizable={col.resizable !== false}
                              className={thClass}
                            >
                              {col.label}
                            </PanelTableTh>
                          );
                        }
                        return (
                          <SortablePanelTableTh
                            key={col.id}
                            colId={col.id}
                            sortKey={col.id}
                            activeSortKey={clientSort?.key ?? null}
                            sortDir={clientSort?.dir ?? 'asc'}
                            onSort={(key) => setClientSort((prev) => cycleClientSort(prev, key))}
                            resizable={col.resizable !== false}
                            className={thClass}
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
                                : trackFilter === 'all'
                                  ? 'Henüz Dosya Bulunmuyor.'
                                  : 'Bu Filtrede Dosya Bulunmuyor.'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredFiles.map((f) => {
                        const reporter = reporterOf(f);
                        const ownerName = meridyenOwnerName(f);
                        const ownerPhone = meridyenOwnerPhone(f);
                        return (
                          <tr
                            key={f.id}
                            className="cursor-pointer transition-colors hover:bg-[#F5F7FB]"
                            onClick={() => openDrawer(f.id, 'ozet')}
                          >
                            {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                              switch (col.id) {
                                case 'fileNumber':
                                  return (
                                    <PanelTableTd
                                      key={col.id}
                                      colId="fileNumber"
                                      className="px-3 py-2.5 text-[13px] font-semibold tabular-nums text-[#10151F]"
                                    >
                                      {fileNoOf(f)}
                                    </PanelTableTd>
                                  );
                                case 'subject':
                                  return (
                                    <PanelTableTd
                                      key={col.id}
                                      colId="subject"
                                      className="table-td-center px-3 py-2.5 text-[13px] text-[#4B5565]"
                                    >
                                      {formatClaimSubjectLabel(f.lossType, undefined, f.subject ?? f.claimSubject?.name)}
                                    </PanelTableTd>
                                  );
                                case 'status': {
                                  const statusLabel = portalStatusLabel(
                                    f.currentStatus?.code,
                                    f.currentStatus?.name,
                                  );
                                  return (
                                    <PanelTableTd key={col.id} colId="status" className="table-td-center px-3 py-2.5">
                                      <span className={expertStatusBadgeClass(statusLabel)}>
                                        {statusLabel}
                                      </span>
                                    </PanelTableTd>
                                  );
                                }
                                case 'amount':
                                  return (
                                    <PanelTableTd
                                      key={col.id}
                                      colId="amount"
                                      className="px-3 py-2.5 text-right text-[13px] font-semibold tabular-nums text-[#10151F]"
                                    >
                                      {fmtMoney(dosyaBedeliOf(f))}
                                    </PanelTableTd>
                                  );
                                case 'reporter':
                                  return (
                                    <PanelTableTd
                                      key={col.id}
                                      colId="reporter"
                                      className="px-3 py-2.5 text-[13px] text-[#4B5565]"
                                    >
                                      {reporter.name === '—' ? (
                                        '—'
                                      ) : (
                                        <span className="block min-w-0">
                                          <span className="block truncate font-medium text-slate-800">{reporter.name}</span>
                                          {reporter.role ? (
                                            <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                                              {reporter.role}
                                            </span>
                                          ) : null}
                                        </span>
                                      )}
                                    </PanelTableTd>
                                  );
                                case 'assignedUser':
                                  return (
                                    <PanelTableTd
                                      key={col.id}
                                      colId="assignedUser"
                                      className="px-3 py-2.5 text-[13px] text-[#4B5565]"
                                    >
                                      {ownerName === '—' ? (
                                        '—'
                                      ) : (
                                        <div
                                          className="min-w-0 space-y-1"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <span className="block truncate font-medium text-slate-800">
                                            {ownerName}
                                          </span>
                                          {ownerPhone ? (
                                            <PhoneContactActions
                                              phone={ownerPhone}
                                              size="sm"
                                              whatsappMessage={`Meridyen — Dosya: ${fileNoOf(f)}`}
                                            />
                                          ) : null}
                                        </div>
                                      )}
                                    </PanelTableTd>
                                  );
                                case 'createdAt':
                                  return (
                                    <PanelTableTd
                                      key={col.id}
                                      colId="createdAt"
                                      className="px-3 py-2.5 text-[13px] text-[#6B7280]"
                                    >
                                      {fmtDateTime(ihbarAt(f))}
                                    </PanelTableTd>
                                  );
                                case 'actions':
                                  return (
                                    <PanelTableTd key={col.id} colId="actions" className="table-td-center px-3 py-2.5">
                                      <InsuranceDosyalarActions
                                        rowId={f.id}
                                        onFileSummary={() => openDrawer(f.id, 'ozet')}
                                        onAddNote={() => setNoteFileId(f.id)}
                                        onDocuments={() => setDocsFileId(f.id)}
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
                        );
                      })
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
        file={drawerFile ? toDrawerFile(drawerFile) : null}
        initialTab={drawerTab}
        audience="insurance"
        canUploadDocuments={false}
        onOpenDocuments={() => drawerFileId && setDocsFileId(drawerFileId)}
        onOpenNote={() => drawerFileId && setNoteFileId(drawerFileId)}
        notesRefreshToken={notesRefreshToken}
      />

      <ExpertFileDocumentsModal
        open={Boolean(docsFileId)}
        claimFileId={docsFileId}
        allowUpload={false}
        onClose={() => setDocsFileId(null)}
      />

      <ExpertFileNoteModal
        open={Boolean(noteFileId)}
        claimFileId={noteFileId}
        fileNo={(() => {
          const f = files.find((x) => x.id === noteFileId);
          return f ? fileNoOf(f) : undefined;
        })()}
        insuredName={files.find((x) => x.id === noteFileId)?.insuredName}
        onClose={() => setNoteFileId(null)}
        onSaved={() => {
          setNotesRefreshToken((n) => n + 1);
          setNoteFileId(null);
        }}
      />
    </div>
  );
}
