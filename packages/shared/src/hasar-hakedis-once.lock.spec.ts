import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { pickReusableHasarHakedisStatement } from './hasar-hakedis-once.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('hasar çift hakediş LOCK', () => {
  it('aynı dosya ve tedarikçide aynı iş grubu mevcut kaydı döner', () => {
    const existing = pickReusableHasarHakedisStatement(
      [{
        id: 'st-1',
        vendorId: 'v1',
        status: 'APPROVED',
        items: [{ claimFileId: 'hf-1', workGroupId: 'mob' }],
      }],
      { vendorId: 'v1', claimFileId: 'hf-1', workGroupIds: ['mob'] },
    );
    assert.equal(existing?.id, 'st-1');
  });

  it('aynı tedarikçide ikinci iş grubu yeni hakedişe izin verir', () => {
    const existing = pickReusableHasarHakedisStatement(
      [{
        id: 'st-1',
        vendorId: 'v1',
        status: 'APPROVED',
        items: [{ claimFileId: 'hf-1', workGroupId: 'mob' }],
      }],
      { vendorId: 'v1', claimFileId: 'hf-1', workGroupIds: ['siva'] },
    );
    assert.equal(existing, null);
  });

  it('taslak ikinci kez basmayı kilitlemez', () => {
    const existing = pickReusableHasarHakedisStatement(
      [{
        id: 'st-draft',
        vendorId: 'v1',
        status: 'DRAFT',
        items: [{ claimFileId: 'hf-1', workGroupId: 'mob' }],
      }],
      { vendorId: 'v1', claimFileId: 'hf-1', workGroupIds: ['mob'] },
    );
    assert.equal(existing, null);
  });

  it('hakediş servisi mevcut kaydı döndürür', () => {
    const service = readFileSync(
      join(here, '../../../apps/backend/src/modules/vendor-statements/vendor-statements.service.ts'),
      'utf8',
    );
    assert.match(service, /pickReusableHasarHakedisStatement/);
    assert.match(service, /return this\.findOne\(reuse\.id\)/);
  });
});
