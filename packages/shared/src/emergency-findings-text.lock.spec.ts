/**
 * Acil tespit bulgusu boş kayıtla silinmez.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/emergency-findings-text.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nextEmergencyFindingsText } from './emergency-findings-text.ts';

describe('acil tespit bulgusu', () => {
  it('alan yoksa mevcut metne dokunulmaz', () => {
    assert.equal(nextEmergencyFindingsText(undefined, 'Tavan ıslak'), undefined);
  });

  it('yazılan metin kayda geçer', () => {
    assert.equal(nextEmergencyFindingsText('  Su kaçağı  ', null), 'Su kaçağı');
  });

  it('boş veya null gönderim mevcut bulguyu silmez', () => {
    assert.equal(nextEmergencyFindingsText('', 'Tavan ıslak'), 'Tavan ıslak');
    assert.equal(nextEmergencyFindingsText('   ', 'Tavan ıslak'), 'Tavan ıslak');
    assert.equal(nextEmergencyFindingsText(null, 'Tavan ıslak'), 'Tavan ıslak');
  });

  it('hiç yoksa boş yazılmaz', () => {
    assert.equal(nextEmergencyFindingsText('', null), undefined);
    assert.equal(nextEmergencyFindingsText(null, ''), undefined);
  });
});
