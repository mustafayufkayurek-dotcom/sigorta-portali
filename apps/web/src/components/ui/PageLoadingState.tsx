'use client';

import { LoadingScreen } from './LoadingIndicator';

export interface PageLoadingStateProps {
  /** Boş bırakılırsa yalnızca spinner gösterilir */
  text?: string;
  className?: string;
  compact?: boolean;
}

/** Sayfa / tablo / modal gövdesi — içerik alanının ortası */
export function PageLoadingState({
  text,
  className,
  compact = false,
}: PageLoadingStateProps) {
  const spacing = compact ? 'py-8' : 'py-16';

  return (
    <LoadingScreen
      label={text}
      className={[spacing, className].filter(Boolean).join(' ')}
    />
  );
}
