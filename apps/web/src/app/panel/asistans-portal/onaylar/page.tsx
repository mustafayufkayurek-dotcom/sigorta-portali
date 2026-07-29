'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

type DrawerTab = 'ozet' | 'belgeler' | 'operasyon' | 'notlar';

const CENTERED_COLS = new Set(['city', 'status', 'actions']);
const RIGHT_COLS = new Set(['amount']);

const ONAYLAR_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'fileNumber', label: 'Dosya No', defaultWidth: 140, minWidth: 120 },
  { id: 'subject', label: 'Dosya Konusu', defaultWidth: 160, minWidth: 120, flex: true },
  { id: 'city', label: 'İl', defaultWidth: 150, minWidth: 120 },
  { id: 'amount', label: 'Dosya Bedeli', defaultWidth: 130, minWidth: 110 },
  { id: 'status', label: 'Durum', defaultWidth: 120, minWidth: 100 },
  { id: 'createdAt', label: 'İhbar Tarihi', defaultWidth: 140, minWidth: 120 },
  { id: 'actions', label: 'İşlemler', defaultWidth: 128, minWidth: 112, pin: 'end', resizable: false },
];

type PendingCase = {
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
  currentStatus?: { code?: string; name?: string };
};

function fileNoOf(f: PendingCase) {
  return f.fileNo ?? f.fileNumber ?? '—';
}

function locationOf(f: Pick<PendingCase, 'city' | 'district'>): string {
  const city = f.city?.trim() ? toTitleCaseTR(f.city.trim()) : '';
  const district = f.district?.trim() ? toTitleCaseTR(f.district.trim()) : '';
  if (city && district) return `${city}-${district}`;
  return city || district || '—';
}

function subjectOf(f: PendingCase, catalog?: string[]) {
  return resolveClaimDosyaKonusu({ lossType: f.issueType || f.subject }, catalog);
}

function amountOf(f: PendingCase): number | null {
  if (typeof f.totalGelir === 'number' && Number.isFinite(f.totalGelir) && f.totalGelir > 0) {
    return f.totalGelir;
  }
  return null;
}

function ihbarAt(f: PendingCase) {
  return f.notificationDate || f.createdAt;
}

function mapRow(raw: any): PendingCase {
  const statusCode = String(raw.status || 'GELEN');
  const issue = raw.issueType || raw.serviceType || undefined;
  return {
    id: String(raw.id),
    fileNumber: raw.fileNo || raw.caseNo || '—',
    fileNo: raw.fileNo || raw.caseNo,
    issueType: issue,
    subject: issue,
    city: raw.city || null,
    district: raw.district || null,
    totalGelir: typeof raw.totalGelir === 'number' ? raw.totalGelir : 0,
    status: statusCode,
    createdAt: raw.createdAt || raw.fileDate || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt,
    notificationDate: raw.fileDate || raw.createdAt,
    currentStatus: { code: statusCode, name: emergencyStatusLabel(statusCode) },
  };
}

