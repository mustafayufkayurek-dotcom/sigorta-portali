'use client';

import { useCallback, useEffect, useState } from 'react';
import { authHeader } from '@/utils/api';
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

type ReportImageGalleryProps = {
  images: ReportImage[];
  categoryLabels: Record<string, string>;
  categoryColors?: Record<string, string>;
  isEditable?: boolean;
  onDelete?: (imageId: string) => void;
  onAnnotate?: (image: ReportImage) => void;
};

function resolveStorageKey(img: ReportImage): string {
  if (img.hasAnnotation && img.annotatedKey) return img.annotatedKey;
  return img.storageKey;
}

function ReportImageThumb({
  image,
  categoryLabel,
  categoryColor,
  onOpen,
}: {
  image: ReportImage;
  categoryLabel: string;
  categoryColor: string;
  onOpen: () => void;
}) {
  const [src, setSrc] = useState(() => getReportImageUrl(resolveStorageKey(image)));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const load = async () => {
      setFailed(false);
      const direct = getReportImageUrl(resolveStorageKey(image));
      setSrc(direct);

      try {
        const res = await fetch(getReportImageStreamUrl(image.id), { headers: authHeader() });
        if (!res.ok) throw new Error('stream failed');
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.id, image.storageKey, image.annotatedKey, image.hasAnnotation]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative group rounded-xl overflow-hidden border border-slate-100 bg-slate-50 aspect-square w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      {!failed ? (
        <img
          src={src}
          alt={image.caption ?? image.fileName ?? categoryLabel}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 px-2 text-center">
          Yüklenemedi
        </div>
      )}
      <div className="absolute top-1.5 right-1.5">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shadow-sm ${categoryColor}`}>
          {categoryLabel}
        </span>
      </div>
    </button>
  );
}

export default function ReportImageGallery({
  images,
  categoryLabels,
  categoryColors = {},
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

  if (!images.length) return null;

  const active = activeIndex !== null ? images[activeIndex] : null;

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {images.map((img, idx) => {
          const cat = img.category ?? 'damage';
          return (
            <ReportImageThumb
              key={img.id}
              image={img}
              categoryLabel={categoryLabels[cat] ?? cat}
              categoryColor={categoryColors[cat] ?? 'bg-slate-100 text-slate-600'}
              onOpen={() => setActiveIndex(idx)}
            />
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
            <LightboxImage image={active} categoryLabels={categoryLabels} />
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
                {categoryLabels[active.category ?? 'damage'] ?? active.category}
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

function LightboxImage({
  image,
  categoryLabels,
}: {
  image: ReportImage;
  categoryLabels: Record<string, string>;
}) {
  const [src, setSrc] = useState(() => getReportImageUrl(resolveStorageKey(image)));

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const load = async () => {
      const direct = getReportImageUrl(resolveStorageKey(image));
      setSrc(direct);
      try {
        const res = await fetch(getReportImageStreamUrl(image.id), { headers: authHeader() });
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch { /* direct URL */ }
    };

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image]);

  const cat = image.category ?? 'damage';

  return (
    <div className="relative w-full flex items-center justify-center max-h-[75vh]">
      <img
        src={src}
        alt={image.caption ?? categoryLabels[cat] ?? cat}
        className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
      />
    </div>
  );
}
