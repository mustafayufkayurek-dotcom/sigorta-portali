'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { InsuranceMapPin, InsurancePinCategory } from './insurance-portal-map.types';
import { pinSlaColor } from '@/utils/insurance-portal-map-utils';
import { escapeHtml } from '@/utils/sanitize-html';

const CATEGORY_ICONS: Record<InsurancePinCategory, string> = {
  residential: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>`,
  industrial: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M5 20V10l4-2v12"/><path d="M9 20V6l5-2.5v16"/><path d="M14 20V4l6-3v19"/><path d="M18 8h.01"/><path d="M18 12h.01"/></svg>`,
  marine: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h18"/><path d="M5 17 8 9h8l3 8"/><path d="M12 9V5"/><path d="M12 5h4l-1 2"/><path d="M2 20c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0"/></svg>`,
  generic: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
};

const DEFAULT_CENTER: [number, number] = [35.0, 39.0];
/** Cadde / sokak görünümü — düz üstten */
const OPEN_PITCH = 0;
const OPEN_BEARING = 0;
const OPEN_ZOOM = 6.4;
const STREET_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
/** Aynı pine her tıklamada bir kademe daha yakın */
const PIN_ZOOM_STEPS = [14.5, 16, 17.2, 18.2, 19];

function buildMarkerHtml(pin: InsuranceMapPin): string {
  const color = pinSlaColor(pin.slaTone, pin.category);
  const icon = CATEGORY_ICONS[pin.category];
  const showcaseRing = pin.isShowcase
    ? 'box-shadow:0 0 0 3px rgba(245,158,11,0.55), 0 2px 8px rgba(0,0,0,0.35);'
    : 'box-shadow:0 2px 8px rgba(0,0,0,0.35);';

  return `
    <div class="relative flex flex-col items-center" data-pin-id="${escapeHtml(pin.id)}">
      <div style="width:36px;height:36px;border-radius:50%;background:${color};border:3px solid white;${showcaseRing}display:flex;align-items:center;justify-content:center;cursor:pointer;">
        ${icon}
      </div>
    </div>`;
}

function buildPopupHtml(pin: InsuranceMapPin, interactive: boolean): string {
  const location = escapeHtml((pin.city ?? 'İl Belirtilmemiş').toLocaleUpperCase('tr-TR'));
  const subject = escapeHtml(pin.claimSubjectName || pin.tooltip || 'Hasar Dosyası');
  const statusColor = pin.slaTone === 'late' ? '#F87171' : pin.slaTone === 'warn' ? '#FBBF24' : '#22C55E';
  const fileId = escapeHtml(pin.fileId ?? '');
  const actions =
    interactive && pin.fileId
      ? `
      <div style="padding:0 16px 14px;display:flex;flex-direction:column;gap:8px;">
        <button type="button" data-live-map-action="summary" data-file-id="${fileId}"
          style="width:100%;background:#2563EB;color:white;border:none;border-radius:8px;padding:9px 12px;font-size:12px;font-weight:600;cursor:pointer;">
          Dosya Özeti
        </button>
        <button type="button" data-live-map-action="message" data-file-id="${fileId}"
          style="width:100%;background:transparent;color:#E2E8F0;border:1px solid rgba(255,255,255,0.18);border-radius:8px;padding:9px 12px;font-size:12px;font-weight:600;cursor:pointer;">
          Mesaj Gönder
        </button>
      </div>`
      : '';

  return `
    <div data-popup-pin-id="${escapeHtml(pin.id)}" style="font-family:system-ui,-apple-system,sans-serif;min-width:240px;max-width:280px;color:#E2E8F0;background:#0B1F3A;border-radius:12px;padding:0;margin:0;">
      <div style="padding:14px 16px 12px;border-bottom:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:10px;font-weight:600;letter-spacing:0.08em;color:#94A3B8;margin-bottom:4px;">${location}</div>
        <div style="font-size:15px;font-weight:700;color:#FFFFFF;line-height:1.3;">${subject}</div>
      </div>
      <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;">
        ${
          pin.fileNumber
            ? `
        <div>
          <div style="font-size:10px;color:#64748B;margin-bottom:2px;">Dosya No</div>
          <div style="font-size:12px;font-weight:600;color:#F1F5F9;">${escapeHtml(pin.fileNumber)}</div>
        </div>`
            : ''
        }
        <div>
          <div style="font-size:10px;color:#64748B;margin-bottom:2px;">Durum</div>
          <div style="font-size:12px;font-weight:600;color:${statusColor};display:flex;align-items:center;gap:4px;">
            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${statusColor};"></span>
            ${escapeHtml(pin.statusName ?? '—')}
          </div>
        </div>
      </div>
      ${actions}
    </div>`;
}

