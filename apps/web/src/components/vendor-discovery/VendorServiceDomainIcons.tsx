'use client';

import { Car, Home, KeyRound } from 'lucide-react';
import { resolveVendorServiceDomains } from '@/utils/vendor-service-domains';

const DOMAIN_META = {
  cilingir: { Icon: KeyRound, label: 'Çilingir' },
  konut: { Icon: Home, label: 'Konut' },
  arac: { Icon: Car, label: 'Araç' },
} as const;

export function VendorServiceDomainIcons({
  branches,
  name,
  hint,
}: {
  branches?: string[] | null;
  name?: string | null;
  hint?: string | null;
}) {
  const domains = resolveVendorServiceDomains(branches, name, hint);
  return (
    <span
      className="pointer-events-none absolute right-2 top-2 inline-flex shrink-0 items-center gap-1"
      data-testid="tedarikci-faaliyet-ikonlari"
    >
      {domains.map((d) => {
        const { Icon, label } = DOMAIN_META[d];
        return (
          <span
            key={d}
            title={label}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-800"
          >
            <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
            <span className="sr-only">{label}</span>
          </span>
        );
      })}
    </span>
  );
}
