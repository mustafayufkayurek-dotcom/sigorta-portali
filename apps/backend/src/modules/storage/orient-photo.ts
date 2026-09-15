import sharp from 'sharp';

const SIDEWAYS_RATIO = 1.6;

export async function orientPhotoBuffer(buf: Buffer): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
}> {
  const exifFixed = await sharp(buf, { failOn: 'none' }).rotate().toBuffer();
  const meta = await sharp(exifFixed).metadata();
  let buffer = exifFixed;
  let width = meta.width ?? 0;
  let height = meta.height ?? 0;
  if (width > height) {
    const ratio = await edgeRatio(buffer);
    if (ratio >= SIDEWAYS_RATIO) {
      buffer = await sharp(buffer).rotate(90).toBuffer();
      const next = await sharp(buffer).metadata();
      width = next.width ?? height;
      height = next.height ?? width;
    }
  }
  return { buffer, width, height };
}

export async function embedOrientedAcilReportPhoto(
  buf: Buffer,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const oriented = await orientPhotoBuffer(buf);
    const out = await sharp(oriented.buffer).jpeg({ quality: 84 }).toBuffer();
    if (!out.length || !(oriented.width > 0 && oriented.height > 0)) return null;
    return {
      dataUrl: `data:image/jpeg;base64,${out.toString('base64')}`,
      width: oriented.width,
      height: oriented.height,
    };
  } catch {
    return null;
  }
}

async function edgeRatio(buf: Buffer): Promise<number> {
  const { data, info } = await sharp(buf)
    .greyscale()
    .resize(96, 96, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  let hd = 0;
  let hn = 0;
  let vd = 0;
  let vn = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 1; x < w; x += 1) {
      hd += Math.abs(data[y * w + x] - data[y * w + x - 1]);
      hn += 1;
    }
  }
  for (let y = 1; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      vd += Math.abs(data[y * w + x] - data[(y - 1) * w + x]);
      vn += 1;
    }
  }
  const horizontal = hn ? hd / hn : 0;
  const vertical = vn ? vd / vn : 0;
  if (vertical === 0) return horizontal > 0 ? 99 : 0;
  return horizontal / vertical;
}
