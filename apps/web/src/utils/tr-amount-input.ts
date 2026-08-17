/**
 * Türkiye tutar girişi — binlik ayraç (.) ve ondalık virgül (,).
 */

export function formatTrAmountInput(input: string): string {
  let cleaned = input.replace(/[^\d,]/g, '');
  const commaIdx = cleaned.indexOf(',');
  if (commaIdx !== -1) {
    cleaned =
      cleaned.slice(0, commaIdx + 1) +
      cleaned.slice(commaIdx + 1).replace(/,/g, '');
  }
  const [intRaw, decRaw] = cleaned.split(',');
  const intDigits = (intRaw ?? '').replace(/\D/g, '');
  const formattedInt = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (decRaw !== undefined) {
    return `${formattedInt},${decRaw.replace(/\D/g, '').slice(0, 2)}`;
  }
  return formattedInt;
}

export function parseTrAmountInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

export function numberToTrAmountInput(n: number | string | null | undefined): string {
  if (n == null || n === '') return '';
  const num = typeof n === 'number' ? n : parseFloat(String(n));
  if (!Number.isFinite(num)) return '';
  const fixed = num.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (decPart === '00') return formattedInt;
  return `${formattedInt},${decPart}`;
}
