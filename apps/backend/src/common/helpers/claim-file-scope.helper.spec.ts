import { ForbiddenException } from '@nestjs/common';
import {
  applyClaimFileListScope,
  assertClaimFileAccess,
  buildClaimFileRelationScope,
} from './claim-file-scope.helper';

describe('claim-file-scope.helper', () => {
  describe('applyClaimFileListScope', () => {
    it('customerId filtresini korur', () => {
      const where = applyClaimFileListScope({ customerId: 'cust-a' });
      expect(where).toEqual({ customerId: 'cust-a' });
    });

    it('sigorta kullanıcısı için insuranceCompanyIds uygular', () => {
      const where = applyClaimFileListScope({}, undefined, ['ins-a', 'ins-b']);
      expect(where).toEqual({
        insuranceCompanyId: { in: ['ins-a', 'ins-b'] },
      });
    });

    it('saha personeli için assignedFieldUserId ve kapanış süresi uygular', () => {
      const where = applyClaimFileListScope(
        { customerId: 'cust-a' },
        { id: 'user-field', roleCode: 'field_staff' },
      );
      expect(where).toEqual({
        AND: [
          { customerId: 'cust-a' },
          {
            assignedFieldUserId: 'user-field',
            OR: [{ closedAt: null }, { closedAt: { gt: expect.any(Date) } }],
          },
        ],
      });
    });
  });

  describe('assertClaimFileAccess', () => {
    it('sigorta kapsamı dışındaki dosyada ForbiddenException fırlatır', () => {
      expect(() =>
        assertClaimFileAccess(
          { insuranceCompanyId: 'ins-other', assignedFieldUserId: null, closedAt: null },
          { id: 'ins-user', roleCode: 'insurance_company_user' },
          ['ins-a'],
        ),
      ).toThrow(ForbiddenException);
    });

    it('saha personeli atanmamış dosyada ForbiddenException fırlatır', () => {
      expect(() =>
        assertClaimFileAccess(
          { insuranceCompanyId: 'ins-a', assignedFieldUserId: 'other-user', closedAt: null },
          { id: 'field-user', roleCode: 'field_staff' },
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('buildClaimFileRelationScope', () => {
    it('scope yoksa undefined döner', () => {
      expect(buildClaimFileRelationScope()).toBeUndefined();
    });

    it('payment/expense ilişkisi için claimFile scope üretir', () => {
      const scope = buildClaimFileRelationScope(
        { id: 'field-user', roleCode: 'field_staff' },
      );
      expect(scope).toEqual({
        claimFile: {
          assignedFieldUserId: 'field-user',
          OR: [{ closedAt: null }, { closedAt: { gt: expect.any(Date) } }],
        },
      });
    });
  });
});
