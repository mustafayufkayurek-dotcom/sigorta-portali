'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FolderOpen,
  LayoutGrid,
  MapPin,
  RefreshCw,
  Route,
  User,
} from 'lucide-react';
import axios from 'axios';
import { HintIcon } from '@/components/ui/HintIcon';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { getAccessToken } from '@/utils/auth-session';
import { OpsFirstRunNotice } from '@/components/operasyon/OpsFirstRunNotice';
import { OPS_NOTICE } from '@/utils/ops-first-run-notice';
import { provinceMapBounds, resolveProvinceCoords } from '@/data/turkey-province-coords';
import { buildPanelFileMarkerHtml, ensureHaritaPinSignalCss } from '@/utils/harita-pin-signal';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

type ActorType = 'personel' | 'vendor_hasar' | 'vendor_acil' | 'file_hasar' | 'file_acil';
export type FieldMapFilterTab = 'all' | 'hasar' | 'acil' | 'kapandi';
type JobStage = 'yeni' | 'atandi' | 'sahada' | 'kapandi';

export interface FieldMapPoint {
  actorType: ActorType;
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  timestamp?: string;
  locationKind: 'live' | 'job';
  jobStage?: JobStage;
  jobStageLabel?: string;
  city?: string;
  activeJob?: { label: string; fileNo?: string; href?: string };
}

interface RotaNoktasi {
  latitude: number;
  longitude: number;
  timestamp: string;
}

const FILTER_CARDS: {
  key: FieldMapFilterTab;
  label: string;
  wrap: string;
  icon: typeof LayoutGrid;
}[] = [
  { key: 'all', label: 'Tümü', wrap: 'bg-slate-800 border-slate-800', icon: LayoutGrid },
  { key: 'hasar', label: 'Hasar', wrap: 'bg-brand-600 border-brand-600', icon: FolderOpen },
  { key: 'acil', label: 'Acil', wrap: 'bg-orange-500 border-orange-500', icon: AlertTriangle },
  { key: 'kapandi', label: 'Kapandı', wrap: 'bg-slate-500 border-slate-500', icon: CheckCircle2 },
];

const ACTOR_LABEL: Record<ActorType, string> = {
  personel: 'Personel',
  vendor_hasar: 'Hasar Tedarikçisi',
  vendor_acil: 'Acil Tedarikçisi',
  file_hasar: 'Hasar Dosyası',
  file_acil: 'Acil Yardım Dosyası',
};

function isHasarPoint(p: FieldMapPoint): boolean {
  return p.actorType === 'file_hasar' || p.actorType === 'vendor_hasar';
}

function isAcilPoint(p: FieldMapPoint): boolean {
  return p.actorType === 'file_acil' || p.actorType === 'vendor_acil';
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

const APPOINTMENT_TYPE: Record<string, string> = {
  expert_visit: 'Eksper Ziyareti',
  inspection: 'Keşif',
  customer_meeting: 'Müşteri Toplantısı',
};

function markerColor(timestamp?: string): 'green' | 'yellow' | 'gray' {
  if (!timestamp) return 'gray';
  const mins = (Date.now() - new Date(timestamp).getTime()) / 60_000;
  if (mins < 15) return 'green';
  if (mins < 60) return 'yellow';
  return 'gray';
}

const COLOR_MAP = {
  green: '#10B981',
  yellow: '#F59E0B',
  gray: '#9CA3AF',
};

function formatRelative(ts?: string): string {
  if (!ts) return '—';
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60_000);
  if (mins < 1) return 'Az Önce';
  if (mins < 60) return `${mins} Dk Önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} Saat Önce`;
  return new Date(ts).toLocaleDateString('tr-TR');
}

function personelInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function fileColor(point: FieldMapPoint): string {
  if (point.jobStage === 'kapandi') return '#64748B';
  if (point.jobStage === 'sahada') return '#15803D';
  const hasar = point.actorType === 'file_hasar' || point.actorType === 'vendor_hasar';
  if (hasar) return point.jobStage === 'yeni' ? '#64748B' : '#2563EB';
  return point.jobStage === 'yeni' ? '#FB923C' : '#EA580C';
}

function fileMarkerHtml(point: FieldMapPoint, letter: string, publicMode: boolean): string {
  const label = publicMode
    ? point.actorType === 'file_hasar' || point.actorType === 'vendor_hasar'
      ? point.activeJob?.label || point.name
      : 'Acil Yardım'
    : point.activeJob?.fileNo || point.name;
  return buildPanelFileMarkerHtml({
    letter,
    color: fileColor(point),
    label,
    stage: publicMode ? undefined : point.jobStageLabel,
    signal: point.jobStage !== 'kapandi',
  });
}

