/**
 * Danışmanlık maili broker’dan gider. Hasar dosyası bu kurala girmez.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/claim-mail-route.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  claimMailRouteMissingParty,
  defaultClaimMailRoute,
  resolveClaimMailRoute,
} from './claim-mail-route.ts';

describe('danışmanlık mail tarafı LOCK', () => {
  it('hizmet ayarı yoksa dosya kendi kanalında kalır', () => {
    assert.equal(defaultClaimMailRoute({ serviceKind: 'consultancy' }), null);
    assert.equal(defaultClaimMailRoute({ serviceKind: 'repair' }), null);
    assert.equal(resolveClaimMailRoute({ serviceKind: 'consultancy' }), null);
  });

  it('hizmet ayarındaki taraf dosyaya yazılır', () => {
    const route = resolveClaimMailRoute({
      serviceKind: 'consultancy',
      serviceMailRoute: { approval: ['broker'], correspondence: ['broker', 'expert'] },
    });
    assert.deepEqual(route, { approval: ['broker'], correspondence: ['broker', 'expert'] });
  });

  it('dosyada yazılı tercih hizmet ayarını ezer', () => {
    const route = resolveClaimMailRoute({
      serviceKind: 'consultancy',
      mailRouteJson: JSON.stringify({ approval: ['broker', 'insurance'], correspondence: ['broker'] }),
    });
    assert.deepEqual(route?.approval, ['broker', 'insurance']);
  });

  it('seçilen tarafın kartı yoksa kayıt durur', () => {
    assert.equal(
      claimMailRouteMissingParty(
        { approval: ['broker'], correspondence: ['broker'] },
        { broker: '' },
      ),
      'broker',
    );
    assert.equal(
      claimMailRouteMissingParty(
        { approval: ['broker'], correspondence: ['broker'] },
        { broker: 'br-1' },
      ),
      null,
    );
  });
});
