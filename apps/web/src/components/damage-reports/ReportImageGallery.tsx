'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  /** Navigasyon / lightbox alt metin (çerçeve üzeri etiket yok) */
  fileNo?: string | null;
  onDelete?: (imageId: string) => void;
  /** Kayıp (diskte yok) kayıtları toplu silmek için */
  onDeleteMany?: (imageIds: string[]) => void | Promise<void>;
  onAnnotate?: (image: ReportImage) => void;
};

type LoadStatus = 'loading' | 'ready' | 'missing';

const STREAM_RETRY_DELAYS_MS = [0, 400, 1200];

function resolveStorageKey(img: ReportImage): string {
  if (img.hasAnnotation && img.annotatedKey) return img.annotatedKey;
  return img.storageKey;
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
      if (res.status === 404) return null; // dosya yok — tekrar deneme anlamsız
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
  onStatus,
}: {
  image: ReportImage;
  fileNo?: string | null;
  onOpen: () => void;
  isEditable?: boolean;
  onDelete?: (imageId: string) => void;
  onStatus: (imageId: string, status: LoadStatus) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const alt = formatReportImageFrameLabel(fileNo, image.category);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const load = async () => {
      setStatus('loading');
      onStatus(image.id, 'loading');
      setSrc(null);

      const blob = await fetchImageBlob(image.id);
      if (cancelled) return;

      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setStatus('ready');
        onStatus(image.id, 'ready');
        return;
      }

      const direct = getReportImageUrl(resolveStorageKey(image));
      if (!direct) {
        setStatus('missing');
        onStatus(image.id, 'missing');
        return;
      }

      // Doğrudan URL — onError ile missing doğrulanır
      setSrc(direct);
      setStatus('ready');
      onStatus(image.id, 'ready');
    };

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.id, image.storageKey, image.annotatedKey, image.hasAnnotation, onStatus]);

  const handleImgError = async () => {
    const blob = await fetchImageBlob(image.id);
    if (blob) {
      const objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
      setStatus('ready');
      onStatus(image.id, 'ready');
      return;
    }
    setStatus('missing');
    onStatus(image.id, 'missing');
  };

  // Kayıp dosya kutusu gösterme — üstte tek uyarı bandı var
  if (status === 'missing') return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={status !== 'ready'}
      className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50 w-36 h-36 shrink-0 text-left focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:cursor-default"
      title={alt}
    >
      {status === 'loading' && <LoadingPlaceholder />}
      {status === 'ready' && src && (
        <img
          src={src}
          alt={image.caption ?? image.fileName ?? alt}
          className="w-full h-full object-cover"
          onError={() => { void handleImgError(); }}
        />
      )}
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

function PendingUploadThumb() {
  return (
    <div className="relative rounded-lg overflow-hidden border border-dashed border-brand-200 bg-brand-50/40 w-36 h-36 shrink-0">
      <LoadingPlaceholder label="Yükleniyor..." />
    </div>
  );
}

