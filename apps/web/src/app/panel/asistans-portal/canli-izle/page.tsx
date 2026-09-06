'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  MapPin,
  Wrench,
  X,
} from 'lucide-react';
import { DashboardShell } from '@/app/panel/_components';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import PortalPageHeader from '@/components/portal/PortalPageHeader';
import type { InsuranceMapPin } from '@/components/portal/insurance-portal-map.types';

const InsuranceLiveMap3D = dynamic(() => import('@/components/portal/InsuranceLiveMap3D'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[640px] items-center justify-center rounded-xl border border-slate-200 bg-white">
      <p className="text-sm font-medium text-slate-600">Harita Yükleniyor...</p>
    </div>
  ),
});
import { ExpertFileDetailDrawer, type ExpertDrawerFile } from '@/components/eksper-portal/ExpertFileDetailDrawer';
import { fmtDate } from '@/utils/date-helpers';
import { claimFileToMapPin, type ClaimFileForMap } from '@/utils/insurance-portal-map-utils';
import {
  classifyAssistanceStage,
  emergencyStatusLabel,
  ASSISTANCE_STAGE_LABELS,
} from '@/utils/assistance-portal-stages';
import { fetchPortalEmergencyCases } from '@/utils/portal-api';
import { hasAssistanceCompanyUserAccess, readAssistancePortalUser } from '@/utils/portal-assistance-scope';
import { useToast } from '@/contexts/ToastContext';

type StatusGroup = 'all' | 'open' | 'in_repair' | 'approval_pending';


type LiveMapFile = ClaimFileForMap & {
  inRepair?: boolean;
  assignedOfficeUserId?: string | null;
  fileDate?: string | null;
  createdAt?: string | null;
  issueType?: string | null;
  district?: string | null;
};

type LiveMapMeta = {
  total: number;
  delayed: number;
  inRepair: number;
};

const STATUS_OPTIONS: { value: StatusGroup; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'open', label: ASSISTANCE_STAGE_LABELS.yeni_ihbar },
  { value: 'in_repair', label: ASSISTANCE_STAGE_LABELS.sahada },
  { value: 'approval_pending', label: ASSISTANCE_STAGE_LABELS.onay_bekleyen },
];

function officeLabel(user?: LiveMapFile['assignedOfficeUser']): string {
  if (!user) return '—';
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return name || '—';
}

