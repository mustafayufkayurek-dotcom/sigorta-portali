/** Ayın son günü (İstanbul) ve havuz giderinin işlenip işlenmediği. */

export function istanbulDateParts(now = new Date()): { year: number; month: number; day: number } {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [year, month, day] = formatted.split('-').map(Number);
  return { year, month, day };
}

export function isLastDayOfMonthIstanbul(now = new Date()): boolean {
  const { year, month, day } = istanbulDateParts(now);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day === lastDay;
}

export function isOverheadPoolProcessed(status: {
  poolExpenseCount: number;
  entryCount: number;
  allocationComplete: boolean;
}): boolean {
  return (status.poolExpenseCount > 0 || status.entryCount > 0) && status.allocationComplete === true;
}
