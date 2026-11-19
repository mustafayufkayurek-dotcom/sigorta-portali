import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  expertPortalBrandLabel,
  expertPortalHomeTitle,
  isBrokerPortalRole,
  isExpertPortalRole,
} from './expert-portal-role.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('expert-portal-role lock', () => {
  it('broker ve eksper aynı portal rol ailesindedir', () => {
    assert.equal(isExpertPortalRole('expert'), true);
    assert.equal(isExpertPortalRole('broker_user'), true);
    assert.equal(isExpertPortalRole('adjuster'), true);
    assert.equal(isExpertPortalRole('office_staff'), false);
    assert.equal(isBrokerPortalRole('broker_user'), true);
    assert.equal(isBrokerPortalRole('expert'), false);
  });

  it('broker başlığı firma ünvanını yazar', () => {
    assert.equal(expertPortalBrandLabel('broker_user'), 'Broker Paneli');
    assert.equal(expertPortalHomeTitle('broker_user', 'Howden Broker'), 'Howden Broker');
    assert.equal(expertPortalHomeTitle('broker_user', ''), 'Broker Paneli');
    assert.equal(expertPortalHomeTitle('expert', 'Kadıköy Eksper'), 'Kadıköy Eksper');
  });

  it('panel-access broker’ı eksper portalına alır', () => {
    const src = readFileSync(join(here, 'panel-access.ts'), 'utf8');
    assert.match(src, /isExpertPortalRole/);
    assert.match(src, /eksper-portal/);
  });
});
