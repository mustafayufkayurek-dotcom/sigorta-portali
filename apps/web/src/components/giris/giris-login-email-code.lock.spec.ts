import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const panel = readFileSync(join(here, 'GirisLoginPanel.tsx'), 'utf8');
const girisPage = readFileSync(join(here, '../../app/giris/page.tsx'), 'utf8');

describe('giriş kodu ekranı LOCK', () => {
  it('kod kutusu ve yeniden gönder durur; Google yok', () => {
    assert.match(panel, /requiresEmailCode/);
    assert.match(panel, /login\/verify-email-code/);
    assert.match(panel, /Giriş Kodu/);
    assert.match(panel, /Kodu Yeniden Gönder/);
    assert.match(panel, /Şifre Ekranına Dön/);
    assert.match(panel, /backToPassword/);
    assert.match(panel, /resend-email-code/);
    assert.match(panel, /autoComplete="one-time-code"/);
    assert.match(panel, /extractLoginEmailCode/);
    assert.match(panel, /maskLoginMailbox/);
    assert.match(panel, /Yapıştır/);
    assert.doesNotMatch(panel, /Google/);
    assert.doesNotMatch(panel, /Açık ekranınız durur/);
  });

  it('yazılım giriş sayfası aynı kod kutusunu kullanır', () => {
    assert.match(girisPage, /GirisLoginPanel/);
    assert.doesNotMatch(girisPage, /handoffToSoftware/);
    assert.doesNotMatch(girisPage, /auth\/login/);
  });
});
