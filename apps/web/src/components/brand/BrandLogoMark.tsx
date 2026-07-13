'use client';

import { CORPORATE_LOGO_DARK, CORPORATE_LOGO_LIGHT } from '@/constants/brand';

export type BrandLogoVariant = 'navbar' | 'login' | 'card' | 'portal' | 'panel';

type BrandLogoMarkProps = {
  alt: string;
  src?: string | null;
  variant?: BrandLogoVariant;
  href?: string;
  title?: string;
  className?: string;
};

const variantStyles: Record<BrandLogoVariant, { shell: string; img: string }> = {
  navbar: {
    shell: 'inline-flex shrink-0 items-center justify-start transition-opacity hover:opacity-80',
    img: 'block h-[3.5rem] w-auto max-w-[min(300px,56vw)] object-contain object-left sm:h-16 sm:max-w-[360px]',
  },
  portal: {
    shell: 'inline-flex shrink-0 items-center justify-start',
    img: 'block h-8 w-auto max-w-[min(128px,32vw)] object-contain object-left sm:h-9 sm:max-w-[160px]',
  },
  /** Panel topbar — 48–56 px logo; kart/çerçeve yok (marka rolü) */
  panel: {
    shell: 'inline-flex h-12 shrink-0 items-center justify-center overflow-visible sm:h-14',
    img: 'block h-10 w-auto max-w-[min(220px,48vw)] object-contain object-left sm:h-12 sm:max-w-[260px]',
  },
  login: {
    shell:
      'inline-flex items-center justify-start rounded-[10px] bg-white py-2.5 pl-3.5 pr-6 shadow-[0_8px_24px_rgba(0,0,0,0.18),0_0_0_1px_rgba(255,255,255,0.1)]',
    img: 'block h-[58px] w-auto max-w-[min(300px,52vw)] object-contain object-left',
  },
  card: {
    shell:
      'inline-flex items-center justify-start rounded-lg border border-slate-200 bg-white px-3.5 py-2 shadow-sm',
    img: 'block h-9 w-auto max-w-[168px] object-contain object-left',
  },
};

export function BrandLogoMark({
  alt,
  src,
  variant = 'navbar',
  href,
  title,
  className = '',
}: BrandLogoMarkProps) {
  const styles = variantStyles[variant];
  const lightSrc = src || CORPORATE_LOGO_LIGHT;
  const darkSrc = CORPORATE_LOGO_DARK;

  const inner = (
    <span className={`${styles.shell} ${className}`.trim()}>
      <img src={lightSrc} alt={alt} className={`${styles.img} dark:hidden`} />
      <img src={darkSrc} alt={alt} className={`${styles.img} hidden dark:block`} />
    </span>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0"
        title={title}
      >
        {inner}
      </a>
    );
  }

  return inner;
}
