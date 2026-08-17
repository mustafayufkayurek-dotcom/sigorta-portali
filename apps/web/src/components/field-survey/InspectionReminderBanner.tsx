'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';

type Props = {
  message: string;
  href: string;
  ctaLabel?: string;
  /** saha-tespit-hatirlatma | ofis-tespit-hatirlatma */
  testId?: string;
};

/**
 * Tespit uyarı bandı — saha ve ofis aynı yöntem (dashboard amber band).
 * Çan bildirimi veya mesaj kanalı değil.
 */
export function InspectionReminderBanner({
  message,
  href,
  ctaLabel = 'Dosyalarıma Git',
  testId = 'saha-tespit-hatirlatma',
}: Props) {
  if (!message.trim()) return null;

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
      role="status"
      data-testid={testId}
    >
      <div className="flex min-w-0 items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" strokeWidth={2} />
        <p className="text-sm font-medium text-amber-950">{message}</p>
      </div>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100/80"
      >
        {ctaLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
