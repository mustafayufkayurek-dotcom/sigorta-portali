'use client';

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

interface PersonelKonum {
  userId: string;
  firstName: string;
  lastName: string;
  role: { code: string; name: string };
  lastLocation: {
    id: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    batteryLevel?: number;
    timestamp: string;
  };
  activeAppointment: {
    id: string;
    type: string;
    scheduledAt: string;
    location?: string;
    claimFile?: { fileNo: string };
  } | null;
}

interface RotaNoktasi {
  latitude: number;
  longitude: number;
  timestamp: string;
}

function markerColor(timestamp: string): 'green' | 'yellow' | 'gray' {
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

function formatRelative(ts: string): string {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60_000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  return new Date(ts).toLocaleDateString('tr-TR');
}

const APPOINTMENT_TYPE: Record<string, string> = {
  expert_visit: 'Eksper Ziyareti',
  inspection: 'Keşif',
  customer_meeting: 'Müşteri Toplantısı',
};

export default function HaritaPage() {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  const [personeller, setPersoneller] = useState<PersonelKonum[]>([]);
  const [seciliPersonel, setSeciliPersonel] = useState<string>('');
  const [rotaBaslangic, setRotaBaslangic] = useState('');
  const [rotaBitis, setRotaBitis] = useState('');
  const [rota, setRota] = useState<RotaNoktasi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const token = () =>
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') ?? '' : '';

  // Leaflet'i yükle (SSR'dan korumak için useEffect içinde)
  useEffect(() => {
    import('leaflet').then((L) => {
      leafletRef.current = L.default ?? L;
      // Leaflet CSS
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      initMap();
    });
  }, []);

  function initMap() {
    if (mapRef.current || !mapContainerRef.current || !leafletRef.current) return;
    const L = leafletRef.current;

    mapRef.current = L.map(mapContainerRef.current).setView([39.0, 35.0], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap katkıda bulunanları',
    }).addTo(mapRef.current);

    fetchPersoneller();
  }

  const fetchPersoneller = async () => {
    setYukleniyor(true);
    try {
      const res = await axios.get(`${API}/user-locations/latest`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data: PersonelKonum[] = res.data.data ?? [];
      setPersoneller(data);
      renderMarkers(data);
    } catch (e) {
      console.error('Personel konumları yüklenemedi', e);
    } finally {
      setYukleniyor(false);
    }
  };

  function renderMarkers(data: PersonelKonum[]) {
    const L = leafletRef.current;
    if (!mapRef.current || !L) return;

    // Mevcut marker'ları temizle
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    data.forEach((p) => {
      const color = COLOR_MAP[markerColor(p.lastLocation.timestamp)];
      const icon = L.divIcon({
        className: '',
        html: `
          <div style="
            width:36px;height:36px;border-radius:50%;
            background:${color};border:3px solid white;
            box-shadow:0 2px 6px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;
            color:white;font-weight:700;font-size:12px;
          ">${p.firstName[0]}${p.lastName[0]}</div>
          <div style="
            position:absolute;top:40px;left:50%;transform:translateX(-50%);
            white-space:nowrap;background:white;padding:2px 6px;border-radius:4px;
            font-size:11px;font-weight:600;color:#111;
            box-shadow:0 1px 4px rgba(0,0,0,0.2);
          ">${p.firstName} ${p.lastName}</div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const popup = L.popup({ maxWidth: 260 }).setContent(`
        <div style="font-family:sans-serif;font-size:13px;">
          <strong>${p.firstName} ${p.lastName}</strong>
          <div style="color:#6B7280;margin-top:4px;">${p.role.name}</div>
          <hr style="margin:8px 0;border-color:#F3F4F6;">
          <div>🕐 ${formatRelative(p.lastLocation.timestamp)}</div>
          ${p.lastLocation.batteryLevel != null
            ? `<div>🔋 Batarya: %${Math.round(p.lastLocation.batteryLevel * 100)}</div>`
            : ''
          }
          ${p.lastLocation.speed != null
            ? `<div>🚗 Hız: ${Math.round((p.lastLocation.speed ?? 0) * 3.6)} km/h</div>`
            : ''
          }
          ${p.activeAppointment
            ? `<hr style="margin:8px 0;border-color:#F3F4F6;">
               <div>📋 ${APPOINTMENT_TYPE[p.activeAppointment.type] ?? p.activeAppointment.type}</div>
               ${p.activeAppointment.claimFile
                 ? `<div>Dosya: ${p.activeAppointment.claimFile.fileNo}</div>`
                 : ''
               }
               <div>${p.activeAppointment.location ?? ''}</div>`
            : ''
          }
        </div>
      `);

      const marker = L.marker(
        [p.lastLocation.latitude, p.lastLocation.longitude],
        { icon },
      ).bindPopup(popup).addTo(mapRef.current);

      markersRef.current.push(marker);
    });
  }

  const fetchRota = async () => {
    if (!seciliPersonel) return;
    try {
      const params: any = {};
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

  // Bugünü varsayılan olarak ayarla
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setRotaBaslangic(today);
    setRotaBitis(today);
  }, []);

  const activeCount = personeller.filter(
    (p) => markerColor(p.lastLocation.timestamp) === 'green',
  ).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', gap: 12 }}>
      {/* Üst araç çubuğu */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #E5E7EB',
          borderRadius: 10,
          padding: '12px 16px',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Personel:</span>
          <select
            value={seciliPersonel}
            onChange={(e) => setSeciliPersonel(e.target.value)}
            style={{
              border: '1px solid #D1D5DB',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 13,
              color: '#374151',
            }}
          >
            <option value="">Tüm Personel</option>
            {personeller.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#6B7280' }}>Başlangıç:</span>
          <input
            type="date"
            value={rotaBaslangic}
            onChange={(e) => setRotaBaslangic(e.target.value)}
            style={{ border: '1px solid #D1D5DB', borderRadius: 6, padding: '5px 8px', fontSize: 13 }}
          />
          <span style={{ fontSize: 13, color: '#6B7280' }}>Bitiş:</span>
          <input
            type="date"
            value={rotaBitis}
            onChange={(e) => setRotaBitis(e.target.value)}
            style={{ border: '1px solid #D1D5DB', borderRadius: 6, padding: '5px 8px', fontSize: 13 }}
          />
        </div>

        <button type="button"
          onClick={fetchRota}
          disabled={!seciliPersonel}
          style={{
            background: seciliPersonel ? '#3B82F6' : '#D1D5DB',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 600,
            cursor: seciliPersonel ? 'pointer' : 'default',
          }}
        >
          Rotayı Göster
        </button>

        <button type="button"
          onClick={fetchPersoneller}
          style={{
            background: '#F3F4F6',
            color: '#374151',
            border: '1px solid #D1D5DB',
            borderRadius: 6,
            padding: '6px 14px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Yenile
        </button>

        {/* Durum göstergesi */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
            Aktif (&lt;15dk) · {activeCount}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
            Beklemede (15–60dk)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#9CA3AF', display: 'inline-block' }} />
            Pasif (&gt;60dk)
          </span>
          {yukleniyor && (
            <span style={{ color: '#6B7280' }}>Yükleniyor...</span>
          )}
        </div>
      </div>

      {/* Harita */}
      <div
        ref={mapContainerRef}
        style={{
          flex: 1,
          borderRadius: 10,
          border: '1px solid #E5E7EB',
          overflow: 'hidden',
          minHeight: 400,
        }}
      />

      {/* Rota bilgisi */}
      {rota.length > 0 && (
        <div
          style={{
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13,
            color: '#1E40AF',
          }}
        >
          {seciliPersonel && personeller.find((p) => p.userId === seciliPersonel)
            ? `${personeller.find((p) => p.userId === seciliPersonel)!.firstName} ${personeller.find((p) => p.userId === seciliPersonel)!.lastName}`
            : 'Personel'}{' '}
          — {rota.length} Konum Noktası Gösteriliyor
          <button type="button"
            onClick={() => {
              setRota([]);
              if (polylineRef.current) {
                polylineRef.current.remove();
                polylineRef.current = null;
              }
            }}
            style={{
              marginLeft: 12,
              background: 'none',
              border: 'none',
              color: '#3B82F6',
              cursor: 'pointer',
              fontSize: 12,
              textDecoration: 'underline',
            }}
          >
            Temizle
          </button>
        </div>
      )}
    </div>
  );
}
