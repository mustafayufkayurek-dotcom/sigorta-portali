'use client';

import { BrandLogoMark } from '@/components/brand/BrandLogoMark';

interface Props {
  alt: string;
}

/** Giriş ve dış sayfalarda kurumsal logo — sola yaslı, kenardan nefes payı ile */
export function LoginBrandLogo({ alt }: Props) {
  return <BrandLogoMark alt={alt} variant="login" />;
}
