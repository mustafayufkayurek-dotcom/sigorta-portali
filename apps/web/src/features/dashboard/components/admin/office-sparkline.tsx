'use client';

type OfficeSparklineProps = {
  values: number[];
  stroke?: string;
  className?: string;
};

/** Gerçek sayı dizisinden mini trend — sahte veri üretmez. */
export function OfficeSparkline({
  values,
  stroke = '#2563EB',
  className = 'h-8 w-[72px]',
}: OfficeSparklineProps) {
  if (!values.length || values.every((v) => !Number.isFinite(v))) {
    return <span className={`inline-block ${className}`} aria-hidden="true" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 72;
  const h = 32;
  const pad = 2;
  const points = values
    .map((v, i) => {
      const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
