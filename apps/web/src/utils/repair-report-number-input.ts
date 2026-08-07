import { parseTrAmountInput } from '@/utils/tr-amount-input';

/** Sıfır/boş hücre değerini düzenleme taslağına çevirir — focus'ta üzerine yazılabilir boş alan */
export function editingDraftFromCellValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '0' || trimmed === '0.0' || trimmed === '0.00') {
    return '';
  }
  return value;
}

function looksLikeFormula(raw: string): boolean {
  return /[+\-*/()]/.test(raw);
}

/**
 * Hücre sayısal girişini normalize eder: TR binlik (15.600,50) veya düz sayı.
 * Formül ifadeleri burada çözülmez — önce evaluateExpression çağrılmalı.
 */
export function normalizeCellNumericInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '0';

  if (!looksLikeFormula(trimmed) && (trimmed.includes(',') || /\d\.\d{3}/.test(trimmed))) {
    const tr = parseTrAmountInput(trimmed);
    if (tr !== null) {
      const rounded = Math.round(tr * 100) / 100;
      return String(rounded);
    }
  }

  const normalized = trimmed.replace(/,/g, '.');
  const parsed = parseFloat(normalized);
  if (!isFinite(parsed) || isNaN(parsed)) return '0';
  const rounded = Math.round(parsed * 100) / 100;
  return String(rounded);
}
