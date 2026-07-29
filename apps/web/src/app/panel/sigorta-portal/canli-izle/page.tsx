'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import {
  AlertTriangle,
  Building2,
  Map as MapIcon,
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
    <div className="flex min-h-[640px] items-center justify-center rounded-xl border border-slate-200 bg-slate-900">
      <p className="text-sm font-medium text-white">Harita Yükleniyor...</p>
    </div>
  ),
});
import { ExpertFileNoteModal } from '@/components/eksper-portal/ExpertFileModals';
import { API, authHeader } from '@/utils/api';
import { fmtDate } from '@/utils/date-helpers';
import { claimFileToMapPin, type ClaimFileForMap } from '@/utils/insurance-portal-map-utils';
import { hasInsuranceCompanyUserAccess, readInsurancePortalUser } from '@/utils/portal-insurance-scope';
import { useToast } from '@/contexts/ToastContext';

type StatusGroup = 'all' | 'open' | 'in_repair' | 'approval_pending';
type ViewMode = 'map' | 'city';

type ClaimSubjectOption = { id: string; name: string };

type LiveMapFile = ClaimFileForMap & {
  inRepair?: boolean;
  assignedOfficeUserId?: string | null;
};

type LiveMapMeta = {
  total: number;
  delayed: number;
  inRepair: number;
};

const STATUS_OPTIONS: { value: StatusGroup; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'open', label: 'Açık' },
  { value: 'in_repair', label: 'Onarımda' },
  { value: 'approval_pending', label: 'Onay Bekliyor' },
];

function officeLabel(user?: LiveMapFile['assignedOfficeUser']): string {
  if (!user) return '—';
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return name || '—';
}

