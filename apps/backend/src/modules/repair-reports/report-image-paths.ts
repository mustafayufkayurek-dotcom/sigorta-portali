import * as fs from 'fs';
import * as path from 'path';

/**
 * Rapor fotoğraf dizini — cwd farkı (repo kökü vs apps/backend) yüzünden
 * «Yüklenemedi» regresyonunu önlemek için tek çözüm noktası.
 */
export function getReportImagesDir(): string {
  const fromEnv = String(process.env.REPORT_IMAGES_DIR ?? '').trim();
  if (fromEnv) {
    fs.mkdirSync(fromEnv, { recursive: true });
    return fromEnv;
  }

  const candidates = [
    path.join(process.cwd(), 'uploads', 'report-images'),
    path.join(process.cwd(), 'apps', 'backend', 'uploads', 'report-images'),
    // dist/modules/repair-reports → apps/backend/uploads/report-images
    path.join(__dirname, '..', '..', '..', 'uploads', 'report-images'),
  ];

  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir)) return dir;
    } catch {
      /* sonraki aday */
    }
  }

  const primary = candidates[0];
  fs.mkdirSync(primary, { recursive: true });
  return primary;
}

/** Diskte gerçek dosya yolunu bul; yoksa null. */
export function resolveReportImageFilePath(storageKey: string | null | undefined): string | null {
  const raw = String(storageKey ?? '').trim();
  if (!raw) return null;
  const base = path.basename(raw);
  const dir = getReportImagesDir();
  const candidates = [
    path.join(dir, base),
    path.join(dir, raw),
    path.join(process.cwd(), 'uploads', 'report-images', base),
    path.join(process.cwd(), 'apps', 'backend', 'uploads', 'report-images', base),
  ];

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return filePath;
    } catch {
      /* sonraki aday */
    }
  }
  return null;
}
