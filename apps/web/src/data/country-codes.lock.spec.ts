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
    assert.equal(formatTrLocalDigits('05321334144'), '532 133 4144');
    const grouped = readFileSync(join(here, '../utils/validators.ts'), 'utf8');
    assert.match(grouped, /formatPhoneDisplay\(phone\)/);
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
    assert.doesNotMatch(src, /overflow-hidden/);
  });
});
