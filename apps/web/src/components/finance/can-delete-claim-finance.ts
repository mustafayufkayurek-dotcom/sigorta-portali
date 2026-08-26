export function canDeleteClaimFinance(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('user') ?? localStorage.getItem('currentUser');
    if (!raw) return false;
    const u = JSON.parse(raw);
    const role = String(u?.roleCode ?? u?.role?.code ?? '').toUpperCase();
    if (['ADMIN', 'MANAGER', 'FINANS', 'FINANCE', 'ACCOUNTANT'].includes(role)) return true;
    return Array.isArray(u?.permissions) && u.permissions.includes('payment.update');
  } catch {
    return false;
  }
}
