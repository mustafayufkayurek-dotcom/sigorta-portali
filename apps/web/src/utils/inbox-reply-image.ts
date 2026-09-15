/** Yanıt eki fotoğrafı Graph sendMail tavanına sığacak kadar küçültür. Taslak açılmaz. */

const MAX_EDGE = 1600;
const TARGET_EACH = 220_000;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Fotoğraf açılamadı'));
    };
    img.src = url;
  });
}

function canvasToJpeg(img: HTMLImageElement, quality: number): Promise<Blob> {
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Fotoğraf küçültülemedi'));
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Fotoğraf küçültülemedi'))),
      'image/jpeg',
      quality,
    );
  });
}

function jpegName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '') || 'foto';
  return `${base}.jpg`;
}

export async function shrinkInboxReplyAttachment(file: File, remainingBytes: number): Promise<File> {
  const image = /\.(jpe?g|png|webp|gif)$/i.test(file.name) || (file.type || '').startsWith('image/');
  if (!image || (file.type || '').includes('heic') || (file.type || '').includes('heif')) {
    return file;
  }
  const cap = Math.max(40_000, Math.min(remainingBytes, TARGET_EACH));
  if (file.size <= cap) return file;
  try {
    const img = await loadImage(file);
    for (const quality of [0.72, 0.58, 0.45]) {
      const blob = await canvasToJpeg(img, quality);
      if (blob.size <= remainingBytes && blob.size <= TARGET_EACH * 1.4) {
        return new File([blob], jpegName(file.name), { type: 'image/jpeg' });
      }
    }
    const last = await canvasToJpeg(img, 0.4);
    return new File([last], jpegName(file.name), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
