/** Tespit galeri yükü: telefonda küçülür, sıra sıra tam boy gitmez. */

export const INSPECTION_PHOTO_MAX_EDGE = 1920;
export const INSPECTION_PHOTO_JPEG_QUALITY = 0.78;
export const INSPECTION_PHOTO_UPLOAD_CONCURRENCY = 3;
const SKIP_IF_SMALLER_THAN = 320_000;

function jpegName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '') || 'tespit';
  return `${base}.jpg`;
}

function drawToJpeg(source: CanvasImageSource, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Fotoğraf küçültülemedi'));
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Fotoğraf küçültülemedi'))),
      'image/jpeg',
      INSPECTION_PHOTO_JPEG_QUALITY,
    );
  });
}

function scaleSize(w: number, h: number): { width: number; height: number } {
  const scale = Math.min(1, INSPECTION_PHOTO_MAX_EDGE / Math.max(w, h, 1));
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

async function fromBitmap(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = scaleSize(bitmap.width, bitmap.height);
    const blob = await drawToJpeg(bitmap, width, height);
    return new File([blob], jpegName(file.name), { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}

async function fromImageElement(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Fotoğraf açılamadı'));
      el.src = url;
    });
    const { width, height } = scaleSize(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const blob = await drawToJpeg(img, width, height);
    return new File([blob], jpegName(file.name), { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Galeri/kamera dosyasını tespit yüküne uygun küçültür. Açılamazsa aslı gider. */
export async function shrinkInspectionPhoto(file: File): Promise<File> {
  const looksImage =
    (file.type || '').startsWith('image/')
    || /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(file.name);
  if (!looksImage) return file;
  if (file.size <= SKIP_IF_SMALLER_THAN && /^image\/jpe?g$/i.test(file.type || '')) return file;
  try {
    if (typeof createImageBitmap === 'function') {
      return await fromBitmap(file);
    }
  } catch {
    /* HEIC bazı tarayıcıda bitmap olmaz */
  }
  try {
    return await fromImageElement(file);
  } catch {
    return file;
  }
}

export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const n = Math.max(1, Math.min(limit, items.length) || 1);
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        await worker(items[index]);
      }
    }),
  );
}
