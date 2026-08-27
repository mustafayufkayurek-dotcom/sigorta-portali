/** Acil Yardım fonksiyon vekaleti: dosya sorumlusunun iş yetkileri. */

export const ACIL_FILE_OWNER_PERMISSIONS = [
  'customer.view',
  'customer.create',
  'customer.update',
  'claim_file.view',
  'claim_file.create',
  'claim_file.update',
  'claim_file.assign',
  'claim_file.status_change',
  'vendor.view',
  'document.view',
  'document.upload',
  'task.view',
  'task.create',
  'task.update',
  'operation_inbox.view',
  'operation_inbox.manage',
] as const;

export function mergeAcilFileOwnerPermissions(
  permissions: readonly string[] | null | undefined,
  hasAcilFunctionDelegation: boolean,
): string[] {
  const base = [...(permissions ?? [])];
  if (!hasAcilFunctionDelegation) return base;
  return [...new Set([...base, ...ACIL_FILE_OWNER_PERMISSIONS])];
}
