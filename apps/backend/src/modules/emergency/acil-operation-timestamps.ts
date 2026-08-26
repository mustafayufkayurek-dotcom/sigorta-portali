/**
 * Acil dosya resmi işlem saatleri — ilk yazım kalır.
 * İhbar: gelen kutu / fileDate. Kapanış: resolvedAt (status COZULDU).
 */

export type AcilStampFields = {
  workStartedAt?: Date | string | null;
  serviceDeliveredAt?: Date | string | null;
};

function isMissing(value: Date | string | null | undefined): boolean {
  if (value == null || value === '') return true;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(t);
}

export function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function nextAcilOperationStamps(
  action: string,
  existing: AcilStampFields,
  now = new Date(),
): Partial<{ workStartedAt: Date; serviceDeliveredAt: Date }> {
  const out: Partial<{ workStartedAt: Date; serviceDeliveredAt: Date }> = {};
  if (action === 'EMERGENCY_WORK_START_READY' && isMissing(existing.workStartedAt)) {
    out.workStartedAt = now;
  }
  if (action === 'EMERGENCY_CUSTOMER_APPROVED' && isMissing(existing.workStartedAt)) {
    out.workStartedAt = now;
  }
  if (action === 'EMERGENCY_SERVICE_COMPLETED') {
    if (isMissing(existing.serviceDeliveredAt)) out.serviceDeliveredAt = now;
    if (isMissing(existing.workStartedAt)) out.workStartedAt = now;
  }
  return out;
}

export function buildAcilOperationTimestamps(input: {
  notifiedAt?: Date | string | null;
  workStartedAt?: Date | string | null;
  serviceDeliveredAt?: Date | string | null;
  closedAt?: Date | string | null;
}) {
  return {
    notifiedAt: toIsoOrNull(input.notifiedAt),
    workStartedAt: toIsoOrNull(input.workStartedAt),
    serviceDeliveredAt: toIsoOrNull(input.serviceDeliveredAt),
    closedAt: toIsoOrNull(input.closedAt),
  };
}
