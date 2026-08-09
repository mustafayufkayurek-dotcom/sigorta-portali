'use client';

import { useCallback, useEffect, useState } from 'react';
import { API, authHeader, ensureValidSession } from '@/utils/api';
import {
  normalizeReportImageCategory,
  REPORT_IMAGE_CATEGORY_KEYS,
  REPORT_IMAGE_CATEGORY_LABELS,
} from '@/utils/quick-repair-damage-types';
import { formatReportImageFrameLabel } from '@/utils/report-image-frame-label';
import { getReportImageStreamUrl, getReportImageUrl } from '@/utils/upload-url';

type ReportImage = {
  id: string;
  storageKey: string;
  annotatedKey?: string | null;
  hasAnnotation?: boolean;
  category?: string;
  caption?: string | null;
  fileName?: string | null;
};

export type PendingReportImageUpload = {
  tempId: string;
  category: string;
};

type ReportImageGalleryProps = {
  images: ReportImage[];
  pendingUploads?: PendingReportImageUpload[];
  isEditable?: boolean;
  /** Hasar dosya no — çerçeve sol üst: 123456/Tespit Resimleri */
  fileNo?: string | null;
  onDelete?: (imageId: string) => void;
  onAnnotate?: (image: ReportImage) => void;
};

const STREAM_RETRY_DELAYS_MS = [0, 350, 900, 2000];

function resolveStorageKey(img: ReportImage): string {
  if (img.hasAnnotation && img.annotatedKey) return img.annotatedKey;
  return img.storageKey;
}

function FrameLabel({ label }: { label: string }) {
  return (
    <span className="absolute top-1 left-1 z-20 max-w-[calc(100%-0.5rem)] truncate rounded bg-slate-900/75 px-1.5 py-0.5 text-[9px] font-semibold leading-tight text-white pointer-events-none">
      {label}
    </span>
  );
}

function LoadingPlaceholder({ label = 'Yükleniyor...' }: { label?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-100 text-slate-500">
      <svg className="h-5 w-5 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      <span className="text-[11px] font-medium">{label}</span>
    </div>
  );
}

async function fetchImageBlob(imageId: string): Promise<Blob | null> {
  for (const delay of STREAM_RETRY_DELAYS_MS) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    try {
      await ensureValidSession(API);
      const res = await fetch(getReportImageStreamUrl(imageId), {
        headers: { ...authHeader(), Accept: 'image/*,*/*' },
        cache: 'no-store',
      });
      if (res.status === 401 || res.status === 403) {
        await ensureValidSession(API);
        continue;
      }
      if (!res.ok) continue;
      const blob = await res.blob();
      if (blob.type && blob.type.includes('application/json')) continue;
      if (blob.size < 32) continue;
      return blob;
    } catch {
      /* sonraki deneme */
    }
  }
  return null;
}

function ReportImageThumb({
  image,
  fileNo,
  onOpen,
  isEditable,
  onDelete,
}: {
  image: ReportImage;
  fileNo?: string | null;
  onOpen: () => void;
  isEditable?: boolean;
  onDelete?: (imageId: string) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const frameLabel = formatReportImageFrameLabel(fileNo, image.category);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const load = async () => {
      setStatus('loading');
      setSrc(null);

      const blob = await fetchImageBlob(image.id);
      if (cancelled) return;

      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setStatus('ready');
        return;
      }

      const direct = getReportImageUrl(resolveStorageKey(image));
      if (!direct) {
        setStatus('error');
        return;
      }

      setSrc(direct);
      setStatus('ready');
    };

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.id, image.storageKey, image.annotatedKey, image.hasAnnotation]);

  const handleImgError = async () => {
    // Doğrudan URL kırıldıysa stream’i bir kez daha dene (kalıcı «Yüklenemedi» döngüsü)
    const blob = await fetchImageBlob(image.id);
    if (blob) {
      const objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
      setStatus('ready');
      return;
    }
    setStatus('error');
  };

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={status !== 'ready'}
      className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50 w-28 h-28 shrink-0 text-left focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:cursor-default"
      title={frameLabel}
    >
      {status === 'loading' && <LoadingPlaceholder />}
      {status === 'error' && (
        <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 px-2 text-center bg-slate-100">
          Yüklenemedi
        </div>
      )}
      {status === 'ready' && src && (
        <img
          src={src}
          alt={image.caption ?? image.fileName ?? frameLabel}
          className="w-full h-full object-cover"
          onError={() => { void handleImgError(); }}
        />
      )}
      <FrameLabel label={frameLabel} />
      {isEditable && onDelete && status === 'ready' && (
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(image.id);
          }}
          className="absolute bottom-1.5 right-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-status-danger text-xs text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100"
          title="Sil"
        >
          ×
        </span>
      )}
    </button>
  );
}

