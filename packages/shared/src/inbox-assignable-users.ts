/** Gelen kutu Kullanıcı Ata — ofis listesi; Kullanıcılar yetkisi gerekmez. */

export const INBOX_ASSIGN_SELF_LABEL = 'Kendime Al';

export type InboxAssignableUser = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
};

export function mergeSessionUserIntoAssignable<T extends InboxAssignableUser>(
  users: T[],
  sessionUser: T | null | undefined,
): T[] {
  if (!sessionUser?.id) return users;
  if (users.some((row) => row.id === sessionUser.id)) return users;
  return [sessionUser, ...users];
}

export function filterAssignableUsersBySearch<T extends InboxAssignableUser>(
  users: T[],
  query: string,
): T[] {
  const q = query.trim().toLocaleLowerCase('tr-TR');
  if (!q) return users;
  return users.filter((row) => {
    const name = `${row.firstName} ${row.lastName}`.toLocaleLowerCase('tr-TR');
    const email = (row.email ?? '').toLocaleLowerCase('tr-TR');
    return name.includes(q) || email.includes(q);
  });
}
