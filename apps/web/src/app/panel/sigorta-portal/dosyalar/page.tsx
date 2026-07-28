'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import PortalPageHeader from '@/components/portal/PortalPageHeader';
import PortalMobileFileList from '@/components/portal/PortalMobileFileList';
import { PortalBreakdownBarCard } from '@/components/panel/portal-breakdown-bar-card';
import { InsuranceProvinceResultsPanel } from '@/components/portal/InsuranceProvinceResultsPanel';
import {
  ExpertFileDetailDrawer,
  type ExpertDrawerFile,
} from '@/components/eksper-portal/ExpertFileDetailDrawer';
import { ExpertFileDocumentsModal, ExpertFileNoteModal } from '@/components/eksper-portal/ExpertFileModals';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTh,
  PanelTableTd,
  PanelTableFrame,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { fmtDateTime } from '@/utils/date-helpers';
import { formatClaimSubjectLabel, toTitleCaseTR } from '@/utils/text-helpers';
import { portalStatusLabel } from '@/utils/portal-file-flow-labels';
import { fetchPortalClaimFiles, hasPortalSessionToken } from '@/utils/portal-api';
import { hasInsuranceCompanyUserAccess, readInsurancePortalUser } from '@/utils/portal-insurance-scope';
import {
  buildInsuranceProvinceStats,
  buildInsuranceSubjectStats,
  classifyInsuranceFileTrack,
  type InsuranceFileTrack,
} from '@/utils/insurance-portal-monitoring';

type TrackFilter = 'all' | InsuranceFileTrack;

const SIGORTA_PORTAL_HOME = '/panel/sigorta-portal';
const SIGORTA_PORTAL_LABEL = 'Dosya Takip';

const SIGORTA_FILE_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'fileNumber', label: 'Dosya No', defaultWidth: 120, minWidth: 96 },
  { id: 'subject', label: 'Konu', defaultWidth: 160, minWidth: 110 },
  { id: 'status', label: 'Durum', defaultWidth: 120, minWidth: 96 },
  { id: 'reporter', label: 'İhbar Eden', defaultWidth: 160, minWidth: 120 },
  { id: 'assignedUser', label: 'Meridyen Sorumlusu', defaultWidth: 140, minWidth: 100 },
  { id: 'createdAt', label: 'İhbar Tarihi', defaultWidth: 140, minWidth: 120 },
  { id: 'flow', label: 'İzle', defaultWidth: 72, minWidth: 64 },
  { id: 'actions', label: 'İşlem', defaultWidth: 72, minWidth: 64, resizable: false },
];

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
  currentStatus?: { name: string; code?: string; colorCode?: string; color?: string };
  insuranceCompany?: { id?: string; name: string };
  assignedFieldUser?: { firstName: string; lastName: string };
  assignedAdjuster?: { id?: string; firstName?: string; lastName?: string } | null;
  propertyAddress?: { city?: string | null; district?: string | null } | null;
  claimSubject?: { id?: string; name?: string | null } | null;
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

