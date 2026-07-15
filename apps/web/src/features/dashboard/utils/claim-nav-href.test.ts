import assert from 'node:assert/strict';
import {
  CLAIM_LIST_HREF,
  CLAIM_LIST_OPEN_HREF,
  CLAIM_LIST_SLA_HREF,
  OPERATIONS_CENTER_HREF,
  STAFF_MGMT_HREF,
  claimDetailHref,
  claimNavHref,
  claimSearchHref,
  staffLoadHref,
} from './claim-nav-href';

assert.equal(
  claimDetailHref('abc-123'),
  '/panel/hasar-dosyalari/abc-123',
  'detail href',
);
assert.equal(
  claimDetailHref('a/b?x=1'),
  `/panel/hasar-dosyalari/${encodeURIComponent('a/b?x=1')}`,
  'detail encodes path param',
);
assert.equal(claimDetailHref('  '), null, 'blank id');
assert.equal(claimDetailHref(null), null, 'null id');

assert.equal(
  claimSearchHref('HD-2026/01'),
  `/panel/hasar-dosyalari?search=${encodeURIComponent('HD-2026/01')}`,
  'search encodes fileNo',
);
assert.equal(claimSearchHref(''), null, 'empty fileNo');

assert.equal(
  claimNavHref({ id: 'id-1', fileNo: 'F-1' }),
  '/panel/hasar-dosyalari/id-1',
  'id wins over fileNo',
);
assert.equal(
  claimNavHref({ fileNo: 'F-2' }),
  `/panel/hasar-dosyalari?search=${encodeURIComponent('F-2')}`,
  'fileNo fallback',
);
assert.equal(claimNavHref({}), null, 'no target → null');

assert.equal(CLAIM_LIST_SLA_HREF, '/panel/hasar-dosyalari?status=sla_exceeded');
assert.equal(CLAIM_LIST_OPEN_HREF, '/panel/hasar-dosyalari?status=open');
assert.equal(CLAIM_LIST_HREF, '/panel/hasar-dosyalari');
assert.equal(OPERATIONS_CENTER_HREF, '/panel/operasyon');
assert.equal(STAFF_MGMT_HREF, '/panel/personel-yonetimi');
assert.equal(staffLoadHref('u-1'), STAFF_MGMT_HREF, 'staff load uses personel yönetimi');
assert.equal(staffLoadHref(null), STAFF_MGMT_HREF, 'staff load null user');

console.log('claim-nav-href.test.ts PASS');
