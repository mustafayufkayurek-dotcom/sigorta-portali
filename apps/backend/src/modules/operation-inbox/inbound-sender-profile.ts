/** Asistan / operasyon firması gönderenleri — sigortalı adı olarak kullanılmaz. */
export function isCorporateInboxSender(fromAddress?: string | null): boolean {
  if (!fromAddress?.trim()) return false;
  const addr = fromAddress.trim().toLowerCase();
  return addr.includes('remed.com') || addr.includes('safranbh.com');
}

export function splitPersonName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
