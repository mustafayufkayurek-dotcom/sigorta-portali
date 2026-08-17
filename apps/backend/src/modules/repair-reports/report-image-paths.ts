import * as fs from 'fs';
import * as path from 'path';

/**
 * Rapor fotoğraf dizini — cwd farkı (repo kökü vs apps/backend) yüzünden
 * «Yüklenemedi» regresyonunu önlemek için tek çözüm noktası.
 *
 * Canlı: REPORT_IMAGES_DIR=/app/apps/backend/uploads/report-images
 * (docker-compose.prod.yml bind-mount ile aynı ağaç).
 */
export function getReportImagesDir(): string {
  const fromEnv = String(process.env.REPORT_IMAGES_DIR ?? '').trim();
  if (fromEnv) {
    fs.mkdirSync(fromEnv, { recursive: true });
    return fromEnv;
  }

  const candidates = [
    // cwd = apps/backend (container WORKDIR çoğu deploy’da)
    path.join(process.cwd(), 'uploads', 'report-images'),
    // cwd = monorepo /app kökü
    path.join(process.cwd(), 'apps', 'backend', 'uploads', 'report-images'),
    // dist/modules/repair-reports → apps/backend/uploads/report-images
    path.join(__dirname, '..', '..', '..', 'uploads', 'report-images'),
  ];

  // Önce dosya içeren dizini tercih et (boş ephemeral klasör yanlış seçilmesin)
  let firstExisting: string | null = null;
  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) continue;
      if (!firstExisting) firstExisting = dir;
      const hasFiles = fs.readdirSync(dir).some((name) => {
        try {
          return fs.statSync(path.join(dir, name)).isFile();
        } catch {
          return false;
        }
      });
      if (hasFiles) return dir;
    } catch {
      /* sonraki aday */
    }
  }
  if (firstExisting) return firstExisting;

  const primary = candidates[0];
  fs.mkdirSync(primary, { recursive: true });
  return primary;
}

/** ServeStatic /uploads kökü — report-images ile aynı uploads ağacı. */
export function getUploadsRootDir(): string {
  return path.dirname(getReportImagesDir());
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
    path.join(__dirname, '..', '..', '..', 'uploads', 'report-images', base),
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

function mimeFromPath(filePath: string, mimeType?: string | null): string {
  const given = String(mimeType ?? '').trim();
  if (given) return given;
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

/** PDF gömme — HTTP URL’ye bağımlı kalmadan data URI. Dosya yoksa null. */
export function reportImageToDataUrl(
  storageKey: string | null | undefined,
  mimeType?: string | null,
): string | null {
  const filePath = resolveReportImageFilePath(storageKey);
  if (!filePath) return null;
  try {
    const buf = fs.readFileSync(filePath);
    if (!buf.length) return null;
    return `data:${mimeFromPath(filePath, mimeType)};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}
