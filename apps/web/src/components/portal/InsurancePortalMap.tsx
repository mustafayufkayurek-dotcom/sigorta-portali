'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { InsuranceMapPin } from './insurance-portal-map.types';
import { CLOSED_CLAIM_STATUS_CODES } from '@sigorta/shared';
import { buildPanelFileMarkerHtml, ensureHaritaPinSignalCss, escHaritaHtml } from '@/utils/harita-pin-signal';

const POPUP_OPTIONS = {
  maxWidth: 300,
  className: 'insurance-live-map-popup',
  closeButton: true,
  autoPan: true,
  autoPanPadding: [48, 48] as [number, number],
  keepInView: true,
};

export type InsuranceMapBasemap = 'street' | 'satellite' | 'hybrid';

type BasemapConfig = {
  url: string;
  attribution: string;
  maxZoom: number;
  maxNativeZoom?: number;
  subdomains?: string;
  /** Uydu üzerine cadde / yer adı katmanı */
  overlays?: string[];
};

const BASEMAP_LAYERS: Record<InsuranceMapBasemap, BasemapConfig> = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap Katkıda Bulunanları',
    maxZoom: 19,
    maxNativeZoom: 19,
    subdomains: 'abc',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Uydu Görüntüsü',
    maxZoom: 19,
    maxNativeZoom: 19,
  },
  // İstenen görünüm: yüksek çözünürlüklü uydu + üzerinde canlı cadde / yer adları
  hybrid: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Uydu + Cadde Görünümü',
    maxZoom: 19,
    maxNativeZoom: 19,
    overlays: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    ],
  },
};

function isOpenInsurancePin(pin: InsuranceMapPin): boolean {
  if (pin.isShowcase) return false;
  const code = String(pin.statusCode ?? '').toLowerCase();
  return !(CLOSED_CLAIM_STATUS_CODES as readonly string[]).includes(code);
}

function insuranceFileColor(pin: InsuranceMapPin): string {
  if (pin.isShowcase || !isOpenInsurancePin(pin)) return '#64748B';
  if (pin.department === 'acil') return '#EA580C';
  return '#2563EB';
}

function buildMarkerHtml(pin: InsuranceMapPin): string {
  return buildPanelFileMarkerHtml({
    letter: pin.department === 'acil' ? 'A' : 'H',
    color: insuranceFileColor(pin),
    label: pin.fileNumber || pin.label,
    stage: pin.statusName,
    signal: isOpenInsurancePin(pin),
  });
}

function buildPopupHtml(pin: InsuranceMapPin, interactive: boolean): string {
  const fileNo = escHaritaHtml(pin.fileNumber || pin.label || '—');
  const subject = escHaritaHtml(pin.claimSubjectName || pin.tooltip || 'Hasar Dosyası');
  const status = escHaritaHtml(pin.statusName ?? '—');
  const city = escHaritaHtml(pin.city ?? 'İl Belirtilmemiş');
  const fileId = escHaritaHtml(pin.fileId ?? '');
  const actions =
    interactive && pin.fileId
      ? `
      <hr class="my-2 border-slate-100">
      <button type="button" data-live-map-action="summary" data-file-id="${fileId}"
        class="mt-1 inline-block text-brand-600 underline">Dosya Özeti</button>
      <button type="button" data-live-map-action="message" data-file-id="${fileId}"
        class="mt-1 ml-3 inline-block text-brand-600 underline">Mesaj Gönder</button>`
      : '';

  return `
    <div class="font-sans text-[13px] text-slate-800" data-popup-pin-id="${escHaritaHtml(pin.id)}">
      <strong>${fileNo}</strong>
      <div class="mt-1 text-slate-500">${subject}</div>
      <hr class="my-2 border-slate-100">
      <div>Konum: İş adresi</div>
      <div>Durum: ${status}</div>
      <div>Bölge: ${city}</div>
      ${actions}
    </div>`;
}

type InsurancePortalMapProps = {
  pins: InsuranceMapPin[];
  loading?: boolean;
  defaultBasemap?: InsuranceMapBasemap;
  showBasemapToggle?: boolean;
  /** Serbest sürükleme + odaklanınca tekerlek zoom */
  immersive?: boolean;
  onSelectPin?: (pin: InsuranceMapPin) => void;
  onMessagePin?: (pin: InsuranceMapPin) => void;
};

