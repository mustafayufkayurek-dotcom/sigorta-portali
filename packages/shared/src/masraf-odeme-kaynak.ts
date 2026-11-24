/**
 * Masraf Ödeme Kaynağı: cari + henüz carisi olmayan tedarikçi kartı.
 * Seçimde `vendor:` öneki → ensure-vendor ile gerçek cari id’sine çevrilir.
 */

export const MASRAF_VENDOR_PENDING_PREFIX = 'vendor:';

export type MasrafOdemeKaynakSatir = {
  id: string;
  name: string;
  kindLabel: string;
  kind: string;
  linkedVendorId: string | null;
  cardLast4: string | null;
  pendingVendorId?: string;
};

export function masrafPendingVendorOptionId(vendorId: string): string {
  return `${MASRAF_VENDOR_PENDING_PREFIX}${vendorId}`;
}

export function parseMasrafPendingVendorId(optionId: string): string | null {
  const raw = String(optionId ?? '');
  if (!raw.startsWith(MASRAF_VENDOR_PENDING_PREFIX)) return null;
  const id = raw.slice(MASRAF_VENDOR_PENDING_PREFIX.length).trim();
  return id || null;
}

/** Cari listesi + carisi olmayan aktif tedarikçiler (çift satır yok). */
export function mergeMasrafOdemeKaynaklari(opts: {
  accounts: Array<{
    id: string;
    name: string;
    kindLabel: string;
    kind?: string | null;
    linkedVendorId?: string | null;
    cardLast4?: string | null;
  }>;
  vendors: Array<{ id: string; name: string; status?: string | null }>;
}): MasrafOdemeKaynakSatir[] {
  const accounts: MasrafOdemeKaynakSatir[] = opts.accounts.map((a) => ({
    id: a.id,
    name: a.name,
    kindLabel: a.kindLabel,
    kind: String(a.kind ?? ''),
    linkedVendorId: a.linkedVendorId ?? null,
    cardLast4: a.cardLast4 ?? null,
  }));

  const linked = new Set(
    accounts
      .map((a) => a.linkedVendorId)
      .filter((id): id is string => Boolean(id)),
  );

  const pending: MasrafOdemeKaynakSatir[] = [];
  for (const v of opts.vendors) {
    const id = String(v.id ?? '').trim();
    const name = String(v.name ?? '').trim();
    if (!id || !name) continue;
    if (v.status && String(v.status).toLowerCase() !== 'active') continue;
    if (linked.has(id)) continue;
    pending.push({
      id: masrafPendingVendorOptionId(id),
      name,
      kindLabel: 'Tedarikçi',
      kind: 'tedarikci',
      linkedVendorId: id,
      cardLast4: null,
      pendingVendorId: id,
    });
  }

  return [...accounts, ...pending].sort((a, b) =>
    a.name.localeCompare(b.name, 'tr'),
  );
}
