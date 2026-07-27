export type PortalWeeklyPoint = { label: string; count: number };

/** Son 7 gün dosya hareketi (güncellenen / oluşan) — müşteri panelleri için semantik trend. */
export function buildPortalWeeklyActivity(
  files: Array<{
    lastActivityAt?: string | null;
    updatedAt?: string | null;
    createdAt?: string | null;
  }>,
): PortalWeeklyPoint[] {
  const now = new Date();
  const counts = Array.from({ length: 7 }, () => 0);
  const labels: string[] = [];

  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    labels.push(
      d.toLocaleDateString('tr-TR', { weekday: 'short' }).replace(/\.$/, ''),
    );
  }

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  for (const f of files) {
    const raw = f.lastActivityAt || f.updatedAt || f.createdAt;
    if (!raw) continue;
    const t = new Date(raw);
    if (Number.isNaN(t.getTime())) continue;
    const dayStart = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    const dayOffset = Math.floor((todayStart - dayStart) / 86_400_000);
    if (dayOffset >= 0 && dayOffset < 7) {
      counts[6 - dayOffset] += 1;
    }
  }

  return labels.map((label, i) => ({ label, count: counts[i] ?? 0 }));
}
