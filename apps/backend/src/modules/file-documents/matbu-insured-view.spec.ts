import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toInsuredFacingMatbuHtml } from './matbu-insured-view.ts';

describe('sigortalı matbu ücret', () => {
  it('hizmet bedeli belgede durur; onay metni Onayla yolunu anlatır', () => {
    const html = `
      <div class="tutar-box"><span class="label">Hizmet Bedeli (KDV dahil)</span><span class="value">3.200,00 ₺</span></div>
      <div class="consent-text">hizmeti ve açıklanan toplam bedeli onayladığımı</div>
    `;
    const out = toInsuredFacingMatbuHtml(html);
    assert.match(out, /3\.200,00/);
    assert.match(out, /Hizmet Bedeli/);
    assert.doesNotMatch(out, /sigortali-ucret-gizli/);
    assert.doesNotMatch(out, /Bu onay formunda hizmet bedeli yer almaz/);
    assert.match(out, /Onayla yeterlidir/);
  });
});