export default function ReportImageGallery({
  images,
  pendingUploads = [],
  isEditable = false,
  fileNo,
  onDelete,
  onDeleteMany,
  onAnnotate,
}: ReportImageGalleryProps) {
  const [activeReadyIdx, setActiveReadyIdx] = useState<number | null>(null);
  const [statusById, setStatusById] = useState<Record<string, LoadStatus>>({});
  const [clearing, setClearing] = useState(false);

  const onStatus = useCallback((imageId: string, status: LoadStatus) => {
    setStatusById((prev) => (prev[imageId] === status ? prev : { ...prev, [imageId]: status }));
  }, []);

  const readyImages = useMemo(
    () => images.filter((img) => statusById[img.id] === 'ready'),
    [images, statusById],
  );
  const missingIds = useMemo(
    () => images.filter((img) => statusById[img.id] === 'missing').map((img) => img.id),
    [images, statusById],
  );
  const loadingCount = useMemo(
    () => images.filter((img) => !statusById[img.id] || statusById[img.id] === 'loading').length,
    [images, statusById],
  );

  const closeLightbox = useCallback(() => setActiveReadyIdx(null), []);

  useEffect(() => {
    if (activeReadyIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') setActiveReadyIdx((i) => (i === null ? null : Math.min(i + 1, readyImages.length - 1)));
      if (e.key === 'ArrowLeft') setActiveReadyIdx((i) => (i === null ? null : Math.max(i - 1, 0)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeReadyIdx, closeLightbox, readyImages.length]);

  const imageIdsKey = useMemo(() => images.map((i) => i.id).join('|'), [images]);

  // images listesi değişince durum haritasını temizle
  useEffect(() => {
    setStatusById({});
    setActiveReadyIdx(null);
  }, [imageIdsKey]);

  const handleClearMissing = async () => {
    if (!missingIds.length) return;
    if (!onDeleteMany && !onDelete) return;
    setClearing(true);
    try {
      if (onDeleteMany) {
        await onDeleteMany(missingIds);
      } else if (onDelete) {
        for (const id of missingIds) onDelete(id);
      }
    } finally {
      setClearing(false);
    }
  };

  if (!images.length && !pendingUploads.length) return null;

  const active = activeReadyIdx !== null ? readyImages[activeReadyIdx] : null;

  return (
    <>
      {/* ONARIM_FOTOGRAF_KATEGORI_KILIT: kategori yalnızca bölüm başlığında */}
      {missingIds.length > 0 && loadingCount === 0 && (
        <div className="mb-4 rounded-xl border border-status-warning/40 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-slate-800">
            {missingIds.length} Fotoğrafın Dosyası Sunucuda Bulunamadı
          </p>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            Kayıtlar duruyor ama dosyalar silinmiş veya taşınmış. Bu kutular açılmaz. Yeniden yükleyin;
            eski boş kayıtları temizleyebilirsiniz.
          </p>
          {isEditable && (onDeleteMany || onDelete) && (
            <button
              type="button"
              disabled={clearing}
              onClick={() => { void handleClearMissing(); }}
              className="mt-3 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {clearing ? 'Temizleniyor...' : `Kayıp Kayıtları Temizle (${missingIds.length})`}
            </button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {REPORT_IMAGE_CATEGORY_KEYS.map((cat) => {
          const catImages = images.filter(
            (img) => normalizeReportImageCategory(img.category) === cat,
          );
          const catPending = pendingUploads.filter(
            (p) => normalizeReportImageCategory(p.category) === cat,
          );
          const catVisible = catImages.filter((img) => statusById[img.id] !== 'missing');
          if (!catVisible.length && !catPending.length) {
            // Hepsi missing ise kategori başlığını da gizle (üst bant yeter)
            if (catImages.length && catImages.every((img) => statusById[img.id] === 'missing')) {
              return null;
            }
            if (!catImages.length && !catPending.length) return null;
          }
          if (!catImages.length && !catPending.length) return null;

          return (
            <div key={cat} className="space-y-2">
              {(catVisible.length > 0 || catPending.length > 0 || catImages.some((i) => !statusById[i.id] || statusById[i.id] === 'loading')) && (
                <p className="text-sm font-semibold text-slate-800">
                  {REPORT_IMAGE_CATEGORY_LABELS[cat]}
                </p>
              )}
              <div className="flex flex-wrap items-start gap-3">
                {catImages.map((img) => {
                  const readyIdx = readyImages.findIndex((r) => r.id === img.id);
                  return (
                    <ReportImageThumb
                      key={img.id}
                      image={img}
                      fileNo={fileNo}
                      isEditable={isEditable}
                      onDelete={onDelete}
                      onStatus={onStatus}
                      onOpen={() => {
                        if (readyIdx >= 0) setActiveReadyIdx(readyIdx);
                      }}
                    />
                  );
                })}
                {catPending.map((pending) => (
                  <PendingUploadThumb key={pending.tempId} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {active && activeReadyIdx !== null && (
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
                disabled={activeReadyIdx <= 0}
                onClick={() => setActiveReadyIdx((i) => Math.max((i ?? 0) - 1, 0))}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 disabled:opacity-40"
              >
                ← Önceki
              </button>
              <span className="text-xs text-slate-300 tabular-nums">
                {activeReadyIdx + 1} / {readyImages.length}
                {' · '}
                {formatReportImageFrameLabel(fileNo, active.category)}
              </span>
              <button
                type="button"
                disabled={activeReadyIdx >= readyImages.length - 1}
                onClick={() => setActiveReadyIdx((i) => Math.min((i ?? 0) + 1, readyImages.length - 1))}
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
  const alt = formatReportImageFrameLabel(fileNo, image.category);

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
        <div className="text-sm text-red-300">Fotoğraf dosyası bulunamadı.</div>
      )}
      {status === 'ready' && src && (
        <img
          src={src}
          alt={image.caption ?? alt}
          className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
          onError={() => setStatus('error')}
        />
      )}
    </div>
  );
}
