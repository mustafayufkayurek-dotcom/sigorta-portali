import type { InboxAssignableUser } from '@sigorta/shared';

export function readInboxSessionUser(): InboxAssignableUser | null {
  if (typeof window === 'undefined') return null;
  for (const key of ['user', 'currentUser']) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        id?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
      };
      const id = String(parsed?.id ?? '').trim();
      if (!id) continue;
      return {
        id,
        firstName: String(parsed.firstName ?? '').trim(),
        lastName: String(parsed.lastName ?? '').trim(),
        email: parsed.email?.trim() || null,
      };
    } catch {
      /* yok say */
    }
  }
  return null;
}
