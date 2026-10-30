import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { formatPhoneDisplay, formatTrLocalDigits, parseInternationalPhone } from './country-codes.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('telefon gösterim kilidi', () => {
  it('Türkiye numarası 532 133 4144 yazar; +90 ve baştaki 0 durmaz', () => {
    assert.equal(formatPhoneDisplay('+905321334144'), '532 133 4144');
    assert.equal(formatPhoneDisplay('05321334144'), '532 133 4144');
    assert.equal(formatPhoneDisplay('5321334144'), '532 133 4144');
    assert.equal(formatPhoneDisplay('+90 532 133 41 44'), '532 133 4144');
    assert.equal(formatPhoneDisplay('0 (549) 434 12 34'), '549 434 1234');
    assert.equal(formatTrLocalDigits('05321334144'), '532 133 4144');
    assert.equal(parseInternationalPhone('0 (549) 434').localDigits, '549434');
    const grouped = readFileSync(join(here, '../utils/validators.ts'), 'utf8');
    assert.match(grouped, /formatPhoneDisplay\(phone\)/);
    assert.doesNotMatch(grouped, /0 ile başlamalıdır/);
    const customer = readFileSync(join(here, '../utils/customer-form-helpers.ts'), 'utf8');
    assert.doesNotMatch(customer, /0 ile başlamalıdır/);
  });

  it('kayıt uluslararası kalır', () => {
    assert.equal(parseInternationalPhone('532 133 4144').international, '+905321334144');
    assert.equal(parseInternationalPhone('0532 133 4144').international, '+905321334144');
  });

  it('telefon kutusu taşmayı kesmez; ülke listesi sayfaya çıkar', () => {
    const src = readFileSync(join(here, '../components/PhoneInput.tsx'), 'utf8');
    assert.match(src, /createPortal/);
    assert.match(src, /fixed z-\[220\]/);
    assert.match(src, /h-10/);
    assert.match(src, /type="text"/);
    assert.match(src, /autoComplete="off"/);
    assert.doesNotMatch(src, /type="tel"/);
    assert.doesNotMatch(src, /overflow-hidden/);
  });

  it('dosya ve ihbar telefonu müşteri kartı ile aynı tiptedir; baştaki 0 istenmez', () => {
    const claim = readFileSync(join(here, '../components/claim-files/ClaimNewForm.tsx'), 'utf8');
    const acil = readFileSync(join(here, '../components/emergency/EmergencyCaseNewForm.tsx'), 'utf8');
    const duzenle = readFileSync(
      join(here, '../app/panel/hasar-dosyalari/[id]/_components/DosyaBilgileriEditModal.tsx'),
      'utf8',
    );
    const sigortaIhbar = readFileSync(
      join(here, '../components/portal/InsuranceIhbarModal.tsx'),
      'utf8',
    );
    for (const src of [claim, acil, duzenle, sigortaIhbar]) {
      assert.match(src, /PhoneInput/);
      assert.doesNotMatch(src, /0 \(5XX\) XXX XX XX/);
      assert.doesNotMatch(src, /05XX XXX XX XX/);
      assert.doesNotMatch(src, /function TRPhoneInput/);
      assert.doesNotMatch(src, /setPhoneDisplay/);
    }
  });
});
