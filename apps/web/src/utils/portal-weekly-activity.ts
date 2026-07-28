export type PortalWeeklyPoint = { label: string; count: number };

type WeeklyActivityFile = {
  lastActivityAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  notificationDate?: string | null;
};

function activityInstant(file: WeeklyActivityFile): number | null {
  const raw =
    file.lastActivityAt ||
    file.notificationDate ||
    file.updatedAt ||
    file.createdAt;
  if (!raw) return null;
  const t = new Date(raw);
  if (Number.isNaN(t.getTime())) return null;
  return t.getTime();
}

/** Son 7 gün dosya hareketi (güncellenen / oluşan / ihbar) — müşteri panelleri için semantik trend. */
export function buildPortalWeeklyActivity(files: WeeklyActivityFile[]): PortalWeeklyPoint[] {
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
    const ms = activityInstant(f);
    if (ms == null) continue;
    const t = new Date(ms);
    const dayStart = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    const dayOffset = Math.floor((todayStart - dayStart) / 86_400_000);
    if (dayOffset >= 0 && dayOffset < 7) {
      counts[6 - dayOffset] += 1;
    }
  }

  return labels.map((label, i) => ({ label, count: counts[i] ?? 0 }));
}
