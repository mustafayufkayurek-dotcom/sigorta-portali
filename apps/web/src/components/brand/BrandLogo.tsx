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

/** Topbar / panel: orta boy + oval (kapsül) kabuk — ne login kadar büyük ne eski kadar küçük */
const TOPBAR_SHELL =
  'inline-flex h-10 max-w-[min(120px,36vw)] shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200/90 bg-white px-2.5 py-1 shadow-sm sm:h-12 sm:max-w-none sm:px-3.5 sm:py-1.5 dark:border-slate-600 dark:bg-slate-900';
const TOPBAR_IMG = 'block h-8 w-auto max-w-[120px] object-contain object-left sm:h-10 sm:max-w-[200px] md:h-11 md:max-w-[220px]';

const variantStyles: Record<BrandLogoVariant, { shell: string; img: string; width?: number; height?: number }> = {
  topbar: {
    shell: TOPBAR_SHELL,
    img: TOPBAR_IMG,
  },
  panel: {
    shell: TOPBAR_SHELL,
    img: TOPBAR_IMG,
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
    img: 'block h-32 w-auto max-w-[min(400px,88vw)] object-contain sm:h-40 sm:max-w-[480px]',
    width: 400,
    height: 266,
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
    shell: TOPBAR_SHELL,
    img: TOPBAR_IMG,
  },
  dark: {
    shell: TOPBAR_SHELL,
    img: `${TOPBAR_IMG} brightness-[1.08]`,
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

/**
 * Yükleme / giriş bootstrap — yalnızca resmi logo.
 * Üzerine ek halka / sahte küre çizilmez (marka küresi PNG’de zaten var).
 */
export function BrandSplashLogo({
  alt,
  className = '',
}: {
  alt: string;
  className?: string;
}) {
  return (
    <div className={`brand-splash-logo inline-flex items-center justify-center ${className}`.trim()}>
      <BrandLogo alt={alt} variant="splash" />
    </div>
  );
}

/** @deprecated BrandLogo kullanın */
export const BrandLogoMark = BrandLogo;
export type BrandLogoMarkProps = BrandLogoProps;
export type BrandLogoVariantLegacy = BrandLogoVariant;
