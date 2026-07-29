'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Phone, ShieldCheck, X } from 'lucide-react';
import {
  REFERENCE_CATEGORY_META,
  type ReferenceMapPin,
  type ReferenceOperationCategory,
} from '@/components/portal/operation-reference.types';
import { referenceCategoryColor } from '@/utils/operation-reference-utils';

const DETAIL_CONTACT_PHONE_DISPLAY = '0 532 133 4144';
const DETAIL_CONTACT_PHONE_TEL = '+905321334144';

const CATEGORY_ICONS: Record<ReferenceOperationCategory, string> = {
  residential: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>`,
  industrial: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M5 20V10l4-2v12"/><path d="M9 20V6l5-2.5v16"/><path d="M14 20V4l6-3v19"/></svg>`,
  public_critical: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M6 21V7l6-4 6 4v14"/><path d="M10 21v-6h4v6"/></svg>`,
  maritime: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h18"/><path d="M4 14c2-3 4-4 8-4s6 1 8 4"/><path d="M6 14l-2-4h16l-2 4"/></svg>`,
  disaster: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.5 1-2.5 2.5-2.5S16 10.5 16 12a2.5 2.5 0 002.5 2.5"/><path d="M12 2c1 3 3 5 3 8a3 3 0 01-6 0c0-3 2-5 3-8z"/></svg>`,
  social: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
};

const POPUP_OPTIONS = {
  maxWidth: 300,
  className: 'operation-reference-popup',
  closeButton: true,
  autoPan: true,
  autoPanPadding: [48, 48] as [number, number],
  keepInView: true,
};

function buildMarkerHtml(pin: ReferenceMapPin): string {
  const color = referenceCategoryColor(pin.category);
  const icon = CATEGORY_ICONS[pin.category];
  return `
    <div class="relative flex flex-col items-center" data-pin-id="${pin.id}">
      <div style="width:36px;height:36px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;">
        ${icon}
      </div>
    </div>`;
}

function buildPopupHtml(pin: ReferenceMapPin): string {
  const location = pin.district
    ? `${pin.city.toLocaleUpperCase('tr-TR')} / ${pin.district}`
    : pin.city.toLocaleUpperCase('tr-TR');
  const statusColor = pin.statusTone === 'success' ? '#22C55E' : '#94A3B8';

  return `
    <div data-popup-pin-id="${pin.id}" style="font-family:system-ui,-apple-system,sans-serif;min-width:240px;max-width:280px;color:#E2E8F0;background:#0B1F3A;border-radius:12px;padding:0;margin:-1px;">
      <div style="padding:14px 16px 12px;border-bottom:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:10px;font-weight:600;letter-spacing:0.08em;color:#94A3B8;margin-bottom:4px;">${location}</div>
        <div style="font-size:15px;font-weight:700;color:#FFFFFF;line-height:1.3;">${pin.institutionDisplay}</div>
      </div>
      <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;">
        <div>
          <div style="font-size:10px;color:#64748B;margin-bottom:2px;">Operasyon</div>
          <div style="font-size:12px;font-weight:500;color:#F1F5F9;">${pin.operationType}</div>
        </div>
        <div>
          <div style="font-size:10px;color:#64748B;margin-bottom:2px;">Kategori</div>
          <div style="font-size:12px;font-weight:500;color:#F1F5F9;">${pin.categoryLabel}</div>
        </div>
        <div style="display:flex;gap:16px;">
          <div>
            <div style="font-size:10px;color:#64748B;margin-bottom:2px;">Tarih</div>
            <div style="font-size:12px;font-weight:500;color:#F1F5F9;">${pin.dateLabel}</div>
          </div>
          <div>
            <div style="font-size:10px;color:#64748B;margin-bottom:2px;">Durum</div>
            <div style="font-size:12px;font-weight:600;color:${statusColor};display:flex;align-items:center;gap:4px;">
              <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${statusColor};"></span>
              ${pin.status}
            </div>
          </div>
        </div>
      </div>
      <div style="padding:0 16px 14px;">
        <button type="button" data-action="reference-detail" style="width:100%;background:#2563EB;color:white;border:none;border-radius:8px;padding:9px 12px;font-size:12px;font-weight:600;cursor:pointer;">
          Detayları Gör →
        </button>
      </div>
    </div>`;
}

