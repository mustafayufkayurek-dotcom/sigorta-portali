/**
 * Yetkili adı firma parçası olamaz.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/authorized-person-name.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AUTHORIZED_PERSON_DIRTY_MESSAGE,
  isDirtyAuthorizedPersonName,
} from './authorized-person-name.ts';

describe('yetkili kişi adı LOCK', () => {
  it('firma adının kişi kutusuna bölünmesini keser', () => {
    assert.equal(
      isDirtyAuthorizedPersonName({
        firstName: 'Fidar',
        lastName: 'Ekspertiz',
        companyName: 'Fidar Ekspertiz Limited Şirketi',
        shortName: 'Fidar',
      }),
      true,
    );
    assert.equal(
      isDirtyAuthorizedPersonName({
        firstName: 'Anadolu',
        lastName: 'Sigorta',
        companyName: 'Anadolu Anonim Türk Sigorta Şirketi',
      }),
      true,
    );
  });

  it('gerçek kişi adını kesmez', () => {
    assert.equal(
      isDirtyAuthorizedPersonName({
        firstName: 'Ahmet',
        lastName: 'Yılmaz',
        companyName: 'Fidar Ekspertiz Limited Şirketi',
        shortName: 'Fidar',
      }),
      false,
    );
  });

  it('personel mesajı firma/API adı taşımaz', () => {
    assert.match(AUTHORIZED_PERSON_DIRTY_MESSAGE, /kişi adı/);
    assert.doesNotMatch(AUTHORIZED_PERSON_DIRTY_MESSAGE, /OpenAI|ChatGPT|API|Google/i);
  });
});
