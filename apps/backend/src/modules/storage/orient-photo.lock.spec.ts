import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { orientPhotoBuffer } from './orient-photo.ts';

describe('tespit resmi duruş LOCK', () => {
  it('EXIF 6 dikeyi piksele çevirir', async () => {
    const tagged = await sharp({
      create: { width: 400, height: 200, channels: 3, background: { r: 90, g: 96, b: 104 } },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const oriented = await orientPhotoBuffer(tagged);
    assert.ok(oriented.height > oriented.width);
  });

  it('yan duran yatay kareyi dikeye çevirir; düz yatayı bozmaz', async () => {
    const sideways = await stripeJpeg('vertical');
    const uprightLand = await stripeJpeg('horizontal');
    const rotated = await orientPhotoBuffer(sideways);
    assert.ok(rotated.height > rotated.width);
    const kept = await orientPhotoBuffer(uprightLand);
    assert.ok(kept.width > kept.height);
  });
});

async function stripeJpeg(kind: 'vertical' | 'horizontal'): Promise<Buffer> {
  const w = 240;
  const h = 120;
  const data = Buffer.alloc(w * h * 3, 255);
  if (kind === 'vertical') {
    for (let x = 6; x < w; x += 16) {
      for (let dx = 0; dx < 8; dx += 1) {
        for (let y = 0; y < h; y += 1) {
          const i = (y * w + x + dx) * 3;
          data[i] = 20;
          data[i + 1] = 20;
          data[i + 2] = 20;
        }
      }
    }
  } else {
    for (let y = 6; y < h; y += 16) {
      for (let dy = 0; dy < 8; dy += 1) {
        for (let x = 0; x < w; x += 1) {
          const i = ((y + dy) * w + x) * 3;
          data[i] = 20;
          data[i + 1] = 20;
          data[i + 2] = 20;
        }
      }
    }
  }
  return sharp(data, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}
