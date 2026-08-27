/** Dosya masrafı — rapordaki iş grubu ve bütçelenen tutarı okur, aşımı keser. */

export function normalizeWorkGroupKey(name: string | null | undefined): string {
  return String(name ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

export function expenseMatchesWorkGroup(
  expenseSubgroup: string | null | undefined,
  workGroupName: string,
): boolean {
  const spent = normalizeWorkGroupKey(expenseSubgroup);
  const group = normalizeWorkGroupKey(workGroupName);
  if (!spent || !group) return false;
  if (spent === group) return true;
  return spent.startsWith(`${group} ·`) || spent.startsWith(`${group} /`);
}

export function remainingWorkGroupBudget(budgeted: number, spent: number): number {
  return Math.round((Number(budgeted) - Number(spent)) * 100) / 100;
}

export function canPostWorkGroupExpense(input: {
  budgeted: number;
  spent: number;
  incoming: number;
}): boolean {
  if (!(input.budgeted > 0)) return false;
  if (!(input.incoming > 0)) return false;
  return remainingWorkGroupBudget(input.budgeted, input.spent) + 0.009 >= input.incoming;
}

export function workGroupExpenseOverLimitMessage(workGroupName: string, remaining: number): string {
  const r = remainingWorkGroupBudget(remaining, 0);
  if (r <= 0) {
    return `${workGroupName} iş grubunda bütçe kalmadı. Masraf işlenemez.`;
  }
  return `${workGroupName} iş grubunda kalan bütçe ${r.toLocaleString('tr-TR')} TL. Bu tutarı aşamazsınız.`;
}
