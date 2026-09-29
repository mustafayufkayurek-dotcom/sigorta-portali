/**
 * Dijital onay WhatsApp — söz konusu talep olağan prosedür; Muvafakatname / Onayla’ya basın yok.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/dijital-onay-whatsapp-message.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDijitalOnayWhatsAppMessage,
  dijitalOnayWhatsAppKind,
  formatDijitalOnayOwnerPhone,
} from './dijital-onay-whatsapp-message.ts';

const url = 'https://app.meridyen-tr.com/evrak/ornek';

describe('dijital onay WhatsApp metni LOCK', () => {
  it('Hasar, Acil ihbar ve kapanış ekrandaki cümleleri basar', () => {
    assert.equal(dijitalOnayWhatsAppKind('muvafakatname'), 'hasar');
    assert.equal(dijitalOnayWhatsAppKind('adres_hizmet_talep'), 'acil_ihbar');
    assert.equal(dijitalOnayWhatsAppKind('matbu_evrak'), 'acil_kapanis');
    assert.equal(formatDijitalOnayOwnerPhone('+90 532 133 4144'), '532 133 4144');

    const hasar = buildDijitalOnayWhatsAppMessage({
      kind: 'hasar',
      insuredName: 'Ayşe Yılmaz',
      fileNo: 'HASAR-1001',
      approvalUrl: url,
      ownerName: 'Mehmet Demir',
      ownerPhone: '05321334144',
    });
    assert.match(hasar, /^Sayın Ayşe Yılmaz,/m);
    assert.match(hasar, /HASAR-1001 numaralı hasar dosyanız için onarım onayı gerekmektedir/);
    assert.match(hasar, /Söz konusu talep olağan prosedür kapsamındadır/);
    assert.match(hasar, /Onay sayfası \(meridyen-tr\.com\):/);
    assert.match(hasar, /Bu yazı dosya sorumlusu Mehmet Demir tarafından gönderilmiştir/);
    assert.match(hasar, /Dosya sorumlusu cep: 532 133 4144/);
    assert.doesNotMatch(hasar, /Muvafakatname/);
    assert.doesNotMatch(hasar, /Yazıcı gerekmez/);
    assert.doesNotMatch(hasar, /Onayla’ya basın/);

    const ihbar = buildDijitalOnayWhatsAppMessage({
      kind: 'acil_ihbar',
      insuredName: 'Ayşe Yılmaz',
      fileNo: 'AY-1001',
      approvalUrl: url,
      ownerName: 'Mehmet Demir',
      ownerPhone: '5321334144',
    });
    assert.match(ihbar, /AY-1001 numaralı acil yardım dosyanız için belirtilen adreste hizmet verilmesini için onayınız gerekmektedir/);
    assert.match(ihbar, /Söz konusu talep olağan prosedür kapsamındadır/);

    const kapanis = buildDijitalOnayWhatsAppMessage({
      kind: 'acil_kapanis',
      insuredName: 'Ayşe Yılmaz',
      fileNo: 'AY-1001',
      approvalUrl: url,
      ownerName: 'Mehmet Demir',
      ownerPhone: '5321334144',
    });
    assert.match(kapanis, /AY-1001 numaralı acil yardım dosyanızda hizmetin tamamlandığını onaylamanız gerekmektedir/);
    assert.doesNotMatch(kapanis, /olağan prosedür/);
  });
});
