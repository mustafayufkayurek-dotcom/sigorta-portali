'use client';

import { useCallback, useEffect, useState } from 'react';
import { API, authHeader, ensureValidSession } from '@/utils/api';
import {
  reportImageCategoryColor,
  reportImageCategoryLabel,
} from '@/utils/quick-repair-damage-types';
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
  onDelete?: (imageId: string) => void;
  onAnnotate?: (image: ReportImage) => void;
};

const STREAM_RETRY_DELAYS_MS = [0, 350, 900, 2000];

function resolveStorageKey(img: ReportImage): string {
  if (img.hasAnnotation && img.annotatedKey) return img.annotatedKey;
  return img.storageKey;
}

function CategoryBadge({ category, className = '' }: { category?: string | null; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide shadow-md ring-2 ring-white/90 ${reportImageCategoryColor(category)} ${className}`}
    >
      {reportImageCategoryLabel(category)}
    </span>
  );
}

function LoadingPlaceholder({ label = 'Yükleniyor...' }: { label?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-100 text-slate-500">
      <svg className="h-5 w-5 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      <span className="text-[11px] font-medium">{label}</span>
    </div>
  );
}

async function fetchImageBlob(imageId: string): Promise<Blob | null> {
  await ensureValidSession(API);
  for (const delay of STREAM_RETRY_DELAYS_MS) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    try {
      const res = await fetch(getReportImageStreamUrl(imageId), { headers: authHeader() });
      if (res.ok) {
        const blob = await res.blob();
        // JSON hata gövdesi (Nest NotFound) image sanılmasın
        if (blob.type && blob.type.includes('application/json')) continue;
        if (blob.size === 0) continue;
        return blob;
      }
    } catch {
      /* sonraki deneme */
    }
  }
  return null;
}

function ReportImageThumb({
  image,
  onOpen,
  isEditable,
  onDelete,
}: {
  image: ReportImage;
  onOpen: () => void;
  isEditable?: boolean;
  onDelete?: (imageId: string) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const categoryLabel = reportImageCategoryLabel(image.category);

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

  const showError = status === 'error';

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={status !== 'ready'}
      className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50 w-24 h-24 shrink-0 text-left focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-default"
    >
      {status === 'loading' && <LoadingPlaceholder />}
      {showError && (
        <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 px-2 text-center bg-slate-100">
          Yüklenemedi
        </div>
      )}
      {status === 'ready' && src && (
        <img
          src={src}
          alt={image.caption ?? image.fileName ?? categoryLabel}
          className="w-full h-full object-cover"
          onError={() => setStatus('error')}
        />
      )}
      <div className="absolute top-1.5 right-1.5 z-20 pointer-events-none">
        <CategoryBadge category={image.category} />
      </div>
      {isEditable && onDelete && status === 'ready' && (
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(image.id);
          }}
          className="absolute bottom-1.5 left-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100"
          title="Sil"
        >
          ×
        </span>
      )}
    </button>
  );
}

function PendingUploadThumb({ category }: { category: string }) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-dashed border-blue-200 bg-blue-50/60 w-24 h-24 shrink-0">
      <LoadingPlaceholder label="Yükleniyor..." />
      <div className="absolute top-1.5 right-1.5 z-20 pointer-events-none">
        <CategoryBadge category={category} />
      </div>
    </div>
  );
}

export default function ReportImageGallery({
  images,
  pendingUploads = [],
  isEditable = false,
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
      <div className="flex flex-wrap items-start gap-2">
        {images.map((img, idx) => (
          <ReportImageThumb
            key={img.id}
            image={img}
            isEditable={isEditable}
            onDelete={onDelete}
            onOpen={() => setActiveIndex(idx)}
          />
        ))}
        {pendingUploads.map((pending) => (
          <PendingUploadThumb key={pending.tempId} category={pending.category} />
        ))}
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
            <LightboxImage image={active} />
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
                {reportImageCategoryLabel(active.category)}
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
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                >
                  İşaretle
                </button>
              )}
              {isEditable && onDelete && (
                <button
                  type="button"
                  onClick={() => { onDelete(active.id); closeLightbox(); }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
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

function LightboxImage({ image }: { image: ReportImage }) {
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

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
          alt={image.caption ?? reportImageCategoryLabel(image.category)}
          className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
          onError={() => setStatus('error')}
        />
      )}
      <div className="absolute top-3 right-3 z-10 pointer-events-none">
        <CategoryBadge category={image.category} className="text-xs px-2.5 py-1" />
      </div>
    </div>
  );
}