function buildMarkerHtml(point: FieldMapPoint, publicMode: boolean): string {
  const label = esc(point.name);

  if (point.actorType === 'personel') {
    const color = COLOR_MAP[markerColor(point.timestamp)];
    const initials = esc(personelInitials(point.name));
    return `
      <div class="relative flex flex-col items-center">
        <div style="width:36px;height:36px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:12px;">${initials}</div>
        <div class="mt-1 whitespace-nowrap rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-900 shadow">${label}</div>
      </div>`;
  }

  if (point.actorType === 'file_hasar' || point.actorType === 'vendor_hasar') {
    return fileMarkerHtml(point, 'H', publicMode);
  }

  return fileMarkerHtml(point, 'A', publicMode);
}

function buildPopupHtml(point: FieldMapPoint, publicMode: boolean): string {
  const locationKindLabel =
    point.locationKind === 'live' ? 'Personel telefonu' : 'İş adresi';
  const title = publicMode
    ? point.actorType === 'file_hasar' || point.actorType === 'vendor_hasar'
      ? point.activeJob?.label || point.name
      : 'Acil Yardım'
    : point.activeJob?.fileNo || point.name;
  const jobLabel =
    point.activeJob?.label && APPOINTMENT_TYPE[point.activeJob.label]
      ? APPOINTMENT_TYPE[point.activeJob.label]
      : point.activeJob?.label;

  return `
    <div class="font-sans text-[13px] text-slate-800">
      <strong>${esc(title)}</strong>
      <div class="mt-1 text-slate-500">${ACTOR_LABEL[point.actorType]}</div>
      <hr class="my-2 border-slate-100">
      <div>Konum: ${locationKindLabel}</div>
      ${
        point.jobStageLabel
          ? `<div>Durum: ${esc(point.jobStageLabel)}</div>`
          : ''
      }
      ${point.city ? `<div>Bölge: ${esc(point.city)}</div>` : ''}
      ${
        publicMode
          ? ''
          : `<div>Son Güncelleme: ${formatRelative(point.timestamp)}</div>
      ${
        point.activeJob?.fileNo
          ? `<hr class="my-2 border-slate-100">
             <div>Dosya No: ${esc(point.activeJob.fileNo)}</div>
             ${jobLabel ? `<div class="text-slate-500">${esc(jobLabel)}</div>` : ''}
             ${
               point.activeJob.href
                 ? `<a href="${esc(point.activeJob.href)}" class="mt-1 inline-block text-brand-600 underline">Dosyaya Git</a>`
                 : ''
             }`
          : ''
      }`
      }
    </div>`;
}

function cityKey(city?: string | null): string {
  return (city ?? '').trim().toLocaleLowerCase('tr-TR');
}

function sameProvince(a?: string | null, b?: string | null): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  const ca = resolveProvinceCoords(a);
  const cb = resolveProvinceCoords(b);
  if (ca && cb) return ca.lat === cb.lat && ca.lng === cb.lng;
  return cityKey(a) === cityKey(b);
}