export default function InsurancePortalMap({
  pins,
  loading,
  defaultBasemap = 'street',
  showBasemapToggle = false,
  immersive = false,
  onSelectPin,
  onMessagePin,
}: InsurancePortalMapProps) {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);
  const leafletRef = useRef<any>(null);
  const baseLayerRef = useRef<any>(null);
  const overlayLayersRef = useRef<any[]>([]);
  const wheelCleanupRef = useRef<(() => void) | null>(null);
  const mapReadyRef = useRef(false);
  const pinsByIdRef = useRef<Map<string, InsuranceMapPin>>(new Map());
  const onSelectRef = useRef(onSelectPin);
  const onMessageRef = useRef(onMessagePin);
  const [mapFocused, setMapFocused] = useState(false);
  const [basemap, setBasemap] = useState<InsuranceMapBasemap>(defaultBasemap);
  const interactive = Boolean(onSelectPin || onMessagePin);

  useEffect(() => {
    setBasemap(defaultBasemap);
  }, [defaultBasemap]);

  const applyBasemap = useCallback((mode: InsuranceMapBasemap) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    const cfg = BASEMAP_LAYERS[mode];
    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
      baseLayerRef.current = null;
    }
    overlayLayersRef.current.forEach((layer) => {
      map.removeLayer(layer);
    });
    overlayLayersRef.current = [];

    baseLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      maxNativeZoom: cfg.maxNativeZoom ?? cfg.maxZoom,
      ...(cfg.subdomains ? { subdomains: cfg.subdomains } : {}),
    }).addTo(map);

    (cfg.overlays ?? []).forEach((overlayUrl) => {
      const overlay = L.tileLayer(overlayUrl, {
        maxZoom: cfg.maxZoom,
        maxNativeZoom: cfg.maxNativeZoom ?? cfg.maxZoom,
        opacity: 0.95,
      }).addTo(map);
      overlayLayersRef.current.push(overlay);
    });

    mapContainerRef.current?.classList.toggle(
      'insurance-live-map-satellite',
      mode === 'satellite' || mode === 'hybrid',
    );
  }, []);

  useEffect(() => {
    onSelectRef.current = onSelectPin;
    onMessageRef.current = onMessagePin;
  }, [onSelectPin, onMessagePin]);

  useEffect(() => {
    pinsByIdRef.current = new Map(
      pins.flatMap((p) => {
        const entries: Array<[string, InsuranceMapPin]> = [[p.id, p]];
        if (p.fileId) entries.push([p.fileId, p]);
        return entries;
      }),
    );
  }, [pins]);

  const closeMapPopup = useCallback(() => {
    mapRef.current?.closePopup();
  }, []);

  const attachScrollWheelGuard = useCallback((map: any) => {
    wheelCleanupRef.current?.();
    const container = map.getContainer() as HTMLElement;

    if (immersive) {
      // Sürükleyici görünüm: harita üzerindeyken tekerlek zoom açık
      map.scrollWheelZoom.disable();
      const onEnter = () => map.scrollWheelZoom.enable();
      const onLeave = () => map.scrollWheelZoom.disable();
      container.addEventListener('mouseenter', onEnter);
      container.addEventListener('mouseleave', onLeave);
      wheelCleanupRef.current = () => {
        container.removeEventListener('mouseenter', onEnter);
        container.removeEventListener('mouseleave', onLeave);
        map.scrollWheelZoom.disable();
      };
      return;
    }

    map.scrollWheelZoom.disable();
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        map.scrollWheelZoom.enable();
        window.setTimeout(() => map.scrollWheelZoom.disable(), 150);
      }
    };
    container.addEventListener('wheel', onWheel, { passive: true });
    wheelCleanupRef.current = () => container.removeEventListener('wheel', onWheel);
  }, [immersive]);

  const renderMarkers = useCallback((data: InsuranceMapPin[]) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!map || !L) return;

    closeMapPopup();
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    data.forEach((pin) => {
      const icon = L.divIcon({
        className: '',
        html: buildMarkerHtml(pin),
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const popup = L.popup(POPUP_OPTIONS).setContent(buildPopupHtml(pin, interactive));
      const marker = L.marker([pin.latitude, pin.longitude], { icon })
        .bindPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });

    if (data.length > 0) {
      const bounds = L.latLngBounds(data.map((p) => [p.latitude, p.longitude]));
      // Az pin / yakın pinlerde cadde seviyesine yaklaş (sokaklar okunaklı olsun)
      const span = Math.max(
        Math.abs(bounds.getNorth() - bounds.getSouth()),
        Math.abs(bounds.getEast() - bounds.getWest()),
      );
      const streetMaxZoom =
        data.length === 1 ? 16 : span < 0.35 ? 15 : span < 1.2 ? 13 : immersive ? 11 : 8;
      const hybridLike = basemap === 'satellite' || basemap === 'hybrid';
      map.fitBounds(bounds, {
        padding: [56, 56],
        maxZoom: hybridLike ? Math.max(streetMaxZoom, 14) : streetMaxZoom,
      });
    } else {
      map.setView([39.0, 35.0], immersive ? 6.5 : 6);
    }
  }, [basemap, closeMapPopup, immersive, interactive]);

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

      if (!document.getElementById('insurance-live-map-css')) {
        const style = document.createElement('style');
        style.id = 'insurance-live-map-css';
        style.textContent = `
          .insurance-live-map-popup .leaflet-popup-content-wrapper {
            background: #fff;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
            padding: 10px 12px;
            border-radius: 10px;
          }
          .insurance-live-map-popup .leaflet-popup-content {
            margin: 0;
          }
          .insurance-live-map-popup .leaflet-popup-tip {
            background: #fff;
          }
          .insurance-live-map-popup .leaflet-popup-close-button {
            color: #64748B !important;
            top: 6px !important;
            right: 8px !important;
          }
          .leaflet-container.insurance-live-map-satellite {
            background: #0b1f3a;
          }
        `;
        document.head.appendChild(style);
      }

      if (!mapRef.current && mapContainerRef.current) {
        const leaflet = leafletRef.current;
        mapRef.current = leaflet
          .map(mapContainerRef.current, {
            scrollWheelZoom: false,
            zoomControl: true,
            dragging: true,
            inertia: true,
            worldCopyJump: true,
            maxZoom: 20,
          })
          .setView([39.0, 35.0], immersive ? 6.5 : 6);
        attachScrollWheelGuard(mapRef.current);
        applyBasemap(defaultBasemap);
        mapReadyRef.current = true;
        renderMarkers(pins);
        requestAnimationFrame(() => {
          mapRef.current?.invalidateSize({ animate: false });
        });
      }
    });

    return () => {
      cancelled = true;
      wheelCleanupRef.current?.();
      wheelCleanupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once
  }, [attachScrollWheelGuard, applyBasemap]);

  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current) return;
    applyBasemap(basemap);
  }, [basemap, applyBasemap]);

  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current) return;
    renderMarkers(pins);
  }, [pins, renderMarkers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      mapRef.current?.invalidateSize({ animate: false });
    }, 200);
    return () => clearTimeout(timer);
  }, [pins.length]);

  // Popup butonları — Operasyon Ağı ile aynı capture + Text node çözümü
  useEffect(() => {
    if (!interactive) return;

    const resolveEl = (target: EventTarget | null): Element | null => {
      if (!target) return null;
      if (target instanceof Element) return target;
      if (target instanceof Node) return target.parentElement;
      return null;
    };

    const onClick = (event: Event) => {
      const el = resolveEl(event.target);
      const btn = el?.closest?.('[data-live-map-action]') as HTMLElement | null;
      if (!btn) return;
      const fileId = btn.getAttribute('data-file-id');
      const action = btn.getAttribute('data-live-map-action');
      if (!fileId || !action) return;
      const pin = pinsByIdRef.current.get(fileId);
      if (!pin) return;

      event.preventDefault();
      event.stopPropagation();
      closeMapPopup();

      if (action === 'message') onMessageRef.current?.(pin);
      else onSelectRef.current?.(pin);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [interactive, closeMapPopup]);

  return (
    <div
      className={`relative h-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${
        immersive ? 'min-h-[640px]' : 'min-h-[420px]'
      }`}
      onMouseEnter={() => setMapFocused(true)}
      onMouseLeave={() => setMapFocused(false)}
    >
      <div
        ref={mapContainerRef}
        className={`h-full w-full ${immersive ? 'min-h-[640px]' : 'min-h-[420px]'} cursor-grab active:cursor-grabbing`}
      />
      {showBasemapToggle && (
        <div className="absolute right-3 top-3 z-[500] inline-flex rounded-xl border border-slate-200/80 bg-white/95 p-0.5 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setBasemap('hybrid')}
            className={`h-8 rounded-lg px-2.5 text-[11px] font-semibold ${
              basemap === 'hybrid' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Uydu + Cadde
          </button>
          <button
            type="button"
            onClick={() => setBasemap('street')}
            className={`h-8 rounded-lg px-2.5 text-[11px] font-semibold ${
              basemap === 'street' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Cadde
          </button>
        </div>
      )}
      <div
        className={`pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur-sm transition-opacity duration-300 ${
          mapFocused ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {immersive
          ? 'Sürükleyerek Gezinin · Yakınlaştırmak İçin Kaydırın'
          : 'Yakınlaştırmak İçin Ctrl veya ⌘ + Kaydır · Sürükleyerek Gezinin'}
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
