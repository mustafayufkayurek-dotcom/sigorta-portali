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
    assert.match(panel, /Kodu yeniden gönder/);
    assert.doesNotMatch(panel, /Google/);
  });

  it('yazılım giriş sayfası aynı kod kutusunu kullanır', () => {
    assert.match(girisPage, /GirisLoginPanel/);
    assert.doesNotMatch(girisPage, /auth\/login/);
  });
});
