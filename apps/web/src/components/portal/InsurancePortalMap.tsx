'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { InsuranceMapPin, InsurancePinCategory } from './insurance-portal-map.types';
import { pinCategoryColor } from '@/utils/insurance-portal-map-utils';

const CATEGORY_ICONS: Record<InsurancePinCategory, string> = {
  residential: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>`,
  industrial: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M5 20V10l4-2v12"/><path d="M9 20V6l5-2.5v16"/><path d="M14 20V4l6-3v19"/><path d="M18 8h.01"/><path d="M18 12h.01"/></svg>`,
  marine: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h18"/><path d="M4 14c2-3 4-4 8-4s6 1 8 4"/><path d="M6 14l-2-4h16l-2 4"/><path d="M12 6V3"/><path d="M8 8l4-3 4 3"/></svg>`,
  generic: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="3"/></svg>`,
};

function buildMarkerHtml(pin: InsuranceMapPin): string {
  const color = pinCategoryColor(pin.category);
  const icon = CATEGORY_ICONS[pin.category];
  const showcaseRing = pin.isShowcase
    ? 'box-shadow:0 0 0 3px rgba(245,158,11,0.55), 0 2px 8px rgba(0,0,0,0.25);'
    : 'box-shadow:0 2px 8px rgba(0,0,0,0.25);';

  return `
    <div class="relative flex flex-col items-center group/pin">
      <div style="width:38px;height:38px;border-radius:50%;background:${color};border:3px solid white;${showcaseRing}display:flex;align-items:center;justify-content:center;">
        ${icon}
      </div>
      <div class="mt-1 max-w-[120px] truncate rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-900 shadow pointer-events-none">
        ${pin.tooltip}
      </div>
    </div>`;
}

function buildPopupHtml(pin: InsuranceMapPin): string {
  const typeLabel = pin.isShowcase ? 'Vitrin Noktası' : 'Gerçek Dosya';
  return `
    <div class="font-sans text-[13px] text-slate-800 min-w-[180px]">
      <strong>${pin.tooltip}</strong>
      <div class="mt-1 text-slate-500">${typeLabel}</div>
      ${pin.fileNumber ? `<div class="mt-2">Dosya No: <span class="font-semibold">${pin.fileNumber}</span></div>` : ''}
      ${pin.city ? `<div class="text-slate-500">${pin.city}</div>` : ''}
      ${pin.statusName ? `<div class="mt-1 text-xs text-slate-500">Durum: ${pin.statusName}</div>` : ''}
      ${pin.fileId ? `<a href="/panel/sigorta-portal/dosyalar" class="mt-2 inline-block text-blue-600 underline text-xs">Dosyalara Git</a>` : ''}
    </div>`;
}

type InsurancePortalMapProps = {
  pins: InsuranceMapPin[];
  loading?: boolean;
};

export default function InsurancePortalMap({ pins, loading }: InsurancePortalMapProps) {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);
  const leafletRef = useRef<any>(null);
  const wheelCleanupRef = useRef<(() => void) | null>(null);
  const [mapFocused, setMapFocused] = useState(false);

  const attachScrollWheelGuard = useCallback((map: any) => {
    wheelCleanupRef.current?.();
    map.scrollWheelZoom.disable();

    const container = map.getContainer() as HTMLElement;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        map.scrollWheelZoom.enable();
        window.setTimeout(() => map.scrollWheelZoom.disable(), 150);
        return;
      }
      // Harita üzerinde normal kaydırma sayfayı hareket ettirsin; zoom tetiklenmesin.
    };

    container.addEventListener('wheel', onWheel, { passive: true });
    wheelCleanupRef.current = () => container.removeEventListener('wheel', onWheel);
  }, []);

  const renderMarkers = useCallback((data: InsuranceMapPin[]) => {
    const L = leafletRef.current;
    if (!mapRef.current || !L) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    data.forEach((pin) => {
      const icon = L.divIcon({
        className: '',
        html: buildMarkerHtml(pin),
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const popup = L.popup({ maxWidth: 280 }).setContent(buildPopupHtml(pin));
      const marker = L.marker([pin.latitude, pin.longitude], { icon })
        .bindPopup(popup)
        .addTo(mapRef.current);
      markersRef.current.push(marker);
    });

    if (data.length > 0) {
      const bounds = L.latLngBounds(data.map((p) => [p.latitude, p.longitude]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 7 });
    } else {
      mapRef.current.setView([39.0, 35.0], 6);
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
        mapRef.current = leaflet.map(mapContainerRef.current, {
          scrollWheelZoom: false,
          zoomControl: true,
        }).setView([39.0, 35.0], 6);
        attachScrollWheelGuard(mapRef.current);
        leaflet
          .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap Katkıda Bulunanları',
          })
          .addTo(mapRef.current);
      }
      renderMarkers(pins);
    });

    return () => {
      wheelCleanupRef.current?.();
      wheelCleanupRef.current = null;
    };
  }, [pins, renderMarkers, attachScrollWheelGuard]);

  useEffect(() => {
    renderMarkers(pins);
  }, [pins, renderMarkers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [pins.length]);

  return (
    <div
      className="relative min-h-[420px] h-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
      onMouseEnter={() => setMapFocused(true)}
      onMouseLeave={() => setMapFocused(false)}
    >
      <div ref={mapContainerRef} className="h-full w-full min-h-[420px]" />
      <div
        className={`pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur-sm transition-opacity duration-300 ${
          mapFocused ? 'opacity-100' : 'opacity-0'
        }`}
      >
        Yakınlaştırmak İçin Ctrl veya ⌘ + Kaydır · Sürükleyerek Gezinin
      </div>
      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60">
          <p className="text-sm font-medium text-slate-600">Harita Yükleniyor...</p>
        </div>
      )}
      {!loading && pins.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70">
          <div className="rounded-lg border border-slate-200 bg-white px-6 py-4 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Haritada Gösterilecek Dosya Yok</p>
            <p className="mt-1 text-xs text-slate-500">Kapsamınızdaki dosyalar için il bilgisi eklendiğinde burada görünecek.</p>
          </div>
        </div>
      )}
    </div>
  );
}
