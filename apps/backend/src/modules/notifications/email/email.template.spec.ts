import {
  buildEmailHtml,
  buildNotificationEmailHtml,
  buildWelcomeInviteEmailHtml,
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
