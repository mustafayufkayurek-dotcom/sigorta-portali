/** Kullanıcı create/update gövdesinden Prisma'ya yazılabilen skaler alanlar. */
export const USER_WRITE_SCALAR_KEYS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'status',
  'roleId',
  'branchId',
  'adjusterId',
  'employeeCode',
  'isMobileUser',
  'isWebUser',
] as const;

export type UserWriteScalarKey = (typeof USER_WRITE_SCALAR_KEYS)[number];

export function pickUserWriteScalars(data: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const src = data && typeof data === 'object' ? data : {};
  const out: Record<string, unknown> = {};
  for (const key of USER_WRITE_SCALAR_KEYS) {
    if (Object.prototype.hasOwnProperty.call(src, key) && src[key] !== undefined) {
      out[key] = src[key];
    }
  }
  return out;
}
