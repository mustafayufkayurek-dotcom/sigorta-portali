'use client';

import { RunningLightsText, type RunningLightsVariant } from './RunningLightsText';

export interface PageLoadingStateProps {
  text?: string;
  className?: string;
  variant?: RunningLightsVariant;
  compact?: boolean;
}

/** Sayfa / tablo / modal ortası — yanıp sönen harfli bekleme göstergesi */
export function PageLoadingState({
  text = 'Yükleniyor',
  className,
  variant = 'blue',
  compact = false,
}: PageLoadingStateProps) {
  const spacing = compact ? 'gap-2 py-8' : 'gap-4 py-16';
  const rootClass = ['flex flex-col items-center justify-center text-center', spacing, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass}>
      <RunningLightsText text={text} size={compact ? 'sm' : 'md'} variant={variant} />
    </div>
  );
}
