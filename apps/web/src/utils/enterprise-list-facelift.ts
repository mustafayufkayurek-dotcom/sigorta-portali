/** Enterprise liste facelift — yalnızca görsel yardımcılar (layout/alan eklemez). */

export type InsuranceCompanyAvatar = {
  initials: string;
  className: string;
};

const INSURANCE_AVATAR_COLORS = [
  'bg-sky-100 text-sky-800',
  'bg-indigo-100 text-indigo-800',
  'bg-violet-100 text-violet-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
] as const;

function hashCompanyName(value: string): number {
  return Array.from(value).reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) | 0, 0);
}

export function insuranceCompanyAvatar(name?: string | null): InsuranceCompanyAvatar {
  const normalized = (name ?? '').trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  const initials = words.length > 1
    ? words.slice(0, 2).map((word) => word[0]).join('')
    : normalized.slice(0, 2);
  const index = Math.abs(hashCompanyName(normalized.toLocaleLowerCase('tr-TR'))) % INSURANCE_AVATAR_COLORS.length;

  return {
    initials: initials.toLocaleUpperCase('tr-TR') || '—',
    className: INSURANCE_AVATAR_COLORS[index],
  };
}

/** Durum badge — aynı yükseklik / radius / font / padding */
export function enterpriseStatusBadgeClass(statusName?: string | null): string {
  const s = (statusName ?? '').toLocaleLowerCase('tr-TR');
  const base =
    'inline-flex h-[23px] max-w-[9.5rem] items-center truncate rounded-full px-2.5 text-[11.5px] font-semibold leading-none';
  if (/tamam|kapandı|kapan|sonuç|bitti/.test(s)) return `${base} bg-[#E4F3EA] text-[#166B3F]`;
  if (/onay/.test(s)) return `${base} bg-[#F1E9FC] text-[#7C3AED]`;
  if (/rapor/.test(s)) return `${base} bg-[#FBE4E1] text-[#C0392B]`;
  if (/ekspertiz/.test(s)) return `${base} bg-[#E9EEFB] text-[#2648C7]`;
  if (/incele|keşif|kesif|tespit|saha/.test(s)) return `${base} bg-[#FEF3C7] text-[#B45309]`;
  return `${base} bg-slate-100 text-slate-700`;
}
