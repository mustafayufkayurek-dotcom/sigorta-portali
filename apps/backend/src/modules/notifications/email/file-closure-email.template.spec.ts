import {
  buildFileClosureEmailHtml,
  buildFileClosureEmailRows,
  closureCardGreeting,
  formatClosureDuration,
  formatFileFeeWithVat,
  isMeridyenInternalMailbox,
} from './file-closure-email.template';

describe('file-closure-email', () => {
  const base = {
    departmentName: 'Acil Yardım',
    organizationName: 'Remed Asistans',
    fileNo: 'AYF-202608-0004',
    insuranceCompanyName: 'Ray Sigorta',
    fileSubject: 'Tesisat',
    insuredName: 'Nafi İlhan',
    insuredPhone: '05362041497',
    notificationAt: new Date('2026-08-27T14:38:00+03:00'),
    workStartedAt: new Date('2026-08-28T12:51:00+03:00'),
    closedAt: new Date('2026-08-28T14:22:00+03:00'),
    fileFeeAmount: 1250,
    audience: 'assistance' as const,
  };

  it('uses authorized person from customer card in greeting', () => {
    expect(closureCardGreeting({
      contactFirstName: 'Ayşe',
      contactLastName: 'Yılmaz',
    })).toBe('Sn. Ayşe Yılmaz,');
    expect(closureCardGreeting(null, 'Mehmet Kaya')).toBe('Sn. Mehmet Kaya,');
    expect(closureCardGreeting(null)).toBe('Sn. Yetkili,');
  });

  it('puts customer title above greeting and department on banner, not under title', () => {
    const html = buildFileClosureEmailHtml(base);
    expect(html).toContain('Acil Yardım');
    expect(html).toContain('Remed Asistans');
    expect(html).toContain('Sn. Yetkili,');
    expect(html.indexOf('Remed Asistans')).toBeLessThan(html.indexOf('Sn. Yetkili,'));
    expect(html).not.toContain('Acil Yardım Departmanı');
    expect(html).not.toContain('>Safran Birleşik Hizmetler<');
    expect(html).not.toContain('Asistan Firması');
    expect(html).not.toContain('Hizmet Verilme');
    expect(html).not.toContain('Onaylı Hizmet Bedeli');
    expect(html).toContain('width="120"');
  });

  it('orders insurance company, file no and subject; assistance sees duration', () => {
    const rows = buildFileClosureEmailRows(base);
    const labels = rows.map((r) => r.label);
    expect(labels.indexOf('Sigorta şirketi')).toBeLessThan(labels.indexOf('Dosya No'));
    expect(labels.indexOf('Dosya No')).toBeLessThan(labels.indexOf('Dosya Konusu'));
    expect(labels).toContain('İşe Başlama');
    expect(labels).toContain('Kapanış Tarihi');
    expect(labels).toContain('Süre');
    expect(labels).toContain('Dosya bedeli');
    expect(rows.find((r) => r.label === 'Dosya bedeli')?.value).toBe('1.250,00 TL +KDV');
    expect(formatClosureDuration(base.workStartedAt, base.closedAt)).toBe('1 saat 31 dakika');
  });

  it('hides start/close/duration for insurance expert broker', () => {
    const rows = buildFileClosureEmailRows({ ...base, audience: 'other' });
    const labels = rows.map((r) => r.label);
    expect(labels).not.toContain('İşe Başlama');
    expect(labels).not.toContain('Kapanış Tarihi');
    expect(labels).not.toContain('Süre');
    expect(labels).toContain('Sigorta şirketi');
    expect(formatFileFeeWithVat(0)).toBe('—');
  });

  it('uses hasar department name on banner', () => {
    const html = buildFileClosureEmailHtml({ ...base, departmentName: 'Hasar Onarım', audience: 'other' });
    expect(html).toContain('Hasar Onarım');
    expect(html).not.toContain('Acil Yardım Departmanı');
  });

  it('skips meridyen internal mailboxes', () => {
    expect(isMeridyenInternalMailbox('info@meridyen-tr.com')).toBe(true);
    expect(isMeridyenInternalMailbox('operasyon@remed.com')).toBe(false);
  });
});
