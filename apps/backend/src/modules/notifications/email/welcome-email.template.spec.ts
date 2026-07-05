import { generateWelcomeEmail } from './welcome-email.template';

describe('generateWelcomeEmail', () => {
  it('renders expert welcome with office line, generic greeting and guide button', () => {
    const rendered = generateWelcomeEmail('EXPERT', {
      recipientName: 'Ayşe Demir',
      organizationName: 'Safran BH Sigorta Hizmetleri',
      portalUrl: 'https://app.meridyen-tr.com/giris',
      guideUrl: 'https://app.meridyen-tr.com/docs/03-eksper-portal-tanitim.pdf',
      accountEmail: 'ayse@ornek.com',
      temporaryPassword: 'fPNt#T6n%th5',
      forcePasswordChange: true,
    });

    expect(rendered.subject).toBe("Meridyen Hasar Yönetim Platformu'na Hoş Geldiniz");
    expect(rendered.html).toContain('Meridyen Hasar Yönetim Platformu');
    expect(rendered.html).toContain('Hoş Geldiniz');
    expect(rendered.html).not.toContain('Hasar süreçlerinizi hızlandırın');
    expect(rendered.html).not.toContain('Platformumuza güvenli erişiminiz hazır.');
    expect(rendered.html).toContain('Safran BH Sigorta Hizmetleri');
    expect(rendered.html).not.toContain('Ekspertiz Ofisi');
    expect(rendered.html).toContain('Sayın Ayşe Demir,');
    expect(rendered.html).not.toContain('Sayın Kullanıcımız,');
    expect(rendered.html).toContain('Sahadan dosya ihbarı ve hasar ihbarında bulunabilirsiniz');
    expect(rendered.html).toContain('Önemli — Sahadan İhbar');
    expect(rendered.html).not.toContain('Güvenli Erişim');
    expect(rendered.html).not.toContain('Operasyon Desteği');
    expect(rendered.html).toContain('Kullanım Kılavuzunu İndir veya İncele');
    expect(rendered.html).not.toMatch(/>\s*Eksper\s*</);
    expect(rendered.html).not.toContain('Hızlı ve Şeffaf');
    expect(rendered.html).not.toContain('Rapor Gönder');
    expect(rendered.html).not.toContain('Size atanmış dosyalar');
    expect(rendered.html).toContain('https://app.meridyen-tr.com/docs/meridyen-assistance-logo.jpeg');
    expect(rendered.attachments).toEqual([]);
  });

  it('uses staff welcome title for Meridyen personnel', () => {
    const rendered = generateWelcomeEmail('MERIDYEN_STAFF', {
      organizationName: 'Meridyen İstanbul Operasyon',
      portalUrl: 'https://app.meridyen-tr.com/giris',
      guideUrl: 'https://app.meridyen-tr.com/docs/01-personel-kullanim-kilavuzu.pdf',
      accountEmail: 'ayse@ornek.com',
      temporaryPassword: 'Ab12#cd34',
      forcePasswordChange: true,
    });

    expect(rendered.subject).toBe("Meridyen Operasyon Platformu'na Hoş Geldiniz");
    expect(rendered.html).toContain('Meridyen Operasyon Platformu');
    expect(rendered.html).not.toContain('Meridyen Hasar Yönetim Platformu');
    expect(rendered.html).toContain('Önemli — Operasyon Merkezi');
    expect(rendered.html).toContain('Hasar Dosyaları');
    expect(rendered.guideFileName).toBe('01-personel-kullanim-kilavuzu.pdf');
  });

  it('renders insurance company welcome without map highlight and six portal actions', () => {
    const rendered = generateWelcomeEmail('INSURANCE_COMPANY', {
      recipientName: 'Mehmet Kaya',
      organizationName: 'Türkiye Sigorta',
      portalUrl: 'https://app.meridyen-tr.com/giris',
      guideUrl: 'https://app.meridyen-tr.com/docs/02-sigorta-portal-kilavuzu.pdf',
      accountEmail: 'sigorta@ornek.com',
      temporaryPassword: 'Xy9#mN2p',
      forcePasswordChange: true,
    });

    expect(rendered.subject).toBe("Meridyen Hasar Yönetim Platformu'na Hoş Geldiniz");
    expect(rendered.html).toContain('Türkiye Sigorta');
    expect(rendered.html).toContain('Kurum');
    expect(rendered.html).toContain('Sayın Mehmet Kaya,');
    expect(rendered.html).not.toContain('Sayın Kullanıcımız,');
    expect(rendered.html).not.toContain('Türkiye Hasar Haritası');
    expect(rendered.html).not.toContain('Önemli —');
    expect(rendered.html).not.toContain('insuranceCompanyScopes');
    expect(rendered.html).not.toContain('approverType');
    expect(rendered.html).toContain('Bekleyen Onaylar');
    expect(rendered.html).toContain('Ana Ekran Özeti');
    expect(rendered.html).toContain('Faturalar');
    expect(rendered.guideFileName).toBe('02-sigorta-portal-kilavuzu.pdf');
  });

  it('renders broker welcome with broker firm label and broker guide', () => {
    const rendered = generateWelcomeEmail('BROKER', {
      recipientName: 'Elif Arslan',
      organizationName: 'Neova Broker',
      portalUrl: 'https://app.meridyen-tr.com/giris',
      guideUrl: 'https://app.meridyen-tr.com/docs/04-broker-portal-kilavuzu.pdf',
      accountEmail: 'elif@neova.com',
      temporaryPassword: 'Br9#kLm2',
      forcePasswordChange: true,
    });

    expect(rendered.html).toContain('Neova Broker');
    expect(rendered.html).not.toContain('Broker Firması');
    expect(rendered.html).toContain('Sayın Elif Arslan,');
    expect(rendered.html).toContain('broker firması kapsamındaki');
    expect(rendered.html).not.toContain('Türkiye Hasar Haritası');
    expect(rendered.guideFileName).toBe('04-broker-portal-kilavuzu.pdf');
  });
});
