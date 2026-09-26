import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { extractLoginEmailCode, visibleLoginEmailCode } from './login-email-code-fill.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('giriş kodu kutuya dolsun LOCK', () => {
  it('yalnız 6 hane veya kod etiketli metinden alır; telefonu kod saymaz', () => {
    assert.equal(extractLoginEmailCode('847291'), '847291');
    assert.equal(extractLoginEmailCode('  847291  '), '847291');
    assert.equal(extractLoginEmailCode('Giriş kodunuz (10 dakika geçerli): 847291'), '847291');
    assert.equal(extractLoginEmailCode('Kod 847291'), '847291');
    assert.equal(extractLoginEmailCode('Kod 8 4 7 2 9 1'), '847291');
    assert.equal(
      extractLoginEmailCode(
        'Giriş için 6 haneli kod. 23.09.2026. Kod 847291. Kodu kopyalayıp giriş ekranına dönün.',
      ),
      '847291',
    );
    assert.equal(extractLoginEmailCode('532 133 4144'), null);
    assert.equal(extractLoginEmailCode(''), null);
    assert.equal(visibleLoginEmailCode('847291'), '847291');
    assert.equal(visibleLoginEmailCode({}), '');
  });

  it('kod adımında kutu boş kalır; Mac otomatik doldurma ve satıra basma durur', () => {
    const panel = readFileSync(join(here, '../components/giris/GirisLoginPanel.tsx'), 'utf8');
    assert.match(panel, /extractLoginEmailCode/);
    assert.match(panel, /autoComplete="off"/);
    assert.match(panel, /name="login-email-code"/);
    assert.match(panel, /clipboard/);
    assert.match(panel, /Yapıştır/);
    assert.match(panel, /maskLoginMailbox/);
    assert.match(panel, /visibilityState === 'hidden'/);
    assert.doesNotMatch(panel, /visibleLoginEmailCode/);
    assert.doesNotMatch(panel, /payload\.code/);
    assert.doesNotMatch(panel, /one-time-code/);
    assert.doesNotMatch(panel, /placeholder="000000"/);
    assert.doesNotMatch(panel, /Google/);
  });
});
