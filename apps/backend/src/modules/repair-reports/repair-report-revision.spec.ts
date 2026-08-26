import {
  REPAIR_REPORT_INITIAL_VERSION,
  REPAIR_REPORT_MAX_VERSION,
  canCreateRepairReportRevision,
  canStartRepairReportRevisionFromStatus,
  isRepairReportRevision,
  nextRepairReportVersionNo,
  repairReportClosesOnRevise,
} from '@sigorta/shared';

describe('repair-report-revision', () => {
  it('0–3 aralığında yeni revizyon üretir', () => {
    expect(REPAIR_REPORT_INITIAL_VERSION).toBe(0);
    expect(REPAIR_REPORT_MAX_VERSION).toBe(3);
    expect(nextRepairReportVersionNo(0)).toBe(1);
    expect(nextRepairReportVersionNo(1)).toBe(2);
    expect(nextRepairReportVersionNo(2)).toBe(3);
  });

  it('3. sürümden sonra 4. revizyonu engeller', () => {
    expect(canCreateRepairReportRevision(3)).toBe(false);
    expect(nextRepairReportVersionNo(3)).toBeNull();
    expect(canCreateRepairReportRevision(4)).toBe(false);
  });

  it('orijinal sürümü (0) revizyon saymaz', () => {
    expect(isRepairReportRevision(0)).toBe(false);
    expect(isRepairReportRevision(1)).toBe(true);
    expect(isRepairReportRevision(undefined)).toBe(false);
  });

  it('dış onay bekleyen ve sunulmuş rapordan revizyon açılır', () => {
    expect(canStartRepairReportRevisionFromStatus('sent_for_external_approval')).toBe(true);
    expect(canStartRepairReportRevisionFromStatus('submitted')).toBe(true);
    expect(canStartRepairReportRevisionFromStatus('approved')).toBe(true);
    expect(canStartRepairReportRevisionFromStatus('draft')).toBe(false);
    expect(repairReportClosesOnRevise('sent_for_external_approval')).toBe(true);
    expect(repairReportClosesOnRevise('approved')).toBe(false);
  });
});
