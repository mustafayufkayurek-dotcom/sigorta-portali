/** Off-site backup SUCCESS only after every critical stage passes. */

export const BACKUP_HEALTH_MIN_DB_BYTES = 10_240;
export const BACKUP_HEALTH_MIN_UPLOADS_BYTES = 100;
export const BACKUP_WATCHDOG_WARNING_HOURS = 24;
export const BACKUP_WATCHDOG_CRITICAL_HOURS = 48;

export type BackupStageOk = {
  localOk: boolean;
  uploadOk: boolean;
  remoteVerifyOk: boolean;
  checksumOk: boolean;
  bytes: number;
  minBytes: number;
};

export function isBackupArtifactHealthy(stage: BackupStageOk): boolean {
  return (
    stage.localOk &&
    stage.uploadOk &&
    stage.remoteVerifyOk &&
    stage.checksumOk &&
    stage.bytes >= stage.minBytes
  );
}

export function resolveBackupHealthResult(input: {
  db: BackupStageOk;
  uploads: BackupStageOk;
}): 'SUCCESS' | 'FAILED' {
  return isBackupArtifactHealthy(input.db) && isBackupArtifactHealthy(input.uploads)
    ? 'SUCCESS'
    : 'FAILED';
}

export function watchdogSeverity(hoursSinceLastSuccess: number | null): 'OK' | 'WARNING' | 'CRITICAL' {
  if (hoursSinceLastSuccess == null || !Number.isFinite(hoursSinceLastSuccess)) return 'CRITICAL';
  if (hoursSinceLastSuccess >= BACKUP_WATCHDOG_CRITICAL_HOURS) return 'CRITICAL';
  if (hoursSinceLastSuccess >= BACKUP_WATCHDOG_WARNING_HOURS) return 'WARNING';
  return 'OK';
}

/** Restore testi periyodu — Admin Genel Durum eşikleri */
export const RESTORE_WARNING_DAYS = 7;
export const RESTORE_CRITICAL_DAYS = 14;

export type AdminHealthTone = 'healthy' | 'warning' | 'critical';

export type AdminHealthInput = {
  result?: string;
  lastSuccessAt?: string | null;
  error?: string | null;
  db?: { checksumOk?: boolean; remoteVerifyOk?: boolean; uploadOk?: boolean };
  uploads?: { checksumOk?: boolean; remoteVerifyOk?: boolean; uploadOk?: boolean };
  b2?: { ok?: boolean };
  restoreTest?: { status?: string; testedAt?: string | null };
  /** Eski snapshot; Genel Durum hesabına girmez */
  scheduler?: { ok?: boolean };
};

export function hoursSinceIso(iso?: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 3_600_000;
}

export function daysSinceIso(iso?: string | null): number | null {
  const hours = hoursSinceIso(iso);
  if (hours == null) return null;
  return hours / 24;
}

function artifactVerifyOk(part?: { checksumOk?: boolean; remoteVerifyOk?: boolean; uploadOk?: boolean }): boolean {
  return Boolean(part?.uploadOk && part?.remoteVerifyOk && part?.checksumOk);
}

/**
 * Admin Genel Durum. scheduler.ok snapshot tek başına WARNING üretmez.
 */
export function overallAdminTone(data: AdminHealthInput | null): AdminHealthTone {
  if (!data || data.result !== 'SUCCESS') return 'critical';
  const ageH = hoursSinceIso(data.lastSuccessAt);
  if (ageH == null || ageH >= BACKUP_WATCHDOG_CRITICAL_HOURS) return 'critical';
  if (data.b2?.ok === false) return 'critical';
  if (!artifactVerifyOk(data.db) || !artifactVerifyOk(data.uploads)) return 'critical';
  const restore = data.restoreTest;
  const restoreDays = daysSinceIso(restore?.testedAt);
  const restorePass = String(restore?.status ?? '').toUpperCase() === 'PASS';
  if (!restorePass || restoreDays == null || restoreDays >= RESTORE_CRITICAL_DAYS) return 'critical';
  if (ageH >= BACKUP_WATCHDOG_WARNING_HOURS) return 'warning';
  if (restoreDays >= RESTORE_WARNING_DAYS) return 'warning';
  return 'healthy';
}
