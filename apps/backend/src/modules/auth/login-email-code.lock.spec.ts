/**
 * Yönetici/finans yeni girişte e-posta kodu. Açık oturum düşmez.
 * Çalıştır: node --experimental-strip-types --test \
 *   apps/backend/src/modules/auth/login-email-code.lock.spec.ts \
 *   apps/web/src/components/giris/giris-login-email-code.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('giriş e-posta kodu kaynak LOCK', () => {
  it('şifre doğru olsa da yönetici/finansta kod adımı durur; mail gitmezse iş kesilmez', () => {
    const auth = readFileSync(join(here, 'auth.service.ts'), 'utf8');
    assert.match(auth, /roleRequiresLoginEmailCode/);
    assert.match(auth, /startLoginEmailChallenge/);
    assert.match(auth, /verifyLoginEmailCode/);
    assert.match(auth, /issueLoginSession/);
    assert.match(auth, /if \(!result\.sent\)/);
    assert.match(auth, /return null/);
    assert.match(auth, /owner\.status !== 'active'/);
    assert.match(auth, /Kodu kopyalayıp giriş ekranına dönün/);
    assert.match(auth, /Kod \$\{code\}/);
    assert.match(auth, /challengeId: row\.id, code/);
    assert.match(auth, /requestReadReceipt:\s*false/);
    assert.doesNotMatch(auth, /letter-spacing:0\.18em/);
    assert.doesNotMatch(auth, /\|\| 'login-email-code'/);
    assert.match(auth, /Giriş kodu anahtarı yok/);
  });

  it('giriş kodu maili gelen kutu işine düşmez', () => {
    const ingest = readFileSync(
      join(here, '../operation-inbox/processors/inbound-ingest.processor.ts'),
      'utf8',
    );
    assert.match(ingest, /isLoginEmailCodeSubject/);
  });

  it('pasifte açık oturum kapanır', () => {
    const users = readFileSync(join(here, '../users/users.service.ts'), 'utf8');
    assert.match(users, /closingAccount/);
    assert.match(users, /loginEmailChallenge\.updateMany/);
    assert.match(users, /passwordResetToken\.updateMany/);
  });
});
