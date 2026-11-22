/**
 * Türkiye tarih girişi — GG.AA.YYYY metin maskesi.
 * TrDateInput: metin girişi (masaüstü) + mobilde native tarih seçici (type=date overlay).
 * Müşteriler, Tedarikçiler ve panel formlarında ortak standart.
 * İki haneli yıl (26) → 20xx (2026); tüm yıllar için geçerli.
 */

/** DDMMYY → DDMM20YY; 8 hane zaten tamsa dokunulmaz. */
export function expandTrDateYearDigits(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length === 6) return `${d.slice(0, 4)}20${d.slice(4, 6)}`;
  return d.slice(0, 8);
}

export function maskTrDateInput(input: string): string {
  // Yazarken 6 hanede 20xx’e çevirme — 2026 gibi dört haneli yılı bozar.
  // Dönüşüm yalnız tamamlanınca (trDateMaskToISO / blur) yapılır.
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

export function trDateMaskToISO(masked: string): string {
  const digits = expandTrDateYearDigits(masked.replace(/\D/g, ''));
  if (digits.length < 8) return '';
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  return `${yyyy}-${mm}-${dd}`;
}

export function isoToTrDateDisplay(iso: string): string {
  if (!iso) return '';
  if (/^\d{2}\.\d{2}\.\d{2,4}$/.test(iso)) {
    const expanded = trDateMaskToISO(iso);
    if (!expanded) return iso;
    const [yyyy, mm, dd] = expanded.split('-');
    if (!yyyy || !mm || !dd) return iso;
    return `${dd}.${mm}.${yyyy}`;
  }
  if (iso.length < 10) return iso;
  const [yyyy, mm, dd] = iso.slice(0, 10).split('-');
  if (!yyyy || !mm || !dd) return iso;
  return `${dd}.${mm}.${yyyy}`;
}

/** Form/API için geçerli yyyy-mm-dd döner; geçersizse boş string. */
export function normalizeTrDateValue(value: string): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const iso = trDateMaskToISO(value);
  if (iso) return iso;
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
  const iso = normalizeTrDateValue(value);
  if (iso) return isoToTrDateDisplay(iso);
  return value;
}

export function handleTrDateInputChange(raw: string): string {
  const masked = maskTrDateInput(raw);
  const digits = masked.replace(/\D/g, '');
  // 8 hane = dört haneli yıl tamam; 6 hane (GG.AA.YY) blur’da 20xx’e açılır.
  if (digits.length === 8) {
    const iso = trDateMaskToISO(masked);
    return iso || masked;
  }
  return masked;
}
