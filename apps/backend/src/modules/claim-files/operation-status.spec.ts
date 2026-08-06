import {
  deriveOperationStage,
  resolveOperationStatusLabel,
  emergencyStatusProductLabel,
  isApproval72hExceeded,
  hoursSince,
  formatApprovalDelayLabel,
  APPROVAL_72H_MS,
} from '@sigorta/shared';

describe('operation-status mapping', () => {
  it('maps new → Yeni İhbar', () => {
    expect(deriveOperationStage({ claimStatusCode: 'new' }).label).toBe('Yeni İhbar');
  });

  it('maps closed → Dosya Kapatıldı', () => {
    expect(deriveOperationStage({ claimStatusCode: 'closed' }).label).toBe('Dosya Kapatıldı');
  });

  it('maps adjuster_assigned → Tespit Aşamasında', () => {
    expect(deriveOperationStage({ claimStatusCode: 'adjuster_assigned' }).label).toBe('Tespit Aşamasında');
  });

  it('maps repair_in_progress → Onarım Aşamasında', () => {
    expect(deriveOperationStage({ claimStatusCode: 'repair_in_progress' }).label).toBe('Onarım Aşamasında');
  });

  it('maps invoice_pending → Finansa Aktarıldı', () => {
    expect(deriveOperationStage({ claimStatusCode: 'invoice_pending' }).label).toBe('Finansa Aktarıldı');
  });

  it('72h aşımı Dosya Durumu etiketini bozmaz; aksiyon nextAction’da kalır', () => {
    expect(
      resolveOperationStatusLabel({
        claimStatusCode: 'budget_preparing',
        reportStatus: 'pending_approval',
        approval72hExceeded: true,
      }),
    ).toBe('Onay Bekliyor');
    expect(
      deriveOperationStage({
        claimStatusCode: 'budget_preparing',
        reportStatus: 'pending_approval',
      }).nextAction,
    ).toBe('Onay Talep Et');
  });

  it('acil ATANDI → Tespit Aşamasında; COZULDU → Dosya Kapatıldı', () => {
    expect(emergencyStatusProductLabel('ATANDI')).toBe('Tespit Aşamasında');
    expect(emergencyStatusProductLabel('COZULDU')).toBe('Dosya Kapatıldı');
  });

  it('report pending_approval overrides claim code → Onay Bekliyor', () => {
    const stage = deriveOperationStage({
      claimStatusCode: 'budget_preparing',
      reportStatus: 'pending_approval',
    });
    expect(stage.label).toBe('Onay Bekliyor');
    expect(stage.nextAction).toBe('Onay Talep Et');
  });

  it('72h rule: exactly 72h is exceeded', () => {
    const since = new Date(Date.now() - APPROVAL_72H_MS);
    expect(isApproval72hExceeded(since)).toBe(true);
  });

  it('72h rule: 71h is not exceeded', () => {
    const since = new Date(Date.now() - (71 * 60 * 60 * 1000));
    expect(isApproval72hExceeded(since)).toBe(false);
  });

  it('hoursSince floors hours', () => {
    const since = new Date(Date.now() - (90 * 60 * 60 * 1000));
    expect(hoursSince(since)).toBe(90);
  });

  it('Gecikme Süresi: exact / 72+ / 96+', () => {
    expect(formatApprovalDelayLabel(18)).toEqual({ text: '18 Saat', suffix: '', level: 'normal' });
    expect(formatApprovalDelayLabel(71)).toEqual({ text: '71 Saat', suffix: '', level: 'normal' });
    expect(formatApprovalDelayLabel(72)).toEqual({ text: '72+ Saat', suffix: '🔴', level: 'over72' });
    expect(formatApprovalDelayLabel(96)).toEqual({ text: '96+ Saat', suffix: '🚨', level: 'over96' });
    expect(formatApprovalDelayLabel(null).text).toBe('—');
  });
});