type OperationReferenceMapProps = {
  pins: ReferenceMapPin[];
  loading?: boolean;
  focusPinId?: string | null;
  /** Aynı ID yeniden seçildiğinde odak/popup'ı tekrar tetikler */
  focusToken?: number;
};

export default function OperationReferenceMap({
  pins,
  loading,
  focusPinId,
  focusToken = 0,
}: OperationReferenceMapProps) {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const leafletRef = useRef<any>(null);
  const wheelCleanupRef = useRef<(() => void) | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const pendingFocusIdRef = useRef<string | null>(null);
  const focusMoveHandlerRef = useRef<(() => void) | null>(null);
  const mapReadyRef = useRef(false);
  const [mapFocused, setMapFocused] = useState(false);
  const [detailNoticeOpen, setDetailNoticeOpen] = useState(false);

  const closeMapPopup = useCallback(() => {
    mapRef.current?.closePopup();
  }, []);

  const detachFocusMoveHandler = useCallback(() => {
    const map = mapRef.current;
    const handler = focusMoveHandlerRef.current;
    if (map && handler) {
      map.off('moveend', handler);
      map.off('zoomend', handler);
    }
    focusMoveHandlerRef.current = null;
  }, []);

  const focusPinById = useCallback(
    (pinId: string) => {
      const map = mapRef.current;
      const marker = markersRef.current.get(pinId);
      if (!map || !marker) return;

      detachFocusMoveHandler();
      pendingFocusIdRef.current = pinId;

      // Önceki animasyonu kes; stop sırasında gelebilecek moveend'i yok say
      map.stop();
      closeMapPopup();

      const target = marker.getLatLng();
      const targetZoom = Math.max(map.getZoom(), 8);

      const openSelected = () => {
        if (pendingFocusIdRef.current !== pinId) return;
        const current = markersRef.current.get(pinId);
        if (!current || !mapRef.current) return;
        mapRef.current.closePopup();
        current.openPopup();
      };

      const center = map.getCenter();
      const distanceM =
        typeof center.distanceTo === 'function' ? center.distanceTo(target) : Number.POSITIVE_INFINITY;
      const sameSpot = distanceM < 25 && Math.abs(map.getZoom() - targetZoom) < 0.05;

      if (sameSpot) {
        openSelected();
        return;
      }

      // stop()/önceki animasyon event'leri geçsin, sonra settle dinle
      requestAnimationFrame(() => {
        if (pendingFocusIdRef.current !== pinId || !mapRef.current) return;

        let settled = false;
        const onSettled = () => {
          if (settled) return;
          if (pendingFocusIdRef.current !== pinId) return;
          settled = true;
          detachFocusMoveHandler();
          openSelected();
        };

        focusMoveHandlerRef.current = onSettled;
        mapRef.current.once('moveend', onSettled);
        mapRef.current.once('zoomend', onSettled);
        mapRef.current.setView(target, targetZoom, { animate: true, duration: 0.55 });
      });
    },
    [closeMapPopup, detachFocusMoveHandler],
  );

  const attachScrollWheelGuard = useCallback((map: any) => {
    wheelCleanupRef.current?.();
    map.scrollWheelZoom.disable();
    const container = map.getContainer() as HTMLElement;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        map.scrollWheelZoom.enable();
        window.setTimeout(() => map.scrollWheelZoom.disable(), 150);
      }
    };
    container.addEventListener('wheel', onWheel, { passive: true });
    wheelCleanupRef.current = () => container.removeEventListener('wheel', onWheel);
  }, []);

  const renderMarkers = useCallback((data: ReferenceMapPin[]) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!map || !L) return;

    // Filtre / pin listesi değişince eski popup kalmasın
    closeMapPopup();
    detachFocusMoveHandler();
    if (pendingFocusIdRef.current && !data.some((p) => p.id === pendingFocusIdRef.current)) {
      pendingFocusIdRef.current = null;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    data.forEach((pin) => {
      const icon = L.divIcon({
        className: '',
        html: buildMarkerHtml(pin),
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const popup = L.popup(POPUP_OPTIONS).setContent(buildPopupHtml(pin));
      const marker = L.marker([pin.latitude, pin.longitude], { icon })
        .bindPopup(popup)
        .addTo(map);

      markersRef.current.set(pin.id, marker);
    });

    // Odak isteği yoksa tüm pinlere sığdır
    if (!pendingFocusIdRef.current) {
      if (data.length > 0) {
        const bounds = L.latLngBounds(data.map((p) => [p.latitude, p.longitude]));
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 7 });
      } else {
        map.setView([39.0, 35.0], 6);
      }
    }
  }, [closeMapPopup, detachFocusMoveHandler]);

  // Harita init (bir kez)
  useEffect(() => {
    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled) return;
      leafletRef.current = L.default ?? L;

      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      if (!document.getElementById('operation-reference-map-css')) {
        const style = document.createElement('style');
        style.id = 'operation-reference-map-css';
        style.textContent = `
          .operation-reference-popup .leaflet-popup-content-wrapper {
            background: transparent;
            box-shadow: none;
            padding: 0;
            border-radius: 12px;
          }
          .operation-reference-popup .leaflet-popup-content {
            margin: 0;
          }
          .operation-reference-popup .leaflet-popup-tip {
            background: #0B1F3A;
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
          })
          .setView([39.0, 35.0], 6);
        attachScrollWheelGuard(mapRef.current);
        leaflet
          .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap Katkıda Bulunanları',
          })
          .addTo(mapRef.current);

        mapReadyRef.current = true;
        renderMarkers(pins);

        // Container boyutu değişince kontrollü invalidateSize
        if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
          resizeObserverRef.current = new ResizeObserver(() => {
            mapRef.current?.invalidateSize({ animate: false });
          });
          resizeObserverRef.current.observe(mapContainerRef.current);
        }

        // İlk layout sonrası boyut doğrula
        requestAnimationFrame(() => {
          mapRef.current?.invalidateSize({ animate: false });
        });
      }
    });

    return () => {
      cancelled = true;
      detachFocusMoveHandler();
      wheelCleanupRef.current?.();
      wheelCleanupRef.current = null;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once; pins/focus handled below
  }, [attachScrollWheelGuard]);

  // Pin listesi değişince marker'ları yenile (focusPinId burada YOK — ırkı önler)
  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current) return;
    renderMarkers(pins);

    // Filtre sonrası seçili pin yoksa popup kapalı kalsın
    if (focusPinId && !markersRef.current.has(focusPinId)) {
      pendingFocusIdRef.current = null;
      closeMapPopup();
      return;
    }

    // Filtre sonrası seçili pin hâlâ varsa yeniden odakla
    if (focusPinId && markersRef.current.has(focusPinId)) {
      focusPinById(focusPinId);
    }
    // focusPinId kasıtlı olarak deps dışında: yalnız pins değişince çalışır
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, renderMarkers, focusPinById, closeMapPopup]);

  // Sağ panel seçimi: benzersiz ID ile odak + moveend sonrası popup
  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current) return;

    if (!focusPinId) {
      pendingFocusIdRef.current = null;
      detachFocusMoveHandler();
      closeMapPopup();
      return;
    }

    if (!markersRef.current.has(focusPinId)) {
      // Marker henüz yok veya filtre dışı
      pendingFocusIdRef.current = focusPinId;
      closeMapPopup();
      return;
    }

    focusPinById(focusPinId);
  }, [focusPinId, focusToken, focusPinById, closeMapPopup, detachFocusMoveHandler]);

  // Popup «Detayları Gör» — KVKK bilgilendirme (Text node tıklaması dahil)
  useEffect(() => {
    const resolveEl = (target: EventTarget | null): Element | null => {
      if (!target) return null;
      if (target instanceof Element) return target;
      if (target instanceof Node) return target.parentElement;
      return null;
    };

    const openDetailNotice = (event: Event) => {
      const el = resolveEl(event.target);
      if (!el?.closest?.('[data-action="reference-detail"]')) return;
      event.preventDefault();
      event.stopPropagation();
      setDetailNoticeOpen(true);
      closeMapPopup();
    };

    document.addEventListener('click', openDetailNotice, true);
    return () => {
      document.removeEventListener('click', openDetailNotice, true);
    };
  }, [closeMapPopup]);

  // Leaflet popup açılınca butona doğrudan bağla (garanti)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onPopupOpen = (e: { popup?: { getElement?: () => HTMLElement | null } }) => {
      const root = e.popup?.getElement?.();
      const btn = root?.querySelector?.('[data-action="reference-detail"]') as HTMLButtonElement | null;
      if (!btn) return;
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        setDetailNoticeOpen(true);
        closeMapPopup();
      };
    };
    map.on('popupopen', onPopupOpen);
    return () => {
      map.off('popupopen', onPopupOpen);
    };
  }, [closeMapPopup, pins]);

  const legendCategories: ReferenceOperationCategory[] = [
    'residential',
    'industrial',
    'public_critical',
    'maritime',
    'disaster',
    'social',
  ];

  return (
    <div
      className="relative min-h-[420px] h-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
      onMouseEnter={() => setMapFocused(true)}
      onMouseLeave={() => setMapFocused(false)}
    >
      <div ref={mapContainerRef} className="h-full w-full min-h-[420px]" />
      <div
        className={`pointer-events-none absolute bottom-12 left-3 z-[500] rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur-sm transition-opacity duration-300 ${
          mapFocused ? 'opacity-100' : 'opacity-0'
        }`}
      >
        Yakınlaştırmak İçin Ctrl veya ⌘ + Kaydır · Sürükleyerek Gezinin
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[500] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-lg border border-slate-200/80 bg-white/95 px-3 py-2 text-[10px] font-medium text-slate-600 shadow-sm backdrop-blur-sm">
        {legendCategories.map((cat) => (
          <span key={cat} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: REFERENCE_CATEGORY_META[cat].color }}
            />
            {REFERENCE_CATEGORY_META[cat].shortLabel}
          </span>
        ))}
      </div>
      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60">
          <p className="text-sm font-medium text-slate-600">Harita Yükleniyor...</p>
        </div>
      )}
      {!loading && pins.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70">
          <div className="rounded-lg border border-slate-200 bg-white px-6 py-4 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Filtreye Uygun Operasyon Bulunamadı</p>
            <p className="mt-1 text-xs text-slate-500">Filtreleri temizleyerek tüm referansları görüntüleyebilirsiniz.</p>
          </div>
        </div>
      )}
      {detailNoticeOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="operation-reference-detail-title"
              onClick={() => setDetailNoticeOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <ShieldCheck className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <div>
                      <h2
                        id="operation-reference-detail-title"
                        className="text-base font-semibold text-slate-900"
                      >
                        KVKK Ve Veri Güvenliği
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        KVKK ve Veri Güvenliği Taahhütümüz nedeniyle detaylı bilgi için{' '}
                        <a
                          href={`tel:${DETAIL_CONTACT_PHONE_TEL}`}
                          className="font-semibold text-brand-600 hover:text-brand-800 hover:underline"
                        >
                          {DETAIL_CONTACT_PHONE_DISPLAY}
                        </a>{' '}
                        nolu numara ile irtibata geçiniz.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailNoticeOpen(false)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Kapat"
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </button>
                </div>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setDetailNoticeOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Kapat
                  </button>
                  <a
                    href={`tel:${DETAIL_CONTACT_PHONE_TEL}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    <Phone className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    {DETAIL_CONTACT_PHONE_DISPLAY}
                  </a>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
