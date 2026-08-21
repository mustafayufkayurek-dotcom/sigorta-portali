'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ImagePlus, Trash2, X } from 'lucide-react';
import { API, authHeader } from '@/utils/api';
import { reportCaughtError } from '@/utils/report-caught-error';

type PhotoDoc = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  notes?: string | null;
};

function isImageMime(mime: string) {
  return (mime || '').startsWith('image/');
}

function isInspectionPhoto(doc: PhotoDoc) {
  if (!isImageMime(doc.mimeType)) return false;
  const notes = (doc.notes ?? '').toLowerCase();
  // Eski yüklemeler notes’suz kalabilir — claim_file altındaki tüm görselleri göster
  if (!notes.trim()) return true;
  return notes.includes('tespit') || notes.includes('kapanış') || notes.includes('kapanis');
}

/** Saha — ortak tespit fotoğrafları (ofis evrak yaşam döngüsü yok) */
export function FieldInspectionPhotosPanel({
  claimId,
  entityType = 'claim_file',
  entityId,
}: {
  claimId?: string;
  entityType?: string;
  entityId?: string;
}) {
  const resolvedId = entityId || claimId || '';
  const [docs, setDocs] = useState<PhotoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    if (!resolvedId) {
      setDocs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await axios.get(`${API}/entity-documents`, {
        headers: authHeader(),
        params: { entityType, entityId: resolvedId },
      });
      const rows = ((r.data?.data ?? []) as PhotoDoc[]).filter(isInspectionPhoto);
      setDocs(rows);
    } catch (err) {
      reportCaughtError(err, 'Tespit fotoğrafları yüklenemedi.', { toast: false });
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, resolvedId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** İmzalı URL img src'de çoğu ortamda görünmez (yönlendirme / yetki).
   * Rapor galerisi gibi dosyayı oturumla çekip blob göster. */
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    const ids = docs.map((d) => d.id);
    if (ids.length === 0) {
      setThumbUrls({});
      return;
    }
    void (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await axios.get(`${API}/entity-documents/${id}/download`, {
              headers: authHeader(),
              responseType: 'blob',
            });
            const blob = r.data as Blob;
            if (!blob || blob.size < 32) return;
            if (blob.type && blob.type.includes('json')) return;
            const url = URL.createObjectURL(blob);
            created.push(url);
            next[id] = url;
          } catch {
            /* tek foto kırılınca diğerleri dursun */
          }
        }),
      );
      if (cancelled) {
        created.forEach((u) => URL.revokeObjectURL(u));
        return;
      }
      setThumbUrls(next);
    })();
    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [docs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        // Mobilde type bazen boş gelir — uzantı ile kabul et
        const looksImage =
          isImageMime(file.type) ||
          !file.type ||
          /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(file.name);
        if (!looksImage) continue;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('entityType', entityType);
        fd.append('entityId', resolvedId);
        fd.append('notes', 'Tespit Fotoğrafı');
        await axios.post(`${API}/entity-documents`, fd, {
          headers: authHeader(),
        });
      }
      await load();
    } catch (err) {
      reportCaughtError(err, 'Fotoğraf yüklenemedi.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (docId: string, fileName: string) => {
    if (!confirm(`"${fileName}" silinsin mi?`)) return;
    try {
      await axios.delete(`${API}/entity-documents/${docId}`, { headers: authHeader() });
      setThumbUrls((prev) => {
        const copy = { ...prev };
        delete copy[docId];
        return copy;
      });
      await load();
    } catch (err) {
      reportCaughtError(err, 'Fotoğraf silinemedi.');
    }
  };

  const openPreview = async (docId: string) => {
    if (thumbUrls[docId]) {
      setPreviewUrl(thumbUrls[docId]);
      return;
    }
    try {
      const r = await axios.get(`${API}/entity-documents/${docId}/download`, {
        headers: authHeader(),
        responseType: 'blob',
      });
      const blob = r.data as Blob;
      if (blob && blob.size >= 32) setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      reportCaughtError(err, 'Önizleme açılamadı.');
    }
  };

  return (
    <div data-testid="saha-tespit-fotograflari">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {loading ? 'Yükleniyor…' : docs.length === 0 ? 'Henüz tespit fotoğrafı yok. Çekimden sonra burada görünür.' : `${docs.length} fotoğraf`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*,.heic,.heif,image/heic,image/heif"
            multiple
            className="hidden"
            onChange={(e) => void handleUpload(e)}
            disabled={uploading}
            data-testid="saha-tespit-foto-input"
          />
          {/* capture: telefonda doğrudan kamera; galeri ayrı */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void handleUpload(e)}
            disabled={uploading}
            data-testid="saha-tespit-foto-kamera"
          />
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-50"
            data-testid="saha-tespit-foto-kamera-btn"
          >
            Kameradan
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            data-testid="saha-tespit-foto-yukle"
          >
            <ImagePlus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            {uploading ? 'Yükleniyor…' : 'Galeriden'}
          </button>
        </div>
      </div>

      {!loading && docs.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
          <ImagePlus className="mx-auto h-8 w-8 text-slate-300" strokeWidth={1.5} aria-hidden />
          <p className="mt-2 text-sm font-medium text-slate-600">Tespit Fotoğrafı Ekleyin</p>
          <p className="mt-1 text-xs text-slate-400">Henüz tespit fotoğrafı yok. Çekimden sonra burada görünür.</p>
        </div>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
            >
              <button
                type="button"
                onClick={() => void openPreview(doc.id)}
                className="block aspect-square w-full"
                title={doc.fileName}
              >
                {thumbUrls[doc.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbUrls[doc.id]}
                    alt={doc.fileName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center px-2 text-center text-[10px] font-medium text-slate-500">
                    {doc.fileName}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(doc.id, doc.fileName)}
                className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1 text-slate-500 opacity-0 shadow-sm ring-1 ring-slate-200 transition group-hover:opacity-100 hover:text-status-danger"
                title="Sil"
                aria-label="Sil"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {previewUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-h-[90vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              className="absolute -right-2 -top-2 rounded-full bg-white p-1 shadow"
              aria-label="Kapat"
            >
              <X className="h-4 w-4 text-slate-700" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Tespit Fotoğrafı"
              className="max-h-[85vh] max-w-full rounded-xl object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
