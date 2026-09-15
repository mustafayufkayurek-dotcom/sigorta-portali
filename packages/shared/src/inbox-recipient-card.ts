/** Yanıt Kime alanı ve müşteri kartı kullanıcı hatırlatması. */

const PUBLIC_MAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'outlook.com',
  'outlook.com.tr',
  'live.com',
  'yahoo.com',
  'yahoo.com.tr',
  'icloud.com',
  'me.com',
  'yandex.com',
  'yandex.com.tr',
  'proton.me',
  'protonmail.com',
]);

export function parseMailAddressList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw || '').split(/[,;\s]+/)) {
    const e = part.trim().toLowerCase();
    if (!e.includes('@') || e.split('@').length !== 2) continue;
    if (!mailAddressDomain(e)) continue;
    if (seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

export function mailAddressDomain(email: string): string | null {
  const at = email.trim().toLowerCase().lastIndexOf('@');
  if (at < 1) return null;
  const domain = email.trim().toLowerCase().slice(at + 1).replace(/^www\./, '');
  return domain.includes('.') ? domain : null;
}

export function isPublicMailDomain(domain: string | null): boolean {
  if (!domain) return true;
  return PUBLIC_MAIL_DOMAINS.has(domain);
}

export function customerMailDomains(registeredEmails: string[]): string[] {
  const domains = new Set<string>();
  for (const raw of registeredEmails) {
    const domain = mailAddressDomain(raw);
    if (!domain || isPublicMailDomain(domain)) continue;
    domains.add(domain);
  }
  return [...domains];
}

export function missingCustomerCardUserEmails(input: {
  recipients: string[];
  registeredEmails: string[];
  skip?: (email: string) => boolean;
}): string[] {
  const registered = new Set(
    input.registeredEmails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')),
  );
  const domains = new Set(customerMailDomains([...registered]));
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.recipients) {
    const email = raw.trim().toLowerCase();
    if (!email.includes('@') || seen.has(email)) continue;
    seen.add(email);
    if (input.skip?.(email)) continue;
    if (registered.has(email)) continue;
    const domain = mailAddressDomain(email);
    if (!domain || isPublicMailDomain(domain) || !domains.has(domain)) continue;
    missing.push(email);
  }
  return missing;
}

export function customerCardUserReminder(emails: string[]): string | null {
  if (!emails.length) return null;
  const list = emails.join(', ');
  return `${list} müşteri kartında kullanıcı olarak yok. Müşteri kartından Kullanıcı ekleyin.`;
}
