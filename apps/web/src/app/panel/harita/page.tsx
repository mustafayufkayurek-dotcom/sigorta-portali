'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { TrDateInput } from '@/components/ui/TrDateInput';
import { getAccessToken } from '@/utils/auth-session';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

type ActorType = 'personel' | 'vendor_hasar' | 'vendor_acil';
type FilterTab = 'all' | 'personel' | 'vendor_hasar' | 'vendor_acil';

interface FieldMapPoint {
  actorType: ActorType;
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  timestamp?: string;
  locationKind: 'live' | 'registered';
  activeJob?: { label: string; fileNo?: string; href?: string };
}

interface RotaNoktasi {
  latitude: number;
  longitude: number;
  timestamp: string;
}

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'personel', label: 'Personel' },
  { key: 'vendor_hasar', label: 'Onarım' },
  { key: 'vendor_acil', label: 'Acil' },
];

const ACTOR_LABEL: Record<ActorType, string> = {
  personel: 'Personel',
  vendor_hasar: 'Onarım Tedarikçisi',
  vendor_acil: 'Acil Tedarikçisi',
};

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

function buildMarkerHtml(point: FieldMapPoint): string {
  const label = point.name;

  if (point.actorType === 'personel') {
    const color = COLOR_MAP[markerColor(point.timestamp)];
    const initials = personelInitials(point.name);
    return `
      <div class="relative flex flex-col items-center">
        <div style="width:36px;height:36px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:12px;">${initials}</div>
        <div class="mt-1 whitespace-nowrap rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-900 shadow">${label}</div>
      </div>`;
  }

  if (point.actorType === 'vendor_hasar') {
    return `
      <div class="relative flex flex-col items-center">
        <div style="width:36px;height:36px;border-radius:50%;background:#2563EB;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;">H</div>
        <div class="mt-1 whitespace-nowrap rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-900 shadow">${label}</div>
      </div>`;
  }

  return `
    <div class="relative flex flex-col items-center">
      <div style="width:36px;height:36px;border-radius:50%;background:#EA580C;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;">A</div>
      <div class="mt-1 whitespace-nowrap rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-900 shadow">${label}</div>
    </div>`;
}

function buildPopupHtml(point: FieldMapPoint): string {
  const locationKindLabel = point.locationKind === 'live' ? 'Canlı' : 'Kayıtlı Konum';
  const jobLabel =
    point.activeJob?.label && APPOINTMENT_TYPE[point.activeJob.label]
      ? APPOINTMENT_TYPE[point.activeJob.label]
      : point.activeJob?.label;

  return `
    <div class="font-sans text-[13px] text-slate-800">
      <strong>${point.name}</strong>
      <div class="mt-1 text-slate-500">${ACTOR_LABEL[point.actorType]}</div>
      <hr class="my-2 border-slate-100">
      <div>Konum Türü: ${locationKindLabel}</div>
      <div>Son Güncelleme: ${formatRelative(point.timestamp)}</div>
      ${
        point.activeJob?.fileNo
          ? `<hr class="my-2 border-slate-100">
             <div>Aktif Dosya No: ${point.activeJob.fileNo}</div>
             ${jobLabel ? `<div class="text-slate-500">${jobLabel}</div>` : ''}
             ${
               point.activeJob.href
                 ? `<a href="${point.activeJob.href}" class="mt-1 inline-block text-brand-600 underline">Dosyaya Git</a>`
                 : ''
             }`
          : ''
      }
    </div>`;
}

