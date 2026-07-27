'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { geocodeAddressCascade } from '@/utils/geocode-address';

export interface LatLng {
  lat: number;
  lng: number;
}

interface LocationPickerModalProps {
  open: boolean;
  initial?: LatLng | null;
  onConfirm: (coords: LatLng) => void;
  onClose: () => void;
  /** Adres alanlarından oluşturulan tam adres metni (geocoding için) */
  addressHint?: string;
}

// OpenStreetMap embed with click support via a lightweight inline HTML page
function buildMapHtml(lat: number, lng: number, zoom: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;}</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map').setView([${lat}, ${lng}], ${zoom});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);
  var marker = L.marker([${lat}, ${lng}], {draggable: true}).addTo(map);
  function sendCoords(lat, lng) {
    window.parent.postMessage({type:'MAP_CLICK',lat:lat,lng:lng}, '*');
  }
  marker.on('dragend', function(e) {
    var pos = e.target.getLatLng();
    sendCoords(pos.lat, pos.lng);
  });
  map.on('click', function(e) {
    marker.setLatLng(e.latlng);
    sendCoords(e.latlng.lat, e.latlng.lng);
  });
  sendCoords(${lat}, ${lng});
</script>
</body>
</html>`;
}

const DEFAULT_LAT = 39.9255;
const DEFAULT_LNG = 32.8663;
const DEFAULT_ZOOM = 6;

/** Nominatim geocoding — adres metninden koordinat döndürür (kademeli) */
async function geocodeAddress(address: string): Promise<LatLng | null> {
  const result = await geocodeAddressCascade({ streetName: address });
  if (!result) return null;
  return { lat: result.lat, lng: result.lng };
}

const GEO_ERROR_MESSAGES: Record<number, string> = {
  1: 'Konum izni reddedildi. Tarayıcı ayarlarından konum erişimine izin verin.',
  2: 'Konum alınamadı. GPS veya internet bağlantınızı kontrol edin.',
  3: 'Konum isteği zaman aşımına uğradı. Tekrar deneyin.',
};

export function LocationPickerModal({ open, initial, onConfirm, onClose, addressHint }: LocationPickerModalProps) {
  const [lat, setLat] = useState<string>(String(initial?.lat ?? DEFAULT_LAT));
  const [lng, setLng] = useState<string>(String(initial?.lng ?? DEFAULT_LNG));
  const [mapKey, setMapKey] = useState(0);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sync when modal opens / initial changes
  useEffect(() => {
    if (open) {
      const initLat = initial?.lat ?? DEFAULT_LAT;
      const initLng = initial?.lng ?? DEFAULT_LNG;
      setLat(String(initLat));
      setLng(String(initLng));
      setGeocodeError(null);
      setGeoError(null);
      setMapKey((k) => k + 1);
    }
  }, [open, initial]);

  // Listen for postMessage from iframe
  useEffect(() => {
    if (!open) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'MAP_CLICK') {
        setLat(String(Number(e.data.lat).toFixed(6)));
        setLng(String(Number(e.data.lng).toFixed(6)));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [open]);

  const handleConfirm = () => {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) return;
    onConfirm({ lat: parsedLat, lng: parsedLng });
  };

  const handleManualInput = () => {
    setMapKey((k) => k + 1);
  };

  const handleGeocode = useCallback(async (address: string) => {
    if (!address.trim()) return;
    setGeocoding(true);
    setGeocodeError(null);
    setGeoError(null);
    try {
      const result = await geocodeAddress(address);
      if (result) {
        setLat(String(result.lat.toFixed(6)));
        setLng(String(result.lng.toFixed(6)));
        setMapKey((k) => k + 1);
      } else {
        setGeocodeError('Konum bulunamadı. Haritada pin atarak manuel belirleyebilirsiniz.');
      }
    } catch {
      setGeocodeError('Konum arama başarısız. İnternet bağlantınızı kontrol edin.');
    } finally {
      setGeocoding(false);
    }
  }, []);

  const handleUseCurrentLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Tarayıcınız konum servisini desteklemiyor.');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    setGeocodeError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setMapKey((k) => k + 1);
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        setGeoError(GEO_ERROR_MESSAGES[err.code] ?? 'Konum alınamadı.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  if (!open) return null;

  const mapLat = parseFloat(lat) || DEFAULT_LAT;
  const mapLng = parseFloat(lng) || DEFAULT_LNG;
  const mapZoom = (initial || (parseFloat(lat) !== DEFAULT_LAT)) ? 14 : DEFAULT_ZOOM;
  const mapHtml = buildMapHtml(mapLat, mapLng, mapZoom);
  const mapSrc = `data:text/html;charset=utf-8,${encodeURIComponent(mapHtml)}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[80] p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-brand-600 to-blue-700">
          <div>
            <h3 className="text-sm font-semibold text-white">Konum Seç</h3>
            <p className="text-xs text-blue-200 mt-0.5">Haritadan pin atın, GPS kullanın veya koordinat girin</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Geocoding bar — sadece addressHint varsa göster */}
        {addressHint && (
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-blue-700 font-medium truncate">
                <svg className="w-3.5 h-3.5 inline-block mr-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {addressHint}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleGeocode(addressHint)}
              disabled={geocoding}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors font-medium"
            >
              {geocoding ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Aranıyor...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Konumu Bul
                </>
              )}
            </button>
          </div>
        )}

        {/* Geocode / GPS error */}
        {(geocodeError || geoError) && (
          <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-100">
            <p className="text-xs text-amber-700 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0 text-status-warning" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {geocodeError ?? geoError}
            </p>
          </div>
        )}

        {/* GPS — saha ziyareti için */}
        <div className="px-5 py-3 border-b border-gray-100 bg-slate-50">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={geoLoading}
            className="w-full flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            {geoLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Konum alınıyor...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22s8-4.5 8-11a8 8 0 10-16 0c0 6.5 8 11 8 11z" />
                </svg>
                Bulunduğum Konumu Kullan
              </>
            )}
          </button>
          <p className="text-[11px] text-slate-400 text-center mt-1.5">Müşteri ziyaretinde sahada konumu kaydetmek için kullanın</p>
        </div>

        {/* Map */}
        <div className="relative h-[260px] sm:h-[340px]">
          <iframe
            key={mapKey}
            ref={iframeRef}
            src={mapSrc}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title="Konum Seç"
          />
        </div>

        {/* Coordinate inputs */}
        <div className="px-5 py-4 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Enlem (Latitude)</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                onBlur={handleManualInput}
                placeholder="39.9255"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Boylam (Longitude)</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                onBlur={handleManualInput}
                placeholder="32.8663"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!lat || !lng || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))}
              className="px-5 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Konumu Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface LocationPreviewProps {
  lat: number;
  lng: number;
  onEdit: () => void;
  onClear: () => void;
  accentColor?: 'blue' | 'indigo' | 'emerald';
  addressLabel?: string;
}