function meridyenOwner(f: ClaimFile) {
  if (!f.assignedFieldUser) return '—';
  return `${f.assignedFieldUser.firstName} ${f.assignedFieldUser.lastName}`;
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
  const [trackFilter, setTrackFilter] = useState<TrackFilter>(() =>
    parseTrackParam(searchParams.get('track')),
  );
  const [noteFileId, setNoteFileId] = useState<string | null>(null);
  const [docsFileId, setDocsFileId] = useState<string | null>(null);
  const [drawerFileId, setDrawerFileId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('ozet');
  const [notesRefreshToken, setNotesRefreshToken] = useState(0);
  const tableColumns = usePanelTableColumns('table-cols:sigorta-portal-dosyalar', SIGORTA_FILE_TABLE_COLUMNS);

  useEffect(() => {
    setTrackFilter(parseTrackParam(searchParams.get('track')));
  }, [searchParams]);

  const filteredFiles = useMemo(() => {
    if (trackFilter === 'all') return files;
    return files.filter((f) => classifyInsuranceFileTrack(f) === trackFilter);
  }, [files, trackFilter]);

  const subjectStats = useMemo(
    () => buildInsuranceSubjectStats(filteredFiles),
    [filteredFiles],
  );
  const provinceStats = useMemo(
    () => buildInsuranceProvinceStats(filteredFiles),
    [filteredFiles],
  );
  const preferenceLabel =
    trackFilter === 'expert_monitor'
      ? 'Eksper İhbarlı'
      : trackFilter === 'direct_process'
        ? 'Departman İhbarlı'
        : 'Toplam Portföy';

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
    <div className="min-w-0 max-w-full space-y-4">
      <PortalPageHeader
        portalHomeHref={SIGORTA_PORTAL_HOME}
        portalHomeLabel={SIGORTA_PORTAL_LABEL}
        currentLabel="Dosyalar"
        title="Dosyalar"
        actions={
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
            {filteredFiles.length}/{total} dosya
          </span>
        }
      />

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

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-4 font-bold text-red-700 hover:text-red-900">
            &times;
          </button>
        </div>
      )}

      {missingScope ? (
        <div className="rounded-xl border border-amber-200 bg-white px-6 py-16 text-center">
          <p className="font-medium text-slate-700">Sigorta şirketi kapsamı tanımlı değil.</p>
          <p className="mt-2 text-sm text-slate-500">
            Hesabınıza bağlı sigorta şirketi bulunamadı. Meridyen operasyon ekibinden kapsam ataması isteyin veya çıkış yapıp tekrar giriş yapın.
          </p>
        </div>
      ) : !error && files.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <svg className="mx-auto mb-3 h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p className="font-medium text-slate-500">Henüz dosya bulunmuyor.</p>
          <p className="mt-1 text-sm text-slate-400">Sigorta şirketinize bağlı dosyalar burada listelenir.</p>
        </div>
      ) : !error && filteredFiles.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <p className="font-medium text-slate-500">Bu amaçta dosya yok.</p>
          <p className="mt-1 text-sm text-slate-400">
            {trackFilter === 'direct_process'
              ? 'Doğrudan ihbar ile açılan dosyalar burada görünür.'
              : 'Eksper tarafında yürüyen dosyalar burada görünür.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <PortalBreakdownBarCard
              title={`Dosya Konusu · ${preferenceLabel}`}
              data={subjectStats.map((r) => ({
                label: toTitleCaseTR(r.subject),
                count: r.total,
              }))}
              emptyText={`${preferenceLabel} için konu dağılımı henüz yok.`}
            />
            <PortalBreakdownBarCard
              title={`İl Bazlı · ${preferenceLabel}`}
              data={provinceStats.map((r) => ({
                label: toTitleCaseTR(r.city),
                count: r.total,
              }))}
              emptyText={`${preferenceLabel} için il dağılımı henüz yok.`}
              color="#0F766E"
            />
          </div>
          <InsuranceProvinceResultsPanel
            rows={provinceStats}
            preferenceLabel={preferenceLabel}
            emptyText={`${preferenceLabel} kapsamında il bazlı sonuç henüz oluşmadı.`}
          />
          <PortalMobileFileList
            showInsurance={false}
            showAssigned
            items={filteredFiles.map((f) => {
              const reporter = reporterOf(f);
              return {
                id: f.id,
                fileNo: fileNoOf(f),
                subject: formatClaimSubjectLabel(f.lossType, undefined, f.subject),
                statusName: portalStatusLabel(f.currentStatus?.code, f.currentStatus?.name),
                statusColor: f.currentStatus?.colorCode,
                createdAt: ihbarAt(f),
                assignedUser: meridyenOwner(f) === '—' ? null : meridyenOwner(f),
                reporterLabel:
                  reporter.name === '—'
                    ? null
                    : reporter.role
                      ? `${reporter.name} · ${reporter.role}`
                      : reporter.name,
                flowLabel: 'İzle',
              };
            })}
            onItemClick={(id) => openDrawer(id, 'ozet')}
            onFlowClick={(id) => openDrawer(id, 'operasyon')}
          />
          <TableColumnsProvider value={tableColumns}>
            <PanelTableFrame
              className="hidden md:block"
              toolbar={<PanelTableColumnPicker tableColumns={tableColumns} />}
            >
              <table className="min-w-full divide-y divide-slate-200" style={panelTableLayoutStyle(tableColumns)}>
                <thead className="bg-slate-50">
                  <tr>
                    <PanelTableTh colId="fileNumber" className="table-th-center">Dosya No</PanelTableTh>
                    <PanelTableTh colId="subject" className="table-th-center">Konu</PanelTableTh>
                    <PanelTableTh colId="status" className="table-th-center">Durum</PanelTableTh>
                    <PanelTableTh colId="reporter" className="table-th-center">İhbar Eden</PanelTableTh>
                    <PanelTableTh colId="assignedUser" className="table-th-center">Meridyen Sorumlusu</PanelTableTh>
                    <PanelTableTh colId="createdAt" className="table-th-center">İhbar Tarihi</PanelTableTh>
                    <PanelTableTh colId="flow" className="table-th-center">İzle</PanelTableTh>
                    <PanelTableTh colId="actions" className="table-th-center">İşlem</PanelTableTh>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFiles.map((f) => (
                    <tr
                      key={f.id}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                      onClick={() => openDrawer(f.id, 'ozet')}
                    >
                      <PanelTableTd colId="fileNumber" className="table-td-center px-4 py-3 text-sm font-medium text-slate-900">
                        {fileNoOf(f)}
                      </PanelTableTd>
                      <PanelTableTd colId="subject" className="table-td-center px-4 py-3 text-sm text-slate-600">
                        {formatClaimSubjectLabel(f.lossType, undefined, f.subject)}
                      </PanelTableTd>
                      <PanelTableTd colId="status" className="table-td-center px-4 py-3">
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{
                            background: f.currentStatus?.colorCode ? `${f.currentStatus.colorCode}20` : '#f3f4f6',
                            color: f.currentStatus?.colorCode ?? '#374151',
                          }}
                        >
                          {portalStatusLabel(f.currentStatus?.code, f.currentStatus?.name)}
                        </span>
                      </PanelTableTd>
                      <PanelTableTd colId="reporter" className="table-td-center px-4 py-3 text-sm text-slate-600">
                        {(() => {
                          const reporter = reporterOf(f);
                          if (reporter.name === '—') return '—';
                          return (
                            <span className="block">
                              <span className="font-medium text-slate-800">{reporter.name}</span>
                              {reporter.role ? (
                                <span className="mt-0.5 block text-[11px] text-slate-500">{reporter.role}</span>
                              ) : null}
                            </span>
                          );
                        })()}
                      </PanelTableTd>
                      <PanelTableTd colId="assignedUser" className="table-td-center px-4 py-3 text-sm text-slate-600">
                        {meridyenOwner(f)}
                      </PanelTableTd>
                      <PanelTableTd colId="createdAt" className="table-td-center px-4 py-3 text-sm text-slate-500">
                        {fmtDateTime(ihbarAt(f))}
                      </PanelTableTd>
                      <PanelTableTd colId="flow" className="table-td-center px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDrawer(f.id, 'operasyon');
                          }}
                          className="text-sm font-medium text-brand-600 hover:text-brand-800"
                        >
                          İzle
                        </button>
                      </PanelTableTd>
                      <PanelTableTd colId="actions" className="table-td-center px-4 py-3">
                        <button
                          type="button"
                          title="Mesaj Gönder"
                          aria-label="Mesaj Gönder"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNoteFileId(f.id);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                        >
                          <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                        </button>
                      </PanelTableTd>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PanelTableFrame>
          </TableColumnsProvider>
        </>
      )}

      <ExpertFileDetailDrawer
        open={Boolean(drawerFileId && drawerFile)}
        onClose={() => setDrawerFileId(null)}
        file={drawerFile ? toDrawerFile(drawerFile) : null}
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
    </div>
  );
}
