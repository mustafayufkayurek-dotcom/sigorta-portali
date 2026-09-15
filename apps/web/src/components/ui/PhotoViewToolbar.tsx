'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type WheelEvent } from 'react';
import { RotateCcw, RotateCw, Undo2, ZoomIn, ZoomOut } from 'lucide-react';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const STEP = 0.25;

function clampZoom(z: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));
}

export function usePhotoViewTransform(resetKey: string | number) {
  const [zoom, setZoom] = useState(1);
  const [deg, setDeg] = useState(0);

  useEffect(() => {
    setZoom(1);
    setDeg(0);
  }, [resetKey]);

  const zoomIn = useCallback(() => setZoom((z) => clampZoom(z + STEP)), []);
  const zoomOut = useCallback(() => setZoom((z) => clampZoom(z - STEP)), []);
  const rotateLeft = useCallback(() => setDeg((d) => d - 90), []);
  const rotateRight = useCallback(() => setDeg((d) => d + 90), []);
  const reset = useCallback(() => {
    setZoom(1);
    setDeg(0);
  }, []);

  const onWheel = useCallback(
    (e: WheelEvent) => {
      if (e.deltaY < 0) zoomIn();
      else if (e.deltaY > 0) zoomOut();
    },
    [zoomIn, zoomOut],
  );

  const style = useMemo<CSSProperties>(
    () => ({
      transform: `rotate(${deg}deg) scale(${zoom})`,
      transformOrigin: 'center center',
      transition: 'transform 120ms ease-out',
    }),
    [deg, zoom],
  );

  return { zoom, deg, zoomIn, zoomOut, rotateLeft, rotateRight, reset, onWheel, style };
}

const toolBtn =
  'flex h-9 w-9 items-center justify-center rounded-lg border border-white/40 text-white hover:bg-white/10';

type Props = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onReset: () => void;
  testIdPrefix: string;
};

export function PhotoViewToolbar({
  onZoomIn,
  onZoomOut,
  onRotateLeft,
  onRotateRight,
  onReset,
  testIdPrefix,
}: Props) {
  return (
    <div className="flex items-center gap-1.5" role="toolbar" aria-label="Fotoğraf Görünümü">
      <button
        type="button"
        className={toolBtn}
        onClick={onZoomIn}
        aria-label="Yakınlaştır"
        data-testid={`${testIdPrefix}-yakinlastir`}
      >
        <ZoomIn className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className={toolBtn}
        onClick={onZoomOut}
        aria-label="Uzaklaştır"
        data-testid={`${testIdPrefix}-uzaklastir`}
      >
        <ZoomOut className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className={toolBtn}
        onClick={onRotateLeft}
        aria-label="Sola Çevir"
        data-testid={`${testIdPrefix}-sola-cevir`}
      >
        <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className={toolBtn}
        onClick={onRotateRight}
        aria-label="Sağa Çevir"
        data-testid={`${testIdPrefix}-saga-cevir`}
      >
        <RotateCw className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className={toolBtn}
        onClick={onReset}
        aria-label="Sıfırla"
        data-testid={`${testIdPrefix}-sifirla`}
      >
        <Undo2 className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
