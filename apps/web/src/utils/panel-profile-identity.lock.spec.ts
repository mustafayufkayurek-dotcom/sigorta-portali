/**
 * Üst bant: müşteri firması, altında kişinin ad soyadı. Rol / firma kelimesi soyad olmaz.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/panel-profile-identity.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolvePanelProfileIdentity } from './panel-profile-identity.ts';

const here = dirname(fileURLToPath(import.meta.url));
const layout = readFileSync(join(here, '../app/panel/layout.tsx'), 'utf8');
const seed = readFileSync(join(here, '../../../backend/prisma/seed.ts'), 'utf8');

describe('panel üst bant kimliği LOCK', () => {
  it('asistans kullanıcısında müşteri kısa adı ve kişi adı durur; soyad firma değildir', () => {
    const identity = resolvePanelProfileIdentity({
      isAssistanceCompanyUser: true,
      organizationName: 'Meridyen Assistance',
      user: {
        firstName: 'Ayşe',
        lastName: 'Yılmaz',
        jobTitle: '',
        assistantCustomerScopes: [
          {
            shortName: 'Remed',
            name: 'Remed Uluslararası Destek Ve Danışmanlık Hizmetleri Tic. A.Ş.',
          },
        ],
      },
    });
    assert.equal(identity.customerChip, 'Remed');
    assert.equal(identity.customerFull, 'Remed Uluslararası Destek Ve Danışmanlık Hizmetleri Tic. A.Ş.');
    assert.equal(identity.personName, 'Ayşe Yılmaz');
    assert.equal(
      resolvePanelProfileIdentity({
        isAssistanceCompanyUser: true,
        user: {
          firstName: 'Ayşe',
          lastName: 'Yılmaz',
          customerShortName: 'Remed',
          assistantCustomerScopes: [
            { name: 'Remed Uluslararası Destek Ve Danışmanlık Hizmetleri Tic. A.Ş.' },
          ],
        },
      }).customerChip,
      'Remed',
    );
    assert.equal(identity.writtenDuty, '');
    assert.equal(
      resolvePanelProfileIdentity({
        isAssistanceCompanyUser: true,
        user: {
          firstName: 'Ayşe',
          lastName: 'Asistans',
          assistantCustomerScopes: [{ shortName: 'Remed', name: 'Remed' }],
        },
      }).personName,
      'Ayşe',
    );
    const fromLongName = resolvePanelProfileIdentity({
      isAssistanceCompanyUser: true,
      user: {
        firstName: 'Ayşe',
        lastName: 'Yılmaz',
        assistantCustomerScopes: [
          { name: 'Remed Uluslararası Destek Ve Danışmanlık Hizmetleri Tic. A.Ş.' },
        ],
      },
    });
    assert.equal(fromLongName.customerChip, '');
    assert.equal(
      fromLongName.customerFull,
      'Remed Uluslararası Destek Ve Danışmanlık Hizmetleri Tic. A.Ş.',
    );
  });

  it('demo kullanıcının soyadı Asistans / Sigorta / Eksper değildir', () => {
    assert.match(seed, /lastName: 'Yılmaz'/);
    assert.doesNotMatch(seed, /lastName: 'Asistans'/);
  });

  it('yazılan görev menüde durur; boşsa rol adı uydurulmaz', () => {
    const withDuty = resolvePanelProfileIdentity({
      isAssistanceCompanyUser: true,
      user: {
        firstName: 'Ayşe',
        lastName: 'Yılmaz',
        jobTitle: 'Dosya Takip',
        assistantCustomerScopes: [{ shortName: 'Remed', name: 'Remed' }],
      },
    });
    assert.equal(withDuty.writtenDuty, 'Dosya Takip');
    const withoutDuty = resolvePanelProfileIdentity({
      isInsuranceCompanyUser: true,
      organizationName: 'Meridyen Assistance',
      user: {
        firstName: 'Mehmet',
        lastName: 'Kaya',
        insuranceCompanyScopes: [{ name: 'Allianz' }],
      },
    });
    assert.equal(withoutDuty.customerChip, 'Allianz');
    assert.equal(withoutDuty.personName, 'Mehmet Kaya');
    assert.equal(withoutDuty.writtenDuty, '');
  });

  it('üst bant kutusu iki satır keser; menü tam metni kırar', () => {
    assert.match(layout, /resolvePanelProfileIdentity/);
    assert.match(layout, /identity\.customerChip/);
    assert.match(layout, /identity\.personName/);
    assert.match(layout, /truncate text-\[13px\] font-semibold/);
    assert.match(layout, /sm:w-\[8\.5rem\]/);
    assert.match(layout, /break-words text-sm font-semibold/);
    assert.doesNotMatch(layout, /showProfileDuty/);
    assert.doesNotMatch(layout, /profileDutyLabel/);
  });
});
