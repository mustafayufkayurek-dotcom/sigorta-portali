/**
 * Dış onay ekranı — onaylanan kart.
 * Orijinal logo içerikle sol hizada. Ret gerekçesi Reddet deyince açılır.
 * Görüş onayı değiştirmez. Önizleme yazısı yalnız deneme ortamında.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const page = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '[token]/page.tsx'),
  'utf8',
);
const service = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../../backend/src/modules/external-approvals/external-approvals.service.ts'),
  'utf8',
);

describe('dosya onay ekranı LOCK', () => {
  it('orijinal logo, telefon biçimi, ret gerekçesi ve ayrı görüş', () => {
    assert.match(page, /meridyen-logo-orijinal\.jpg/);
    assert.match(page, /alt="Meridyen Asistans"/);
    assert.doesNotMatch(page, /Orbit/);
    assert.doesNotMatch(page, />ASSISTANCE</);
    assert.match(page, /0\$\{local\.slice\(0, 3\)\} \$\{local\.slice\(3, 6\)\} \$\{local\.slice\(6, 8\)\} \$\{local\.slice\(8\)\}/);
    assert.match(page, /mailto:\$\{ownerEmail\}/);
    assert.match(page, /Dosya Değerlendirmeniz Bekleniyor/);
    assert.match(page, /Lütfen Dosya Durumunu Bildirin/);
    assert.match(page, /Dosyayı Onayla/);
    assert.match(page, /Ret Gerekçesi/);
    assert.match(page, /Ret Kararını İlet/);
    assert.match(page, /Vazgeç/);
    assert.match(page, /setAskingReason\(true\)/);
    assert.match(page, /Görüşünüz/);
    assert.match(page, /isteğe bağlı/);
    assert.match(page, /rounded-\[24px\]/);
    assert.match(page, /Operasyon Bölgesi/);
    assert.match(page, /Eksper Ofisi/);
    assert.match(page, /Rapor Bedeli/);
    assert.match(page, /totalSalesAmount/);
    assert.match(service, /expertOffice: \{ select: \{ companyName: true/);
    assert.match(page, /\/opinion/);
    assert.match(page, /NODE_ENV === 'production'\) return null/);
    assert.match(page, /token === 'gorunum' && sample != null/);
    const approve = page.slice(page.indexOf('const handleApprove'), page.indexOf('const handleSendReject'));
    assert.doesNotMatch(approve, /comments/);
    assert.match(approve, /action: 'approved'/);
    const reject = page.slice(page.indexOf('const handleSendReject'), page.indexOf('const shareNote'));
    assert.match(reject, /Lütfen ret gerekçesini yazın/);
    assert.match(reject, /action: 'rejected'/);
    const opinion = page.slice(page.indexOf('const shareNote'), page.indexOf("if (state === 'loading')"));
    assert.match(opinion, /\/opinion/);
    assert.doesNotMatch(opinion, /action: 'approved'/);
    assert.doesNotMatch(opinion, /action: 'rejected'/);
    const note = service.slice(service.indexOf('async noteOpinion'), service.indexOf('async respondAuth'));
    assert.match(note, /action: 'external_opinion'/);
    assert.doesNotMatch(note, /status: 'approved'/);
    assert.doesNotMatch(note, /status: 'rejected'/);
    const respond = service.slice(service.indexOf('async respond('), service.indexOf('async noteOpinion'));
    assert.match(respond, /dto\.action === 'rejected' && !commentText/);
    assert.match(respond, /Lütfen ret gerekçesini yazın/);
  });
});
