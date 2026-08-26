export type AssignableStaffPerson = {
  id: string;
  firstName: string;
  lastName: string;
};

/** Finans vekili + ofis personeli aynı listede; id tekil, ada göre A→Z. */
export function mergeAssignableStaffWithDelegates<T extends AssignableStaffPerson>(
  staff: T[],
  delegates: T[],
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const person of [...staff, ...delegates]) {
    if (!person?.id || seen.has(person.id)) continue;
    seen.add(person.id);
    merged.push(person);
  }
  return merged.sort((a, b) => {
    const an = `${a.firstName} ${a.lastName}`.trim();
    const bn = `${b.firstName} ${b.lastName}`.trim();
    return an.localeCompare(bn, 'tr');
  });
}
