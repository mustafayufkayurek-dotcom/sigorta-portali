/**
 * Tespitçi WA — sigortalı telefon regresyonu.
 * Çalıştır: node --experimental-strip-types apps/web/src/components/hasar-operasyon-planlayicisi/hasar-templates.regression.test.ts
 */
import assert from 'node:assert/strict';
import {
  ensureInsuredPhoneInMessage,
  INSPECTOR_APPOINTMENT_DEFAULT,
  interpolateHasarTemplate,
} from './hasar-template-text.ts';

const phone = '05321112233';
const vars = {
  musteriAdi: 'Pelin İki',
  musteriTelefon: phone,
  dosyaNo: '15598774220001',
  hasarAdresi: 'Kadıköy',
  randevuTarih: '06.08.2026',
  randevuSaat: '10:30',
  tahminiSure: '90 Dakika',
};

{
  assert.match(INSPECTOR_APPOINTMENT_DEFAULT, /\{musteriTelefon\}/);
  const msg = interpolateHasarTemplate(INSPECTOR_APPOINTMENT_DEFAULT, vars);
  assert.match(msg, new RegExp(phone));
  assert.match(msg, /Pelin İki/);
}

{
  const old =
    '{dosyaNo} numaralı dosya için tespit randevusu: {randevuTarih} {randevuSaat}. Sigortalı: {musteriAdi}. Adres: {hasarAdresi}.';
  const msg = ensureInsuredPhoneInMessage(interpolateHasarTemplate(old, vars), phone);
  assert.match(msg, new RegExp(phone));
  assert.equal(ensureInsuredPhoneInMessage(msg, phone), msg);
}

console.log('hasar-templates.regression.test.ts PASS');
