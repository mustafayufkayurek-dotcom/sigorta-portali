/** Panel nabzı ve hatırlatma pencereleri — Europe/Istanbul. */

export function istanbulYmd(now: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function istanbulDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isIstanbulLastCalendarDay(now: Date = new Date()): boolean {
  const { year, month, day } = istanbulYmd(now);
  return day === istanbulDaysInMonth(year, month);
}

export function previousIstanbulMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

/** Günlük puantaj onayı: kadrodaki ofis, saha, finans, mali müşavir, müdür. */
const ATTENDANCE_ROSTER_ROLES = new Set([
  'OFFICE_STAFF',
  'FIELD_STAFF',
  'FINANCE',
  'FINANS',
  'ACCOUNTANT',
  'MANAGER',
]);

/** Personel Ekle. Yönetici kadroya girer; günlük onay maili almaz. */
const PERSONNEL_ADD_ROLES = new Set([
  ...ATTENDANCE_ROSTER_ROLES,
  'ADMIN',
  'SUPER_ADMIN',
]);

export const CUSTOMER_VENDOR_ROLE_CODES = [
  'expert',
  'EXPERT',
  'insurance_company_user',
  'INSURANCE_COMPANY_USER',
  'assistance_company_user',
  'ASSISTANCE_COMPANY_USER',
  'broker_user',
  'BROKER_USER',
] as const;

export function isCustomerOrVendorRole(roleCode?: string | null): boolean {
  const r = (roleCode ?? '').trim().toUpperCase();
  if (!r) return false;
  if (r.includes('PORTAL')) return true;
  if (r.includes('VENDOR') || r.includes('SUPPLIER') || r.includes('TEDARIK')) return true;
  if (r.includes('CUSTOMER') || r.includes('MUSTERI')) return true;
  return (
    r === 'EXPERT'
    || r === 'INSURANCE_COMPANY_USER'
    || r === 'ASSISTANCE_COMPANY_USER'
    || r === 'BROKER_USER'
  );
}

/** Admin, müşteri ve tedarikçi günlük puantaj maili almaz. Saha, kadroya eklenince alır. */
export function roleReceivesAttendanceReminders(roleCode?: string | null): boolean {
  const r = (roleCode ?? '').trim().toUpperCase();
  if (!r || isCustomerOrVendorRole(r)) return false;
  return ATTENDANCE_ROSTER_ROLES.has(r);
}

export function roleCanBeAddedAsPersonnel(roleCode?: string | null): boolean {
  const r = (roleCode ?? '').trim().toUpperCase();
  if (!r || isCustomerOrVendorRole(r)) return false;
  return PERSONNEL_ADD_ROLES.has(r);
}
