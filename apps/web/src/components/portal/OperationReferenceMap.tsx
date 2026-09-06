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
import { buildPanelFileMarkerHtml, ensureHaritaPinSignalCss, escHaritaHtml } from '@/utils/harita-pin-signal';

const DETAIL_CONTACT_PHONE_DISPLAY = '0 532 133 4144';
const DETAIL_CONTACT_PHONE_TEL = '+905321334144';

const CATEGORY_LETTER: Record<ReferenceOperationCategory, string> = {
  residential: 'K',
  industrial: 'E',
  public_critical: 'M',
  maritime: 'D',
  disaster: 'F',
  social: 'T',
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
  return buildPanelFileMarkerHtml({
    letter: CATEGORY_LETTER[pin.category],
    color: referenceCategoryColor(pin.category),
    label: pin.city || pin.label,
    stage: pin.status,
    signal: pin.statusTone !== 'success',
  });
}

function buildPopupHtml(pin: ReferenceMapPin): string {
  const location = pin.district
    ? `${pin.city.toLocaleUpperCase('tr-TR')} / ${pin.district}`
    : pin.city.toLocaleUpperCase('tr-TR');

  return `
    <div class="font-sans text-[13px] text-slate-800" data-popup-pin-id="${escHaritaHtml(pin.id)}">
      <strong>${escHaritaHtml(pin.institutionDisplay)}</strong>
      <div class="mt-1 text-slate-500">${escHaritaHtml(pin.operationType)}</div>
      <hr class="my-2 border-slate-100">
      <div>Konum: ${escHaritaHtml(location)}</div>
      <div>Durum: ${escHaritaHtml(pin.status)}</div>
      <div>Kategori: ${escHaritaHtml(pin.categoryLabel)}</div>
      <div>Tarih: ${escHaritaHtml(pin.dateLabel)}</div>
      <button type="button" data-action="reference-detail" class="mt-2 inline-block text-brand-600 underline">
        Detayları Gör
      </button>
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

      ensureHaritaPinSignalCss();
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
            background: #fff;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
            padding: 10px 12px;
            border-radius: 10px;
          }
          .operation-reference-popup .leaflet-popup-content {
            margin: 0;
          }
          .operation-reference-popup .leaflet-popup-tip {
            background: #fff;
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