export function LocationPreview({ lat, lng, onEdit, onClear, accentColor = 'blue', addressLabel }: LocationPreviewProps) {
  const urls = {
    googleView: `https://www.google.com/maps?q=${lat},${lng}`,
    googleDirections: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    apple: `https://maps.apple.com/?daddr=${lat},${lng}`,
    yandexView: `https://yandex.com/maps/?pt=${lng},${lat}&z=15&l=map`,
    yandexDirections: `https://yandex.com/maps/?rtext=~${lat},${lng}&rtt=auto`,
  };

  const accent = accentColor === 'indigo'
    ? { btn: 'bg-brand-50 text-brand-700 hover:bg-brand-100 border-brand-200', pin: 'text-brand-600', cta: 'bg-brand-600 text-white border-brand-600 hover:bg-brand-700' }
    : accentColor === 'emerald'
      ? { btn: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200', pin: 'text-emerald-600', cta: 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700' }
      : { btn: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200', pin: 'text-brand-600', cta: 'bg-brand-600 text-white border-brand-600 hover:bg-blue-700' };

  const previewSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.008},${lat - 0.005},${lng + 0.008},${lat + 0.005}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden">
      {/* Static map preview */}
      <div style={{ height: 150 }}>
        <iframe
          src={previewSrc}
          className="w-full h-full border-0"
          title="Konum Önizleme"
          loading="lazy"
        />
      </div>

      {/* Info + buttons */}
      <div className="px-3 py-2.5 bg-gray-50 border-t border-gray-100">
        {addressLabel && (
          <p className="text-xs text-slate-600 mb-2 line-clamp-2" title={addressLabel}>{addressLabel}</p>
        )}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className={`text-xs font-medium ${accent.pin} flex items-center gap-1`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={onEdit} className={`text-xs px-2 py-1 rounded-lg border transition-colors ${accent.btn}`}>Düzenle</button>
            <button type="button" onClick={onClear} className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">Kaldır</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          <a href={urls.googleDirections} target="_blank" rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${accent.cta}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Yol Tarifi
          </a>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <a href={urls.googleView} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
            <svg className="w-3.5 h-3.5 text-brand-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            Haritada Aç
          </a>
          <a href={urls.apple} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
            <svg className="w-3.5 h-3.5 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.14-2.19 1.28-2.17 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.77M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            Apple Harita
          </a>
          <a href={urls.yandexDirections} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
            <svg className="w-3.5 h-3.5 text-status-danger" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            Yandex Navigasyon
          </a>
        </div>
      </div>
    </div>
  );
}
