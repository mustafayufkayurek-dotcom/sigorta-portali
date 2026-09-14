/**
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/acil-assistance-mail-decision.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAssistanceMailDecision } from './acil-assistance-mail-decision.ts';

describe('acil asistans mail karar LOCK', () => {
  it('yanıt gövdesindeki onayı okur; konu başlığı yetmez', () => {
    assert.equal(
      parseAssistanceMailDecision('Ynt: Onay talebi – AY-1', 'Raporu onaylıyoruz. Uygundur.'),
      'approve',
    );
    assert.equal(parseAssistanceMailDecision('Onay talebi – AY-1', ''), null);
    assert.equal(
      parseAssistanceMailDecision('Ynt: Onay talebi', 'Bu hizmeti onaylamıyoruz.'),
      'reject',
    );
  });
});
