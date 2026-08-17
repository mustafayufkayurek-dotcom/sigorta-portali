'use client';

import { BrandLogo } from './BrandLogo';

interface Props {
  alt: string;
}

/** Giriş — BrandLogo login varyasyonu */
export function LoginBrandLogo({ alt }: Props) {
  return <BrandLogo alt={alt} variant="login" />;
}
