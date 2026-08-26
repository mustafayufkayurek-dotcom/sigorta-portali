'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AuthBlobImg } from '@/components/ui/AuthBlobImg';

type Props = {
  srcs: string[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
  alt?: string;
};

function wrapIndex(index: number, dir: -1 | 1, total: number) {
  if (total < 1) return 0;
  return (index + dir + total) % total;
}

/** Kart overflow’una takılmaz: body’ye basılır. Birden fazla resimde Önceki/Sonraki döner. */
export function PhotoLightbox({ srcs, index, onIndex, onClose, alt = 'Fotoğraf' }: Props) {
  const total = srcs.length;
  const src = srcs[index];
  const canNav = total > 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (!canNav) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onIndex(wrapIndex(index, -1, total));
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onIndex(wrapIndex(index, 1, total));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canNav, index, onClose, onIndex, total]);

  if (typeof document === 'undefined' || !src) return null;

  const go = (dir: -1 | 1) => {
    if (!canNav) return;
    onIndex(wrapIndex(index, dir, total));
  };

  const navBtn =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-800 shadow-lg hover:bg-slate-100';

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      data-testid="foto-lightbox"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-0 top-0 z-20 rounded-full bg-white p-1.5 shadow-lg"
          aria-label="Kapat"
        >
          <X className="h-4 w-4 text-slate-700" />
        </button>

        <div className="mt-8 flex w-full items-center justify-center gap-3">
          {canNav ? (
            <button
              type="button"
              onClick={() => go(-1)}
              className={navBtn}
              aria-label="Önceki"
              data-testid="foto-lightbox-onceki"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
            </button>
          ) : null}
          <div className="flex min-h-[200px] min-w-0 flex-1 items-center justify-center">
            <AuthBlobImg
              url={src}
              alt={alt}
              className="max-h-[72vh] max-w-full rounded-lg object-contain shadow-2xl"
            />
          </div>
          {canNav ? (
            <button
              type="button"
              onClick={() => go(1)}
              className={navBtn}
              aria-label="Sonraki"
              data-testid="foto-lightbox-sonraki"
            >
              <ChevronRight className="h-6 w-6" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <span className="text-xs tabular-nums text-slate-200">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/40 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
