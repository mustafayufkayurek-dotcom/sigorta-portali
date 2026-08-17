'use client';

/** FSB_PHASE_1_2_LOCK — docs/project-governance/canli-kabul/FIELD_SURVEY_BRIEFS_PHASE_1_2_KILIT.md */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toTitleCaseTR } from '@/utils/text-helpers';

export interface FieldSurveyCameraDimension {
  label: string;
  genislikCm: number | null;
  yukseklikCm: number | null;
  derinlikCm: number | null;
}

interface FieldSurveyCameraModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (payload: {
    file: File;
    annotatedFile: File | null;
    dimensions: FieldSurveyCameraDimension[];
  }) => void;
  initialDimensions?: FieldSurveyCameraDimension[];
}

function parseCm(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function emptyDim(index: number): FieldSurveyCameraDimension {
  return {
    label: `Alan ${index}`,
    genislikCm: null,
    yukseklikCm: null,
    derinlikCm: null,
  };
}

function dimSummaryLine(d: FieldSurveyCameraDimension): string {
  const parts = [
    d.genislikCm != null ? `G:${d.genislikCm}` : null,
    d.yukseklikCm != null ? `Y:${d.yukseklikCm}` : null,
    d.derinlikCm != null ? `D:${d.derinlikCm}` : null,
  ].filter(Boolean);
  return parts.length ? `${d.label} (${parts.join(' ')} cm)` : d.label;
}

function hasAnyMeasure(d: FieldSurveyCameraDimension): boolean {
  return d.genislikCm != null || d.yukseklikCm != null || d.derinlikCm != null;
}

export function FieldSurveyCameraModal({
  open,
  onClose,
  onCapture,
  initialDimensions,
}: FieldSurveyCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [label, setLabel] = useState('Alan 1');
  const [genislik, setGenislik] = useState('');
  const [yukseklik, setYukseklik] = useState('');
  const [derinlik, setDerinlik] = useState('');
  const [dimensions, setDimensions] = useState<FieldSurveyCameraDimension[]>([emptyDim(1)]);

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

    const seed =
      initialDimensions && initialDimensions.length > 0
        ? initialDimensions.map((d, i) => ({
            label: d.label?.trim() || `Alan ${i + 1}`,
            genislikCm: d.genislikCm,
            yukseklikCm: d.yukseklikCm,
            derinlikCm: d.derinlikCm,
          }))
        : [emptyDim(1)];
    setDimensions(seed);
    setLabel(`Alan ${seed.length}`);
    setGenislik('');
    setYukseklik('');
    setDerinlik('');

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
          setError('Kamera açılamadı. Tarayıcı izni verin veya dosyadan seçin.');
          setReady(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
    // initialDimensions yalnızca modal açılışında okunur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stopStream]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const addCurrentMeasure = () => {
    const g = parseCm(genislik);
    const y = parseCm(yukseklik);
    const d = parseCm(derinlik);
    if (g == null && y == null && d == null) return;
    const row: FieldSurveyCameraDimension = {
      label: toTitleCaseTR(label.trim()) || `Alan ${dimensions.length + 1}`,
      genislikCm: g,
      yukseklikCm: y,
      derinlikCm: d,
    };
    const next = [...dimensions.filter((x) => hasAnyMeasure(x)), row];
    setDimensions(next.length ? next : [row]);
    setLabel(`Alan ${next.length + 1}`);
    setGenislik('');
    setYukseklik('');
    setDerinlik('');
  };

  const removeDim = (idx: number) => {
    setDimensions((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [emptyDim(1)];
    });
  };

  const drawAnnotations = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dims: FieldSurveyCameraDimension[],
  ) => {
    const margin = Math.round(Math.min(w, h) * 0.06);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(2, Math.round(w / 400));
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);
    ctx.setLineDash([]);

    // Corner L marks
    const arm = Math.round(margin * 0.7);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = Math.max(3, Math.round(w / 320));
    const corners: Array<[number, number, number, number]> = [
      [margin, margin, 1, 1],
      [w - margin, margin, -1, 1],
      [margin, h - margin, 1, -1],
      [w - margin, h - margin, -1, -1],
    ];
    for (const [x, y, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + arm * sx, y);
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + arm * sy);
      ctx.stroke();
    }

    // Center crosshair
    const cx = w / 2;
    const cy = h / 2;
    const cross = Math.round(Math.min(w, h) * 0.04);
    ctx.strokeStyle = 'rgba(56,189,248,0.9)';
    ctx.beginPath();
    ctx.moveTo(cx - cross, cy);
    ctx.lineTo(cx + cross, cy);
    ctx.moveTo(cx, cy - cross);
    ctx.lineTo(cx, cy + cross);
    ctx.stroke();

    const measured = dims.filter(hasAnyMeasure);
    if (measured.length === 0) return;

    const boxW = Math.min(Math.round(w * 0.55), 420);
    const lineH = Math.round(Math.min(h, w) * 0.035);
    const pad = Math.round(lineH * 0.4);
    const boxH = pad * 2 + lineH * (1 + measured.length);
    const bx = margin;
    const by = h - margin - boxH;
    ctx.fillStyle = 'rgba(15,23,42,0.72)';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `600 ${Math.max(12, Math.round(lineH * 0.75))}px system-ui,sans-serif`;
    ctx.fillText('Ölçü Özeti', bx + pad, by + pad + lineH * 0.75);
    ctx.font = `500 ${Math.max(11, Math.round(lineH * 0.65))}px system-ui,sans-serif`;
    measured.forEach((d, i) => {
      ctx.fillText(dimSummaryLine(d), bx + pad, by + pad + lineH * (1.7 + i));
    });
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !ready) return;

    // Include in-progress fields if filled
    let finalDims = dimensions.filter(hasAnyMeasure);
    const g = parseCm(genislik);
    const y = parseCm(yukseklik);
    const d = parseCm(derinlik);
    if (g != null || y != null || d != null) {
      finalDims = [
        ...finalDims,
        {
          label: toTitleCaseTR(label.trim()) || `Alan ${finalDims.length + 1}`,
          genislikCm: g,
          yukseklikCm: y,
          derinlikCm: d,
        },
      ];
    }
    if (finalDims.length === 0) finalDims = [emptyDim(1)];

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (rawBlob) => {
        if (!rawBlob) return;
        const file = new File([rawBlob], `kesif-${Date.now()}.jpg`, { type: 'image/jpeg' });

        const annCanvas = document.createElement('canvas');
        annCanvas.width = canvas.width;
        annCanvas.height = canvas.height;
        const annCtx = annCanvas.getContext('2d');
        let annotatedFile: File | null = null;
        if (annCtx) {
          annCtx.drawImage(canvas, 0, 0);
          drawAnnotations(annCtx, annCanvas.width, annCanvas.height, finalDims);
          annCanvas.toBlob(
            (annBlob) => {
              if (annBlob) {
                annotatedFile = new File([annBlob], `kesif-isaretli-${Date.now()}.jpg`, {
                  type: 'image/jpeg',
                });
              }
              stopStream();
              onCapture({ file, annotatedFile, dimensions: finalDims });
              onClose();
            },
            'image/jpeg',
            0.92,
          );
          return;
        }

        stopStream();
        onCapture({ file, annotatedFile: null, dimensions: finalDims });
        onClose();
      },
      'image/jpeg',
      0.92,
    );
  };

  if (!open) return null;

  const summaryDims = dimensions.filter(hasAnyMeasure);
  const livePreviewParts = [
    parseCm(genislik) != null ? `G:${genislik}` : null,
    parseCm(yukseklik) != null ? `Y:${yukseklik}` : null,
    parseCm(derinlik) != null ? `D:${derinlik}` : null,
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative z-10 flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="field-survey-camera-title"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-700">
          <h3
            id="field-survey-camera-title"
            className="text-sm font-semibold text-slate-800 dark:text-slate-100"
          >
            Saha Keşif Ölçüsü
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          {error ? (
            <p className="rounded-lg border border-status-danger/30 bg-red-50 px-4 py-3 text-sm text-status-danger">
              {error}
            </p>
          ) : (
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-900">
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
              {/* Ölçü emareleri */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-[8%] border border-dashed border-white/70" />
                <div className="absolute left-[8%] top-[8%] h-5 w-5 border-l-2 border-t-2 border-sky-400" />
                <div className="absolute right-[8%] top-[8%] h-5 w-5 border-r-2 border-t-2 border-sky-400" />
                <div className="absolute bottom-[8%] left-[8%] h-5 w-5 border-b-2 border-l-2 border-sky-400" />
                <div className="absolute bottom-[8%] right-[8%] h-5 w-5 border-b-2 border-r-2 border-sky-400" />
                <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2">
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-sky-400/90" />
                  <div className="absolute bottom-0 left-1/2 top-0 w-px bg-sky-400/90" />
                </div>
                <div className="absolute left-[10%] top-[10%] rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-sky-200">
                  G
                </div>
                <div className="absolute right-[10%] top-1/2 -translate-y-1/2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-sky-200">
                  Y
                </div>
                <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-sky-200">
                  D
                </div>
                {livePreviewParts.length > 0 && (
                  <div className="absolute bottom-[10%] left-[10%] max-w-[70%] rounded bg-black/65 px-2 py-1 text-[10px] text-white">
                    {label}: {livePreviewParts.join(' ')} cm
                  </div>
                )}
              </div>
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                  Kamera açılıyor…
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-slate-500">
            Lazer metre değerlerini girin; kadrajdaki emareler ölçü yönünü gösterir. Fotoğraf ölçü
            özetiyle birlikte kaydedilir.
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="col-span-2 block text-[11px] font-medium text-slate-600 sm:col-span-1">
              Alan
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-[11px] font-medium text-slate-600">
              Genişlik (Cm)
              <input
                inputMode="decimal"
                value={genislik}
                onChange={(e) => setGenislik(e.target.value)}
                placeholder="cm"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-[11px] font-medium text-slate-600">
              Yükseklik (Cm)
              <input
                inputMode="decimal"
                value={yukseklik}
                onChange={(e) => setYukseklik(e.target.value)}
                placeholder="cm"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-[11px] font-medium text-slate-600">
              Derinlik (Cm)
              <input
                inputMode="decimal"
                value={derinlik}
                onChange={(e) => setDerinlik(e.target.value)}
                placeholder="cm"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={addCurrentMeasure}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Ölçüyü Özete Ekle
          </button>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="mb-1.5 text-xs font-semibold text-slate-700">Ölçü Özeti</p>
            {summaryDims.length === 0 ? (
              <p className="text-[11px] text-slate-400">Henüz ölçü eklenmedi.</p>
            ) : (
              <ul className="space-y-1">
                {dimensions.map((d, i) =>
                  hasAnyMeasure(d) ? (
                    <li key={`${d.label}-${i}`} className="flex items-center justify-between gap-2 text-xs text-slate-700">
                      <span>{dimSummaryLine(d)}</span>
                      <button
                        type="button"
                        onClick={() => removeDim(i)}
                        className="text-status-danger hover:underline"
                      >
                        Sil
                      </button>
                    </li>
                  ) : null,
                )}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-700">
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
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Fotoğraf Çek
          </button>
        </div>
      </div>
    </div>
  );
}