export default function AsistansCanliIzlePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [files, setFiles] = useState<LiveMapFile[]>([]);
  const [meta, setMeta] = useState<LiveMapMeta>({ total: 0, delayed: 0, inRepair: 0 });
  const [city, setCity] = useState('all');
  const [statusGroup, setStatusGroup] = useState<StatusGroup>('all');
  const [officeUserId, setOfficeUserId] = useState('all');
  const [selectedPin, setSelectedPin] = useState<InsuranceMapPin | null>(null);
  const [drawerFile, setDrawerFile] = useState<ExpertDrawerFile | null>(null);
  const [drawerTab, setDrawerTab] = useState<'ozet' | 'belgeler' | 'operasyon' | 'notlar'>('ozet');
  const notesRefreshToken = 0;

  useEffect(() => {
    const { user } = readAssistancePortalUser();
    if (!user) {
      router.push('/giris');
      return;
    }
    if (!hasAssistanceCompanyUserAccess(user)) {
      setLoading(false);
      setAccessDenied(true);
      return;
    }
    setLoading(false);
  }, [router]);


  const openCaseDrawer = (fileId: string, tab: 'ozet' | 'belgeler' | 'operasyon' | 'notlar' = 'ozet') => {
    const file = files.find((f) => f.id === fileId);
    setDrawerTab(tab);
    setDrawerFile({
      id: fileId,
      fileNo: file?.fileNo || file?.fileNumber || '—',
      lossType: file?.lossType,
      subject: file?.issueType || file?.claimSubject?.name,
      currentStatus: file?.currentStatus
        ? { name: file.currentStatus.name, code: String(file.currentStatus.code || '') }
        : null,
    });
  };

  const loadLiveMap = useCallback(async () => {
    setFilesLoading(true);
    try {
      const em = await fetchPortalEmergencyCases(500);
      let rows: (LiveMapFile & { totalGelir?: number })[] = (em.data ?? []).map((raw: any) => {
        const statusCode = String(raw.status || 'GELEN');
        const issueType = raw.issueType || raw.serviceType || undefined;
        const stage = classifyAssistanceStage({
          id: String(raw.id),
          status: statusCode,
          totalGelir: typeof raw.totalGelir === 'number' ? raw.totalGelir : 0,
        });
        return {
          id: String(raw.id),
          fileNo: raw.fileNo || raw.caseNo || undefined,
          fileNumber: raw.fileNo || raw.caseNo || undefined,
          lossType: issueType || 'Acil Yardım',
          claimSubject: { name: issueType || '—' },
          propertyAddress: raw.city ? { city: String(raw.city) } : null,
          customer: raw.city ? { city: String(raw.city) } : null,
          currentStatus: {
            code: statusCode,
            name:
              stage === 'yeni_ihbar' || stage === 'sahada' || stage === 'onay_bekleyen' || stage === 'onaylanan'
                ? ASSISTANCE_STAGE_LABELS[stage]
                : emergencyStatusLabel(statusCode),
          },
          delayRisk: Boolean(raw.overdueLevel && raw.overdueLevel !== 'none'),
          inRepair: stage === 'sahada',
          totalGelir: typeof raw.totalGelir === 'number' ? raw.totalGelir : 0,
          assignedOfficeUserId: raw.assignedUserId || raw.assignedOfficeUserId || null,
          assignedOfficeUser: raw.assignedUser || raw.assignedOfficeUser || null,
          fileDate: raw.fileDate || null,
          createdAt: raw.createdAt || null,
          issueType: issueType || null,
          district: raw.district || null,
        };
      });

      if (city !== 'all') {
        rows = rows.filter((f) => (f.propertyAddress?.city ?? f.customer?.city) === city);
      }
      if (statusGroup === 'in_repair') {
        rows = rows.filter((f) => classifyAssistanceStage(f) === 'sahada');
      } else if (statusGroup === 'open') {
        rows = rows.filter((f) => classifyAssistanceStage(f) === 'yeni_ihbar');
      } else if (statusGroup === 'approval_pending') {
        rows = rows.filter((f) => classifyAssistanceStage(f) === 'onay_bekleyen');
      }
      if (officeUserId !== 'all') {
        rows = rows.filter((f) => f.assignedOfficeUserId === officeUserId);
      }

      const delayed = rows.filter((f) => f.delayRisk).length;
      const inRepair = rows.filter((f) => f.inRepair).length;
      setFiles(rows);
      setMeta({ total: rows.length, delayed, inRepair });
    } catch (err: unknown) {
      setFiles([]);
      setMeta({ total: 0, delayed: 0, inRepair: 0 });
      const msg = err instanceof Error ? err.message : 'Canlı izle verisi yüklenemedi';
      showToast('error', msg);
    } finally {
      setFilesLoading(false);
    }
  }, [city, statusGroup, officeUserId, showToast]);

  useEffect(() => {
    if (accessDenied || loading) return;
    void loadLiveMap();
  }, [accessDenied, loading, loadLiveMap]);

  const pins = useMemo(
    () =>
      files
        .map((file) => claimFileToMapPin(file))
        .filter((pin): pin is InsuranceMapPin => pin !== null),
    [files],
  );

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const file of files) {
      const c = file.propertyAddress?.city ?? file.customer?.city;
      if (c?.trim()) set.add(c.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [files]);

  const officeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const file of files) {
      if (!file.assignedOfficeUserId || !file.assignedOfficeUser) continue;
      map.set(file.assignedOfficeUserId, officeLabel(file.assignedOfficeUser));
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [files]);

  const selectPin = useCallback((pin: InsuranceMapPin) => {
    setSelectedPin({ ...pin });
  }, []);

  const selectClass =
    'h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:max-w-[200px]';

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
            Canlı İzle yalnızca asistans firması rolündeki kullanıcılar tarafından kullanılabilir.
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
      <div className="flex flex-col gap-4 pb-2">
        <PortalPageHeader
          portalHomeHref="/panel/asistans-portal"
          portalHomeLabel="Dosya Takip"
          currentLabel="Canlı İzle"
          title="Canlı İzle"
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { label: 'Toplam Pin', value: meta.total || pins.length, icon: MapPin, tone: 'text-brand-600 bg-blue-50' },
            { label: 'Geciken', value: meta.delayed, icon: AlertTriangle, tone: 'text-status-warning bg-amber-50' },
            { label: 'Sahada', value: meta.inRepair, icon: Wrench, tone: 'text-status-success bg-emerald-50' },
          ].map((card) => (
            <div
              key={card.label}
              className="relative flex min-h-[4.5rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white px-3 pb-2.5 pt-2 shadow-sm"
            >
              <span
                className={`absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-lg ${card.tone}`}
                aria-hidden
              >
                <card.icon className="h-4 w-4" />
              </span>
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
                <p className="w-full text-[11px] font-medium leading-tight text-slate-500">{card.label}</p>
                <p className="w-full text-lg font-bold tabular-nums leading-none tracking-tight text-slate-900">
                  {card.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            aria-label="Bölge Seç"
            className={selectClass}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            <option value="all">Bölge Seç</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            aria-label="Durum"
            className={selectClass}
            value={statusGroup}
            onChange={(e) => setStatusGroup(e.target.value as StatusGroup)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            aria-label="Meridyen Sorumlusu"
            className={selectClass}
            value={officeUserId}
            onChange={(e) => setOfficeUserId(e.target.value)}
          >
            <option value="all">Meridyen Sorumlusu: Tümü</option>
            {officeOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>

        <div className="grid min-h-[640px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-h-[640px] min-w-0">
            <ErrorBoundary
              fallback={
                <div className="flex min-h-[640px] flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-6">
                  <p className="text-sm font-semibold text-slate-800">Harita Geçici Olarak Açılamadı</p>
                </div>
              }
            >
              <InsuranceLiveMap3D
                key="live-map-street"
                pins={pins}
                loading={filesLoading}
                onSelectPin={selectPin}
                onMessagePin={(pin) => {
                  if (pin.fileId) openCaseDrawer(pin.fileId, 'notlar');
                }}
              />
            </ErrorBoundary>
          </div>

          <aside key={selectedPin?.id ?? 'empty'} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800">Dosya Özeti</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {selectedPin ? selectedPin.fileNumber : 'Dosya numarasından seçin'}
                </p>
              </div>
              {selectedPin && (
                <button
                  type="button"
                  onClick={() => setSelectedPin(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                  aria-label="Özeti Kapat"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {!selectedPin ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-xs text-slate-500">
                Henüz Dosya Seçilmedi
              </p>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Dosya No', value: selectedPin.fileNumber ?? '—' },
                  { label: 'Dosya Konusu', value: selectedPin.claimSubjectName ?? selectedPin.tooltip ?? '—' },
                  {
                    label: 'İhbar Tarihi',
                    value: (() => {
                      const file = files.find((f) => f.id === selectedPin.fileId);
                      return fmtDate(selectedPin.repairStartAt) || fmtDate(file?.fileDate || file?.createdAt);
                    })(),
                  },
                  { label: 'Durum', value: selectedPin.statusName ?? '—' },
                  { label: 'İl', value: (() => {
                    const file = files.find((f) => f.id === selectedPin.fileId);
                    const city = (selectedPin.city || file?.propertyAddress?.city || '').trim();
                    const district = (file?.district || '').trim();
                    if (city && district) return `${city}-${district}`;
                    return city || district || '—';
                  })() },
                  { label: 'Meridyen Sorumlusu', value: selectedPin.assignedOfficeUserName ?? '—' },
                ].map((row) => (
                  <div key={row.label} className="border-b border-slate-100 pb-2 last:border-0">
                    <p className="text-[11px] font-medium text-slate-500">{row.label}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-800">{row.value || '—'}</p>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => selectedPin.fileId && openCaseDrawer(selectedPin.fileId, 'ozet')}
                  className="mt-2 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Dosya Özeti
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>

      <ExpertFileDetailDrawer
        open={Boolean(drawerFile)}
        onClose={() => setDrawerFile(null)}
        file={drawerFile}
        initialTab={drawerTab}
        audience="assistance"
        canUploadDocuments={true}
        onOpenDocuments={() => setDrawerTab('belgeler')}
        onOpenNote={() => setDrawerTab('notlar')}
        notesRefreshToken={notesRefreshToken}
      />
    </DashboardShell>
  );
}
