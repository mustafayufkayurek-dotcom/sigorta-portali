'use client';

import { CORPORATE_LOGO_DARK } from '@/constants/brand';

interface Props {
  alt: string;
}

/** Orijinal kurumsal logo — tek parça, animasyonsuz */
export function LoginBrandLogo({ alt }: Props) {
  return (
    <img
      src={CORPORATE_LOGO_DARK}
      alt={alt}
      className="login-brand-full"
    />
  );
}
