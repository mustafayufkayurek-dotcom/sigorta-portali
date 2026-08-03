'use client';

/** FSB_PHASE_1_2_LOCK — docs/project-governance/canli-kabul/FIELD_SURVEY_BRIEFS_PHASE_1_2_KILIT.md */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type AspectKey = 'original' | '1:1' | '4:3' | '16:9';

type CropRect = { x: number; y: number; w: number; h: number };

interface FieldSurveyCropModalProps {
  open: boolean;
  file: File | null;
  onClose: () => void;
  onSave: (cropped: File) => void;
}

const ASPECT_OPTIONS: { key: AspectKey; label: string; ratio: number | null }[] = [
  { key: 'original', label: 'Özgün', ratio: null },
  { key: '1:1', label: '1:1', ratio: 1 },
  { key: '4:3', label: '4:3', ratio: 4 / 3 },
  { key: '16:9', label: '16:9', ratio: 16 / 9 },
];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Görsel yüklenemedi'));
    img.src = url;
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function fitCrop(
  imgW: number,
  imgH: number,
  aspect: number | null,
  cover = 0.86,
): CropRect {
  if (!aspect) {
    const w = imgW * cover;
    const h = imgH * cover;
    return { x: (imgW - w) / 2, y: (imgH - h) / 2, w, h };
  }
  const imgRatio = imgW / imgH;
  let w: number;
  let h: number;
  if (imgRatio > aspect) {
    h = imgH * cover;
    w = h * aspect;
  } else {
    w = imgW * cover;
    h = w / aspect;
  }
  return { x: (imgW - w) / 2, y: (imgH - h) / 2, w, h };
}

