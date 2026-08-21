/**
 * Dosya ekranlarında durum rozeti renkleri — Hasar ve Acil tek sözlükten okur.
 * Referans: onaylı Hasar dosya kabuğu (`/panel/hasar-dosyalari/[id]`).
 */

export type FileStatusTone =
  | 'gray'
  | 'blue'
  | 'teal'
  | 'amber'
  | 'orange'
  | 'green'
  | 'purple'
  | 'red';

export const FILE_STATUS_TONE: Record<FileStatusTone, string> = {
  gray: 'border-slate-200 bg-slate-100 text-slate-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-800',
  teal: 'border-teal-200 bg-teal-50 text-teal-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  orange: 'border-orange-200 bg-orange-50 text-orange-800',
  green: 'border-green-200 bg-green-50 text-green-800',
  purple: 'border-purple-200 bg-purple-50 text-purple-800',
  red: 'border-red-200 bg-red-50 text-red-800',
};

/** Rozet gövdesi (yarıçap, boşluk, yazı) — iki departmanda aynı. */
export const FILE_STATUS_BADGE_BASE =
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold';

export function fileStatusToneClass(tone: string | null | undefined): string {
  return FILE_STATUS_TONE[(tone ?? 'gray') as FileStatusTone] ?? FILE_STATUS_TONE.gray;
}

export function fileStatusBadgeClass(tone: string | null | undefined): string {
  return `${FILE_STATUS_BADGE_BASE} ${fileStatusToneClass(tone)}`;
}
