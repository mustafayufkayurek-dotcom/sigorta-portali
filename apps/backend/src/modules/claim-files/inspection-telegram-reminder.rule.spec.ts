import {
  buildInspectionTelegramDigest,
  buildInspectionTelegramPayload,
  formatMeridyenTelegramMessage,
} from './inspection-telegram-reminder.rule';

describe('inspection-telegram-reminder.rule', () => {
  const now = new Date('2026-08-11T09:00:00+03:00').getTime();

  it('tespit yapılmış dosyaları saymaz', () => {
    const d = buildInspectionTelegramDigest(
      [
        { fileNo: 'A', inspectionDone: true, createdAt: '2026-08-01T00:00:00Z' },
        { fileNo: 'B', inspectionDone: false, createdAt: '2026-08-10T00:00:00Z' },
      ],
      now,
    );
    expect(d.pendingCount).toBe(1);
    expect(d.sampleFileNos).toEqual(['B']);
  });

  it('48 saat aşımını sayar', () => {
    const d = buildInspectionTelegramDigest(
      [
        { fileNo: 'OLD', inspectionDone: false, createdAt: '2026-08-01T00:00:00Z' },
        { fileNo: 'NEW', inspectionDone: false, createdAt: '2026-08-10T20:00:00Z' },
      ],
      now,
    );
    expect(d.pendingCount).toBe(2);
    expect(d.overdue48Count).toBe(1);
  });

  it('pending yoksa payload null', () => {
    expect(
      buildInspectionTelegramPayload({ pendingCount: 0, overdue48Count: 0, sampleFileNos: [] }),
    ).toBeNull();
  });

  it('Sistem Alarmları formatında mesaj üretir', () => {
    const payload = buildInspectionTelegramPayload(
      {
        pendingCount: 3,
        overdue48Count: 1,
        sampleFileNos: ['LOCAL-SAHA-001', 'LOCAL-SAHA-002'],
      },
      { at: new Date('2026-08-11T09:00:00+03:00'), host: 'vps-test' },
    );
    expect(payload).not.toBeNull();
    expect(payload!.severity).toBe('WARNING');
    expect(payload!.code).toBe('INSPECTION_OVERDUE_48H');
    expect(payload!.title).toBe('Saha Tespiti Gecikti — Aksiyon Gerekli');
    expect(payload!.text).toContain('🟠 UYARI | SAHA TESPİT');
    expect(payload!.text).toContain('<b>Konu</b>: Saha Tespiti Gecikti — Aksiyon Gerekli');
    expect(payload!.text).not.toContain('Kod:');
    expect(payload!.text).not.toContain('Sunucu');
    expect(payload!.text).toContain('<b>Durum</b>:');
    expect(payload!.text).toContain('LOCAL-SAHA-001');
    expect(payload!.text).toMatch(/<b>Zaman<\/b>: .*2026/);
    expect(payload!.text).not.toContain('+0300');
  });

  it('formatMeridyenTelegramMessage KRİTİK öneki ve Kod satırı (sistem alarmı)', () => {
    const text = formatMeridyenTelegramMessage({
      severity: 'CRITICAL',
      code: 'CONTAINER_DOWN',
      title: 'Test',
      detail: 'detay',
      impact: 'etki',
      action: 'aksiyon',
      at: new Date('2026-08-10T22:35:01+03:00'),
      host: 'vps-1277914-22739',
    });
    expect(text).toContain('🔴 KRİTİK | MERİDYEN CANLI');
    expect(text).toContain('Kod: CONTAINER_DOWN');
  });
});