export function FieldSurveyCropModal({ open, file, onClose, onSave }: FieldSurveyCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [rotation, setRotation] = useState(0);
  const [aspectKey, setAspectKey] = useState<AspectKey>('original');
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [history, setHistory] = useState<CropRect[]>([]);
  const [drag, setDrag] = useState<{
    mode: 'move' | 'nw' | 'ne' | 'sw' | 'se';
    startX: number;
    startY: number;
    origin: CropRect;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aspectRatio = useMemo(
    () => ASPECT_OPTIONS.find((o) => o.key === aspectKey)?.ratio ?? null,
    [aspectKey],
  );

  useEffect(() => {
    if (!open || !file) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setObjectUrl(null);
      setNatural(null);
      setCrop(null);
      setHistory([]);
      setRotation(0);
      setAspectKey('original');
      setError(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    let cancelled = false;
    void loadImage(url)
      .then((img) => {
        if (cancelled) return;
        setNatural({ w: img.naturalWidth, h: img.naturalHeight });
        const initial = fitCrop(img.naturalWidth, img.naturalHeight, null);
        setCrop(initial);
        setHistory([initial]);
      })
      .catch(() => {
        if (!cancelled) setError('Görsel açılamadı.');
      });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file]);

  const displaySize = useMemo(() => {
    if (!natural) return { w: 1, h: 1 };
    const rotated = rotation % 180 !== 0;
    return rotated
      ? { w: natural.h, h: natural.w }
      : { w: natural.w, h: natural.h };
  }, [natural, rotation]);

  useEffect(() => {
    if (!natural || !open) return;
    const next = fitCrop(displaySize.w, displaySize.h, aspectRatio);
    setCrop(next);
    setHistory((h) => [...h.slice(-19), next]);
  }, [aspectKey]); // oran değişince yeniden ortala

  const drawRotated = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    cw: number,
    ch: number,
    scale: number,
  ) => {
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, (-natural!.w * scale) / 2, (-natural!.h * scale) / 2, natural!.w * scale, natural!.h * scale);
    ctx.restore();
  };

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !objectUrl || !natural || !crop) return;
    const img = await loadImage(objectUrl);
    const { w: dw, h: dh } = displaySize;
    const maxW = Math.min(640, typeof window !== 'undefined' ? window.innerWidth - 48 : 640);
    const scale = Math.min(1, maxW / dw);
    canvas.width = Math.round(dw * scale);
    canvas.height = Math.round(dh * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawRotated(ctx, img, canvas.width, canvas.height, scale);

    const sx = crop.x * scale;
    const sy = crop.y * scale;
    const sw = crop.w * scale;
    const sh = crop.h * scale;

    ctx.fillStyle = 'rgba(15,23,42,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, sy, sw, sh);
    ctx.clip();
    drawRotated(ctx, img, canvas.width, canvas.height, scale);
    ctx.restore();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, sw, sh);
    const hs = 10;
    ctx.fillStyle = '#38bdf8';
    for (const [hx, hy] of [
      [sx, sy],
      [sx + sw, sy],
      [sx, sy + sh],
      [sx + sw, sy + sh],
    ] as const) {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
    }
  }, [objectUrl, natural, crop, rotation, displaySize]);

  useEffect(() => {
    void draw();
  }, [draw]);

  const pushHistory = (next: CropRect) => {
    setCrop(next);
    setHistory((h) => [...h.slice(-19), next]);
  };

  const pointerToImage = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !crop) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * displaySize.w,
      y: ((clientY - rect.top) / rect.height) * displaySize.h,
    };
  };

  const hitHandle = (x: number, y: number): typeof drag extends null ? never : NonNullable<typeof drag>['mode'] | 'move' | null => {
    if (!crop) return null;
    const tol = Math.max(16, Math.min(crop.w, crop.h) * 0.08);
    const corners: Array<[number, number, 'nw' | 'ne' | 'sw' | 'se']> = [
      [crop.x, crop.y, 'nw'],
      [crop.x + crop.w, crop.y, 'ne'],
      [crop.x, crop.y + crop.h, 'sw'],
      [crop.x + crop.w, crop.y + crop.h, 'se'],
    ];
    for (const [cx, cy, mode] of corners) {
      if (Math.abs(x - cx) <= tol && Math.abs(y - cy) <= tol) return mode;
    }
    if (x >= crop.x && x <= crop.x + crop.w && y >= crop.y && y <= crop.y + crop.h) return 'move';
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const p = pointerToImage(e.clientX, e.clientY);
    if (!p || !crop) return;
    const mode = hitHandle(p.x, p.y);
    if (!mode) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ mode, startX: p.x, startY: p.y, origin: { ...crop } });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !crop) return;
    const p = pointerToImage(e.clientX, e.clientY);
    if (!p) return;
    const dx = p.x - drag.startX;
    const dy = p.y - drag.startY;
    const o = drag.origin;
    const maxW = displaySize.w;
    const maxH = displaySize.h;
    let next: CropRect = { ...o };

    if (drag.mode === 'move') {
      next.x = clamp(o.x + dx, 0, maxW - o.w);
      next.y = clamp(o.y + dy, 0, maxH - o.h);
    } else {
      let x1 = o.x;
      let y1 = o.y;
      let x2 = o.x + o.w;
      let y2 = o.y + o.h;
      if (drag.mode.includes('w')) x1 = clamp(o.x + dx, 0, x2 - 24);
      if (drag.mode.includes('e')) x2 = clamp(o.x + o.w + dx, x1 + 24, maxW);
      if (drag.mode.includes('n')) y1 = clamp(o.y + dy, 0, y2 - 24);
      if (drag.mode.includes('s')) y2 = clamp(o.y + o.h + dy, y1 + 24, maxH);

      if (aspectRatio) {
        const w = x2 - x1;
        const h = y2 - y1;
        if (drag.mode === 'se' || drag.mode === 'ne') {
          const nh = w / aspectRatio;
          if (drag.mode === 'se') y2 = clamp(y1 + nh, y1 + 24, maxH);
          else y1 = clamp(y2 - nh, 0, y2 - 24);
        } else {
          const nw = h * aspectRatio;
          if (drag.mode === 'sw') x1 = clamp(x2 - nw, 0, x2 - 24);
          else x2 = clamp(x1 + nw, x1 + 24, maxW);
        }
      }
      next = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    }
    setCrop(next);
  };

  const onPointerUp = () => {
    if (drag && crop) {
      setHistory((h) => [...h.slice(-19), { ...crop }]);
    }
    setDrag(null);
  };

  const handleUndo = () => {
    setHistory((h) => {
      if (h.length <= 1) return h;
      const next = h.slice(0, -1);
      setCrop(next[next.length - 1] ?? null);
      return next;
    });
  };

  const handleReset = () => {
    if (!natural) return;
    setRotation(0);
    setAspectKey('original');
    const initial = fitCrop(natural.w, natural.h, null);
    pushHistory(initial);
  };

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  useEffect(() => {
    if (!natural || !open) return;
    const next = fitCrop(displaySize.w, displaySize.h, aspectRatio);
    setCrop(next);
    setHistory((h) => [...h.slice(-19), next]);
    // rotation değişince crop yeniden
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotation]);

  const handleSave = async () => {
    if (!objectUrl || !natural || !crop) return;
    setBusy(true);
    setError(null);
    try {
      const img = await loadImage(objectUrl);
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(crop.w));
      out.height = Math.max(1, Math.round(crop.h));
      const ctx = out.getContext('2d');
      if (!ctx) throw new Error('Canvas yok');

      // Draw rotated full image onto temp, then crop
      const temp = document.createElement('canvas');
      temp.width = displaySize.w;
      temp.height = displaySize.h;
      const tctx = temp.getContext('2d');
      if (!tctx) throw new Error('Canvas yok');
      tctx.translate(temp.width / 2, temp.height / 2);
      tctx.rotate((rotation * Math.PI) / 180);
      tctx.drawImage(img, -natural.w / 2, -natural.h / 2, natural.w, natural.h);

      ctx.drawImage(temp, crop.x, crop.y, crop.w, crop.h, 0, 0, out.width, out.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob(resolve, 'image/jpeg', 0.92),
      );
      if (!blob) throw new Error('Kırpma başarısız');
      const cropped = new File([blob], `kesif-kirpilmis-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });
      onSave(cropped);
      onClose();
    } catch {
      setError('Kırpılmış görsel kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  };

  if (!open || !file) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative z-10 flex max-h-[96vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="field-survey-crop-title"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <h3 id="field-survey-crop-title" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Fotoğrafı Kırp
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-4 py-3">
          {error && (
            <p className="rounded-lg border border-status-danger/30 bg-red-50 px-3 py-2 text-xs text-status-danger">
              {error}
            </p>
          )}
          <div className="flex justify-center overflow-auto rounded-xl bg-slate-900 p-2">
            <canvas
              ref={canvasRef}
              className="max-h-[55vh] max-w-full touch-none cursor-move"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {ASPECT_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setAspectKey(o.key)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                  aspectKey === o.key
                    ? 'bg-brand-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRotate}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Döndür
            </button>
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length <= 1}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Geri Al
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Sıfırla
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Köşeleri sürükleyerek kırpma alanını ayarlayın. Oran seçebilir, döndürebilirsiniz.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            İptal
          </button>
          <button
            type="button"
            disabled={busy || !crop}
            onClick={() => void handleSave()}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'Kaydediliyor…' : 'Kırpmayı Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