function MapKpiCard({
  label,
  value,
  icon: Icon,
  wrap,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof LayoutGrid;
  wrap: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[4.25rem] w-full min-w-0 items-center gap-3 rounded-xl border px-3 text-left text-white shadow-card transition ${wrap} ${
        active ? 'ring-2 ring-slate-900 ring-offset-2' : 'hover:brightness-110'
      }`}
      data-testid={`harita-kpi-${label}`}
    >
      <span className="inline-flex shrink-0 rounded-lg bg-white/20 p-2">
        <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-bold leading-none tabular-nums">{value}</span>
        <span className="mt-1 block text-[11px] font-semibold leading-tight text-white/90">{label}</span>
      </span>
    </button>
  );
}

function MapFilterField({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof MapPin;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-[9.5rem] flex-1 flex-col gap-1 sm:max-w-[14rem] sm:flex-none">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
        {label}
      </span>
      {children}
    </label>
  );
}

export type FieldOperationsMapProps = {
  customerId?: string;
  ownerOnly?: boolean;
  compact?: boolean;
  embed?: boolean;
  publicFilesOnly?: boolean;
  showPersonnelRoute?: boolean;
  showNotice?: boolean;
  defaultFilter?: FieldMapFilterTab;
};

export function FieldOperationsMap({
  customerId,
  ownerOnly = false,
  compact = false,
  embed = false,
  publicFilesOnly = false,
  showPersonnelRoute = false,
  showNotice = false,
  defaultFilter = 'all',
}: FieldOperationsMapProps) {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  const [points, setPoints] = useState<FieldMapPoint[]>([]);
  const [filter, setFilter] = useState<FieldMapFilterTab>(defaultFilter);
  const [seciliBolge, setSeciliBolge] = useState('');
  const [seciliPersonel, setSeciliPersonel] = useState('');
  const [rotaBaslangic, setRotaBaslangic] = useState('');
  const [rotaBitis, setRotaBitis] = useState('');
  const [rota, setRota] = useState<RotaNoktasi[]>([]);
  const [rotaPanel, setRotaPanel] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const token = () => getAccessToken() ?? '';

  const regionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of points) {
      const raw = (p.city ?? '').trim();
      if (!raw) continue;
      const coords = resolveProvinceCoords(raw);
      const key = coords ? `${coords.lat},${coords.lng}` : cityKey(raw);
      if (!seen.has(key)) seen.set(key, raw);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, 'tr'));
  }, [points]);

  const regionPoints = points.filter((p) => {
    if (p.actorType === 'personel') return false;
    if (seciliBolge && !sameProvince(p.city, seciliBolge)) return false;
    return true;
  });

  const regionViewKey = useMemo(
    () =>
      `${seciliBolge}::${regionPoints.map((p) => `${p.id}:${p.latitude}:${p.longitude}`).join('|')}`,
    [seciliBolge, regionPoints],
  );

  const filteredPoints = regionPoints.filter((p) => {
    if (filter === 'hasar') return isHasarPoint(p);
    if (filter === 'acil') return isAcilPoint(p);
    if (filter === 'kapandi') return p.jobStage === 'kapandi';
    return true;
  });

  const personelPoints = points.filter((p) => p.actorType === 'personel');

  const renderMarkers = useCallback((data: FieldMapPoint[]) => {
    const L = leafletRef.current;
    if (!mapRef.current || !L) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    data.forEach((point) => {
      const filePin =
        point.actorType === 'file_hasar' ||
        point.actorType === 'file_acil' ||
        point.actorType === 'vendor_hasar' ||
        point.actorType === 'vendor_acil';
      const icon = L.divIcon({
        className: 'harita-dosya-pin',
        html: buildMarkerHtml(point, publicFilesOnly),
        iconSize: filePin ? [48, 64] : [36, 36],
        iconAnchor: filePin ? [24, 18] : [18, 18],
      });

      const popup = L.popup({ maxWidth: 280 }).setContent(buildPopupHtml(point, publicFilesOnly));
      const marker = L.marker([point.latitude, point.longitude], { icon })
        .bindPopup(popup)
        .addTo(mapRef.current);
      markersRef.current.push(marker);
    });
  }, [publicFilesOnly]);

  const fetchFieldMap = useCallback(async () => {
    setYukleniyor(true);
    try {
      const data: FieldMapPoint[] = publicFilesOnly
        ? await (async () => {
            const res = await fetch('/api/v1/user-locations/public-file-map');
            const json = await res.json();
            return (json.data ?? []) as FieldMapPoint[];
          })()
        : ((
            await axios.get(`${API}/user-locations/field-map`, {
              headers: { Authorization: `Bearer ${token()}` },
              params: {
                ...(customerId ? { customerId } : {}),
                ...(ownerOnly ? { ownerOnly: '1' } : {}),
              },
            })
          ).data.data ?? []);
      setPoints(data);
    } catch (e) {
      console.error('Harita verileri yüklenemedi', e);
    } finally {
      setYukleniyor(false);
      window.setTimeout(() => mapRef.current?.invalidateSize?.(), 80);
    }
  }, [customerId, ownerOnly, publicFilesOnly]);

  useEffect(() => {
    void fetchFieldMap();
  }, [fetchFieldMap]);

  useEffect(() => {
    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled) return;
      leafletRef.current = L.default ?? L;
      ensureHaritaPinSignalCss();
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      if (!mapRef.current && mapContainerRef.current) {
        const leaflet = leafletRef.current;
        mapRef.current = leaflet.map(mapContainerRef.current).setView([39.15, 35.15], 6.4);
        leaflet
          .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap Katkıda Bulunanları',
          })
          .addTo(mapRef.current);
        setMapReady(true);
        window.setTimeout(() => mapRef.current?.invalidateSize?.(), 80);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el || !mapReady) return;
    const resize = () => mapRef.current?.invalidateSize?.();
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    window.addEventListener('resize', resize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [mapReady]);

  useEffect(() => {
    renderMarkers(filteredPoints);
  }, [filteredPoints, renderMarkers]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!map || !L) return;

    if (!seciliBolge) {
      map.setMinZoom(5);
      const turkey = L.latLngBounds(
        [36.05, 26.15] as [number, number],
        [42.12, 44.85] as [number, number],
      );
      map.setMaxBounds(turkey.pad(0.12));
      map.fitBounds(turkey, { padding: [8, 24], maxZoom: 6.6, animate: true });
      return;
    }

    const box = provinceMapBounds(seciliBolge);
    let bounds = box ? L.latLngBounds(box[0], box[1]) : null;
    if (regionPoints.length > 0) {
      const pinBounds = L.latLngBounds(
        regionPoints.map((p) => [p.latitude, p.longitude] as [number, number]),
      );
      bounds = bounds ? bounds.extend(pinBounds) : pinBounds;
    }
    if (!bounds) return;
    const padded = bounds.pad(0.08);
    map.setMinZoom(7);
    map.setMaxBounds(padded);
    map.fitBounds(padded, { padding: [28, 28], maxZoom: 11, animate: true });
  }, [seciliBolge, regionViewKey, mapReady]);

  useEffect(() => {
    const interval = setInterval(fetchFieldMap, 60_000);
    return () => clearInterval(interval);
  }, [fetchFieldMap]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setRotaBaslangic(today);
    setRotaBitis(today);
  }, []);

  const fetchRota = async () => {
    if (!seciliPersonel) return;
    try {
      const params: Record<string, string> = {};
      if (rotaBaslangic) params.from = new Date(rotaBaslangic).toISOString();
      if (rotaBitis) params.to = new Date(rotaBitis + 'T23:59:59').toISOString();

      const res = await axios.get(`${API}/user-locations/${seciliPersonel}/history`, {
        headers: { Authorization: `Bearer ${token()}` },
        params,
      });
      const noktalar: RotaNoktasi[] = res.data.data?.locations ?? [];
      setRota(noktalar);
      renderRota(noktalar);
    } catch (e) {
      console.error('Rota yüklenemedi', e);
    }
  };

  function renderRota(noktalar: RotaNoktasi[]) {
    const L = leafletRef.current;
    if (!mapRef.current || !L) return;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (noktalar.length < 2) return;

    const coords = noktalar.map((n) => [n.latitude, n.longitude] as [number, number]);
    polylineRef.current = L.polyline(coords, {
      color: '#3B82F6',
      weight: 3,
      opacity: 0.8,
    }).addTo(mapRef.current);

    mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [30, 30] });
  }

  const counts = {
    all: regionPoints.length,
    hasar: regionPoints.filter(isHasarPoint).length,
    acil: regionPoints.filter(isAcilPoint).length,
    kapandi: regionPoints.filter((p) => p.jobStage === 'kapandi').length,
  };

  const seciliPersonelAdi = personelPoints.find((p) => p.id === seciliPersonel)?.name;

  const shellClass = embed
    ? 'flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden'
    : compact
      ? 'flex min-h-0 flex-col gap-3'
      : 'flex h-[calc(100dvh-3.5rem-1rem)] min-h-[360px] flex-col gap-3 overflow-hidden sm:h-[calc(100vh-130px)]';

  const mapHeightClass = embed
    ? 'h-full w-full min-h-[420px]'
    : compact
      ? 'h-[320px] min-h-[240px]'
      : 'h-full w-full min-h-[240px]';

  return (
    <div className={shellClass}>
      {!compact && !embed ? (
        <div className="page-header !mb-0">
          <div className="flex items-center gap-3">
            <div className="page-header-icon">
              <MapPin className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="inline-flex items-center gap-1.5 page-title">
                Harita
                <HintIcon text="İş adresine göre konum. Sahadaki durum işaretlenir." />
              </h2>
            </div>
          </div>
        </div>
      ) : null}

      {showNotice ? (
        <OpsFirstRunNotice
          compact
          noticeId={OPS_NOTICE.haritaDosyaIsAdresi.id}
          title={OPS_NOTICE.haritaDosyaIsAdresi.title}
          body={OPS_NOTICE.haritaDosyaIsAdresi.body}
          testId="harita-dosya-is-adresi-seridi"
        />
      ) : null}

      <div
        className={embed ? 'grid grid-cols-4 gap-2' : 'grid grid-cols-2 gap-2 lg:grid-cols-4'}
        data-testid="harita-ozet-kartlari"
      >
        {FILTER_CARDS.map((card) => (
          <MapKpiCard
            key={card.key}
            label={card.label}
            value={counts[card.key]}
            wrap={card.wrap}
            icon={card.icon}
            active={filter === card.key}
            onClick={() => setFilter(card.key)}
          />
        ))}
      </div>

      <div className="filter-bar !mb-0 !py-2.5">
        <div className="panel-filter-bar">
          <div className="relative min-w-[12rem] flex-[0_0_14rem]">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <select
              aria-label="Bölge seç"
              value={seciliBolge}
              onChange={(e) => {
                const next = e.target.value;
                setSeciliBolge(next);
                if (next) setFilter('all');
              }}
              className="block w-full min-h-[2.5rem] rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-8 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Bölge seç</option>
              {regionOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={fetchFieldMap} className="btn-secondary h-10 justify-center">
            <RefreshCw className="h-4 w-4" aria-hidden />
            Yenile
          </button>
          {showPersonnelRoute ? (
            <button
              type="button"
              onClick={() => setRotaPanel((v) => !v)}
              className={rotaPanel ? 'btn-primary h-10 justify-center' : 'btn-secondary h-10 justify-center'}
            >
              <Route className="h-4 w-4" aria-hidden />
              Rota
            </button>
          ) : null}
          {yukleniyor ? <span className="text-xs text-slate-400">Yükleniyor...</span> : null}
        </div>

        {showPersonnelRoute && rotaPanel ? (
          <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:flex-wrap sm:items-end">
            <MapFilterField label="Personel" icon={User}>
              <select
                aria-label="Personel"
                value={seciliPersonel}
                onChange={(e) => setSeciliPersonel(e.target.value)}
                className="input-base-sm h-10 w-full"
              >
                <option value="">Personel seçin</option>
                {personelPoints.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </MapFilterField>
            <MapFilterField label="Rota başlangıç" icon={Calendar}>
              <TrDateInput
                value={rotaBaslangic}
                onChange={setRotaBaslangic}
                placeholder="Başlangıç"
                aria-label="Rota başlangıç"
                className="input-base-sm h-10 w-full"
              />
            </MapFilterField>
            <MapFilterField label="Rota bitiş" icon={Calendar}>
              <TrDateInput
                value={rotaBitis}
                onChange={setRotaBitis}
                placeholder="Bitiş"
                aria-label="Rota bitiş"
                className="input-base-sm h-10 w-full"
              />
            </MapFilterField>
            <button
              type="button"
              onClick={fetchRota}
              disabled={!seciliPersonel}
              className="btn-primary h-10 justify-center disabled:cursor-default disabled:opacity-50"
            >
              <Route className="h-4 w-4" aria-hidden />
              Rotayı Göster
            </button>
          </div>
        ) : null}
      </div>

      <div
        className={`relative min-h-0 overflow-hidden rounded-xl border border-slate-200 ${
          compact ? '' : 'flex-1'
        }`}
      >
        {seciliBolge ? (
          <div className="pointer-events-none absolute right-3 top-3 z-[400] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{seciliBolge} İl Haritası</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Devam eden ve tamamlanan dosyalar
            </p>
          </div>
        ) : null}
        <div
          ref={mapContainerRef}
          className={compact ? mapHeightClass : 'absolute inset-0 h-full w-full'}
        />
        {!yukleniyor && filteredPoints.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70">
            <div className="mx-3 rounded-lg border border-slate-200 bg-white px-4 py-4 text-center shadow-sm sm:px-6">
              <p className="text-sm font-semibold text-slate-800">Haritada Gösterilecek Konum Yok</p>
              <p className="mt-1 text-xs text-slate-500">
                Seçili bölge veya filtre için il adı ya da iş adresi olan dosya yok. Pin, tedarikçi
                telefonu değil; dosyanın iş yeri veya ilidir.
              </p>
            </div>
          </div>
        )}
      </div>

      {showPersonnelRoute && rota.length > 0 && (
        <div className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 sm:text-[13px]">
          {seciliPersonelAdi ?? 'Personel'} — {rota.length} Konum Noktası Gösteriliyor
          <button
            type="button"
            onClick={() => {
              setRota([]);
              if (polylineRef.current) {
                polylineRef.current.remove();
                polylineRef.current = null;
              }
            }}
            className="ml-2 text-xs text-blue-700 underline sm:ml-3"
          >
            Temizle
          </button>
        </div>
      )}
    </div>
  );
}
