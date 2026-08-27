const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value?: string | null): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || !EMAIL_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

/** Onaya gönderimde müşteri / eksper ofisine giden adresler — sigorta şirketi yedeği yok. */
export function resolveReportCustomerMailRecipients(input: {
  customerEmail?: string | null;
  contacts?: Array<{ email?: string | null; isPrimary?: boolean | null }> | null;
  expertOfficeEmail?: string | null;
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw?: string | null) => {
    const email = normalizeEmail(raw);
    if (!email || seen.has(email)) return;
    seen.add(email);
    out.push(email);
  };

  push(input.customerEmail);
  const contacts = Array.isArray(input.contacts) ? input.contacts : [];
  const primary = contacts.find((c) => c?.isPrimary);
  push(primary?.email ?? null);
  for (const c of contacts) push(c?.email ?? null);
  push(input.expertOfficeEmail);
  return out;
}
