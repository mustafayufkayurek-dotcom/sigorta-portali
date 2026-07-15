import {
  deriveOperationStage,
  isApproval72hExceeded,
  hoursSince,
  APPROVAL_72H_MS,
} from '@sigorta/shared';

describe('operation-status mapping', () => {
  it('maps new → İhbar Alındı', () => {
    expect(deriveOperationStage({ claimStatusCode: 'new' }).label).toBe('İhbar Alındı');
  });

  it('maps closed → Dosya Kapandı', () => {
    expect(deriveOperationStage({ claimStatusCode: 'closed' }).label).toBe('Dosya Kapandı');
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
});