function toDrawerFile(f: PendingCase, catalog?: string[]): ExpertDrawerFile {
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

export default function AsistansOnaylarPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PendingCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingScope, setMissingScope] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [drawerFileId, setDrawerFileId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('ozet');
  const notesRefreshToken = 0;
  const [dosyaKonusuCatalog, setDosyaKonusuCatalog] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientSort, setClientSort] = useState<ClientSortState>(null);
  const tableColumns = usePanelTableColumns(
    'table-cols:asistans-portal-onaylar-v2',
    ONAYLAR_TABLE_COLUMNS,
  );

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr');
    const list = !q
      ? rows
      : rows.filter((f) => {
          const hay = [
            fileNoOf(f),
            subjectOf(f, dosyaKonusuCatalog),
            locationOf(f),
            formatTryAmount(amountOf(f)),
          ]
            .join(' ')
            .toLocaleLowerCase('tr');
          return hay.includes(q);
        });
    return sortRowsByClientSort(list, clientSort, (f, key) => {
      switch (key) {
        case 'fileNumber':
          return fileNoOf(f);
        case 'subject':
          return subjectOf(f, dosyaKonusuCatalog);
        case 'city':
          return locationOf(f);
        case 'amount':
          return amountOf(f) ?? -1;
        case 'status':
          return ASSISTANCE_STAGE_LABELS.onay_bekleyen;
        case 'createdAt':
          return ihbarAt(f);
        default:
          return '';
      }
    });
  }, [rows, searchQuery, clientSort, dosyaKonusuCatalog]);

  const drawerFile = useMemo(
    () =>
      filtered.find((f) => f.id === drawerFileId) ??
      rows.find((f) => f.id === drawerFileId) ??
      null,
    [rows, filtered, drawerFileId],
  );

  const openDrawer = (id: string, tab: DrawerTab = 'ozet') => {
    setDrawerTab(tab);
    setDrawerFileId(id);
  };

  const copyFileNo = async (f: PendingCase) => {
    try {
      await navigator.clipboard.writeText(fileNoOf(f));
      setToast('Dosya No Kopyalandı.');
    } catch {
      setToast('Kopyalama Başarısız.');
    }
  };

  useEffect(() => {
    const { user, hasScope } = readAssistancePortalUser();
    if (!user) {
      router.push('/giris');
      return;
    }
    if (!hasAssistanceCompanyUserAccess(user)) {
      router.push('/panel');
      return;
    }
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
    Promise.all([
      fetchPortalEmergencyCases(100),
      fetchAcilDosyaKonusuCatalog().catch(() => [] as string[]),
    ])
      .then(([em, catalog]) => {
        const pending = (em.data ?? [])
          .map(mapRow)
          .filter((f) => classifyAssistanceStage(f) === 'onay_bekleyen');
        setRows(pending);
        setDosyaKonusuCatalog(catalog);
      })
      .catch((err: Error) => {
        if (err.message === 'SESSION_REQUIRED') {
          router.push('/giris');
          return;
        }
        setError(err.message ?? 'Onaylar yüklenemedi.');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-500">Yükleniyor...</div>;
  }

  return (
    <div className="min-w-0 max-w-full space-y-3" data-testid="asistans-onaylar">
      <PortalPageHeader
        portalHomeHref="/panel/asistans-portal"
        portalHomeLabel="Dosya Takip"
        currentLabel="Bekleyen Onaylar"
        title="Bekleyen Onaylar"
        actions={
          <span className="w-fit shrink-0 rounded-full bg-amber-50 px-3 py-1 text-[12.5px] font-semibold text-amber-800 ring-1 ring-amber-100">
            {filtered.length} Onay Bekliyor
          </span>
        }
      />

      {toast ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm">
          {toast}
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
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
            Onay listesi için hesabınıza asistans firması atanmalıdır.
          </p>
        </div>
      ) : !error && rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <p className="font-medium text-slate-500">Onay Bekleyen Dosya Yok.</p>
          <Link
            href="/panel/asistans-portal/dosyalar"
            className="mt-3 inline-flex text-sm font-semibold text-brand-600 hover:underline"
          >
            Tüm Dosyalara Git
          </Link>
        </div>
      ) : !error && filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <p className="font-medium text-slate-500">Aramaya Uyan Dosya Yok.</p>
        </div>
      ) : (
        <>
          <PortalMobileFileList
            showInsurance={false}
            showAssigned={false}
            items={filtered.map((f) => ({
              id: f.id,
              fileNo: fileNoOf(f),
              subject: subjectOf(f, dosyaKonusuCatalog),
              statusName: ASSISTANCE_STAGE_LABELS.onay_bekleyen,
              createdAt: ihbarAt(f),
              reporterLabel: locationOf(f) !== '—' ? locationOf(f) : null,
            }))}
            onItemClick={(id) => openDrawer(id, 'ozet')}
          />

          <TableColumnsProvider value={tableColumns}>
            <PanelTableFrame
              className="hidden overflow-hidden rounded-card border-[#E7E9EE] shadow-card md:block"
              toolbar={
                <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-2">
                  <div className="section-heading mb-0 shrink-0">
                    <span className="section-heading-bar" />
                    <span className="section-heading-text">Onay Bekleyenler</span>
                  </div>
                  <div className="flex flex-nowrap items-center gap-2 shrink-0">
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Dosya, Dosya Konusu, İl Ara…"
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
                  <tbody>
                    {filtered.map((f) => (
                      <tr
                        key={f.id}
                        onClick={() => openDrawer(f.id, 'ozet')}
                        className={`cursor-pointer border-t border-slate-100 transition hover:bg-slate-50/80 ${
                          drawerFileId === f.id ? 'bg-amber-50/50' : 'bg-white'
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
                            case 'status':
                              return (
                                <PanelTableTd key={col.id} colId={col.id} className="table-td-center px-3 py-2.5">
                                  <span className={expertStatusBadgeClass(ASSISTANCE_STAGE_LABELS.onay_bekleyen)}>
                                    {ASSISTANCE_STAGE_LABELS.onay_bekleyen}
                                  </span>
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
                    ))}
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
    </div>
  );
}
