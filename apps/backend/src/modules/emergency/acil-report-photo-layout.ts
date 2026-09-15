export type AcilReportPhotoKind = 'landscape' | 'portrait' | 'square';

export type AcilReportPhoto = {
  dataUrl: string;
  caption?: string;
  width?: number | null;
  height?: number | null;
};

export type AcilReportPhotoRow<T extends AcilReportPhoto = AcilReportPhoto> = {
  kind: 'landscape' | 'portrait';
  items: T[];
};

const LANDSCAPE_RATIO = 1.15;

export function classifyAcilReportPhoto(photo: Pick<AcilReportPhoto, 'dataUrl' | 'width' | 'height'>): AcilReportPhotoKind {
  let width = Number(photo.width) || 0;
  let height = Number(photo.height) || 0;
  if (!(width > 0 && height > 0)) {
    const probed = probeAcilReportPhotoSize(photo.dataUrl);
    if (probed) {
      width = probed.width;
      height = probed.height;
    }
  }
  if (!(width > 0 && height > 0)) return 'square';
  const ratio = width / height;
  if (ratio >= LANDSCAPE_RATIO) return 'landscape';
  if (ratio <= 1 / LANDSCAPE_RATIO) return 'portrait';
  return 'square';
}

export function packAcilReportPhotoRows<T extends AcilReportPhoto>(photos: T[]): Array<AcilReportPhotoRow<T>> {
  const rows: Array<AcilReportPhotoRow<T>> = [];
  let i = 0;
  while (i < photos.length) {
    const kind = classifyAcilReportPhoto(photos[i]);
    if (kind === 'landscape') {
      const items = [photos[i]];
      if (photos[i + 1] && classifyAcilReportPhoto(photos[i + 1]) === 'landscape') {
        items.push(photos[i + 1]);
      }
      rows.push({ kind: 'landscape', items });
      i += items.length;
      continue;
    }
    const items: T[] = [];
    while (items.length < 3 && photos[i] && classifyAcilReportPhoto(photos[i]) !== 'landscape') {
      items.push(photos[i]);
      i += 1;
    }
    rows.push({ kind: 'portrait', items });
  }
  return rows;
}

export function displaySizeFromExifMeta(input: {
  width?: number | null;
  height?: number | null;
  orientation?: number | null;
}): { width: number; height: number } {
  let width = Number(input.width) || 0;
  let height = Number(input.height) || 0;
  const orientation = Number(input.orientation) || 1;
  if (orientation >= 5 && orientation <= 8) {
    const swap = width;
    width = height;
    height = swap;
  }
  return { width, height };
}

export function probeAcilReportPhotoSize(dataUrl: string): { width: number; height: number } | null {
  const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/.exec(dataUrl || '');
  if (!match) return null;
  try {
    const buf = Buffer.from(match[1], 'base64');
    return readPngSize(buf) || readJpegSize(buf) || readGifSize(buf) || readWebpSize(buf);
  } catch {
    return null;
  }
}

function readPngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  if (buf.subarray(0, 8).toString('binary') !== '\x89PNG\r\n\x1a\n') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readGifSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 10) return null;
  const sig = buf.subarray(0, 6).toString('ascii');
  if (sig !== 'GIF87a' && sig !== 'GIF89a') return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function readWebpSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 30) return null;
  if (buf.subarray(0, 4).toString('ascii') !== 'RIFF' || buf.subarray(8, 12).toString('ascii') !== 'WEBP') return null;
  const chunk = buf.subarray(12, 16).toString('ascii');
  if (chunk === 'VP8X' && buf.length >= 30) {
    const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { width, height };
  }
  if (chunk === 'VP8 ' && buf.length >= 30) {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

function readJpegSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const orientation = readJpegExifOrientation(buf);
  let offset = 2;
  while (offset + 8 < buf.length) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return displaySizeFromExifMeta({ width, height, orientation });
    }
    const size = buf.readUInt16BE(offset + 2);
    offset += 2 + size;
  }
  return null;
}

function readJpegExifOrientation(buf: Buffer): number {
  let offset = 2;
  while (offset + 8 < buf.length) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1];
    const size = buf.readUInt16BE(offset + 2);
    if (marker === 0xe1 && buf.subarray(offset + 4, offset + 10).toString('ascii') === 'Exif\0\0') {
      const tiff = offset + 10;
      const little = buf.toString('ascii', tiff, tiff + 2) === 'II';
      const read16 = (at: number) => (little ? buf.readUInt16LE(at) : buf.readUInt16BE(at));
      const read32 = (at: number) => (little ? buf.readUInt32LE(at) : buf.readUInt32BE(at));
      const ifd0 = tiff + read32(tiff + 4);
      const count = read16(ifd0);
      for (let i = 0; i < count; i += 1) {
        const entry = ifd0 + 2 + i * 12;
        if (entry + 12 > buf.length) break;
        if (read16(entry) === 0x0112) {
          return read16(entry + 8) || 1;
        }
      }
      return 1;
    }
    offset += 2 + size;
  }
  return 1;
}
