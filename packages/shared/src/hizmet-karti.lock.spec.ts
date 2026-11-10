/**
 * Hizmet kartı Ayarlar’dadır. Yeni asistans hizmeti menüye eklenir.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/hizmet-karti.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findHizmetKarti,
  hizmetKartiCodeForClaim,
  mailRouteFromHizmetKarti,
  mergeHizmetKartlari,
  missingHizmetRequiredParty,
} from './hizmet-karti.ts';

describe('hizmet kartı LOCK', () => {
  it('Hasar, Acil ve Ek Hizmetler kartta durur', () => {
    const rows = mergeHizmetKartlari(null);
    assert.equal(rows.some((row) => row.name === 'Hasar Onarım' && row.group === 'asistans'), true);
    assert.equal(rows.some((row) => row.name === 'Acil Yardım' && row.group === 'asistans'), true);
    assert.equal(rows.some((row) => row.name === 'Danışmanlık' && row.approvalParties[0] === 'broker'), true);
  });

  it('yeni hizmet ek grubuna yazılır ve birden fazla mail tarafı durur', () => {
    const rows = mergeHizmetKartlari([
      {
        code: 'cam-isleri',
        name: 'Cam İşleri',
        group: 'asistans',
        menuVisible: true,
        steps: 'hasar',
        reportPrice: true,
        approvalParties: ['broker', 'expert'],
        correspondenceParties: ['broker'],
        requiredParties: ['broker'],
      },
    ]);
    const cam = rows.find((row) => row.code === 'cam-isleri');
    assert.equal(cam?.group, 'asistans');
    assert.deepEqual(cam?.approvalParties, ['broker', 'expert']);
  });

  it('dosya kendi hizmet kartına bağlanır', () => {
    const cards = mergeHizmetKartlari(null);
    assert.equal(hizmetKartiCodeForClaim({ serviceKind: 'repair' }), 'hasar-onarim');
    assert.equal(hizmetKartiCodeForClaim({ serviceKind: 'consultancy' }), 'danismanlik');
    const danismanlik = findHizmetKarti(cards, 'danismanlik');
    assert.deepEqual(mailRouteFromHizmetKarti(danismanlik)?.approval, ['broker']);
    assert.equal(missingHizmetRequiredParty(danismanlik, { broker: '' }), 'broker');
    assert.equal(missingHizmetRequiredParty(danismanlik, { broker: 'kart-1' }), null);
  });
});
