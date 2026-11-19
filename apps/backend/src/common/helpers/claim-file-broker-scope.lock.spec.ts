import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));

describe('claim-file broker scope lock', () => {
  it('broker_user kanal ve müşteri id ile scope alır', () => {
    const helper = readFileSync(join(here, 'claim-file-scope.helper.ts'), 'utf8');
    assert.match(helper, /broker_user/);
    assert.match(helper, /channelBrokerCustomerId/);
    assert.match(helper, /broker_no_office/);
  });

  it('servis broker ofis id çeker', () => {
    const src = readFileSync(
      join(here, '../../modules/claim-files/claim-files.service.ts'),
      'utf8',
    );
    assert.match(src, /getBrokerOfficeCustomerIds/);
    assert.match(src, /roleCode === 'broker_user'/);
  });
});
