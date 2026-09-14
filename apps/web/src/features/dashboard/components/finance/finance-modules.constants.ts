import { FINANS_KART_YOL } from '@/utils/finans-merkez-kart';

export type FinanceModuleItem = {
  title: string;
  href: string;
  purpose: string;
  action: string;
};

export const FINANCE_MODULES: FinanceModuleItem[] = [
  {
    title: 'Satış Fatura Talepleri',
    href: FINANS_KART_YOL.faturaTalepleri,
    purpose: 'Dosya kapanışından gelen kesilecek satış işi. Resmi fatura başka programda kesilir.',
    action: 'Resmi fatura numarasını yazın; iş Faturalandı görünür ve Faturalar sayfasına geçer.',
  },
  {
    title: 'Tedarikçi Ödeme Kuyruğu',
    href: FINANS_KART_YOL.tedarikciOdeme,
    purpose: 'Tedarikçi hakediş ve avans. Ayrı sayfa değildir; Tahsilatlar içindeki Tedarikçi Ödeme Kuyruğu sekmesidir.',
    action: 'Bekleyen ve vadesi gelen ödemeyi bu sekmede işaretleyin.',
  },
  {
    title: 'Tahsilatlar ve Ödemeler',
    href: '/panel/finans/tahsilatlar',
    purpose: 'Tahsilat ve tedarikçi ödemesi aynı sayfada durur. Tedarikçi işi Tedarikçi Ödeme Kuyruğu sekmesindedir.',
    action: 'Sekmelerden tahsilat, tedarikçi ödeme, vadesi gelen ve tamamlananı açın.',
  },
  {
    title: 'Faturalar',
    href: '/panel/finans/faturalar',
    purpose: 'Kesilmiş satış ve alış belgesi. Satış Fatura Talepleri ayrı sayfadır.',
    action: 'Satış veya alış süzgeciyle kesin kaydı açın. Tedarikçi ödemesi burada değildir.',
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
    purpose: 'Seçilen aydaki satış eksi alış KDV. Fatura yoksa sıfır doğrudur. Resmi beyanname değildir.',
    action: 'Dönemi Faturalar’daki aya göre seçin; mahsup özetini okuyun.',
  },
  {
    title: 'Kârlılık Analizi',
    href: '/panel/finans/karlilik',
    purpose: 'Gelir, gider ve net sonuç farkını yorumlar.',
    action: 'Dosya veya dönem bazlı kârlılık kontrol edilir.',
  },
];
