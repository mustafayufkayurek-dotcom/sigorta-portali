/** Aynı Hasar dosyası + tedarikçi + iş grubu için ikinci onaylı hakediş açılmaz. */

export type HasarHakedisReuseItem = {
  claimFileId?: string | null;
  workGroupId?: string | null;
};

export type HasarHakedisReuseStatement = {
  id: string;
  vendorId: string;
  status?: string | null;
  items?: HasarHakedisReuseItem[] | null;
};

export function isActiveHasarHakedisStatement(status?: string | null): boolean {
  const value = String(status ?? '').trim().toUpperCase();
  if (!value) return true;
  return value !== 'DRAFT';
}

function workGroupKeys(items: Array<{ workGroupId?: string | null } | null | undefined>): string[] {
  return items
    .map((item) => String(item?.workGroupId ?? '').trim())
    .filter(Boolean);
}

export function shouldReuseHasarHakedisStatement(
  statement: HasarHakedisReuseStatement,
  input: {
    vendorId: string;
    claimFileId: string;
    workGroupIds: Array<string | null | undefined>;
  },
): boolean {
  if (statement.vendorId !== input.vendorId) return false;
  if (!isActiveHasarHakedisStatement(statement.status)) return false;
  const fileItems = (statement.items ?? []).filter(
    (item) => !item.claimFileId || item.claimFileId === input.claimFileId,
  );
  if ((statement.items ?? []).length > 0 && fileItems.length === 0) return false;
  const existingGroups = workGroupKeys(fileItems);
  const wanted = workGroupKeys(input.workGroupIds.map((id) => ({ workGroupId: id })));
  if (wanted.length === 0) return true;
  if (existingGroups.length === 0) return true;
  return wanted.some((id) => existingGroups.includes(id));
}

export function pickReusableHasarHakedisStatement(
  statements: HasarHakedisReuseStatement[],
  input: {
    vendorId: string;
    claimFileId: string;
    workGroupIds: Array<string | null | undefined>;
  },
): HasarHakedisReuseStatement | null {
  return statements.find((row) => shouldReuseHasarHakedisStatement(row, input)) ?? null;
}
