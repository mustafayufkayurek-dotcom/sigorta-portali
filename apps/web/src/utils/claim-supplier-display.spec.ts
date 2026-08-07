import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveClaimSupplierDisplayName } from './claim-supplier-display';

describe('resolveClaimSupplierDisplayName', () => {
  it('assignedSupplier adını döner (eksper alanına bakmaz)', () => {
    const name = resolveClaimSupplierDisplayName({
      assignedSupplier: { id: 'v1', name: 'Şükrü Öztürk' },
      assignedAdjuster: { firstName: 'Ali', lastName: 'Yılmaz' },
    } as any);
    assert.equal(name, 'Şükrü Öztürk');
  });

  it('çoklu supplierAssignments adlarını birleştirir', () => {
    const name = resolveClaimSupplierDisplayName({
      supplierAssignments: [
        { vendor: { name: 'Şükrü Öztürk' } },
        { vendor: { name: 'Dündar Erol' } },
      ],
    });
    assert.equal(name, 'Şükrü Öztürk · Dündar Erol');
  });

  it('tedarikçi yoksa null (Atanmadı için)', () => {
    assert.equal(
      resolveClaimSupplierDisplayName({
        assignedAdjuster: { firstName: 'Ali', lastName: 'Yılmaz' },
      } as any),
      null,
    );
  });
});