export default function HaritaPage() {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  const [points, setPoints] = useState<FieldMapPoint[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [seciliPersonel, setSeciliPersonel] = useState('');
  const [rotaBaslangic, setRotaBaslangic] = useState('');
  const [rotaBitis, setRotaBitis] = useState('');
  const [rota, setRota] = useState<RotaNoktasi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const token = () => getAccessToken() ?? '';

  const filteredPoints = points.filter((p) => {
    if (filter === 'all') return true;
    return p.actorType === filter;
  });

  const personelPoints = points.filter((p) => p.actorType === 'personel');

  const renderMarkers = useCallback((data: FieldMapPoint[]) => {
    const L = leafletRef.current;
    if (!mapRef.current || !L) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    data.forEach((point) => {
      const icon = L.divIcon({
        className: '',
        html: buildMarkerHtml(point),
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const popup = L.popup({ maxWidth: 280 }).setContent(buildPopupHtml(point));
      const marker = L.marker([point.latitude, point.longitude], { icon })
        .bindPopup(popup)
        .addTo(mapRef.current);
      markersRef.current.push(marker);
    });
  }, []);

  const fetchFieldMap = useCallback(async () => {
    setYukleniyor(true);
    try {
      const res = await axios.get(`${API}/user-locations/field-map`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data: FieldMapPoint[] = res.data.data ?? [];
      setPoints(data);
    } catch (e) {
      console.error('Harita verileri yüklenemedi', e);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    import('leaflet').then((L) => {
      leafletRef.current = L.default ?? L;
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      if (!mapRef.current && mapContainerRef.current) {
        const leaflet = leafletRef.current;
        mapRef.current = leaflet.map(mapContainerRef.current).setView([39.0, 35.0], 6);
        leaflet
          .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap Katkıda Bulunanları',
          })
          .addTo(mapRef.current);
        fetchFieldMap();
      }
    });
  }, [fetchFieldMap]);

  useEffect(() => {
    renderMarkers(filteredPoints);
  }, [filteredPoints, renderMarkers]);

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

  const activePersonelCount = personelPoints.filter(
    (p) => markerColor(p.timestamp) === 'green',
  ).length;

  const counts = {
    personel: points.filter((p) => p.actorType === 'personel').length,
    vendor_hasar: points.filter((p) => p.actorType === 'vendor_hasar').length,
    vendor_acil: points.filter((p) => p.actorType === 'vendor_acil').length,
  };

  const seciliPersonelAdi = personelPoints.find((p) => p.id === seciliPersonel)?.name;

  return (
    <div className="flex h-[calc(100dvh-3.5rem-1rem)] min-h-[360px] flex-col gap-3 overflow-hidden sm:h-[calc(100vh-130px)]">
      <div className="min-w-0 shrink-0 space-y-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        {/* Filtre sekmeleri — mobil: 2 sütun grid */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`rounded-full px-3 py-2 text-xs font-medium transition sm:py-1 sm:text-sm ${
                filter === tab.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
              {tab.key !== 'all' && (
                <span className="ml-1 opacity-70">
                  ({counts[tab.key as keyof typeof counts] ?? 0})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Personel rota — mobil: dikey stack */}
        <div className="space-y-2 border-t border-slate-100 pt-3 sm:flex sm:flex-wrap sm:items-end sm:gap-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
          <p className="text-xs font-semibold text-slate-800 sm:sr-only">Personel Rota</p>
          <span className="hidden text-sm font-semibold text-slate-900 sm:inline">Personel Rota:</span>
          <select
            value={seciliPersonel}
            onChange={(e) => setSeciliPersonel(e.target.value)}
            className="input-base-sm w-full min-w-0 sm:w-auto sm:min-w-[10rem]"
          >
            <option value="">Personel Seç</option>
            {personelPoints.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
            <TrDateInput
              value={rotaBaslangic}
              onChange={setRotaBaslangic}
              className="input-base-sm w-full min-w-0 sm:w-[7.5rem]"
            />
            <TrDateInput
              value={rotaBitis}
              onChange={setRotaBitis}
              className="input-base-sm w-full min-w-0 sm:w-[7.5rem]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
            <button
              type="button"
              onClick={fetchRota}
              disabled={!seciliPersonel}
              className={`rounded-lg px-3 py-2.5 text-xs font-semibold text-white sm:py-1.5 sm:text-[13px] ${
                seciliPersonel ? 'bg-brand-600 hover:bg-brand-700' : 'cursor-default bg-slate-300'
              }`}
            >
              Rotayı Göster
            </button>
            <button
              type="button"
              onClick={fetchFieldMap}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-100 sm:py-1.5 sm:text-[13px]"
            >
              Yenile
            </button>
          </div>
        </div>

        {/* Lejant */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-600 sm:text-xs">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-status-success" />
            Personel Aktif · {activePersonelCount}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" />
            Onarım · {counts.vendor_hasar}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-orange-600" />
            Acil · {counts.vendor_acil}
          </span>
          {yukleniyor && <span className="text-slate-400">Yükleniyor...</span>}
        </div>
      </div>

      <div className="relative min-h-[240px] flex-1 overflow-hidden rounded-xl border border-slate-200">
        <div ref={mapContainerRef} className="h-full w-full min-h-[240px]" />
        {!yukleniyor && filteredPoints.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70">
            <div className="mx-3 rounded-lg border border-slate-200 bg-white px-4 py-4 text-center shadow-sm sm:px-6">
              <p className="text-sm font-semibold text-slate-800">Haritada Gösterilecek Konum Yok</p>
              <p className="mt-1 text-xs text-slate-500">
                Seçili filtre için aktif personel veya tedarikçi bulunamadı.
              </p>
            </div>
          </div>
        )}
      </div>

      {rota.length > 0 && (
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
