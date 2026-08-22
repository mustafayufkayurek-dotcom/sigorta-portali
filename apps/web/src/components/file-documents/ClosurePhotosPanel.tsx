'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ImagePlus, Trash2, X } from 'lucide-react';
import { API, authHeader } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';

type ClosurePhotoDoc = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
};

type Props = {
  entityId: string;
  /** Yüklenen kapanış resmi adedi değişince (kapı senkronu) */
  onPhotoCountChange?: (count: number) => void;
  readonly?: boolean;
};

function isImageMime(mime: string) {
  return (mime || '').startsWith('image/');
}

export default function ClosurePhotosPanel({
  entityId,
  onPhotoCountChange,
  readonly = false,
}: Props) {
  const [docs, setDocs] = useState<ClosurePhotoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const onCountRef = useRef(onPhotoCountChange);
  onCountRef.current = onPhotoCountChange;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await axios.get(`${API}/entity-documents`, {
        headers: authHeader(),
        params: { entityType: 'emergency_case', entityId },
      });
      const rows = ((r.data?.data ?? []) as ClosurePhotoDoc[]).filter((d) =>
        isImageMime(d.mimeType),
      );
      setDocs(rows);
      onCountRef.current?.(rows.length);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Fotoğraflar yüklenemedi'));
      setDocs([]);
      onCountRef.current?.(0);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0 || readonly) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        if (!isImageMime(file.type) && !/\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(file.name)) {
          setError('Yalnızca resim dosyaları yüklenebilir.');
          continue;
        }
        const fd = new FormData();
        fd.append('file', file);
        fd.append('entityType', 'emergency_case');
        fd.append('entityId', entityId);
        fd.append('notes', 'Dosya Kapanış Resmi');
        await axios.post(`${API}/entity-documents`, fd, {
          headers: authHeader(),
        });
      }
      await load();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Dosya yüklenemedi. Lütfen kısa süre sonra tekrar deneyin.'));
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    await uploadFiles(files);
  };

  const onDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (readonly || uploading) return;
    void uploadFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const handleDelete = async (docId: string, fileName: string) => {
    if (readonly) return;
    if (!confirm(`"${fileName}" silinsin mi?`)) return;
    setError(null);
    try {
      await axios.delete(`${API}/entity-documents/${docId}`, { headers: authHeader() });
      await load();
    } catch {
      setError('Silinemedi');
    }
  };

  const openPreview = async (docId: string) => {
    try {
      const r = await axios.get(`${API}/entity-documents/${docId}/signed-url`, {
        headers: authHeader(),
      });
      const url = r.data?.data?.url as string | undefined;
      if (url) setPreviewUrl(url);
    } catch {
      setError('Önizleme açılamadı');
    }
  };

  const done = docs.length > 0;

  return (
    <div
      className={`rounded-md border px-2 py-1.5 space-y-1.5 ${
        done
          ? 'border-emerald-200 bg-emerald-50/50'
          : 'border-amber-200 bg-amber-50/40'
      } ${dragOver && !readonly ? 'ring-2 ring-brand-400' : ''}`}
      data-testid="dosya-kapanis-resimleri"
      data-photo-count={docs.length}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!readonly && !uploading) setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!readonly && !uploading) setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
      }}
      onDrop={onDropFiles}
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <ImagePlus
            className={`h-3.5 w-3.5 shrink-0 ${done ? 'text-emerald-700' : 'text-amber-700'}`}
            strokeWidth={1.75}
            aria-hidden
          />
          <p className="text-xs font-semibold text-slate-800 truncate">
            Dosya Kapanış Resimleri
          </p>
        </div>
        <span
          className={`text-[10px] font-semibold shrink-0 tabular-nums ${
            done ? 'text-emerald-700' : 'text-amber-800'
          }`}
          data-testid="dosya-kapanis-resimleri-durum"
        >
          {loading
            ? '…'
            : done
              ? `${docs.length} Resim · Tamam`
              : 'Eksik'}
        </span>
      </div>

      <p className="text-[10px] text-slate-500 leading-snug">
        Kapanış öncesi saha / hizmet fotoğraflarını buraya yükleyin. Belgeler sekmesinden ayrıdır.
        {!readonly ? (
          <>
            {' '}
            <span data-testid="dosya-kapanis-surukle-birak">
              Resim yükle ile veya dosyayı bu alana sürükleyip bırakarak ekleyin.
            </span>
          </>
        ) : null}
      </p>

      {!readonly && (
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            className="hidden"
            onChange={(e) => void handleUpload(e)}
            disabled={uploading}
            data-testid="dosya-kapanis-resimleri-input"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-500 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="dosya-kapanis-resimleri-yukle"
          >
            <ImagePlus className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            {uploading ? 'Yükleniyor…' : 'Resim Yükle'}
          </button>
        </div>
      )}

      {error && (
        <p className="text-[10px] text-red-700" data-testid="dosya-kapanis-resimleri-hata">
          {error}
        </p>
      )}

      {!loading && docs.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-1" data-testid="dosya-kapanis-resimleri-liste">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px]"
            >
              <button
                type="button"
                onClick={() => void openPreview(doc.id)}
                className="min-w-0 flex-1 truncate text-left font-medium text-slate-700 hover:text-blue-700"
                title={doc.fileName}
              >
                {doc.fileName}
              </button>
              {!readonly && (
                <button
                  type="button"
                  onClick={() => void handleDelete(doc.id, doc.fileName)}
                  className="shrink-0 rounded p-0.5 text-slate-400 hover:text-red-600"
                  title="Sil"
                  aria-label="Sil"
                >
                  <Trash2 className="h-3 w-3" strokeWidth={1.75} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
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
              alt="Dosya Kapanış Resmi"
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
