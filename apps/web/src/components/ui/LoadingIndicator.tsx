'use client';

import { BrandSplashLogo } from '@/components/brand/BrandLogo';

export type LoadingIndicatorSize = 'sm' | 'md' | 'lg';

export interface LoadingIndicatorProps {
  /** Görünür etiket — kısa ve nötr tutun (ör. "Yükleniyor") */
  label?: string;
  size?: LoadingIndicatorSize;
  className?: string;
  /** Erişilebilirlik — etiket yoksa zorunlu */
  ariaLabel?: string;
}

const spinnerSize: Record<LoadingIndicatorSize, string> = {
  sm: 'h-4 w-4 border-[1.5px]',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-2',
};

function joinClasses(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function LoadingSpinner({
  size = 'md',
  className,
}: Pick<LoadingIndicatorProps, 'size' | 'className'>) {
  return (
    <span
      className={joinClasses(
        'meridyen-spinner inline-block shrink-0 rounded-full border-slate-200 border-t-slate-600 dark:border-slate-700 dark:border-t-slate-300',
        spinnerSize[size],
        className,
      )}
      aria-hidden="true"
    />
  );
}

/** Satır içi veya blok — tek spinner, isteğe bağlı kısa etiket */
export function LoadingIndicator({
  label,
  size = 'md',
  className,
  ariaLabel,
}: LoadingIndicatorProps) {
  const accessibleName = ariaLabel ?? label ?? 'Yükleniyor';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={accessibleName}
      className={joinClasses('inline-flex items-center gap-2.5 text-slate-500 dark:text-slate-400', className)}
    >
      <LoadingSpinner size={size} />
      {label ? (
        <span className={joinClasses('font-medium text-slate-500 dark:text-slate-400', size === 'sm' ? 'text-xs' : 'text-sm')}>
          {label}
        </span>
      ) : null}
    </div>
  );
}

/** Tam ekran / içerik alanı ortası — oturum ve sayfa bootstrap */
export function LoadingScreen({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={joinClasses(
        'flex min-h-[16rem] flex-col items-center justify-center gap-6 px-4',
        className,
      )}
    >
      <BrandSplashLogo alt="Meridyen Assistance" />
      <LoadingIndicator size="md" label={label} ariaLabel={label ?? 'Yükleniyor'} />
    </div>
  );
}
