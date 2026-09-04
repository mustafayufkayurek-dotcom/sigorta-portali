import {
  buildEmailHtml,
  buildExternalApprovalSummaryHtml,
  buildNotificationEmailHtml,
  buildTransactionalEmailHtml,
  buildWelcomeInviteEmailHtml,
  formatSnPersonGreeting,
  onarimRaporuRequestSubject,
  organizationLineForMail,
  raporOnaylandiSubject,
  yeniIhbarSubject,
  buildRaporOnaylandiEmailHtml,
  buildNewClaimFileEmailHtml,
} from './email.template';

describe('buildWelcomeInviteEmailHtml', () => {
  it('renders copy-friendly temporary password block and production login URL', () => {
    const html = buildWelcomeInviteEmailHtml({
      fullName: 'Ayşe Yılmaz',
      email: 'ayse@ornek.com',
      temporaryPassword: 'fPNt#T6n%th5',
      loginUrl: 'https://app.meridyen-tr.com/giris',
    });

    expect(html).toContain('fPNt#T6n%th5');
    expect(html).toContain('Kopyala');
    expect(html).toContain('user-select:all');
    expect(html).toContain('https://app.meridyen-tr.com/giris');
    expect(html).not.toContain('localhost');
    // Şifre/davet basit şablonda kalır — enterprise bilgilendirme kabuğu yok
    expect(html).toContain('Meridyen Assistance');
    expect(html).toContain('Hasar Platformu');
    expect(html).not.toContain('Operasyon Bildirimi');
    expect(html).not.toContain('meridyen-logo-original.png');
  });
});

describe('buildEmailHtml (şifre/davet basit şablon)', () => {
  it('does not use enterprise notification chrome', () => {
    const html = buildEmailHtml({
      title: 'Test',
      preheader: 'Önizleme',
      rows: [{ label: 'Alan', value: 'Değer' }],
    });
    expect(html).toContain('Meridyen Assistance');
    expect(html).not.toContain('Operasyon Bildirimi');
  });
});

describe('buildNotificationEmailHtml (bilgilendirme)', () => {
  it('renders enterprise shell with logo and summary card', () => {
    const html = buildNotificationEmailHtml({
      title: 'Dosya Ataması',
      badgeLabel: 'Yeni Atama',
      preheader: '20260110256923 numaralı dosya size atandı.',
      greeting: 'Sayın M. Hakan Yufkayürek,',
      summaryTitle: 'Dosya Özeti',
      rows: [
        { label: 'Dosya No', value: '20260110256923' },
        { label: 'Müşteri', value: 'M-Nihal Sigorta Ekspertiz' },
      ],
      nextStepText: 'Dosyayı açarak güncel durumu kontrol edin.',
      actionUrl: 'https://app.meridyen-tr.com/panel/hasar-dosyalari/abc',
      actionLabel: 'Dosyayı Görüntüle',
      portalUrl: 'https://app.meridyen-tr.com/giris',
    });

    expect(html).toContain('Operasyon Bildirimi');
    expect(html).toContain('Yeni Atama');
    expect(html).toContain('Dosya Özeti');
    expect(html).toContain('Dosyayı Görüntüle');
    expect(html).toContain('/docs/meridyen-logo-original.png');
    expect(html).toContain('Meridyen Asistans');
    expect(html).not.toContain('Geçici Şifre');
    expect(html).not.toContain('Kopyala');
  });
});

describe('buildTransactionalEmailHtml (dış onay / şifre sıfırlama)', () => {
  it('uses live welcome logo scale 120px', () => {
    const html = buildTransactionalEmailHtml({
      title: 'Onay Talep',
      greeting: formatSnPersonGreeting('Ayşe', 'Yılmaz'),
      actionUrl: 'https://app.meridyen-tr.com/onay',
      actionLabel: 'Raporu İncele ve Onayla',
      portalUrl: 'https://app.meridyen-tr.com/giris',
    });
    expect(html).toContain('width="120"');
    expect(html).toContain('width:120px');
    expect(html).toContain('/docs/meridyen-logo-original.png');
    expect(html).toContain('Raporu İncele ve Onayla');
    expect(html).toContain('Sn. Ayşe Yılmaz,');
    expect(html).not.toContain('196px');
  });

  it('shows firm above name for external users, not for Meridyen staff', () => {
    const external = buildTransactionalEmailHtml({
      title: 'Şifre Sıfırlama',
      organizationName: organizationLineForMail('Ray Sigorta', 'insurance_company_user'),
      greeting: formatSnPersonGreeting('Ayşe', 'Yılmaz'),
      actionUrl: 'https://app.meridyen-tr.com/giris',
      actionLabel: 'Şifreyi Sıfırla',
    });
    expect(external).toContain('Ray Sigorta');
    expect(external.indexOf('Ray Sigorta')).toBeLessThan(external.indexOf('Sn. Ayşe Yılmaz,'));

    const staff = buildTransactionalEmailHtml({
      title: 'Şifre Sıfırlama',
      organizationName: organizationLineForMail('Meridyen İstanbul Operasyon', 'office_staff'),
      greeting: formatSnPersonGreeting('Ayşe', 'Yılmaz'),
      actionUrl: 'https://app.meridyen-tr.com/giris',
      actionLabel: 'Şifreyi Sıfırla',
    });
    expect(staff).toContain('Sn. Ayşe Yılmaz,');
    expect(staff).not.toContain('Meridyen İstanbul Operasyon');
  });
});

