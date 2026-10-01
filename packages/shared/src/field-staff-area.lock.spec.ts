import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filterStaffByFileArea, userServiceAreaMatchesFile } from './field-staff-area.ts';

describe('field staff area lock', () => {
  it('Muğla-Bodrum İstanbul dosyasında durmaz; boş bölge düşmez', () => {
    assert.equal(
      userServiceAreaMatchesFile(
        [{ provinceName: 'Muğla', districtName: 'Bodrum' }],
        'İstanbul',
        'Kartal',
      ),
      false,
    );
    assert.equal(
      userServiceAreaMatchesFile(
        [{ provinceName: 'İstanbul', districtName: 'Kartal' }],
        'İstanbul',
        'Kartal',
      ),
      true,
    );
    assert.equal(userServiceAreaMatchesFile([], 'İstanbul', 'Kartal'), false);
    const list = filterStaffByFileArea(
      [
        { id: 'mugla', serviceAreas: [{ provinceName: 'Muğla', districtName: 'Bodrum' }] },
        { id: 'ist', serviceAreas: [{ provinceName: 'İstanbul', districtName: null }] },
      ],
      'İstanbul',
      'Kartal',
    );
    assert.deepEqual(list.map((r) => r.id), ['ist']);
  });
});
