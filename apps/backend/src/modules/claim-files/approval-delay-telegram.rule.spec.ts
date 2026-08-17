import {
  APPROVAL_DELAY_CRITICAL_HOURS,
  APPROVAL_DELAY_WARNING_HOURS,
  buildApprovalDelayTelegramDigest,
  buildApprovalDelayTelegramPayload,
  formatApprovalDelayKonuLine,
  resolveApprovalCustomerShortName,
  resolveApprovalDelayNotifyUserIds,
} from './approval-delay-telegram.rule';

describe('approval-delay-telegram.rule', () => {
  it('eşikler panodaki Onay Gecikmesi ile aynı', () => {
    expect(APPROVAL_DELAY_WARNING_HOURS).toBe(24);
    expect(APPROVAL_DELAY_CRITICAL_HOURS).toBe(48);
  });

  it('müşteri kısa ad shortName öncelikli', () => {
    expect(
      resolveApprovalCustomerShortName({
        shortName: 'Acme',
        companyName: 'Acme Sigorta A.Ş.',
        fullName: 'Acme Full',
      }),
    ).toBe('Acme');
  });

  it('tek dosya konu satırı', () => {
    expect(formatApprovalDelayKonuLine('HS-1001', 'Acme')).toBe(
      'HS-1001 Nolu Acme dosya onayı gecikti.',
    );
  });

  it('kritik yoksa payload null', () => {
    expect(
      buildApprovalDelayTelegramPayload({
        total24h: 2,
        critical48h: 0,
        pendingApproval: 2,
        externalApproval: 0,
        submitted: 0,
        criticalItems: [],
      }),
    ).toBeNull();
  });

  it('tek kritik — Etki/Durum yok, müşteri cümlesi tekil', () => {
    const digest = buildApprovalDelayTelegramDigest([
      {
        claimFileId: 'c1',
        fileNo: 'HS-1001',
        customerShortName: 'Acme',
        hoursWaiting: 55,
        category: 'pending_approval',
        assignedOfficeUserId: 'office-1',
      },
      {
        claimFileId: 'c2',
        fileNo: 'HS-WARN',
        customerShortName: 'Beta',
        hoursWaiting: 30,
        category: 'pending_approval',
      },
    ]);
    expect(digest.critical48h).toBe(1);
    const payload = buildApprovalDelayTelegramPayload(digest, {
      at: new Date('2026-08-11T09:05:00+03:00'),
    });
    expect(payload!.title).toBe('HS-1001 Nolu Acme dosya onayı gecikti.');
    expect(payload!.action).toBe('Lütfen müşteri ile irtibata geçiniz.');
    expect(payload!.text).toContain('🔴 KRİTİK | ONAY GECİKMESİ');
    expect(payload!.text).toContain('<b>Konu</b>: HS-1001 Nolu Acme dosya onayı gecikti.');
    expect(payload!.text).toContain('<b>Aksiyon</b>: Lütfen müşteri ile irtibata geçiniz.');
    expect(payload!.text).not.toContain('Etki');
    expect(payload!.text).not.toContain('Durum');
    expect(payload!.text).not.toContain('Sunucu');
  });

  it('çoklu kritik — numaralı liste ve müşterilere', () => {
    const digest = buildApprovalDelayTelegramDigest([
      {
        claimFileId: 'c1',
        fileNo: 'HS-1001',
        customerShortName: 'Acme',
        hoursWaiting: 60,
        category: 'pending_approval',
      },
      {
        claimFileId: 'c2',
        fileNo: 'HS-1002',
        customerShortName: 'Beta',
        hoursWaiting: 50,
        category: 'external_approval',
      },
    ]);
    const payload = buildApprovalDelayTelegramPayload(digest);
    expect(payload!.action).toBe('Lütfen müşteriler ile irtibata geçiniz.');
    expect(payload!.title).toContain('1- HS-1001 Nolu Acme dosya onayı gecikti.');
    expect(payload!.title).toContain('2- HS-1002 Nolu Beta dosya onayı gecikti.');
    expect(payload!.text).toContain('<b>Konu</b>:');
    expect(payload!.text).toContain('1- HS-1001 Nolu Acme dosya onayı gecikti.');
  });

  it('bildirim hedefi dosya sorumlusu + admin (saha yok)', () => {
    const ids = resolveApprovalDelayNotifyUserIds(
      { assignedOfficeUserId: 'office-1', currentResponsibleUserId: 'resp-1' },
      ['admin-1'],
    );
    expect(ids.sort()).toEqual(['admin-1', 'office-1', 'resp-1'].sort());
  });
});
