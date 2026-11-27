'use client';

/** Masraf formunda hatırlanan yazıların görünür seçim satırı (datalist yalnız yetmez). */

import { MASRAF_HATIRLA_CHIP_MAX } from '@/utils/masraf-aciklama-hatirla';

export function MasrafHatirlaChips({
  items,
  onPick,
  testId,
}: {
  items: string[];
  onPick: (value: string) => void;
  testId: string;
}) {
  if (items.length === 0) return null;
  return (
    <div
      className="mt-1.5 flex flex-wrap gap-1.5"
      data-testid={testId}
      role="listbox"
      aria-label="Hatırlananlar"
    >
      {items.slice(0, MASRAF_HATIRLA_CHIP_MAX).map((item) => (
        <button
          key={item}
          type="button"
          role="option"
          tabIndex={-1}
          onClick={() => onPick(item)}
          className="max-w-full truncate rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
          title={item}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
