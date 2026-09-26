import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isLoginEmailCodeSubject, maskLoginMailbox, roleRequiresLoginEmailCode, formatLoginEmailCodeForMail } from './login-email-code.ts';

describe('giriş e-posta kodu LOCK', () => {
  it('yalnız yönetici ve finans ister; ofis ve saha istemez', () => {
    assert.equal(roleRequiresLoginEmailCode('admin'), true);
    assert.equal(roleRequiresLoginEmailCode('ADMIN'), true);
    assert.equal(roleRequiresLoginEmailCode('finance'), true);
    assert.equal(roleRequiresLoginEmailCode('office_staff'), false);
    assert.equal(roleRequiresLoginEmailCode('field_staff'), false);
    assert.equal(roleRequiresLoginEmailCode('insurance_company_user'), false);
  });

  it('kutu adresini gizler', () => {
    assert.equal(maskLoginMailbox('mustafa@meridyen-tr.com'), 'm***@meridyen-tr.com');
  });

  it('giriş kodu konusunu gelen kutu işinden ayırır', () => {
    assert.equal(isLoginEmailCodeSubject('Giriş Kodu — Meridyen Assistance'), true);
    assert.equal(isLoginEmailCodeSubject('Giriş Onayı — Meridyen Assistance'), true);
    assert.equal(isLoginEmailCodeSubject('RE: KONUT CAM'), false);
  });

  it('mailde bitişik 6 hane yazılmaz', () => {
    assert.equal(formatLoginEmailCodeForMail('847291'), '8 4 7 2 9 1');
  });
});
