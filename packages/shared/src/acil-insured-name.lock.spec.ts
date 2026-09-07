/**
 * Acil ihbar: sigortalı adı asistan unvanı değildir.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/acil-insured-name.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveAcilInsuredName } from './acil-insured-name.ts';

describe('acil sigortalı adı LOCK', () => {
  it('kişi adını basar; Remed unvanını basmaz', () => {
    assert.equal(
      resolveAcilInsuredName({
        personField: 'Ayşe Yılmaz',
        firmNames: ['Remed Assistance', 'Remed'],
      }),
      'Ayşe Yılmaz',
    );
    assert.equal(
      resolveAcilInsuredName({
        personField: 'Remed Assistance',
        firmNames: ['Remed Assistance'],
      }),
      null,
    );
  });

  it('boş, tire ve Belirtilmemiş adı yok sayar', () => {
    assert.equal(resolveAcilInsuredName({ personField: '—' }), null);
    assert.equal(resolveAcilInsuredName({ personField: 'Belirtilmemiş' }), null);
    assert.equal(resolveAcilInsuredName({ personField: '' }), null);
  });

  it('nottaki Sigortalı satırını yedek alır', () => {
    assert.equal(
      resolveAcilInsuredName({
        personField: 'Remed Assistance',
        notes: 'Asistan firması: Remed Assistance\nSigortalı: Mehmet Demir',
        firmNames: ['Remed Assistance'],
      }),
      'Mehmet Demir',
    );
  });
});
