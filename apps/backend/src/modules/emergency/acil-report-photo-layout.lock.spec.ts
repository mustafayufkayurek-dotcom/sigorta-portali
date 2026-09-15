import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyAcilReportPhoto,
  displaySizeFromExifMeta,
  packAcilReportPhotoRows,
} from './acil-report-photo-layout.ts';

describe('acil rapor tespit resmi yerleşimi LOCK', () => {
  it('yatay iki, dikey üç, karışıkta yatay ayrı satır', () => {
    assert.equal(classifyAcilReportPhoto({ dataUrl: '', width: 1600, height: 900 }), 'landscape');
    assert.equal(classifyAcilReportPhoto({ dataUrl: '', width: 900, height: 1600 }), 'portrait');
    assert.equal(classifyAcilReportPhoto({ dataUrl: '', width: 1000, height: 1000 }), 'square');
    const packed = packAcilReportPhotoRows([
      { dataUrl: 'a', width: 1600, height: 900, caption: '1' },
      { dataUrl: 'b', width: 1800, height: 1000, caption: '2' },
      { dataUrl: 'c', width: 800, height: 1200, caption: '3' },
      { dataUrl: 'd', width: 700, height: 1100, caption: '4' },
      { dataUrl: 'e', width: 720, height: 1280, caption: '5' },
      { dataUrl: 'f', width: 1920, height: 1080, caption: '6' },
    ]);
    assert.equal(packed.length, 3);
    assert.equal(packed[0].kind, 'landscape');
    assert.equal(packed[0].items.length, 2);
    assert.equal(packed[1].kind, 'portrait');
    assert.equal(packed[1].items.length, 3);
    assert.equal(packed[2].kind, 'landscape');
    assert.equal(packed[2].items.length, 1);
  });

  it('telefon EXIF 6 dikeyi piksele çevirir', async () => {
    const size = displaySizeFromExifMeta({ width: 4032, height: 3024, orientation: 6 });
    assert.equal(size.width, 3024);
    assert.equal(size.height, 4032);
    assert.equal(classifyAcilReportPhoto({ dataUrl: '', ...size }), 'portrait');
  });
});