describe('formatSnPersonGreeting', () => {
  it('uses first and last name, not company or Kullanıcı', () => {
    expect(formatSnPersonGreeting('Ayşe', 'Yılmaz')).toBe('Sn. Ayşe Yılmaz,');
    expect(formatSnPersonGreeting('', '', 'Kullanıcı')).toBe('Sn. Yetkili,');
    expect(formatSnPersonGreeting('', '', 'Ray Sigorta', 'Ray Sigorta')).toBe('Sn. Yetkili,');
    expect(formatSnPersonGreeting('', '', 'Sayın Ayşe Yılmaz')).toBe('Sn. Ayşe Yılmaz,');
  });
});

describe('organizationLineForMail', () => {
  it('hides firm for Meridyen staff and keeps it for portal users', () => {
    expect(organizationLineForMail('Ray Sigorta', 'insurance_company_user')).toBe('Ray Sigorta');
    expect(organizationLineForMail('Safran BH', 'expert')).toBe('Safran BH');
    expect(organizationLineForMail('Neova Broker', 'broker_user')).toBe('Neova Broker');
    expect(organizationLineForMail('Remed Asistans', 'assistance_company_user')).toBe('Remed Asistans');
    expect(organizationLineForMail('Meridyen İstanbul Operasyon', 'admin')).toBeUndefined();
    expect(organizationLineForMail('Meridyen İstanbul Operasyon', 'manager')).toBeUndefined();
    expect(organizationLineForMail('Meridyen İstanbul Operasyon', 'office_staff')).toBeUndefined();
    expect(organizationLineForMail('Ray Sigorta', undefined)).toBe('Ray Sigorta');
  });
});

describe('rapor mail konuları', () => {
  it('joins insurance company, file no and onarım / onaylandı labels', () => {
    expect(onarimRaporuRequestSubject('Ray Sigorta', 'RCS-20261868899')).toBe(
      'Ray Sigorta-RCS-20261868899-Onay Talep',
    );
    expect(raporOnaylandiSubject('Ray Sigorta', 'RCS-20261868899', 'Fidar')).toBe(
      'Rapor Onaylandı (Fidar)-Ray Sigorta-RCS-20261868899',
    );
    expect(yeniIhbarSubject('Fidar')).toBe('Yeni İhbar-Fidar');
    expect(yeniIhbarSubject('')).toBe('Yeni İhbar');
  });

  it('expert approved body follows rapor onaylandı shell without report no', () => {
    const html = buildRaporOnaylandiEmailHtml({
      insuranceCompanyName: 'Ray Sigorta',
      fileNo: 'RCS-20261868899',
      approvedBy: 'Ahmet Demir',
      greeting: 'Sn. Mehmet Kaya,',
      intro: 'Eksper onarım raporunu onaylanmıştır.\nOperasyon planlama aşamasına geçiniz.',
    });
    expect(html).toContain('Rapor Onaylandı');
    expect(html).toContain('width="120"');
    expect(html).toContain('Ray Sigorta');
    expect(html).toContain('RCS-20261868899');
    expect(html).toContain('Eksper onarım raporunu onaylanmıştır.');
    expect(html).toContain('Operasyon planlama aşamasına geçiniz.');
    expect(html).toContain('Sn. Mehmet Kaya,');
    expect(html).not.toContain('Operasyon Bildirimi');
    expect(html).not.toContain('Rapor No');
    expect(html.indexOf('Ray Sigorta')).toBeLessThan(html.indexOf('Sn. Mehmet Kaya,'));
  });
});

describe('buildNewClaimFileEmailHtml', () => {
  it('uses transactional shell without Operasyon Bildirimi', () => {
    const html = buildNewClaimFileEmailHtml({
      fileNo: '49/19430902',
      customer: 'Osem',
      branch: 'diger',
      priority: 'normal',
      actionUrl: 'https://app.meridyen-tr.com/panel/hasar-dosyalari/abc',
      portalUrl: 'https://app.meridyen-tr.com/giris',
    });
    expect(html).toContain('Yeni Hasar Dosyası');
    expect(html).toContain('width="120"');
    expect(html).toContain('49/19430902');
    expect(html).toContain('Osem');
    expect(html).toContain('Dosyayı Görüntüle');
    expect(html).not.toContain('Operasyon Bildirimi');
    expect(html).not.toContain('196px');
  });
});

describe('buildExternalApprovalSummaryHtml', () => {
  it('lists insurance company, file no and send date — not report no', () => {
    const html = buildExternalApprovalSummaryHtml({
      insuranceCompanyName: 'Ray Sigorta',
      fileNo: 'RCS-20261868899',
      sentAt: new Date(2026, 8, 2, 12, 16),
    });
    expect(html).toContain('Sigorta şirketi');
    expect(html).toContain('Ray Sigorta');
    expect(html).toContain('Dosya No');
    expect(html).toContain('RCS-20261868899');
    expect(html).toContain('Onay Gönderim tarihi');
    expect(html).not.toContain('Rapor No');
    expect(html).not.toContain('Hasar Dosya No');
  });
});
