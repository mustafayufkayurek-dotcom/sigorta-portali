/**
 * Türkiye tarih girişi — GG.AA.YYYY metin maskesi (native date picker kullanılmaz).
 * Müşteriler, Tedarikçiler ve yeni formlarda ortak standart.
 */

export function maskTrDateInput(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

export function trDateMaskToISO(masked: string): string {
  const digits = masked.replace(/\D/g, '');
  if (digits.length < 8) return '';
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  return `${yyyy}-${mm}-${dd}`;
}

export function isoToTrDateDisplay(iso: string): string {
  if (!iso) return '';
  if (iso.includes('.')) return iso;
  if (iso.length < 10) return iso;
  const [yyyy, mm, dd] = iso.slice(0, 10).split('-');
  if (!yyyy || !mm || !dd) return iso;
  return `${dd}.${mm}.${yyyy}`;
}

/** Form/API için geçerli yyyy-mm-dd döner; geçersizse boş string. */
export function normalizeTrDateValue(value: string): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) return trDateMaskToISO(value);
  return '';
}

export function isCompleteTrDateValue(value: string): boolean {
  const iso = normalizeTrDateValue(value);
  if (!iso) return false;
  const d = new Date(`${iso}T12:00:00`);
  return !Number.isNaN(d.getTime());
}

export function trDateInputDisplayValue(value: string): string {
  if (!value) return '';
  if (value.includes('-')) return isoToTrDateDisplay(value.slice(0, 10));
  return value;
}

export function handleTrDateInputChange(raw: string): string {
  const masked = maskTrDateInput(raw);
  const iso = trDateMaskToISO(masked);
  return iso || masked;
}