type InsuranceLiveMap3DProps = {
  pins: InsuranceMapPin[];
  loading?: boolean;
  /** Şehir görünümünde false — fitBounds/resize çalışmaz */
  active?: boolean;
  onSelectPin?: (pin: InsuranceMapPin) => void;
  onMessagePin?: (pin: InsuranceMapPin) => void;
};

export default function InsuranceLiveMap3D({
  pins,
  loading,
  active = true,
  onSelectPin,
  onMessagePin,
}: InsuranceLiveMap3DProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const mapReadyRef = useRef(false);
  const pinZoomStepRef = useRef<{ id: string; step: number } | null>(null);
  const pinsByIdRef = useRef<Map<string, InsuranceMapPin>>(new Map());
  const pinsRef = useRef(pins);
  const activeRef = useRef(active);
  const onSelectRef = useRef(onSelectPin);
  const onMessageRef = useRef(onMessagePin);
  const renderMarkersRef = useRef<(data: InsuranceMapPin[]) => void>(() => undefined);
  const [mapFocused, setMapFocused] = useState(false);
  const interactive = Boolean(onSelectPin || onMessagePin);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    onSelectRef.current = onSelectPin;
    onMessageRef.current = onMessagePin;
  }, [onSelectPin, onMessagePin]);

  useEffect(() => {
    pinsRef.current = pins;
    const next = new Map<string, InsuranceMapPin>();
    pins.forEach((pin) => {
      next.set(pin.id, pin);
      if (pin.fileId) next.set(pin.fileId, pin);
    });
    pinsByIdRef.current = next;
  }, [pins]);

  const closePopup = useCallback(() => {
    popupRef.current?.remove();
    popupRef.current = null;
  }, []);

  const fitToPins = useCallback(
    (map: maplibregl.Map, data: InsuranceMapPin[]) => {
      try {
        const canvas = map.getCanvas();
        if (!canvas || canvas.clientWidth < 2 || canvas.clientHeight < 2) return;
        pinZoomStepRef.current = null;

        if (data.length === 0) {
          map.easeTo({
            center: DEFAULT_CENTER,
            zoom: OPEN_ZOOM,
            pitch: OPEN_PITCH,
            bearing: OPEN_BEARING,
            duration: 900,
          });
          return;
        }

        const bounds = new maplibregl.LngLatBounds();
        data.forEach((pin) => bounds.extend([pin.longitude, pin.latitude]));

        const span = Math.max(
          Math.abs(bounds.getNorth() - bounds.getSouth()),
          Math.abs(bounds.getEast() - bounds.getWest()),
        );
        const maxZoom = data.length === 1 ? 16.2 : span < 0.25 ? 15.4 : span < 0.9 ? 13.8 : 11.5;

        map.fitBounds(bounds, {
          padding: { top: 72, bottom: 72, left: 72, right: 72 },
          maxZoom,
          pitch: OPEN_PITCH,
          bearing: OPEN_BEARING,
          duration: 1100,
        });
      } catch {
        // gizli / sıfır boyutlu konteynerde fitBounds sessizce yutulur
      }
    },
    [],
  );

  const zoomToPin = useCallback((map: maplibregl.Map, pin: InsuranceMapPin) => {
    try {
      const prev = pinZoomStepRef.current;
      const step =
        prev?.id === pin.id
          ? Math.min(prev.step + 1, PIN_ZOOM_STEPS.length - 1)
          : 0;
      pinZoomStepRef.current = { id: pin.id, step };
      map.flyTo({
        center: [pin.longitude, pin.latitude],
        zoom: PIN_ZOOM_STEPS[step],
        pitch: OPEN_PITCH,
        bearing: OPEN_BEARING,
        duration: 480,
        essential: true,
      });
    } catch {
      // ignore
    }
  }, []);

  const renderMarkers = useCallback(
    (data: InsuranceMapPin[]) => {
      const map = mapRef.current;
      if (!map || !mapReadyRef.current || !activeRef.current) return;

      try {
        closePopup();
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        data.forEach((pin) => {
          const el = document.createElement('div');
          el.innerHTML = buildMarkerHtml(pin);
          el.style.width = '36px';
          el.style.height = '36px';

          const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([pin.longitude, pin.latitude])
            .addTo(map);

          el.addEventListener('click', (event) => {
            event.stopPropagation();
            closePopup();
            zoomToPin(map, pin);
            onSelectRef.current?.(pin);

            let opened = false;
            const openPopup = () => {
              if (opened) return;
              opened = true;
              map.off('moveend', openPopup);
              const popup = new maplibregl.Popup({
                closeButton: true,
                closeOnClick: true,
                maxWidth: '300px',
                className: 'insurance-live-maplibre-popup',
                offset: 22,
              })
                .setLngLat([pin.longitude, pin.latitude])
                .setHTML(buildPopupHtml(pin, interactive))
                .addTo(map);
              popupRef.current = popup;
            };

            map.once('moveend', openPopup);
            window.setTimeout(openPopup, 720);
          });

          markersRef.current.push(marker);
        });

        fitToPins(map, data);
      } catch {
        // MapLibre unmount / resize yarışında sayfa çökmesin
      }
    },
    [closePopup, fitToPins, interactive, zoomToPin],
  );

  useEffect(() => {
    renderMarkersRef.current = renderMarkers;
  }, [renderMarkers]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    if (!document.getElementById('insurance-live-maplibre-css')) {
      const style = document.createElement('style');
      style.id = 'insurance-live-maplibre-css';
      style.textContent = `
        .insurance-live-maplibre-popup .maplibregl-popup-content {
          background: transparent;
          box-shadow: none;
          padding: 0;
          border-radius: 12px;
        }
        .insurance-live-maplibre-popup .maplibregl-popup-tip {
          border-top-color: #0B1F3A;
          border-bottom-color: #0B1F3A;
        }
        .insurance-live-maplibre-popup .maplibregl-popup-close-button {
          color: #94A3B8;
          font-size: 18px;
          padding: 4px 8px;
          right: 4px;
          top: 4px;
        }
        .maplibregl-ctrl-attrib {
          font-size: 10px;
          opacity: 0.75;
        }
      `;
      document.head.appendChild(style);
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: STREET_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: OPEN_ZOOM,
      pitch: OPEN_PITCH,
      bearing: OPEN_BEARING,
      maxPitch: 0,
      minZoom: 4,
      maxZoom: 19,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-left');
    map.dragRotate.disable();
    map.touchPitch.disable();
    map.scrollZoom.disable();

    const onEnter = () => map.scrollZoom.enable();
    const onLeave = () => map.scrollZoom.disable();
    map.getCanvas().addEventListener('mouseenter', onEnter);
    map.getCanvas().addEventListener('mouseleave', onLeave);

    mapRef.current = map;

    map.on('load', () => {
      mapReadyRef.current = true;
      map.resize();
      renderMarkersRef.current(pinsRef.current);
    });

    return () => {
      mapReadyRef.current = false;
      mapRef.current = null;
      try {
        map.getCanvas().removeEventListener('mouseenter', onEnter);
        map.getCanvas().removeEventListener('mouseleave', onLeave);
      } catch {
        // ignore
      }
      markersRef.current.forEach((m) => {
        try {
          m.remove();
        } catch {
          // ignore
        }
      });
      markersRef.current = [];
      try {
        closePopup();
      } catch {
        // ignore
      }
      // remove’u commit sonrasına bırak — Şehir geçişinde sayfa çökmesin
      window.setTimeout(() => {
        try {
          map.remove();
        } catch {
          // ignore
        }
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once
  }, []);

  useEffect(() => {
    if (!active || !mapReadyRef.current || !mapRef.current) return;
    renderMarkers(pins);
  }, [pins, renderMarkers, active]);

  useEffect(() => {
    if (!active || !mapReadyRef.current || !mapRef.current) return;
    const timer = window.setTimeout(() => {
      try {
        mapRef.current?.resize();
        renderMarkersRef.current(pinsRef.current);
      } catch {
        // ignore
      }
    }, 100);
    return () => window.clearTimeout(timer);
  }, [active]);

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
      closePopup();

      if (action === 'message') onMessageRef.current?.(pin);
      else onSelectRef.current?.(pin);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [interactive, closePopup]);

  return (
    <div
      className="relative h-full min-h-[640px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
      onMouseEnter={() => setMapFocused(true)}
      onMouseLeave={() => setMapFocused(false)}
    >
      <div ref={mapContainerRef} className="h-full min-h-[640px] w-full cursor-grab active:cursor-grabbing" />
      <div
        className={`pointer-events-none absolute bottom-3 left-3 z-[5] rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur-sm transition-opacity duration-300 ${
          mapFocused ? 'opacity-100' : 'opacity-0'
        }`}
      >
        Sürükleyerek Gezinin · Yakınlaştırmak İçin Kaydırın
      </div>
      {loading && (
        <div className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center bg-white/60">
          <p className="text-sm font-medium text-slate-600">Harita Yükleniyor...</p>
        </div>
      )}
      {!loading && pins.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center bg-white/70">
          <div className="rounded-lg border border-slate-200 bg-white px-6 py-4 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Haritada Gösterilecek Dosya Yok</p>
            <p className="mt-1 text-xs text-slate-500">
              Kapsamınızdaki dosyalar için il bilgisi eklendiğinde burada görünecek.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
