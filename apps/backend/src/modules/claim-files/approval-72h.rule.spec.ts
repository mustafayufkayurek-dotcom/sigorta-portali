import {
  filterExceededCandidates,
  resolveNotifyUserIds,
  buildApproval72hNotification,
} from './approval-72h.rule';
import { APPROVAL_72H_MS } from '@sigorta/shared';

describe('approval-72h.rule', () => {
  const base = {
    claimFileId: 'c1',
    fileNo: 'H-1',
    reportId: 'r1',
    reportNo: 'R-1',
    assignedOfficeUserId: 'u1',
    assignedFieldUserId: null as string | null,
    currentResponsibleUserId: 'u1',
  };

  it('filters only exceeded rows', () => {
    const now = new Date();
    const rows = [
      { ...base, awaitingSince: new Date(now.getTime() - APPROVAL_72H_MS - 1000) },
      { ...base, claimFileId: 'c2', awaitingSince: new Date(now.getTime() - 1000) },
    ];
    const out = filterExceededCandidates(rows, now);
    expect(out).toHaveLength(1);
    expect(out[0].claimFileId).toBe('c1');
    expect(out[0].hoursWaiting).toBeGreaterThanOrEqual(72);
  });

  it('merges responsible + managers', () => {
    const ids = resolveNotifyUserIds(
      { ...base, awaitingSince: new Date() },
      ['mgr1', 'u1'],
    );
    expect(ids.sort()).toEqual(['mgr1', 'u1']);
  });

  it('builds Turkish notification copy', () => {
    const n = buildApproval72hNotification({ fileNo: 'H-99', hoursWaiting: 80 });
    expect(n.title).toContain('72 Saat');
    expect(n.body).toContain('Onay Talep Et');
    expect(n.body).toContain('H-99');
  });
});
