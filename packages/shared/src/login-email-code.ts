/** Yönetici ve finans yeni girişinde e-posta kodu. Açık oturumu düşürmez. */

export function roleRequiresLoginEmailCode(roleCode?: string | null): boolean {
  const code = String(roleCode ?? '').trim().toLowerCase();
  return code === 'admin' || code === 'finance' || code === 'finans';
}

export function maskLoginMailbox(email?: string | null): string {
  const value = String(email ?? '').trim();
  const at = value.indexOf('@');
  if (at < 1) return 'kayıtlı e-posta';
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

/** Giriş kodu maili gelen kutu işine düşmez; kutuda durur. */
export function isLoginEmailCodeSubject(subject?: string | null): boolean {
  const value = String(subject ?? '').trim().toLocaleLowerCase('tr-TR');
  return value.startsWith('giriş kodu');
}