function PendingUploadThumb({ category, fileNo }: { category: string; fileNo?: string | null }) {
  const frameLabel = formatReportImageFrameLabel(fileNo, category);
  return (
    <div className="relative rounded-lg overflow-hidden border border-dashed border-brand-200 bg-brand-50/40 w-28 h-28 shrink-0">
      <LoadingPlaceholder label="Yükleniyor..." />
      <FrameLabel label={frameLabel} />
    </div>
  );
}

export default function ReportImageGallery({
  images,
  pendingUploads = [],
  isEditable = false,
  fileNo,
  onDelete,
  onAnnotate,
}: ReportImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const closeLightbox = useCallback(() => setActiveIndex(null), []);

  useEffect(() => {
    if (activeIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') setActiveIndex((i) => (i === null ? null : Math.min(i + 1, images.length - 1)));
      if (e.key === 'ArrowLeft') setActiveIndex((i) => (i === null ? null : Math.max(i - 1, 0)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, closeLightbox, images.length]);

  if (!images.length && !pendingUploads.length) return null;

  const active = activeIndex !== null ? images[activeIndex] : null;

  return (
    <>
      <div className="space-y-4">
        {REPORT_IMAGE_CATEGORY_KEYS.map((cat) => {
          const catImages = images
            .map((img, idx) => ({ img, idx }))
            .filter(({ img }) => normalizeReportImageCategory(img.category) === cat);
          const catPending = pendingUploads.filter(
            (p) => normalizeReportImageCategory(p.category) === cat,
          );
          if (!catImages.length && !catPending.length) return null;
          return (
            <div key={cat} className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                {REPORT_IMAGE_CATEGORY_LABELS[cat]}
              </p>
              <div className="flex flex-wrap items-start gap-2">
                {catImages.map(({ img, idx }) => (
                  <ReportImageThumb
                    key={img.id}
                    image={img}
                    fileNo={fileNo}
                    isEditable={isEditable}
                    onDelete={onDelete}
                    onOpen={() => setActiveIndex(idx)}
                  />
                ))}
                {catPending.map((pending) => (
                  <PendingUploadThumb
                    key={pending.tempId}
                    category={pending.category}
                    fileNo={fileNo}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {active && activeIndex !== null && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
          onClick={closeLightbox}
          role="dialog"
          aria-modal
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <LightboxImage image={active} fileNo={fileNo} />
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                disabled={activeIndex <= 0}
                onClick={() => setActiveIndex((i) => Math.max((i ?? 0) - 1, 0))}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 disabled:opacity-40"
              >
                ← Önceki
              </button>
              <span className="text-xs text-slate-300 tabular-nums">
                {activeIndex + 1} / {images.length}
                {' · '}
                {formatReportImageFrameLabel(fileNo, active.category)}
              </span>
              <button
                type="button"
                disabled={activeIndex >= images.length - 1}
                onClick={() => setActiveIndex((i) => Math.min((i ?? 0) + 1, images.length - 1))}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 disabled:opacity-40"
              >
                Sonraki →
              </button>
              {isEditable && onAnnotate && (
                <button
                  type="button"
                  onClick={() => { onAnnotate(active); closeLightbox(); }}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
                >
                  İşaretle
                </button>
              )}
              {isEditable && onDelete && (
                <button
                  type="button"
                  onClick={() => { onDelete(active.id); closeLightbox(); }}
                  className="rounded-lg bg-status-danger px-4 py-2 text-sm text-white hover:opacity-90"
                >
                  Sil
                </button>
              )}
              <button
                type="button"
                onClick={closeLightbox}
                className="rounded-lg border border-white/30 px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LightboxImage({ image, fileNo }: { image: ReportImage; fileNo?: string | null }) {
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const frameLabel = formatReportImageFrameLabel(fileNo, image.category);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const load = async () => {
      setStatus('loading');
      setSrc(null);

      const blob = await fetchImageBlob(image.id);
      if (cancelled) return;

      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setStatus('ready');
        return;
      }

      const direct = getReportImageUrl(resolveStorageKey(image));
      if (!direct) {
        setStatus('error');
        return;
      }
      setSrc(direct);
      setStatus('ready');
    };

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image]);

  return (
    <div className="relative w-full flex items-center justify-center max-h-[75vh] min-h-[200px]">
      {status === 'loading' && (
        <div className="text-sm text-slate-300">Fotoğraf yükleniyor...</div>
      )}
      {status === 'error' && (
        <div className="text-sm text-red-300">Fotoğraf yüklenemedi.</div>
      )}
      {status === 'ready' && src && (
        <img
          src={src}
          alt={image.caption ?? frameLabel}
          className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
          onError={() => setStatus('error')}
        />
      )}
      <div className="absolute top-3 left-3 z-10 pointer-events-none">
        <span className="rounded bg-slate-900/80 px-2.5 py-1 text-xs font-semibold text-white">
          {frameLabel}
        </span>
      </div>
    </div>
  );
}
