import {
  resolveInsuredEmailForInbox,
  shouldCreateInsuredWithoutEmailOnDuplicate,
} from './inbound-insured-contact.util';

describe('resolveInsuredEmailForInbox', () => {
  it('gönderen adresini sigortalı e-postası saymaz', () => {
    expect(
      resolveInsuredEmailForInbox({
        fromAddress: 'eksper@nihal.com',
        extractedEmail: null,
      }),
    ).toBeUndefined();
  });

  it('formdan çıkarılan sigortalı e-postasını kullanır', () => {
    expect(
      resolveInsuredEmailForInbox({
        extractedEmail: 'mustafa.cacav@example.com',
        fromAddress: 'eksper@nihal.com',
      }),
    ).toBe('mustafa.cacav@example.com');
  });

  it('açık e-posta önceliklidir', () => {
    expect(
      resolveInsuredEmailForInbox({
        explicitEmail: 'a@b.com',
        extractedEmail: 'c@d.com',
        fromAddress: 'eksper@nihal.com',
      }),
    ).toBe('a@b.com');
  });
});

describe('shouldCreateInsuredWithoutEmailOnDuplicate', () => {
  it('kurumsal e-posta çakışmasında birey oluşturmayı e-postasız sürdürür', () => {
    expect(
      shouldCreateInsuredWithoutEmailOnDuplicate({
        field: 'email',
        entityType: 'corporate',
        creatingEntityType: 'individual',
      }),
    ).toBe(true);
  });

  it('birey e-posta çakışmasında engeller', () => {
    expect(
      shouldCreateInsuredWithoutEmailOnDuplicate({
        field: 'email',
        entityType: 'individual',
        creatingEntityType: 'individual',
      }),
    ).toBe(false);
  });
});
