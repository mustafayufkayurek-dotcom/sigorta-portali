'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

interface Appointment {
  id: string;
  scheduledAt: string;
  location?: string;
  notes?: string;
  status?: string;
  claimFile?: { fileNumber?: string };
}

export default function EksperRandevularPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.push('/giris'); return; }
    const u = JSON.parse(raw);
    if (u?.role?.code !== 'expert') { router.push('/panel'); return; }

    const adjusterId = u.adjusterId;
    if (!adjusterId) { setLoading(false); return; }

    setError(null);
    fetch(`${API}/adjusters/appointments?adjusterId=${adjusterId}`, { headers: getHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error(`Sunucu hatası: ${r.status}`);
        return r.json();
      })
      .then((res) => setAppointments(res?.data ?? res ?? []))
      .catch((err: Error) => setError(err.message ?? 'Randevular yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [router]);

  const statusLabel = (s?: string) => {
    const map: Record<string, string> = { scheduled: 'Planlandı', completed: 'Tamamlandı', cancelled: 'İptal' };
    return s ? (map[s] ?? s) : '—';
  };
  const statusColor = (s?: string) => {
    const map: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return s ? (map[s] ?? 'bg-slate-100 text-slate-600') : 'bg-slate-100 text-slate-600';
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Yükleniyor...</div>;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span>/</span>
        <a href="/panel/eksper-portal" className="hover:text-blue-600 transition-colors">Eksper Portal</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Randevular</span>
      </nav>

      <h2 className="text-2xl font-bold text-slate-900">Randevularım</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 flex justify-between items-center">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-700 hover:text-red-900 ml-4 font-bold">&times;</button>
        </div>
      )}

      {!error && appointments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-slate-500 font-medium">Planlanmış randevu bulunmuyor.</p>
          <p className="text-slate-400 text-sm mt-1">Henüz bir randevunuz yok.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-4">
              <div className="flex-shrink-0 text-center bg-blue-50 rounded-lg px-3 py-2 min-w-[60px]">
                <p className="text-xs text-blue-500 font-medium">{new Date(a.scheduledAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}</p>
                <p className="text-sm font-bold text-blue-700">{new Date(a.scheduledAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-900">{a.claimFile?.fileNumber ?? '—'}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(a.status)}`}>{statusLabel(a.status)}</span>
                </div>
                {a.location && <p className="text-sm text-slate-500 mt-0.5">{a.location}</p>}
                {a.notes && <p className="text-sm text-slate-400 mt-0.5 italic">{a.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
