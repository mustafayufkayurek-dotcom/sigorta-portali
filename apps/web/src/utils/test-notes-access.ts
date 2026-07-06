import { normalizeRoleCode } from '@/app/panel/kullanicilar/_lib/user-invite-config';
import { isFinanceRole, isOfficeStaffRole } from '@/hooks/usePanelRole';

const FEEDBACK_ROLES = new Set(['admin', 'manager']);

export function canAccessTestNotes(roleCode?: string | null, screenPermissions?: Array<{ code?: string; canView?: boolean }> | null): boolean {
  const code = normalizeRoleCode(roleCode);
  if (FEEDBACK_ROLES.has(code) || isOfficeStaffRole(code) || isFinanceRole(code)) {
    return true;
  }
  return (screenPermissions ?? []).some((item) => item?.code === 'test_notes_admin' && item?.canView);
}

export function canAccessTestNotesFromStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const roleCode = String(parsed?.role?.code ?? parsed?.roleCode ?? '');
    const permissions = parsed?.screenPermissions ?? [];
    return canAccessTestNotes(roleCode, permissions);
  } catch {
    return false;
  }
}
