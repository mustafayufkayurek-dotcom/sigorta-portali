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
    expect(rendered.html).toContain('<h1');
    expect(rendered.html).toContain('Hoş Geldiniz');
    expect(rendered.html).toContain('Değerli Eksperimiz ve Ekibi;');
    expect(rendered.html).not.toContain('Sayın Ayşe Demir,');
    expect(rendered.html).not.toContain('Önemli — Sesli Not');
    expect(rendered.html).not.toContain(
      'Hasar dosyalarınızı artık tek platformdan, her cihazdan, gerçek zamanlı yönetebilirsiniz.',
    );
    expect(rendered.html).not.toContain('oto dışı branşlarda');
    expect(rendered.html).toContain('Meridyen Hasar Yönetim Platformu;');
    expect(rendered.html).toContain('Konut, Endüstriyel Ve Denizcilik');
    expect(rendered.html).toContain('user-select:all');
    expect(rendered.html).not.toContain('Kopyala');
    expect(rendered.html).toContain('welcome-temp-pwd-copy');
    expect(rendered.html).toContain('.welcome-temp-pwd:hover');
    expect(rendered.html).toContain('data:image/svg+xml');
    expect(rendered.html).toContain('Platformla neler yapabilirsiniz?');
    expect(rendered.html).not.toContain('Dosya Açma — Saha');
    expect(rendered.html).toContain('Mobil Uyumlu Tasarım:');
    expect(rendered.html.indexOf('Mobil Uyumlu Tasarım')).toBeLessThan(
      rendered.html.indexOf('Sahadan Anlık İhbar ve Dosya Açma'),
    );
    expect(rendered.html).toContain('hasar ihbarına konu evrakları dijital ortamda yükleme');
    expect(rendered.html).toContain('Onarım raporlarınızın durumunu tek panelden izleyin.');
    expect(rendered.html).toContain('Ve daha bir çok özellik...');
    expect(rendered.html).not.toContain('Operasyon Görünürlüğü ve Dashboard');
    expect(rendered.html).not.toContain('Hızlı Onarım Kalemleri Önerisi');
    expect(rendered.html).not.toContain('Güvenli ve Rol Bazlı Erişim');
    expect(rendered.html).not.toContain('Eksper Portalında Öne Çıkanlar');
    expect(rendered.html).toContain('Safran BH Sigorta Hizmetleri');
    expect(rendered.html).toContain('https://app.meridyen-tr.com/giris');
    expect(rendered.html).toContain('Kullanım Kılavuzunu İndir veya İncele');
    expect(rendered.html).not.toContain('Önemli — Sahadan İhbar');
    expect(rendered.html).not.toContain('Operasyon Birimi');
    expect(rendered.html).not.toContain('Acil Yardım');
    expect(rendered.html).not.toContain('Tedarikçi');
    expect(rendered.html).not.toContain('Operasyon Merkezi');
    expect(rendered.html).toContain('https://app.meridyen-tr.com/docs/meridyen-logo-original.png');
    expect(rendered.html).toContain('width="120"');
    expect(rendered.html).toContain('width:120px');
    expect(rendered.html).not.toContain('196px');
    expect(rendered.attachments).toEqual([]);
    expect(rendered.html.split("Meridyen'e Giriş Yap").length - 1).toBe(1);
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

    expect(rendered.subject).toBe(
      'Meridyen Hasar Yönetim Platformu -> Dosya İzleme Erişiminiz Hazır',
    );
    expect(rendered.html).toContain('Sayın Mehmet Kaya,');
    expect(rendered.html).toContain('Türkiye Sigorta');
    expect(rendered.html).not.toContain('Sigorta Şirketi');
    expect(rendered.html.indexOf('Türkiye Sigorta')).toBeLessThan(
      rendered.html.indexOf('Sayın Mehmet Kaya,'),
    );
    expect(rendered.html).toContain('Hoş Geldiniz');
    expect(rendered.html).toContain('yenilendik.');
    expect(rendered.html).toContain('Sizin İçin Ne Değişiyor?');
    expect(rendered.html).toContain('dijital ortamdan, anlık olarak izleyebilirsiniz');
    expect(rendered.html).toContain('Platform ile Neler Yapabilirsiniz?');
    expect(rendered.html).toContain('<b style="font-weight:700;color:#123A63;">Dosya Durumu Takibi :</b>');
    expect(rendered.html).toContain('<b style="font-weight:700;color:#123A63;">Onarım Sürecini Canlı İzleme :</b>');
    expect(rendered.html).toContain('Evrak ve Rapor Erişimi :');
    expect(rendered.html).toContain('Her Cihazdan Güvenli Erişim :');
    expect(rendered.html).toContain('güvenli giriş ile her yerden erişim');
    expect(rendered.html).not.toContain('✅');
    expect(rendered.html).toContain('✓');
    expect(rendered.html).not.toContain('Önemli — Dosya Takip');
    expect(rendered.html).not.toContain('Sayfanızda Öne Çıkanlar');
    expect(rendered.html).not.toContain('Operasyon Ağı');
    expect(rendered.html).not.toContain('Bu metin Dosya Takip ekranınıza göredir.');
    expect(rendered.html).not.toContain('Operasyon Birimi');
    expect(rendered.html).not.toContain('Kurum');
    expect(rendered.html).not.toContain('Tedarikçi');
    expect(rendered.html).not.toContain('Finans Modülleri');
    expect(rendered.html).not.toContain('Acil Yardım');
    expect(rendered.html).not.toContain('Operasyon Merkezi');
    expect(rendered.html).not.toContain('vade');
    expect(rendered.html).not.toContain('Türkiye Hasar Haritası');
    expect(rendered.html.split("Meridyen'e Giriş Yap").length - 1).toBe(1);
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

    expect(rendered.subject).toBe(
      'Meridyen Hasar Yönetim Platformu -> Dosya İzleme Erişiminiz Hazır',
    );
    expect(rendered.html).toContain('Sayın Elif Arslan,');
    expect(rendered.html).toContain('Neova Broker');
    expect(rendered.html).toContain('Hoş Geldiniz');
    expect(rendered.html).toContain('Sizin İçin Ne Değişiyor?');
    expect(rendered.html).toContain('Platform ile Neler Yapabilirsiniz?');
    expect(rendered.html).toContain('<b style="font-weight:700;color:#123A63;">Dosya Durumu Takibi :</b>');
    expect(rendered.html).toContain('<b style="font-weight:700;color:#123A63;">Her Cihazdan Güvenli Erişim :</b>');
    expect(rendered.html).not.toContain('✅');
    expect(rendered.html).not.toContain('broker kapsamındaki');
    expect(rendered.html).not.toContain('Sayfanızda Öne Çıkanlar');
    expect(rendered.html).not.toContain('Operasyon Birimi');
    expect(rendered.html).not.toContain('Tedarikçi');
    expect(rendered.html).not.toContain('Acil Yardım');
    expect(rendered.html).not.toContain('Operasyon Merkezi');
    expect(rendered.html).not.toContain('Finans Modülleri');
    expect(rendered.guideFileName).toBe('04-broker-portal-kilavuzu.pdf');
  });

  it('renders assistance welcome with approved file-management copy', () => {
    const rendered = generateWelcomeEmail('ASSISTANCE_COMPANY', {
      recipientName: 'Deniz Aksoy',
      organizationName: 'Remed Uluslararası Destek Ve Danışmanlık Hizmetleri Tic. A.Ş.',
      portalUrl: 'https://app.meridyen-tr.com/giris',
      accountEmail: 'deniz@asistans.com',
      temporaryPassword: 'As7#kLm2',
      forcePasswordChange: true,
    });

    expect(rendered.subject).toBe("Meridyen Dosya Yönetim Platformu'na Hoş Geldiniz");
    expect(rendered.html).toContain('Meridyen Dosya Yönetim Platformu&#39;na Hoş Geldiniz');
    expect(rendered.html).toContain('Sayın Deniz Aksoy,');
    expect(rendered.html).toContain('Remed Uluslararası Destek Ve Danışmanlık Hizmetleri Tic. A.Ş.');
    expect(rendered.html).toContain('ihbardan kapanışa kadar tek platformdan yönetebilirsiniz');
    expect(rendered.html).toContain('Hızlı, Şeffaf Ve Değer Katarak');
    expect(rendered.html).toContain('yenilendik.');
    expect(rendered.html).toContain('Sizin İçin Ne Değişiyor?');
    expect(rendered.html).toContain('tedarikçi nerede?');
    expect(rendered.html).toContain('Platform ile Neler Yapabilirsiniz?');
    expect(rendered.html).toContain('<b style="font-weight:700;color:#123A63;">Dosya Yönetimi :</b>');
    expect(rendered.html).toContain('<b style="font-weight:700;color:#123A63;">Dijital Evrak ve Onay :</b>');
    expect(rendered.html).toContain('Otomatik Kapanış Raporu :');
    expect(rendered.html).toContain('Anket Sonuçları :');
    expect(rendered.html).toContain('Dijital onay sistemi ile zaman tasarrufu,');
    expect(rendered.html).not.toContain('✅');
    expect(rendered.html).toContain('✓');
    expect(rendered.html).not.toContain('Acil Asistans');
    expect(rendered.html).not.toContain('Asistans Firması');
    expect(rendered.html).not.toContain('Önemli — Acil Dosya Takibi');
    expect(rendered.html).not.toContain('Sayfanızda Öne Çıkanlar');
    expect(rendered.html).not.toContain('Canlı İzle');
    expect(rendered.html).not.toContain('Operasyon Birimi');
    expect(rendered.html).not.toContain('Hasar Dosyaları');
    expect(rendered.html).not.toContain('Operasyon Merkezi');
    expect(rendered.html).not.toContain('Finans Modülleri');
    expect(rendered.html).not.toContain('Operasyon Bildirimi');
    expect(rendered.html.split("Meridyen'e Giriş Yap").length - 1).toBe(1);
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
