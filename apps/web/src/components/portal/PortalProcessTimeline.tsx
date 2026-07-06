'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { fmtDateTime } from '@/utils/date-helpers';
import {
  portalActivityLabel,
  portalNextStepHint,
  portalStatusLabel,
} from '@/utils/portal-file-flow-labels';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
const UPLOADS_ORIGIN = API.replace(/\/api\/v1$/, '');

function authHeader() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  return { Authorization: `Bearer ${token}` };
}

type FlowEntry = {
  id: string;
  kind: 'opened' | 'transition' | 'activity';
  date: string;
  title: string;
  subtitle?: string;
  actorName?: string;
};

type GalleryItem = {
  id: string;
  url: string;
  label: string;
};

interface PortalProcessTimelineProps {
  claimFileId: string;
  fileCreatedAt?: string;
  initialStatusCode?: string;
  initialStatusName?: string;
}

function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} dk`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} sa ${m} dk` : `${h} sa`;
}

export default function PortalProcessTimeline({
  claimFileId,
  fileCreatedAt,
  initialStatusCode,
  initialStatusName,
}: PortalProcessTimelineProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entries, setEntries] = useState<FlowEntry[]>([]);
  const [currentStatusCode, setCurrentStatusCode] = useState(initialStatusCode ?? 'new');
  const [currentStatusName, setCurrentStatusName] = useState(initialStatusName ?? 'Yeni');
  const [currentStatusColor, setCurrentStatusColor] = useState('#3B82F6');
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [responsibleRole, setResponsibleRole] = useState<string | null>(null);
  const [photos, setPhotos] = useState<GalleryItem[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [stageRes, activityRes, historyRes, reportsRes, docsRes] = await Promise.all([
        axios.get(`${API}/claim-files/${claimFileId}/current-stage`, { headers: authHeader() }),
        axios.get(`${API}/claim-files/${claimFileId}/activity-log`, { headers: authHeader() }),
        axios.get(`${API}/claim-files/${claimFileId}/timeline`, { headers: authHeader() }),
        axios.get(`${API}/claim-files/${claimFileId}/repair-reports`, { headers: authHeader() }),
        axios.get(`${API}/documents?claimFileId=${claimFileId}&limit=50`, { headers: authHeader() }),
      ]);

      const stage = stageRes.data?.data ?? stageRes.data;
      if (stage?.status) {
        setCurrentStatusCode(stage.status.code ?? initialStatusCode ?? 'new');
        setCurrentStatusName(portalStatusLabel(stage.status.code, stage.status.name));
        setCurrentStatusColor(stage.status.color ?? '#3B82F6');
        setElapsedMinutes(stage.elapsedMinutes ?? 0);
        setResponsibleRole(stage.currentResponsibleRole ?? null);
      }

      const merged: FlowEntry[] = [];

      if (fileCreatedAt) {
        merged.push({
          id: 'opened',
          kind: 'opened',
          date: fileCreatedAt,
          title: 'Dosya Açıldı',
          subtitle: 'İhbar kaydı sisteme alındı',
        });
      }

      const history: any[] = historyRes.data?.data ?? historyRes.data ?? [];
      for (const h of history) {
        merged.push({
          id: `hist-${h.id}`,
          kind: 'transition',
          date: h.changedAt,
          title: portalStatusLabel(h.toStatus?.code, h.toStatus?.name),
          subtitle: h.fromStatus?.name ? `${h.fromStatus.name} aşamasından geçildi` : undefined,
          actorName: h.changedByUser
            ? `${h.changedByUser.firstName} ${h.changedByUser.lastName}`.trim()
            : undefined,
        });
      }

      const activities: any[] = activityRes.data?.data ?? activityRes.data ?? [];
      for (const a of activities) {
        merged.push({
          id: `act-${a.id}`,
          kind: 'activity',
          date: a.createdAt,
          title: portalActivityLabel(a.action),
          subtitle: a.description ?? undefined,
          actorName: a.actor ? `${a.actor.firstName} ${a.actor.lastName}`.trim() : undefined,
        });
      }

      merged.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const deduped = merged.filter((entry, idx, arr) => {
        if (idx === 0) return true;
        const prev = arr[idx - 1];
        return !(prev.title === entry.title && prev.kind === entry.kind
          && Math.abs(new Date(entry.date).getTime() - new Date(prev.date).getTime()) < 60_000);
      });
      setEntries(deduped);

      const gallery: GalleryItem[] = [];
      const reports: any[] = reportsRes.data?.data ?? reportsRes.data ?? [];
      await Promise.all(
        reports.map(async (report) => {
          try {
            const imgRes = await axios.get(`${API}/repair-reports/${report.id}/images`, { headers: authHeader() });
            const images: any[] = imgRes.data?.data ?? imgRes.data ?? [];
            for (const img of images) {
              if (!img.storageKey) continue;
              gallery.push({
                id: img.id,
                url: `${UPLOADS_ORIGIN}/uploads/report-images/${encodeURIComponent(img.storageKey)}`,
                label: img.caption || img.fileName || 'Rapor Görseli',
              });
            }
          } catch {
            /* rapor görselleri opsiyonel */
          }
        }),
      );

      const docs: any[] = docsRes.data?.data ?? docsRes.data ?? [];
      for (const doc of docs) {
        const mime = doc.fileAsset?.mimeType ?? '';
        const storageKey = doc.fileAsset?.storageKey;
        if (!storageKey || !mime.startsWith('image/')) continue;
        try {
          const signed = await axios.get(
            `${API}/uploads/signed-url?storageKey=${encodeURIComponent(storageKey)}`,
            { headers: authHeader() },
          );
          const url = signed.data?.data?.url ?? signed.data?.url;
          if (url) {
            gallery.push({
              id: doc.id,
              url,
              label: doc.fileAsset?.fileName ?? doc.documentType ?? 'Dosya Görseli',
            });
          }
        } catch {
          gallery.push({
            id: doc.id,
            url: `${UPLOADS_ORIGIN}/uploads/${encodeURIComponent(storageKey)}`,
            label: doc.fileAsset?.fileName ?? 'Dosya Görseli',
          });
        }
      }

      setPhotos(gallery);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Akış verisi yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [claimFileId, fileCreatedAt, initialStatusCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const nextHint = useMemo(
    () => portalNextStepHint(currentStatusCode),
    [currentStatusCode],
  );

  const roleLabel = useMemo(() => {
    const map: Record<string, string> = {
      operasyon_sorumlusu: 'Operasyon Sorumlusu',
      saha_personeli: 'Saha Personeli',
      eksper: 'Eksper',
      sigorta_temsilcisi: 'Sigorta Temsilcisi',
      finans_sorumlusu: 'Finans Sorumlusu',
      yonetici: 'Yönetici',
    };
    return responsibleRole ? (map[responsibleRole] ?? responsibleRole) : 'Dosya Sorumlusu';
  }, [responsibleRole]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-36 bg-slate-100 rounded-xl" />
        <div className="h-24 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button type="button" onClick={loadData} className="mt-2 text-xs text-red-700 underline">Tekrar Dene</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Güncel aşama */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: currentStatusColor }} />
            <h3 className="text-lg font-semibold text-slate-800">{currentStatusName}</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-emerald-100 text-emerald-700 border-emerald-200">
            Normal
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Bu Aşamada</p>
            <p className="text-sm font-semibold text-slate-800">{fmtDuration(elapsedMinutes)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Sorumlu Rol</p>
            <p className="text-sm font-semibold text-slate-800">{roleLabel}</p>
          </div>
          {nextHint && (
            <div className="bg-blue-50 rounded-lg p-3 md:col-span-1 col-span-2">
              <p className="text-xs text-blue-600 font-medium">Sıradaki Adım</p>
              <p className="text-sm text-blue-900 mt-0.5">{nextHint}</p>
            </div>
          )}
        </div>
      </div>

      {/* Dosya görselleri */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Dosya Görselleri</h4>
        {photos.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Henüz yüklenmiş görsel yok</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setPreviewUrl(photo.url)}
                className="group relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-square"
              >
                <img
                  src={photo.url}
                  alt={photo.label}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <span className="absolute inset-x-0 bottom-0 bg-black/50 text-white text-[10px] px-2 py-1 truncate">
                  {photo.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Süreç geçmişi */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Süreç Geçmişi</h4>
        {entries.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Henüz süreç kaydı yok</p>
        ) : (
          <div className="space-y-0">
            {[...entries].reverse().map((entry, idx) => (
              <div key={entry.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 ${
                    entry.kind === 'opened' ? 'bg-slate-500' :
                    entry.kind === 'transition' ? 'bg-blue-500' : 'bg-emerald-500'
                  }`}
                  >
                    {entry.kind === 'opened' ? '★' : entry.kind === 'transition' ? '→' : '✓'}
                  </div>
                  {idx < entries.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 mt-1 min-h-[24px]" />}
                </div>
                <div className="pb-5 flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{entry.title}</p>
                  {entry.subtitle && <p className="text-xs text-slate-500 mt-0.5">{entry.subtitle}</p>}
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                    <span>{fmtDateTime(entry.date)}</span>
                    {entry.actorName && <span className="text-slate-600">{entry.actorName}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewUrl && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
          onKeyDown={(e) => e.key === 'Escape' && setPreviewUrl(null)}
          role="presentation"
        >
          <img
            src={previewUrl}
            alt="Önizleme"
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
