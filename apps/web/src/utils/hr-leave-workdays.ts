/**
 * İzin gün hesabı — hafta tatili (Cmt–Paz) düşülür.
 * Resmi tatil bu yardımcıda yok (sonraki faz / takvim servisi).
 */

export function parseTrDateLabel(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // ISO (takvim seçici): YYYY-MM-DD
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = Number(iso[1]);
    const mo = Number(iso[2]);
    const d = Number(iso[3]);
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (
      date.getUTCFullYear() !== y ||
      date.getUTCMonth() !== mo - 1 ||
      date.getUTCDate() !== d
    ) {
      return null;
    }
    return date;
  }

  // TR metin: GG.AA.YYYY
  const m = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== mo - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

/** Başlangıç–bitiş arası iş günü (Pzt–Cum). Bitiş dahil. */
export function countBusinessDaysInclusive(
  startLabel: string,
  endLabel: string,
): { workDays: number; calendarDays: number; weekendDays: number } | null {
  const start = parseTrDateLabel(startLabel);
  const end = parseTrDateLabel(endLabel);
  if (!start || !end || end < start) return null;

  let workDays = 0;
  let calendarDays = 0;
  let weekendDays = 0;
  const cur = new Date(start);
  while (cur <= end) {
    calendarDays += 1;
    const dow = cur.getUTCDay(); // 0 Paz … 6 Cmt
    if (dow === 0 || dow === 6) weekendDays += 1;
    else workDays += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return { workDays, calendarDays, weekendDays };
}

/** API / liste gösterimi için GG.AA.YYYY */
export function toTrDateLabel(value: string): string {
  const d = parseTrDateLabel(value);
  if (!d) return value;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}
