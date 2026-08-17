import { annualLeaveEntitlementDays } from './hr-leave-entitlement.helper';

describe('hr-leave-entitlement', () => {
  const asOf = new Date(Date.UTC(2026, 7, 4)); // 4 Ağustos 2026

  it('1 yıldan az → 0 gün', () => {
    const r = annualLeaveEntitlementDays(new Date(Date.UTC(2026, 0, 1)), asOf);
    expect(r.totalDays).toBe(0);
    expect(r.eligible).toBe(false);
  });

  it('3 yıl → 14 gün', () => {
    const r = annualLeaveEntitlementDays(new Date(Date.UTC(2023, 7, 4)), asOf);
    expect(r.completedYears).toBe(3);
    expect(r.totalDays).toBe(14);
  });

  it('6 yıl → 20 gün', () => {
    const r = annualLeaveEntitlementDays(new Date(Date.UTC(2020, 7, 4)), asOf);
    expect(r.completedYears).toBe(6);
    expect(r.totalDays).toBe(20);
  });

  it('16 yıl → 26 gün', () => {
    const r = annualLeaveEntitlementDays(new Date(Date.UTC(2010, 7, 4)), asOf);
    expect(r.completedYears).toBe(16);
    expect(r.totalDays).toBe(26);
  });
});
