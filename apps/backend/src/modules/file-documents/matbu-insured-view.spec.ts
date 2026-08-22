import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { INSURED_FEE_NOTICE, toInsuredFacingMatbuHtml } from './matbu-insured-view.ts';

describe('sigortalı matbu ücret gizleme', () => {
  it('tutar kutusunu kaldırır, uyarı basar', () => {
    const html = `
      <div class="tutar-box"><span class="label">Toplam Hizmet Bedeli (KDV Dahil)</span><span class="value">3.200,00 ₺</span></div>
      <div class="consent-text">hizmeti ve açıklanan toplam bedeli onayladığımı</div>
    `;
    const out = toInsuredFacingMatbuHtml(html);
    assert.match(out, /sigortali-ucret-gizli/);
    assert.match(out, new RegExp(INSURED_FEE_NOTICE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(out, /Sizden ücret istenmez/);
    assert.doesNotMatch(out, /3\.200,00/);
    assert.doesNotMatch(out, /toplam bedeli/);
  });
});
