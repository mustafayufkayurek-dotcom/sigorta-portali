import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

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

const PDF_IMAGE_BYTES = 180_000;

export type PdfImageFit = {
  maxEdge: number;
  quality: number;
  maxBytes: number;
};

const DEFAULT_PDF_IMAGE_FIT: PdfImageFit = {
  maxEdge: 1400,
  quality: 72,
  maxBytes: PDF_IMAGE_BYTES,
};

function isJpegMime(mime: string): boolean {
  return /jpe?g/i.test(mime);
}

/**
 * PDF’ye gömülecek fotoğraf.
 * WebP ve PNG olduğu gibi gömülürse sayfa şişer; mail sınırı aşılır.
 * Yalnız küçük JPEG aynen kalır. Diğerleri JPEG olur.
 */
export async function reportImageToPdfDataUrl(
  storageKey: string | null | undefined,
  mimeType?: string | null,
  fit: PdfImageFit = DEFAULT_PDF_IMAGE_FIT,
): Promise<string | null> {
  const filePath = resolveReportImageFilePath(storageKey);
  if (!filePath) return null;
  let original: Buffer;
  try {
    original = fs.readFileSync(filePath);
  } catch {
    return null;
  }
  if (!original.length) return null;
  const mime = mimeFromPath(filePath, mimeType);
  if (isJpegMime(mime) && original.length <= fit.maxBytes) {
    return `data:${mime};base64,${original.toString('base64')}`;
  }
  try {
    const compressed = await sharp(original)
      .rotate()
      .resize({ width: fit.maxEdge, height: fit.maxEdge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: fit.quality, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${compressed.toString('base64')}`;
  } catch {
    if (isJpegMime(mime) && original.length <= fit.maxBytes) {
      return `data:${mime};base64,${original.toString('base64')}`;
    }
    return null;
  }
}
