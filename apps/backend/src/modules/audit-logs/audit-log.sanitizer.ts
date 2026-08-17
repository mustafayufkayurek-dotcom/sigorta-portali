import { SENSITIVE_AUDIT_KEYS } from './audit-log.constants';

const MASKED_VALUE = '[FILTERED]';

function isSensitiveKey(key: string): boolean {
  const lowered = key.toLowerCase();
  return SENSITIVE_AUDIT_KEYS.some((sensitive) => lowered.includes(sensitive.toLowerCase()));
}

export function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item));
  }

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? MASKED_VALUE : sanitizeAuditValue(val);
    }
    return out;
  }

  return value;
}