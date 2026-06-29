'use client';

interface Props {
  size?: number;
  className?: string;
}

/** Kurumsal küre — dönen halkalar (login / favicon ile uyumlu) */
export function MeridyenGlobeAnimated({ size = 52, className = '' }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`meridyen-globe ${className}`.trim()}
      role="img"
      aria-hidden
    >
      <defs>
        <linearGradient id="globeSphere" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#e8f2fc" />
          <stop offset="100%" stopColor="#b8d4f0" />
        </linearGradient>
        <filter id="globeShadow" x="-20%" y="-10%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0b1f3a" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* Küre gövdesi */}
      <circle cx="32" cy="32" r="22" fill="url(#globeSphere)" filter="url(#globeShadow)" />

      {/* Meridyen / paralel çizgiler */}
      <g stroke="#1a3870" strokeWidth="0.9" fill="none" opacity="0.55">
        <ellipse cx="32" cy="32" rx="22" ry="8" />
        <ellipse cx="32" cy="32" rx="22" ry="14" />
        <ellipse cx="32" cy="32" rx="8" ry="22" />
        <ellipse cx="32" cy="32" rx="14" ry="22" />
        <line x1="10" y1="32" x2="54" y2="32" />
      </g>

      {/* Dönen yörünge halkaları */}
      <g className="globe-ring globe-ring-a">
        <ellipse cx="32" cy="32" rx="28" ry="10" fill="none" stroke="#5eb3f6" strokeWidth="2.2" opacity="0.95" />
      </g>
      <g className="globe-ring globe-ring-b">
        <ellipse cx="32" cy="32" rx="28" ry="10" fill="none" stroke="#e31b23" strokeWidth="2.2" opacity="0.95" />
      </g>
      <g className="globe-ring globe-ring-c">
        <ellipse cx="32" cy="32" rx="28" ry="10" fill="none" stroke="#123063" strokeWidth="2.2" opacity="0.95" />
      </g>
    </svg>
  );
}
