import { canSeeHasarTespitBedel } from '@sigorta/shared';

/** Oturumdaki kullanıcı Hasar Tespit hizmet bedeli hesabını görür mü (yönetici / finans). */
export function canSeeHasarTespitBedelClient(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('user') ?? localStorage.getItem('currentUser');
    if (!raw) return false;
    const u = JSON.parse(raw) as { roleCode?: string; role?: { code?: string } };
    return canSeeHasarTespitBedel(u?.roleCode ?? u?.role?.code ?? null);
  } catch {
    return false;
  }
}
