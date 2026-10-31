/**
 * Dosya kanalı — sigorta, acente, broker, eksper ayrı seçilir.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/claim-file-channels.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CLAIM_FILE_CHANNELS,
  CLAIM_FILE_CHANNEL_AGENCY_SUB_TYPE,
  claimFileChannelCreateFields,
  claimFileChannelSummaryRows,
  collectClaimFileChannelEmails,
} from './claim-file-channels.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('dosya kanalı LOCK', () => {
  it('dört taraf ayrıdır; tek listede karışmaz', () => {
    assert.deepEqual(
      CLAIM_FILE_CHANNELS.map((row) => row.label),
      ['Sigorta Şirketi', 'Acente', 'Broker', 'Eksper'],
    );
    assert.equal(CLAIM_FILE_CHANNEL_AGENCY_SUB_TYPE, 'acente_firmasi');
    assert.equal(CLAIM_FILE_CHANNELS[1].customerSubType, 'acente_firmasi');
    assert.equal(CLAIM_FILE_CHANNELS[2].customerSubType, 'broker_firmasi');
    assert.equal(CLAIM_FILE_CHANNELS[3].customerSubType, 'eksper_firmasi');
  });

  it('boş kanal kayda yazılmaz', () => {
    assert.deepEqual(
      claimFileChannelCreateFields({
        channelAgencyCustomerId: '  ',
        channelBrokerCustomerId: 'br-1',
        channelExpertCustomerId: undefined,
      }),
      {
        channelAgencyCustomerId: null,
        channelBrokerCustomerId: 'br-1',
        channelExpertCustomerId: null,
      },
    );
  });

  it('özette dört satır durur', () => {
    const rows = claimFileChannelSummaryRows({
      insuranceCompany: { name: 'Allianz' },
      channelAgencyCustomer: { companyName: 'Vadi Acente' },
      channelBrokerCustomer: null,
      channelExpertCustomer: { shortName: 'Doğanlar' },
    });
    assert.equal(rows[0].value, 'Allianz');
    assert.equal(rows[1].value, 'Vadi Acente');
    assert.equal(rows[2].value, '—');
    assert.equal(rows[3].value, 'Doğanlar');
  });

  it('Yeni Dosya ve dosya özeti bu kanalları kullanır', () => {
    const form = readFileSync(join(here, '../../../apps/web/src/components/claim-files/ClaimNewForm.tsx'), 'utf8');
    const detay = readFileSync(
      join(here, '../../../apps/web/src/app/panel/hasar-dosyalari/[id]/_components/DosyaBilgileriDetay.tsx'),
      'utf8',
    );
    const svc = readFileSync(
      join(here, '../../../apps/backend/src/modules/claim-files/claim-files.service.ts'),
      'utf8',
    );
    assert.match(form, /Dosya Kanalı/);
    assert.match(form, /Dosyayı biz açarız/);
    assert.match(form, /Rapor ve yazışma burada seçilen taraflara gider/);
    assert.match(form, /data-field="channelAgencyCustomerId"/);
    assert.match(form, /data-field="channelBrokerCustomerId"/);
    assert.match(form, /data-field="channelExpertCustomerId"/);
    assert.match(form, /CLAIM_FILE_CHANNELS/);
    assert.doesNotMatch(form, /Google/);
    assert.match(detay, /claimFileChannelSummaryRows/);
    assert.match(svc, /claimFileChannelCreateFields/);
    assert.match(svc, /channelAgencyCustomerId/);
  });

  it('seçilen kanalların kutusu rapora ve yazışmaya gider; seçilmeyen sigorta karışmaz', () => {
    assert.deepEqual(
      collectClaimFileChannelEmails({
        insuranceContactEmail: 'hasar@allianz.com',
        agency: { email: 'acente@vadi.com' },
        broker: null,
        expert: { email: 'ofis@doganlar.com', contacts: [{ email: 'sena@doganlar.com', isPrimary: true }] },
      }),
      ['hasar@allianz.com', 'acente@vadi.com', 'ofis@doganlar.com', 'sena@doganlar.com'],
    );
    assert.deepEqual(
      collectClaimFileChannelEmails({
        insuranceContactEmail: '  ',
        agency: null,
        broker: null,
        expert: null,
      }),
      [],
    );
  });
});
