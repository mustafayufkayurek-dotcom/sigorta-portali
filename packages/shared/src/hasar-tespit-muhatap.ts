/** Hasar Tespit ilk muhatap: Sigorta; e-postası yoksa Broker; o da yoksa Eksper. */

export const HASAR_TESPIT_MUHATAP_SIRASI = ['insurance', 'broker', 'expert'] as const;

export type HasarTespitMuhatapTaraf = (typeof HASAR_TESPIT_MUHATAP_SIRASI)[number];

export type HasarTespitMuhatapAday = { name?: string | null; email?: string | null } | null | undefined;

export type HasarTespitMuhatap = { party: HasarTespitMuhatapTaraf; name: string; email: string };

function validEmail(value: unknown): string | null {
  const email = String(value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function hasarTespitIlkMuhatap(input: {
  insurance?: HasarTespitMuhatapAday;
  broker?: HasarTespitMuhatapAday;
  expert?: HasarTespitMuhatapAday;
}): HasarTespitMuhatap | null {
  for (const party of HASAR_TESPIT_MUHATAP_SIRASI) {
    const row = input[party];
    const email = validEmail(row?.email);
    if (email) return { party, name: String(row?.name ?? '').trim(), email };
  }
  return null;
}
