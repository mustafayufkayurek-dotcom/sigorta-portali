/** Panel nabzı — puantaj mesai giriş/bitiş ve önerilen süre bununla düşer. */

export const ACTIVITY_BEAT_IDLE_GAP_MS = 3 * 60_000;
/** Uyuyan sekme / kapalı laptop Int taşırmaz. */
const ACTIVITY_BEAT_ELAPSED_CAP_MS = 8 * 60 * 60 * 1000;

export type ActivityBeatState = {
  startedAt: Date;
  lastBeatAt: Date;
  activeMs: number;
  idleMs: number;
  beatCount: number;
};

export function applyActivityBeat(
  existing: ActivityBeatState | null,
  now: Date,
): ActivityBeatState {
  if (!existing) {
    return {
      startedAt: now,
      lastBeatAt: now,
      activeMs: 0,
      idleMs: 0,
      beatCount: 1,
    };
  }

  const rawElapsed = Math.max(0, now.getTime() - existing.lastBeatAt.getTime());
  const elapsed = Math.min(rawElapsed, ACTIVITY_BEAT_ELAPSED_CAP_MS);
  const active = elapsed <= ACTIVITY_BEAT_IDLE_GAP_MS;
  return {
    startedAt: existing.startedAt,
    lastBeatAt: now,
    activeMs: existing.activeMs + (active ? elapsed : 0),
    idleMs: existing.idleMs + (active ? 0 : elapsed),
    beatCount: existing.beatCount + 1,
  };
}
