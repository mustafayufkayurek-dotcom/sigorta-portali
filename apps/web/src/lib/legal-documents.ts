/**
 * Kamuoyu KVKK / gizlilik / çerez taslakları.
 * Personel-içi sözleşme şablonlarından ayrıdır (Ayarlar → Sözleşmeler).
 * Avukat onayı olmadan kesin hüküm sayılmaz.
 */

export const LEGAL_CONTROLLER_NAME = 'Meridyen Assistance';
export const LEGAL_CONTROLLER_NOTE = 'Safran Birleşik Hizmetler Yan Kuruluşudur';

export const KVKK_AYDINLATMA_SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Veri sorumlusu',
    body: [
      `${LEGAL_CONTROLLER_NAME} (${LEGAL_CONTROLLER_NOTE}) bu uygulama kapsamında kişisel verilerinizin işlenmesinden sorumludur.`,
      'Başvurularınızı, Ayarlar → Kurulum’da kayıtlı KVKK iletişim e-postası üzerinden iletebilirsiniz.',
    ],
  },
  {
    title: 'Hangi veriler işlenir',
    body: [
      'Kimlik ve iletişim: ad, soyad, telefon, e-posta.',
      'İş ve dosya: poliçe / dosya numarası, adres, hasar veya acil yardım konusu, evrak ve fotoğraf.',
      'Hesap: giriş kaydı, yetki, işlem geçmişi.',
      'Ödeme ve fatura bilgileri yalnızca ilgili işin gerektirdiği ölçüde.',
    ],
  },
  {
    title: 'Amaç ve hukuki sebep',
    body: [
      'Hasar onarım, acil yardım, tedarikçi ve finans süreçlerinin yürütülmesi.',
      'Hukuki dayanak: 6698 sayılı KVKK m. 5/2-c (sözleşmenin ifası), m. 5/2-ç (hukuki yükümlülük) ve m. 5/2-f (meşru menfaat).',
      'Pazarlama iletisi veya zorunlu olmayan çerez için ayrıca açık rıza alınır.',
    ],
  },
  {
    title: 'Aktarım',
    body: [
      'Veriler; ilgili sigorta / eksper / asistans, görevli tedarikçi, yasal merciler ve barındırma / e-posta hizmeti alınan iş ortaklarıyla, işin gereği ve KVKK m. 8 çerçevesinde paylaşılabilir.',
      'Yurt dışına aktarım ancak kanunun öngördüğü şartlarda yapılır.',
    ],
  },
  {
    title: 'Saklama',
    body: [
      'Veriler, işin ve yasal saklama sürelerinin gerektirdiği süre kadar tutulur; süre bitince silinir, yok edilir veya anonim hale getirilir.',
    ],
  },
  {
    title: 'Haklarınız (KVKK m. 11)',
    body: [
      'Verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, amaca uygunluğu sorgulama, yurt içi / yurt dışı aktarımı öğrenme, düzeltme, silme veya yok etme, itiraz ve zararın giderilmesini talep etme haklarına sahipsiniz.',
      'Başvuru yanıtsız kalırsa Kişisel Verileri Koruma Kurulu’na şikâyet hakkınız saklıdır.',
    ],
  },
];

export const GIZLILIK_SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Kapsam',
    body: [
      'Bu metin; web paneli, sigorta / eksper / asistans girişleri ve mobil kullanımda toplanan kişisel verilerin gizliliğini anlatır.',
    ],
  },
  {
    title: 'Güvenlik',
    body: [
      'Şifreler düz metin tutulmaz. Oturum çerezi HttpOnly’dir. İletişim TLS ile korunur.',
      'Yetkisiz kişiye veri verilmez. Personel yalnız görevinin gerektirdiği kayda erişir.',
    ],
  },
  {
    title: 'Çerezler',
    body: [
      'Giriş ve oturum için zorunlu çerezler kullanılır. Ayrıntı Çerez Politikası sayfasındadır.',
    ],
  },
  {
    title: 'Üçüncü taraflar',
    body: [
      'Harita, ödeme, e-posta veya depolama sağlayıcıları kendi gizlilik kurallarına da tabidir. Bu sağlayıcılara yalnız iş için gerekli veri gider.',
    ],
  },
];

export const CEREZ_SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Zorunlu çerezler',
    body: [
      'Giriş oturumu (meridyen_at, meridyen_rt) ve güvenlik için zorunludur. Bunlar olmadan panele girilemez.',
      'Bu çerezler reklam için kullanılmaz.',
    ],
  },
  {
    title: 'Tercih çerezleri',
    body: [
      '«Beni hatırla», tema ve «anladım» kayıtları tarayıcınızda tutulabilir. İstemezseniz tarayıcıdan silebilirsiniz; bazı kolaylıklar kaybolur.',
    ],
  },
  {
    title: 'Üçüncü taraf',
    body: [
      'Harita veya ödeme ekranı açılırsa ilgili sağlayıcının çerezi devreye girebilir. Bu durumda o sağlayıcının politikası da geçerlidir.',
    ],
  },
  {
    title: 'Yönetim',
    body: [
      'Tarayıcı ayarlarından çerezleri silebilirsiniz. Zorunlu oturum çerezini silerseniz yeniden giriş gerekir.',
    ],
  },
];

export const KVKK_ACIK_RIZA_LABEL =
  'KVKK Aydınlatma Metnini okudum. Kimlik ve iletişim bilgilerimin bu işin yürütülmesi amacıyla işlenmesini kabul ediyorum.';
