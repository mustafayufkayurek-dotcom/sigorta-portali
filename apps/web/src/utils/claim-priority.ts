export const CLAIM_PRIORITY_OPTIONS = [
  { value: 'low', label: 'Düşük' },
  { value: 'normal', label: 'Normal' },
  { value: 'medium', label: 'Orta' },
  { value: 'high', label: 'Yüksek' },
  { value: 'critical', label: 'Kritik' },
] as const;

export type ClaimPriorityValue = (typeof CLAIM_PRIORITY_OPTIONS)[number]['value'];

export function claimPriorityLabel(value?: string | null): string {
  const key = String(value ?? '').trim().toLowerCase();
  return CLAIM_PRIORITY_OPTIONS.find((row) => row.value === key)?.label ?? 'Normal';
}

export function isClaimPriority(value?: string | null): boolean {
  const key = String(value ?? '').trim().toLowerCase();
  return CLAIM_PRIORITY_OPTIONS.some((row) => row.value === key);
}
