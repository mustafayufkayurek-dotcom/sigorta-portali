export type HizmetSlug =
  | 'konut-ve-endustriyel-onarim'
  | 'sektore-ozel-yazilim'
  | 'eksper-koordinasyon-agi'
  | 'tum-turkiyede';

export type HizmetPageContent = {
  slug: HizmetSlug;
  path: string;
  title: string;
  eyebrow: string;
  lead: string;
  highlights: { title: string; text: string }[];
  steps: { title: string; text: string }[];
  closing: string;
};

export const HIZMET_PAGES: HizmetPageContent[] = [
  {
    slug: 'konut-ve-endustriyel-onarim',
    path: '/hizmetler/konut-ve-endustriyel-onarim',
    title: 'Konut ve Endüstriyel Onarım',
    eyebrow: 'Onarım Operasyonu',
    lead:
      'Hasardan sonra yaşam ve üretimi durdurmayan onarım. Konuttan tesise, tek elden yönetilen süreçle sigortalıyı ve şirketi aynı anda güvende tutarız.',
    highlights: [
      {
        title: 'Tek Elden Yönetim',
        text: 'Tespitten teslime kadar tüm onarım adımları tek sorumluluk altında ilerler. Dağınık tedarik ve takip yükü oluşmaz.',
      },
      {
        title: 'Konut + Endüstriyel',
        text: 'Daire, villa, işyeri ve tesis hasarlarında aynı disiplin; farklı risk tipine uygun ekipler ve yöntem.',
      },
      {
        title: 'Delilli İletişim',
        text: 'Her kritik adım kayıt altına alınır. Sigorta şirketi ve sigortalı aynı süreç görünürlüğünü paylaşır.',
      },
    ],
    steps: [
      { title: 'Hasar Bildirimi', text: 'Dosya açılır, risk tipi ve öncelik netleşir.' },
      { title: 'Saha Tespiti', text: 'Doğru ekipler yerinde inceler, kapsam belirlenir.' },
      { title: 'Onarım Yönetimi', text: 'İş programı, malzeme ve kalite kontrolü eşzamanlı yürür.' },
      { title: 'Teslim ve Kapanış', text: 'Sonuç doğrulanır, dosya güvenle kapatılır.' },
    ],
    closing: 'Hasar anında kaos değil; kontrollü, hızlı ve güvenilir onarım.',
  },
  {
    slug: 'sektore-ozel-yazilim',
    path: '/hizmetler/sektore-ozel-yazilim',
    title: 'Sektöre Özel Yazılım Hizmetleri',
    eyebrow: 'Operasyon Platformu',
    lead:
      'Hasar operasyonunu tek ekranda yönetin. Atama, takip, onay ve kapanış aynı akışta; karmaşa azalır, kontrol sizde kalır.',
    highlights: [
      {
        title: 'Tek Platform',
        text: 'Dosya, görev, onay ve iletişim dağınık araçlara bölünmez; operasyon tek merkezden akar.',
      },
      {
        title: 'Rol Bazlı Görünürlük',
        text: 'Her kullanıcı yalnızca işine yarayan ekranı görür. Karmaşa azalır, hız artar.',
      },
      {
        title: 'Kurumsal Takip',
        text: 'Kim, ne zaman, ne yaptı — süreç izlenebilir kalır.',
      },
    ],
    steps: [
      { title: 'Dosya Açılışı', text: 'Hasar kaydı saniyeler içinde sisteme girer.' },
      { title: 'Görev Dağılımı', text: 'Doğru kişiye doğru iş atanır.' },
      { title: 'Onay Akışı', text: 'Kritik adımlar görünür ve kontrollü ilerler.' },
      { title: 'Kapanış', text: 'Sonuç netleşir, dosya kapanır.' },
    ],
    closing: 'Yazılım öne çıkmaz; operasyon görünür olur.',
  },
  {
    slug: 'eksper-koordinasyon-agi',
    path: '/hizmetler/eksper-koordinasyon-agi',
    title: 'Eksper Koordinasyon Ağı',
    eyebrow: 'Saha Koordinasyonu',
    lead:
      'Doğru eksper, doğru zamanda, doğru dosyada. Koordinasyonu biz üstleniriz; saha ile masaüstü aynı dilde konuşur.',
    highlights: [
      {
        title: 'Doğru Eşleştirme',
        text: 'Branş, bölge ve dosya ihtiyacına göre en uygun eksper yönlendirilir.',
      },
      {
        title: 'Anlık Koordinasyon',
        text: 'Randevu, geri bildirim ve dosya durumu tek hat üzerinden ilerler.',
      },
      {
        title: 'Ortak Dil',
        text: 'Saha ve ofis aynı bilgiyle çalışır; gecikme ve yanlış anlaşılma azalır.',
      },
    ],
    steps: [
      { title: 'Dosya İhtiyacı', text: 'Eksper gereksinimi netleştirilir.' },
      { title: 'Eşleştirme', text: 'Uygun eksper seçilir ve yönlendirilir.' },
      { title: 'Saha Çalışması', text: 'Tespit ve rapor süreci takip edilir.' },
      { title: 'Geri Besleme', text: 'Sonuç dosyaya işlenir, sonraki adım açılır.' },
    ],
    closing: 'Eksper ağı dağınık liste değil; yönetilen bir operasyon gücüdür.',
  },
  {
    slug: 'tum-turkiyede',
    path: '/hizmetler/tum-turkiyede',
    title: "Tüm Türkiye'deyiz",
    eyebrow: 'Ulusal Kapasite',
    lead:
      'İl sınırına takılmayan müdahale gücü. Türkiye genelinde aynı standart, aynı hız, aynı güvenilir sonuç.',
    highlights: [
      {
        title: 'Ulusal Kapsama',
        text: 'Büyükşehirden ilçeye kadar aynı operasyon standardı uygulanır.',
      },
      {
        title: 'Yerel Hız',
        text: 'Bölgesel ekiplerle müdahale süresi kısaltılır.',
      },
      {
        title: 'Tek Standart',
        text: 'Coğrafya değişir; kalite ve raporlama dili değişmez.',
      },
    ],
    steps: [
      { title: 'Bildirim', text: 'Hasar nerede olursa olsun dosya açılır.' },
      { title: 'Bölge Ataması', text: 'En uygun saha kapasitesi devreye girer.' },
      { title: 'Yerinde Müdahale', text: 'Tespit ve onarım süreci başlar.' },
      { title: 'Merkezi Kontrol', text: 'Sonuç tek platformda izlenir ve kapanır.' },
    ],
    closing: 'Türkiye’nin her noktasında aynı Meridyen güveni.',
  },
];

export function getHizmetBySlug(slug: string): HizmetPageContent | undefined {
  return HIZMET_PAGES.find((p) => p.slug === slug);
}

export function getHizmetAbsoluteUrl(path: string, origin?: string): string {
  const base =
    origin ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://app.meridyen-tr.com');
  return `${base.replace(/\/$/, '')}${path}`;
}
