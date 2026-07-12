export function isFieldStaff(roleCode: string | undefined | null): boolean {
  return roleCode === 'field_staff';
}

/**
 * Telefon numarasını maskeler: ilk 4 rakam + son 4 rakam görünür
 * Örnek: 05551234567 → 0555***4567
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (phone === null || phone === undefined) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return phone;
  return digits.slice(0, 4) + '***' + digits.slice(-4);
}

/**
 * Bir obje/dizide phone, contactPhone, siteContactPhone alanlarını recursive maskeler
 */
export function deepMaskPhones(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(deepMaskPhones);
  if (obj instanceof Date) return obj;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(obj)) return obj;
  if (typeof obj === 'object') {
    const proto = Object.getPrototypeOf(obj);
    if (proto !== Object.prototype && proto !== null) return obj;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (['phone', 'contactPhone', 'siteContactPhone'].includes(key) && typeof value === 'string') {
        result[key] = maskPhone(value);
      } else {
        result[key] = deepMaskPhones(value);
      }
    }
    return result;
  }
  return obj;
}
