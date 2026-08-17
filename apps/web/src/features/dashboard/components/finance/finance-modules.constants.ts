export type FinanceModuleItem = {
  title: string;
  href: string;
  purpose: string;
  action: string;
};

export const FINANCE_MODULES: FinanceModuleItem[] = [
  {
    title: 'Satış Fatura Talepleri',
    href: '/panel/finans/faturalar?tab=talepler',
    purpose: 'Kapanan hasar, acil yardım ve özel müşteri dosyalarından gelen kesilecek satış fatura taleplerini toplar.',
    action: 'Onay bekleyen ve kesime hazır talepleri inceleyin; faturayı kesince durumu güncelleyin.',
  },
  {
    title: 'Tedarikçi Ödeme Kuyruğu',
    href: '/panel/finans/tahsilatlar?queue=payable',
    purpose: 'Hakediş onayı, avans ve kapanan dosya tedarikçi ödemelerinin biriktiği giden ödeme kuyruğu.',
    action: 'Bekleyen ve vadesi gelen ödemeleri dosya bazında takip edin.',
  },
  {
    title: 'Tahsilatlar ve Ödemeler',
    href: '/panel/finans/tahsilatlar',
    purpose: 'Gelir ve gider kuyruklarını takip eder; tahsilat dosyada, tedarikçi ödemeleri hakediş onayından düşer.',
    action: 'Tahsilat / ödeme kuyruğu, vadesi gelenler ve tamamlanan hareketler burada listelenir.',
  },
  {
    title: 'Faturalar',
    href: '/panel/finans/faturalar',
    purpose: 'Kesilen faturalar ile sahadan gelen fatura taleplerini tek yerden yönetir.',
    action: 'Özet kartlarından durumu görün; kesilen faturalar ve bekleyen talepleri aynı sayfada inceleyin.',
  },
  {
    title: 'Masraflar',
    href: '/panel/finans/masraflar',
    purpose: 'Dosya bütçesi ve ek iş masraflarını dosya bazında izler.',
    action: 'Masraf kalemi dosyaya bağlanır, kategori ipucuna göre kaydedilir.',
  },
  {
    title: 'Carilerim',
    href: '/panel/carilerim',
    purpose: 'Atanmış müşteri ve dosya ilişkilerini tek yerde gösterir.',
    action: 'Müşteri dosyaları hızlıca açılır ve operasyon geçmişi izlenir.',
  },
  {
    title: 'Sabit Giderler',
    href: '/panel/finans/sabit-giderler',
    purpose: 'Dönemsel işletme giderlerini finans izlemeye dahil eder.',
    action: 'Havuzdan aktarım ve ay sonu dosya dağıtımı burada yapılır.',
  },
  {
    title: 'KDV Raporu',
    href: '/panel/finans/kdv-raporu',
    purpose: 'Satış ve alış faturalarından KDV mahsupu; mali müşavir denetimi.',
    action: 'Fatura mahsupu, satış/alış ayrımı veya operasyonel karşılaştırma modunu seçin.',
  },
  {
    title: 'Kârlılık Analizi',
    href: '/panel/finans/karlilik',
    purpose: 'Gelir, gider ve net sonuç farkını yorumlar.',
    action: 'Dosya veya dönem bazlı kârlılık kontrol edilir.',
  },
];
