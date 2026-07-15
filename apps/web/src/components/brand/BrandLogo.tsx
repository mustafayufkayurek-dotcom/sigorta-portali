'use client';

import { CORPORATE_LOGO_ORIGINAL_PNG } from '@/constants/brand';

/**
 * Tek marka bileşeni — resmi meridyen-logo-original.png.
 * Varyasyonlar yalnızca boyut / kabuk; asset değiştirilmez.
 */
export type BrandLogoVariant =
  | 'topbar'
  | 'panel'
  | 'login'
  | 'splash'
  | 'mark'
  | 'card'
  | 'navbar'
  | 'portal'
  | 'light'
  | 'dark';

type BrandLogoProps = {
  alt: string;
  src?: string | null;
  variant?: BrandLogoVariant;
  href?: string;
  title?: string;
  className?: string;
};

const variantStyles: Record<BrandLogoVariant, { shell: string; img: string; width?: number; height?: number }> = {
  topbar: {
    shell: 'inline-flex h-10 shrink-0 items-center justify-center overflow-visible',
    img: 'block h-9 w-auto max-w-[176px] object-contain object-left sm:h-10',
  },
  panel: {
    shell: 'inline-flex h-10 shrink-0 items-center justify-center overflow-visible',
    img: 'block h-9 w-auto max-w-[176px] object-contain object-left sm:h-10',
  },
  login: {
    shell:
      'inline-flex items-center justify-start rounded-[10px] bg-white py-2.5 pl-3.5 pr-6 shadow-[0_8px_24px_rgba(0,0,0,0.18),0_0_0_1px_rgba(255,255,255,0.1)]',
    img: 'block h-[58px] w-auto max-w-[min(300px,52vw)] object-contain object-left',
    width: 300,
    height: 200,
  },
  splash: {
    shell: 'inline-flex items-center justify-center',
    img: 'block h-14 w-auto max-w-[220px] object-contain',
    width: 220,
    height: 146,
  },
  mark: {
    shell: 'inline-flex shrink-0 items-center justify-center',
    img: 'block h-8 w-8 object-contain',
    width: 32,
    height: 32,
  },
  card: {
    shell:
      'inline-flex items-center justify-start rounded-lg border border-slate-200 bg-white px-3.5 py-2 shadow-sm',
    img: 'block h-9 w-auto max-w-[168px] object-contain object-left',
  },
  navbar: {
    shell: 'inline-flex shrink-0 items-center justify-start transition-opacity hover:opacity-80',
    img: 'block h-[3.5rem] w-auto max-w-[min(300px,56vw)] object-contain object-left sm:h-16 sm:max-w-[360px]',
  },
  portal: {
    shell: 'inline-flex shrink-0 items-center justify-start',
    img: 'block h-8 w-auto max-w-[min(128px,32vw)] object-contain object-left sm:h-9 sm:max-w-[160px]',
  },
  light: {
    shell: 'inline-flex h-10 shrink-0 items-center justify-center',
    img: 'block h-9 w-auto max-w-[176px] object-contain object-left sm:h-10',
  },
  dark: {
    shell: 'inline-flex h-10 shrink-0 items-center justify-center',
    img: 'block h-9 w-auto max-w-[176px] object-contain object-left brightness-[1.08] sm:h-10',
  },
};

export function BrandLogo({
  alt,
  src,
  variant = 'topbar',
  href,
  title,
  className = '',
}: BrandLogoProps) {
  const styles = variantStyles[variant];
  const logoSrc = src || CORPORATE_LOGO_ORIGINAL_PNG;

  const inner = (
    <span className={`${styles.shell} ${className}`.trim()}>
      <img
        src={logoSrc}
        alt={alt}
        className={styles.img}
        width={styles.width}
        height={styles.height}
        decoding="async"
      />
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

/** @deprecated BrandLogo kullanın */
export const BrandLogoMark = BrandLogo;
export type BrandLogoMarkProps = BrandLogoProps;
export type BrandLogoVariantLegacy = BrandLogoVariant;
