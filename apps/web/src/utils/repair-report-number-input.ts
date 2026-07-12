/** Sıfır/boş hücre değerini düzenleme taslağına çevirir — focus'ta üzerine yazılabilir boş alan */
export function editingDraftFromCellValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '0' || trimmed === '0.0' || trimmed === '0.00') {
    return '';
  }
  return value;
}

/** Hücre sayısal girişini normalize eder: trim, virgül→nokta, 2 ondalık, boş → '0' */
export function normalizeCellNumericInput(raw: string): string {
  const trimmed = raw.trim().replace(/,/g, '.');
  if (!trimmed) return '0';
  const parsed = parseFloat(trimmed);
  if (!isFinite(parsed) || isNaN(parsed)) return '0';
  const rounded = Math.round(parsed * 100) / 100;
  return String(rounded);
}
