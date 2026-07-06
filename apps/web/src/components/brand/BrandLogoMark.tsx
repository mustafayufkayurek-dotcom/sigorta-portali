'use client';

import { CORPORATE_LOGO_LIGHT } from '@/constants/brand';

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
    shell: 'inline-flex shrink-0 items-center justify-start py-0.5 transition-opacity hover:opacity-80',
    img: 'block h-9 w-auto max-w-[min(168px,38vw)] object-contain object-left sm:h-10 sm:max-w-[200px]',
  },
  portal: {
    shell: 'inline-flex shrink-0 items-center justify-start',
    img: 'block h-8 w-auto max-w-[min(128px,32vw)] object-contain object-left sm:h-9 sm:max-w-[160px]',
  },
  /** Panel navbar — logo çerçeveye tam oturur, mobil/masaüstü ölçek tutarlı */
  panel: {
    shell:
      'inline-flex h-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-slate-200/90 bg-white px-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:h-10 sm:px-3',
    img: 'block h-[26px] w-auto max-w-[min(116px,28vw)] object-contain object-center sm:h-[30px] sm:max-w-[140px]',
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
  const displaySrc = src || CORPORATE_LOGO_LIGHT;

  const inner = (
    <span className={`${styles.shell} ${className}`.trim()}>
      <img
        src={displaySrc}
        alt={alt}
        className={styles.img}
        onError={(e) => {
          if (e.currentTarget.src !== CORPORATE_LOGO_LIGHT) {
            e.currentTarget.src = CORPORATE_LOGO_LIGHT;
          }
        }}
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
