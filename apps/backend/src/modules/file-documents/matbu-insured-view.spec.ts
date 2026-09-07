import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { INSURED_FEE_NOTICE, toInsuredFacingMatbuHtml } from './matbu-insured-view.ts';

describe('sigortalı matbu ücret', () => {
  it('sigortalıda hizmet bedeli gizlenir', () => {
    const html = `
      <div class="totals-section"><div class="tutar-box"><span class="label">Hizmet Bedeli (KDV dahil)</span><span class="value">3.200,00 ₺</span></div></div>
      <div class="legal-section"><div class="consent-text">hizmeti ve açıklanan toplam bedeli onayladığımı</div></div>
    `;
    const out = toInsuredFacingMatbuHtml(html);
    assert.doesNotMatch(out, /3\.200,00/);
    assert.match(out, new RegExp(INSURED_FEE_NOTICE));
    assert.match(out, /sigortali-ucret-gizli/);
    assert.match(out, /Onayla yeterlidir/);
  });

  it('adres ve hizmet talep onayında bedel metnini değiştirmez', () => {
    const html = '<div class="header-title">Adres Ve Hizmet Talep Onayı</div><div class="consent-text">adreste işlem</div>';
    assert.equal(toInsuredFacingMatbuHtml(html), html);
  });
});
