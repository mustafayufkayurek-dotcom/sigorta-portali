import { generateWelcomeEmail } from './welcome-email.template';

describe('generateWelcomeEmail', () => {
  it('renders expert welcome with portal screens only', () => {
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
    expect(rendered.html).toContain('Sayın Ayşe Demir,');
    expect(rendered.html).toContain('Önemli — Sesli Not');
    expect(rendered.html).toContain('Sahadan ihbar...');
    expect(rendered.html).toContain('Sesli not özellikleri...');
    expect(rendered.html).toContain('Fotoğraf ve evrak yükleme...');
    expect(rendered.html).toContain('Rapor ve onayları tek ekrandan izleme...');
    expect(rendered.html).toContain('Eksper Portalında Öne Çıkanlar');
    expect(rendered.html).toContain('Safran BH Sigorta Hizmetleri');
    expect(rendered.html).toContain('https://app.meridyen-tr.com/giris');
    expect(rendered.html).toContain('Kullanım Kılavuzunu İndir veya İncele');
    expect(rendered.html).not.toContain('oto dışı');
    expect(rendered.html).not.toContain('Önemli — Sahadan İhbar');
    expect(rendered.html).not.toContain('Operasyon Birimi');
    expect(rendered.html).not.toContain('Acil Yardım');
    expect(rendered.html).not.toContain('Tedarikçi');
    expect(rendered.html).not.toContain('Finans');
    expect(rendered.html).not.toContain('Operasyon Merkezi');
    expect(rendered.html).toContain('https://app.meridyen-tr.com/docs/meridyen-logo-original.png');
    expect(rendered.html).toContain('width="120"');
    expect(rendered.html).toContain('width:120px');
    expect(rendered.html).not.toContain('196px');
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
    expect(rendered.html).toContain('Meridyen İstanbul Operasyon');
    expect(rendered.html).not.toContain('Meridyen Personeli');
    expect(rendered.html).not.toContain('Bu metin operasyon panelinizdeki yetkili ekranlara göredir.');
    expect(rendered.html).toContain('Hasar Dosyaları');
    expect(rendered.html).toContain('Acil Yardım');
    expect(rendered.html).toContain('Tedarikçi');
    expect(rendered.html).toContain('Finans');
    expect(rendered.html).not.toContain('Operasyon Birimi');
    expect(rendered.guideFileName).toBe('01-personel-kullanim-kilavuzu.pdf');
  });

  it('renders insurance company welcome with tracking screens only', () => {
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
    expect(rendered.html).toContain('Sayın Mehmet Kaya,');
    expect(rendered.html).toContain('Türkiye Sigorta');
    expect(rendered.html).not.toContain('Sigorta Şirketi');
    expect(rendered.html.indexOf('Türkiye Sigorta')).toBeLessThan(
      rendered.html.indexOf('Sayın Mehmet Kaya,'),
    );
    expect(rendered.html).not.toContain('Bu metin Dosya Takip ekranınıza göredir.');
    expect(rendered.html).toContain('Dosya Takip');
    expect(rendered.html).toContain('Bekleyen Onaylar');
    expect(rendered.html).toContain('Canlı İzle');
    expect(rendered.html).toContain('Operasyon Ağı');
    expect(rendered.html).toContain('Sayfanızda Öne Çıkanlar');
    expect(rendered.html).not.toContain('Operasyon Birimi');
    expect(rendered.html).not.toContain('Kurum');
    expect(rendered.html).not.toContain('Tedarikçi');
    expect(rendered.html).not.toContain('Finans Modülleri');
    expect(rendered.html).not.toContain('Acil Yardım');
    expect(rendered.html).not.toContain('Operasyon Merkezi');
    expect(rendered.html).not.toContain('vade');
    expect(rendered.html).not.toContain('Türkiye Hasar Haritası');
    expect(rendered.guideFileName).toBe('02-sigorta-portal-kilavuzu.pdf');
  });

  it('renders broker welcome without finance or emergency operations', () => {
    const rendered = generateWelcomeEmail('BROKER', {
      recipientName: 'Elif Arslan',
      organizationName: 'Neova Broker',
      portalUrl: 'https://app.meridyen-tr.com/giris',
      guideUrl: 'https://app.meridyen-tr.com/docs/04-broker-portal-kilavuzu.pdf',
      accountEmail: 'elif@neova.com',
      temporaryPassword: 'Br9#kLm2',
      forcePasswordChange: true,
    });

    expect(rendered.html).toContain('Sayın Elif Arslan,');
    expect(rendered.html).toContain('Neova Broker');
    expect(rendered.html).toContain('broker kapsamındaki');
    expect(rendered.html).not.toContain('Operasyon Birimi');
    expect(rendered.html).not.toContain('Tedarikçi');
    expect(rendered.html).not.toContain('Acil Yardım');
    expect(rendered.html).not.toContain('Operasyon Merkezi');
    expect(rendered.html).not.toContain('Finans Modülleri');
    expect(rendered.guideFileName).toBe('04-broker-portal-kilavuzu.pdf');
  });

  it('renders assistance welcome for emergency file tracking only', () => {
    const rendered = generateWelcomeEmail('ASSISTANCE_COMPANY', {
      recipientName: 'Deniz Aksoy',
      organizationName: 'Remed Uluslararası Destek Ve Danışmanlık Hizmetleri Tic. A.Ş.',
      portalUrl: 'https://app.meridyen-tr.com/giris',
      accountEmail: 'deniz@asistans.com',
      temporaryPassword: 'As7#kLm2',
      forcePasswordChange: true,
    });

    expect(rendered.html).toContain('acil yardım dosyalarını');
    expect(rendered.html).toContain('Remed Uluslararası Destek Ve Danışmanlık Hizmetleri Tic. A.Ş.');
    expect(rendered.html).not.toContain('Acil Asistans');
    expect(rendered.html).not.toContain('Asistans Firması');
    expect(rendered.html).toContain('Dosya Takip');
    expect(rendered.html).toContain('Canlı İzle');
    expect(rendered.html).not.toContain('Operasyon Birimi');
    expect(rendered.html).not.toContain('Tedarikçi');
    expect(rendered.html).not.toContain('Hasar Dosyaları');
    expect(rendered.html).not.toContain('Operasyon Merkezi');
    expect(rendered.html).not.toContain('Finans Modülleri');
  });

  it('localhost giriş adresini canlı siteye çevirir', () => {
    const rendered = generateWelcomeEmail('INSURANCE_COMPANY', {
      portalUrl: 'http://localhost:3001/giris',
      accountEmail: 'sigorta@ornek.com',
      temporaryPassword: 'Xy9#mN2p',
    });

    expect(rendered.html).toContain('https://app.meridyen-tr.com/giris');
    expect(rendered.html).not.toContain('localhost');
    expect(rendered.text).toContain('https://app.meridyen-tr.com/giris');
    expect(rendered.text).not.toContain('localhost');
  });
});
