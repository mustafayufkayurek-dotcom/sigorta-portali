/**
 * Acil ihbar: sigortalı adı asistan unvanı değildir.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/acil-insured-name.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveAcilInsuredName, acilInsuredNamesMatch } from './acil-insured-name.ts';

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
    assert.equal(
      resolveAcilInsuredName({
        notes:
          'Gelen kutusu ihbarı: 2599291318/RUHSAR ALKAN/ RCS-20261887742/TESİSAT\nRuhsar Alkan adına yapılan konut hasar ihbarı ile ilgili bilgi.',
        firmNames: ['Remed Assistance'],
      }),
      'Ruhsar Alkan',
    );
  });

  it('onay Ad Soyad büyük/küçük harf uyumunu kabul eder; farklı adı uyarır', () => {
    assert.equal(acilInsuredNamesMatch('mehmet demir', 'Mehmet Demir'), true);
    assert.equal(acilInsuredNamesMatch('Ayşe Koç', 'Mehmet Demir'), false);
    assert.equal(acilInsuredNamesMatch('Ali', ''), true);
  });
});
