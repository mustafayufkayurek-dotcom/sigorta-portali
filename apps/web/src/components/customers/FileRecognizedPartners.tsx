'use client';

import { filePartnersSectionTitle, type FileRecognizedPartner } from '@sigorta/shared';

export function FileRecognizedPartners({
  subType,
  partners,
}: {
  subType?: string | null;
  partners?: FileRecognizedPartner[] | null;
}) {
  const title = filePartnersSectionTitle(subType);
  if (!title || !partners?.length) return null;
  return (
    <div className="mt-3" data-testid="dosyadan-taninan-iliskiler">
      <p className="text-xs font-medium text-slate-500 mb-1.5">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {partners.map((row) => (
          <span
            key={row.id}
            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"
          >
            {row.name}
            <span className="text-emerald-600">{row.fileCount}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
