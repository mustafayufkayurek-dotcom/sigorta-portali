/** Yedek sağlığı ekranı — mevcut backup_health JSON'unu değiştirmeden gösterir. */

export {
  BACKUP_WATCHDOG_CRITICAL_HOURS,
  BACKUP_WATCHDOG_WARNING_HOURS,
  RESTORE_CRITICAL_DAYS,
  RESTORE_WARNING_DAYS,
  hoursSinceIso as hoursSince,
  overallAdminTone as overallTone,
  watchdogSeverity,
} from '@sigorta/shared';
export type { AdminHealthTone as OverallTone } from '@sigorta/shared';

export const BACKUP_HEALTH_POLL_MS = 5 * 60 * 1000;

export type BackupHealthPayload = {
  result?: string;
  recordedAt?: string;
  lastSuccessAt?: string | null;
  error?: string | null;
  durationSeconds?: number;
  db?: {
    localOk?: boolean;
    uploadOk?: boolean;
    remoteVerifyOk?: boolean;
    checksumOk?: boolean;
    fileName?: string;
    bytes?: number;
    b2Key?: string;
    restoreTest?: string;
  };
  uploads?: {
    localOk?: boolean;
    uploadOk?: boolean;
    remoteVerifyOk?: boolean;
    checksumOk?: boolean;
    fileName?: string;
    bytes?: number;
    b2Key?: string;
  };
  b2?: { ok?: boolean };
  scheduler?: { ok?: boolean; checkedAt?: string };
  restoreTest?: {
    status?: string;
    testedAt?: string;
    backupFile?: string;
    summary?: string;
    publicTables?: number;
    claimFiles?: number;
    duration?: number;
    durationSeconds?: number;
    error?: string | null;
  };
  notify?: { telegram?: string; email?: string; emailError?: string };
};

export function watchdogTone(hours: number | null): 'healthy' | 'warning' | 'critical' {
  if (hours == null || !Number.isFinite(hours)) return 'critical';
  if (hours >= 48) return 'critical';
  if (hours >= 24) return 'warning';
  return 'healthy';
}

export function formatBytes(bytes?: number): string {
  const n = Number(bytes ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '0 byte';
  if (n < 1024) return `${n} byte`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatWhen(value?: string | null): string {
  if (!value) return 'Yok';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatClock(value: Date): string {
  return value.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function restoreDisplay(data: BackupHealthPayload | null): string {
  const r = data?.restoreTest;
  if (!r?.status) return 'Bu health kaydında restore testi sonucu yok';
  const when = formatWhen(r.testedAt);
  const file = r.backupFile || '—';
  const summary = r.summary || `${r.publicTables ?? '—'} public tables, claim_files=${r.claimFiles ?? '—'}`;
  return `${r.status} · ${when} · ${file} · ${summary}`;
}
