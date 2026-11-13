/**
 * Hasar Tespit Süreci Başlatıldı maili — onaylı broker / acente tasarımı (13.11.2026).
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/notifications/email/hasar-tespit-acilis-email.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { hasarTespitIlkMuhatap } from '../../../../../../packages/shared/src/hasar-tespit-muhatap.ts';

const here = dirname(fileURLToPath(import.meta.url));
const tpl = readFileSync(join(here, 'hasar-tespit-acilis-email.ts'), 'utf8');

describe('hasar tespit açılış maili LOCK', () => {
  it('ilk muhatap Sigorta → Broker → Eksper', () => {
    assert.equal(
      hasarTespitIlkMuhatap({
        insurance: { name: 'Allianz Sigorta', email: '' },
        broker: { name: 'Howden Türkiye', email: 'gorkem.cakar@howden.com.tr' },
        expert: { name: 'Ekol', email: 'mnazlier@ekolekspertiz.com.tr' },
      })?.party,
      'broker',
    );
    assert.equal(
      hasarTespitIlkMuhatap({ insurance: { name: 'X', email: 'a@b.com' }, broker: { email: 'c@d.com' } })?.party,
      'insurance',
    );
    assert.equal(hasarTespitIlkMuhatap({ expert: { email: 'e@f.com' } })?.party, 'expert');
    assert.equal(hasarTespitIlkMuhatap({}), null);
  });

  it('onaylı metin ve sıra durur; kaldırılan cümleler gelmez', () => {
    assert.match(tpl, /Hasar Tespit Süreci Başlatıldı/);
    assert.match(tpl, /Dosya Açılışı · /);
    assert.match(tpl, /Aşağıda bilgileri yer alan dosyanız için hasar tespit süreci başlatılmıştır\./);
    assert.doesNotMatch(tpl, /Tespit planı netleştiğinde/);
    assert.doesNotMatch(tpl, /Bir Sonraki Bilgilendirme/);
    assert.doesNotMatch(tpl, /DOSYA SÜREÇ BİLDİRİMİ/);
    assert.doesNotMatch(tpl, /Tasarım Önerisi/);
    const order = ['Dosya No', 'Sigorta Şirketi', 'Sigortalı', 'Dosya Konusu', 'İl / İlçe', 'İhbar Tarihi']
      .map((label) => tpl.indexOf(`fieldRow('${label}'`));
    assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), 'Dosya Bilgileri sırası');
  });

  it('Network il ve ilçeden; pazarlama yalnız broker / acente; düğme dosya sorumlusu maili', () => {
    assert.match(tpl, /\$\{il\}-\$\{ilce\} Network/);
    assert.match(tpl, /showPartner = data\.recipientParty === 'broker' \|\| data\.recipientParty === 'agency'/);
    assert.match(tpl, /BROKER VE ACENTELER İÇİN/);
    assert.match(tpl, /İş Birliği İçin Görüşelim/);
    assert.match(tpl, /mailto:\$\{ownerEmail\}\?subject=\$\{encodeURIComponent\('Broker ve Acente İş Birliği'\)\}/);
  });

  it('bildirim yalnız formda seçilince ve Hasar Tespit dosyasında gider; dosya geçmişine yazılır', () => {
    const service = readFileSync(join(here, '../../claim-files/claim-files.service.ts'), 'utf8');
    assert.match(service, /const sendOpeningNotice = sendOpeningNoticeRaw === true;/);
    assert.match(service, /if \(sendOpeningNotice && created\.serviceKind === 'inspection'\)/);
    assert.match(service, /kind: 'hasar_tespit_opening_notice'/);
    assert.match(service, /hasarTespitIlkMuhatap\(\{/);
    const form = readFileSync(join(here, '../../../../../web/src/components/claim-files/ClaimNewForm.tsx'), 'utf8');
    assert.match(form, /data-testid="hasar-tespit-acilis-bildirimi"/);
    assert.match(form, /Açılış Bildirimi Gönder/);
    assert.match(form, /useState\(false\);\n/);
    assert.match(form, /sendOpeningNotice: parseClaimServiceKind\(serviceKind\) === 'inspection' && sendOpeningNotice/);
  });

  it('Hasar Tespit yazışmasında Kime: tercih, sonra Sigorta → Broker → Eksper', () => {
    const to = readFileSync(join(here, '../../../../../web/src/utils/ops-email-default-to.ts'), 'utf8');
    assert.match(to, /hizmetKartiCodeForClaim\(claim\) === 'hasar-tespit'/);
    assert.match(to, /for \(const party of HASAR_TESPIT_MUHATAP_SIRASI\)/);
  });

  it('e-posta uyumlu: tablo, satır içi stil, script yok, gerçek logo kırpımı', () => {
    assert.doesNotMatch(tpl, /<script/i);
    assert.doesNotMatch(tpl, /style="[^"]*(?:display:grid|display:flex|object-fit)/);
    assert.doesNotMatch(tpl, /light-dark\(/);
    assert.match(tpl, /resolveMailWideLogoUrl/);
    assert.match(tpl, /@media only screen and \(max-width:440px\)/);
  });
});
