export {
  evaluateAmountExpression,
  formulaForEval,
  normalizeCellNumericInput,
} from './tr-amount-input';

/** Sıfır/boş hücre değerini düzenleme taslağına çevirir — focus'ta üzerine yazılabilir boş alan */
export function editingDraftFromCellValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '0' || trimmed === '0.0' || trimmed === '0.00') {
    return '';
  }
  return value;
}
