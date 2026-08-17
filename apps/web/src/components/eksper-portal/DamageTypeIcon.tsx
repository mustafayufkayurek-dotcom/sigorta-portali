'use client';

type DamageTypeIconProps = {
  label?: string | null;
  className?: string;
};

const ICON_BASE = '/design-system/icons';

/** Hasar türü → referans SVG (Lucide/emoji yok) */
export function damageTypeIconSrc(label?: string | null): string | null {
  const s = (label ?? '').toLocaleLowerCase('tr-TR');
  if (/yangın|ates|ateş|fire/.test(s)) return `${ICON_BASE}/yangin.svg`;
  if (/cam|vitray|glass|pencere|window/.test(s)) return `${ICON_BASE}/cam_kirilmasi.svg`;
  if (/su|baskın|baski|ıslak|islak|leak|sel|dahili|sızınt|sizint/.test(s)) {
    return `${ICON_BASE}/dahili_su.svg`;
  }
  return null;
}

export function DamageTypeIcon({ label, className = 'h-3.5 w-3.5' }: DamageTypeIconProps) {
  const src = damageTypeIconSrc(label);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      className={`shrink-0 object-contain ${className}`}
      style={{
        // slate-400 ailesi (#9AA3AF) — stroke SVG’yi tek renk yapar
        filter:
          'brightness(0) saturate(100%) invert(68%) sepia(8%) saturate(314%) hue-rotate(176deg) brightness(92%) contrast(87%)',
      }}
    />
  );
}
