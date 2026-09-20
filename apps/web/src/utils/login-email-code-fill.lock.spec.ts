import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { extractLoginEmailCode } from './login-email-code-fill.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('giriş kodu kutuya dolsun LOCK', () => {
  it('yalnız 6 hane veya kod etiketli metinden alır; telefonu kod saymaz', () => {
    assert.equal(extractLoginEmailCode('847291'), '847291');
    assert.equal(extractLoginEmailCode('  847291  '), '847291');
    assert.equal(extractLoginEmailCode('Giriş kodunuz (10 dakika geçerli): 847291'), '847291');
    assert.equal(extractLoginEmailCode('Kod 847291'), '847291');
    assert.equal(extractLoginEmailCode('532 133 4144'), null);
    assert.equal(extractLoginEmailCode(''), null);
  });

  it('kod adımında kopyalanan kod kutuya yazılır; Mac otomatik doldurma durur', () => {
    const panel = readFileSync(join(here, '../components/giris/GirisLoginPanel.tsx'), 'utf8');
    assert.match(panel, /extractLoginEmailCode/);
    assert.match(panel, /autoComplete="one-time-code"/);
    assert.match(panel, /name="one-time-code"/);
    assert.match(panel, /clipboard/);
    assert.doesNotMatch(panel, /Google/);
  });
});