export default function SigortaCanliIzlePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [files, setFiles] = useState<LiveMapFile[]>([]);
  const [meta, setMeta] = useState<LiveMapMeta>({ total: 0, delayed: 0, inRepair: 0 });
  const [subjects, setSubjects] = useState<ClaimSubjectOption[]>([]);
  const [claimSubjectId, setClaimSubjectId] = useState('all');
  const [city, setCity] = useState('all');
  const [statusGroup, setStatusGroup] = useState<StatusGroup>('all');
  const [officeUserId, setOfficeUserId] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [selectedPin, setSelectedPin] = useState<InsuranceMapPin | null>(null);
  const [noteFileId, setNoteFileId] = useState<string | null>(null);

  useEffect(() => {
    const { user } = readInsurancePortalUser();
    if (!user) {
      router.push('/giris');
      return;
    }
    if (!hasInsuranceCompanyUserAccess(user)) {
      setLoading(false);
      setAccessDenied(true);
      return;
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (accessDenied || loading) return;
    let cancelled = false;
    axios
      .get(`${API}/claim-subjects/active?category=hasar`, { headers: authHeader() })
      .then((r) => {
        if (cancelled) return;
        const rows = (r.data?.data ?? r.data ?? []) as Array<{ id?: string; name?: string }>;
        setSubjects(
          (Array.isArray(rows) ? rows : [])
            .filter((s) => s.id && s.name)
            .map((s) => ({ id: String(s.id), name: String(s.name) })),
        );
      })
      .catch(() => {
        if (!cancelled) setSubjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accessDenied, loading]);

  const loadLiveMap = useCallback(async () => {
    setFilesLoading(true);
    try {
      const params: Record<string, string> = { limit: '500' };
      if (claimSubjectId !== 'all') params.claimSubjectId = claimSubjectId;
      if (city !== 'all') params.city = city;
      if (statusGroup !== 'all') params.statusGroup = statusGroup;
      if (officeUserId !== 'all') params.assignedOfficeUserId = officeUserId;

      const r = await axios.get(`${API}/claim-files/live-map`, {
        headers: authHeader(),
        params,
      });
      const rows = (r.data?.data ?? []) as LiveMapFile[];
      const nextMeta = (r.data?.meta ?? {}) as Partial<LiveMapMeta>;
      setFiles(Array.isArray(rows) ? rows : []);
      setMeta({
        total: Number(nextMeta.total) || 0,
        delayed: Number(nextMeta.delayed) || 0,
        inRepair: Number(nextMeta.inRepair) || 0,
      });
    } catch (err: unknown) {
      setFiles([]);
      setMeta({ total: 0, delayed: 0, inRepair: 0 });
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message ?? err.message
        : 'Canlı izle verisi yüklenemedi';
      showToast('error', Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setFilesLoading(false);
    }
  }, [claimSubjectId, city, statusGroup, officeUserId, showToast]);

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

  const cityGroups = useMemo(() => {
    const groups = new Map<string, InsuranceMapPin[]>();
    const push = (cityName: string, entry: InsuranceMapPin) => {
      const list = groups.get(cityName) ?? [];
      list.push(entry);
      groups.set(cityName, list);
    };

    // Haritada görünen pin’ler önce (şehir listesi harita ile aynı kaynağı kullansın)
    for (const pin of pins) {
      push((pin.city ?? '').trim() || 'İl Belirtilmemiş', pin);
    }

    const pinIds = new Set(pins.map((p) => p.id));
    for (const file of files) {
      if (pinIds.has(file.id)) continue;
      const cityName =
        (file.propertyAddress?.city ?? file.customer?.city)?.trim() || 'İl Belirtilmemiş';
      push(cityName, {
        id: file.id,
        fileId: file.id,
        fileNumber: file.fileNo ?? file.fileNumber ?? '—',
        latitude: 0,
        longitude: 0,
        label: file.fileNo ?? '—',
        tooltip: file.claimSubject?.name || file.lossType || 'Hasar Dosyası',
        category: 'generic',
        city: cityName === 'İl Belirtilmemiş' ? undefined : cityName,
        statusName: file.currentStatus?.name,
        statusCode: file.currentStatus?.code,
        delayRisk: Boolean(file.delayRisk),
        slaTone: file.delayRisk ? 'late' : 'ok',
        claimSubjectName: file.claimSubject?.name || file.lossType || 'Hasar Dosyası',
        approvedAt: file.approvedAt ? String(file.approvedAt) : null,
        repairStartAt: file.repairStartAt ? String(file.repairStartAt) : null,
        estimatedRepairEndAt: file.estimatedRepairEndAt ? String(file.estimatedRepairEndAt) : null,
        assignedOfficeUserName: officeLabel(file.assignedOfficeUser),
      });
    }

    return Array.from(groups.entries())
      .map(([name, items]) => ({ name, items, count: items.length }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'tr'));
  }, [files, pins]);

  // Şehir görünümüne geçince / liste gelince sağ özet dolsun
  useEffect(() => {
    if (viewMode !== 'city') return;
    const first = cityGroups[0]?.items[0];
    if (!first) return;
    setSelectedPin((prev) => {
      if (prev && cityGroups.some((g) => g.items.some((i) => i.id === prev.id))) return prev;
      return first;
    });
  }, [viewMode, cityGroups]);

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
          <p className="text-base font-semibold text-slate-800">Bu Sayfa Sigorta Şirketi Kullanıcıları İçindir</p>
          <p className="mt-1 text-sm text-slate-500">
            Canlı İzle yalnızca sigorta şirketi rolündeki kullanıcılar tarafından kullanılabilir.
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
          portalHomeHref="/panel/sigorta-portal"
          portalHomeLabel="Dosya Takip"
          currentLabel="Canlı İzle"
          title="Canlı İzle"
        />

        <div
          className="inline-flex w-full max-w-md rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
          role="tablist"
          aria-label="Görünüm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'map'}
            onClick={() => setViewMode('map')}
            className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition ${
              viewMode === 'map' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <MapIcon className="h-4 w-4" aria-hidden />
            Harita
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'city'}
            onClick={() => {
              setViewMode('city');
              const first = cityGroups[0]?.items[0];
              if (first) setSelectedPin({ ...first });
            }}
            className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition ${
              viewMode === 'city' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Building2 className="h-4 w-4" aria-hidden />
            Şehir
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { label: 'Toplam Pin', value: meta.total || pins.length, icon: MapPin, tone: 'text-brand-600 bg-blue-50' },
            { label: 'Geciken', value: meta.delayed, icon: AlertTriangle, tone: 'text-status-warning bg-amber-50' },
            { label: 'Onarımda', value: meta.inRepair, icon: Wrench, tone: 'text-status-success bg-emerald-50' },
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
            aria-label="Dosya Konusu"
            className={selectClass}
            value={claimSubjectId}
            onChange={(e) => setClaimSubjectId(e.target.value)}
          >
            <option value="all">Dosya Konusu: Tümü</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            aria-label="İl"
            className={selectClass}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            <option value="all">Tüm İller</option>
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
            {viewMode === 'map' ? (
              <ErrorBoundary
                fallback={
                  <div className="flex min-h-[640px] flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-6">
                    <p className="text-sm font-semibold text-slate-800">Harita Geçici Olarak Açılamadı</p>
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode('city');
                        const first = cityGroups[0]?.items[0];
                        if (first) setSelectedPin({ ...first });
                      }}
                      className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                    >
                      Şehir Görünümüne Geç
                    </button>
                  </div>
                }
              >
                <InsuranceLiveMap3D
                  key="live-map-street"
                  pins={pins}
                  loading={filesLoading}
                  onSelectPin={selectPin}
                  onMessagePin={(pin) => {
                    if (pin.fileId) setNoteFileId(pin.fileId);
                  }}
                />
              </ErrorBoundary>
            ) : (
              <div
                className="space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                style={{ minHeight: 640 }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">Şehir Görünümü</p>
                  <span className="text-xs font-medium text-slate-500">
                    {cityGroups.length} İl · {files.length} Dosya
                  </span>
                </div>
                {filesLoading && (
                  <p className="py-10 text-center text-sm text-slate-500">Yükleniyor...</p>
                )}
                {!filesLoading && cityGroups.length === 0 && (
                  <p className="py-10 text-center text-sm text-slate-500">Gösterilecek Dosya Yok</p>
                )}
                {!filesLoading &&
                  cityGroups.map((group) => (
                    <div key={group.name} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (group.items[0]) selectPin(group.items[0]);
                        }}
                        className="mb-2.5 flex w-full items-center justify-between gap-2 text-left"
                      >
                        <p className="text-sm font-semibold text-slate-900">{group.name}</p>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                          {group.count} Dosya
                        </span>
                      </button>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((pin) => {
                          const selected = selectedPin?.id === pin.id;
                          return (
                            <button
                              key={pin.id}
                              type="button"
                              onClick={() => selectPin(pin)}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-sm transition ${
                                selected
                                  ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-200'
                                  : 'border-emerald-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700'
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  pin.slaTone === 'late'
                                    ? 'bg-status-danger'
                                    : pin.slaTone === 'warn'
                                      ? 'bg-status-warning'
                                      : 'bg-status-success'
                                }`}
                                aria-hidden
                              />
                              {pin.fileNumber ?? pin.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            )}
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
                  { label: 'Hasar Konusu', value: selectedPin.claimSubjectName ?? selectedPin.tooltip ?? '—' },
                  { label: 'Onay Tarihi', value: fmtDate(selectedPin.approvedAt) },
                  { label: 'Onarıma Başlangıç', value: fmtDate(selectedPin.repairStartAt) },
                  { label: 'Tahmini Onarım Bitiş', value: fmtDate(selectedPin.estimatedRepairEndAt) },
                  { label: 'Durum', value: selectedPin.statusName ?? '—' },
                  { label: 'İl', value: selectedPin.city ?? '—' },
                  { label: 'Meridyen Sorumlusu', value: selectedPin.assignedOfficeUserName ?? '—' },
                ].map((row) => (
                  <div key={row.label} className="border-b border-slate-100 pb-2 last:border-0">
                    <p className="text-[11px] font-medium text-slate-500">{row.label}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-800">{row.value || '—'}</p>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => selectedPin.fileId && setNoteFileId(selectedPin.fileId)}
                  className="mt-2 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Mesaj Gönder
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>

      <ExpertFileNoteModal
        open={Boolean(noteFileId)}
        claimFileId={noteFileId}
        fileNo={selectedPin?.fileNumber}
        onClose={() => setNoteFileId(null)}
        onSaved={() => {
          showToast('success', 'Mesaj Gönderildi');
          setNoteFileId(null);
        }}
      />
    </DashboardShell>
  );
}
