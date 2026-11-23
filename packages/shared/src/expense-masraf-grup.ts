/**
 * Masraf alt grubu üst gruba bağlıdır. Rapor / özet grup adını
 * expenseCategory.parent’tan okur; dört sabit enum yedektir.
 */

export const EXPENSE_GROUP_ENUM_LABEL: Readonly<Record<string, string>> = {
  YONETIM_GIDERLERI: 'Yönetim Giderleri',
  OPERASYON_GIDERLERI: 'Operasyon Giderleri',
  ONARIM_GIDERLERI: 'Onarım Giderleri',
  MHY_OZEL_GIDERLER: 'MHY Özel Giderler',
};

export type MasrafGrupOzetAlt = {
  name: string;
  amount: number;
  count: number;
};

export type MasrafGrupOzetSatir = {
  groupId: string;
  groupName: string;
  amount: number;
  count: number;
  subgroups: MasrafGrupOzetAlt[];
};

type MasrafGrupKaynak = {
  amount: number;
  expenseGroup?: string | null;
  expenseCategory?: {
    id: string;
    name: string;
    parentId?: string | null;
    parent?: { id: string; name: string } | null;
  } | null;
};

/** Kayıttan gerçek masraf grubu (üst kategori) ve alt grup adı. */
export function resolveMasrafGrupBaglam(row: MasrafGrupKaynak): {
  groupId: string;
  groupName: string;
  subgroupName: string;
} {
  const cat = row.expenseCategory;
  if (cat?.parent?.id) {
    return {
      groupId: cat.parent.id,
      groupName: cat.parent.name || '—',
      subgroupName: cat.name || '—',
    };
  }
  if (cat?.id) {
    return {
      groupId: cat.id,
      groupName: cat.name || '—',
      subgroupName: '—',
    };
  }
  const enumKey = String(row.expenseGroup ?? '').trim();
  return {
    groupId: enumKey ? `enum:${enumKey}` : 'enum:unknown',
    groupName: EXPENSE_GROUP_ENUM_LABEL[enumKey] || enumKey || 'Belirtilmemiş',
    subgroupName: '—',
  };
}

/** Grup bazlı analiz — alt gruplar üst grubun altında toplanır. */
export function aggregateMasrafByGrup(rows: MasrafGrupKaynak[]): MasrafGrupOzetSatir[] {
  const map = new Map<
    string,
    {
      groupId: string;
      groupName: string;
      amount: number;
      count: number;
      subgroups: Map<string, MasrafGrupOzetAlt>;
    }
  >();

  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    const { groupId, groupName, subgroupName } = resolveMasrafGrupBaglam(row);
    let bucket = map.get(groupId);
    if (!bucket) {
      bucket = {
        groupId,
        groupName,
        amount: 0,
        count: 0,
        subgroups: new Map(),
      };
      map.set(groupId, bucket);
    }
    bucket.amount += amount;
    bucket.count += 1;
    const subKey = subgroupName || '—';
    const sub = bucket.subgroups.get(subKey) ?? { name: subKey, amount: 0, count: 0 };
    sub.amount += amount;
    sub.count += 1;
    bucket.subgroups.set(subKey, sub);
  }

  return Array.from(map.values())
    .map((g) => ({
      groupId: g.groupId,
      groupName: g.groupName,
      amount: Math.round(g.amount * 100) / 100,
      count: g.count,
      subgroups: Array.from(g.subgroups.values())
        .map((s) => ({
          ...s,
          amount: Math.round(s.amount * 100) / 100,
        }))
        .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'tr')),
    }))
    .sort((a, b) => b.amount - a.amount || a.groupName.localeCompare(b.groupName, 'tr'));
}
