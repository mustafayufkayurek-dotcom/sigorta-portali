'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface ReceiptCameraModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function ReceiptCameraModal({ open, onClose, onCapture }: ReceiptCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setError(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
        setError(null);
      } catch {
        if (!cancelled) {
          setError('Kamera açılamadı. Tarayıcı izni verin veya “Dosyadan Seç” kullanın.');
          setReady(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, stopStream]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `fis-${Date.now()}.jpg`, { type: 'image/jpeg' });
        stopStream();
        onCapture(file);
        onClose();
      },
      'image/jpeg',
      0.92,
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-camera-title"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 px-5 py-3">
          <h3 id="receipt-camera-title" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Fiş / Fatura Çek
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Kapat"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {error ? (
            <p className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          ) : (
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-900">
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                  Kamera açılıyor...
                </div>
              )}
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Fişi kadraja yerleştirin ve “Fotoğraf Çek”e basın.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            İptal
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={capture}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Fotoğraf Çek
          </button>
        </div>
      </div>
    </div>
  );
}

/** Telefonda yerel kamera uygulaması; masaüstünde webcam modalı */
export function prefersNativeCameraCapture(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
