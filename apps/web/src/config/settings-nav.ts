import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  BookOpenText,
  Building2,
  FileCog,
  GitBranch,
  Landmark,
  Layers3,
  MessageSquareText,
  Receipt,
  ScrollText,
  Settings,
  HardDrive,
  KeyRound,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  TestTube2,
  UserCog,
  Users,
} from 'lucide-react';

export interface SettingsNavLink {
  title: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  /** Hub kartında yalnızca yetkili kullanıcıya göster */
  requiresTestNotesAccess?: boolean;
}

export interface SettingsNavGroup {
  title: string;
  description: string;
  icon: LucideIcon;
  links: SettingsNavLink[];
}

/** Ayarlar hub kartları — tek kaynak (sol menüde alt liste yok) */
export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    title: 'Kurulum ve Yetki',
    description: 'Sistem kimliği, iletişim, kullanıcılar ve güvenlik.',
    icon: UserCog,
    links: [
      { title: 'Şirket Bilgileri', href: '/panel/ayarlar/sirket-bilgileri', icon: Building2, description: 'Unvan, iletişim, logo ve KVKK bilgileri.' },
      { title: 'Mail ve Bildirim Merkezi', href: '/panel/ayarlar/e-posta-bildirimleri', icon: Bell, description: 'SMTP kurulumu, test maili ve e-posta bildirim kuralları.' },
      { title: 'Yedek Sağlığı', href: '/panel/ayarlar/yedek-sagligi', icon: HardDrive, description: 'Veritabanı ve fotoğraf yedeğinin off-site sağlık durumu.' },
      { title: 'Entegrasyon Merkezi', href: '/panel/ayarlar/entegrasyonlar', icon: Settings, description: 'SMS sağlayıcısı, TÜRMOB ve Logo Wings ERP bağlantıları.' },
      { title: 'Sözleşmeler', href: '/panel/ayarlar/sozlesmeler', icon: ScrollText, description: 'Kullanıcı onay metinleri.' },
      { title: 'Kullanıcılar', href: '/panel/kullanicilar', icon: Users, description: 'Davet, geçici şifre ve arşiv.' },
      { title: 'Yetkilendirme', href: '/panel/ayarlar/yetkilendirme', icon: KeyRound, description: 'Kimlerin hangi işlemleri yapabileceğini yönetin.' },
      { title: 'Roller', href: '/panel/ayarlar/roller', icon: ShieldCheck, description: 'Rol adları ve kullanıcı sayıları.' },
      { title: 'Alan Zorunlulukları', href: '/panel/ayarlar/alan-zorunluluklari', icon: SlidersHorizontal, description: 'Form alanı zorunluluk ve görünürlük.' },
      { title: 'Test Notları / Görev Takip', href: '/panel/ayarlar/test-notlari-gorev-takip', icon: TestTube2, description: 'Canlı geri bildirim ve görev takibi.', requiresTestNotesAccess: true },
    ],
  },
  {
    title: 'Operasyon Tanımları',
    description: 'Dosya, konu, durum ve evrak tanımları.',
    icon: BookOpenText,
    links: [
      { title: 'Tanımlar Merkezi', href: '/panel/ayarlar/tanimlar', icon: BookOpenText, description: 'Tüm tanım sözlükleri: departman, ilişki türü, dosya konusu, evrak, iş grubu, mahal, tedarikçi hizmet kolu, müşteri tipi, personel izin türü.' },
      { title: 'Sigorta ve Asistans Firmaları', href: '/panel/ayarlar/sigorta-sirketleri', icon: Building2, description: 'Sigorta şirketi ve asistans firması tanımlarını iki sekmede yönetin.' },
      { title: 'Eksper–Sigorta İlişkileri', href: '/panel/ayarlar/eksper-sigorta-iliskileri', icon: GitBranch, description: 'Eksper firması ↔ sigorta şirketi dosya kapsam matrisi.' },
      { title: 'Durumlar', href: '/panel/ayarlar/durumlar', icon: GitBranch, description: 'Dosya durumları ve süreç sırası.' },
      { title: 'Eskalasyon Kuralları', href: '/panel/ayarlar/eskalasyon-kurallari', icon: Bell, description: 'SLA ve eskalasyon bildirim kuralları.' },
    ],
  },
  {
    title: 'Hizmet, Maliyet ve Bölge',
    description: 'Saha hizmetleri, fiyat ve maliyet kırılımları.',
    icon: Layers3,
    links: [
      { title: 'Fiyat Listesi', href: '/panel/ayarlar/fiyat-listesi', icon: Receipt, description: 'Birim fiyat ve iş kalemleri.' },
      { title: 'Masraf Kategorileri', href: '/panel/ayarlar/masraf-kategorileri', icon: Tags, description: 'Masraf grubu ve alt grup hiyerarşisi.' },
      { title: 'Bölgesel Zamlar', href: '/panel/ayarlar/bolgesel-zamlar', icon: Landmark, description: 'Bölge bazlı fiyat etkileri.' },
    ],
  },
  {
    title: 'Doküman ve Şablon',
    description: 'Rapor ve sistem şablonları.',
    icon: FileCog,
    links: [
      { title: 'Şablonlar', href: '/panel/ayarlar/sablonlar', icon: FileCog, description: 'Sistem şablonları.' },
      { title: 'Mesaj Şablonları', href: '/panel/ayarlar/sms-bildirimler', icon: MessageSquareText, description: 'Hasar, Acil Yardım, Özel Müşteri WhatsApp ve SMS şablonları.' },
    ],
  },
];

/** Eski URL yönlendirmeleri */
export const SETTINGS_LEGACY_REDIRECTS: Record<string, string> = {
  '/panel/ayarlar/kurulum': '/panel/ayarlar/sirket-bilgileri',
  '/panel/ayarlar/mail-kurulum': '/panel/ayarlar/e-posta-bildirimleri',
  '/panel/ayarlar/hizmet-branslari': '/panel/ayarlar/dosya-konulari',
  '/panel/ayarlar/hizmet-turleri': '/panel/ayarlar/dosya-konulari',
  '/panel/ayarlar/ihbar-konulari': '/panel/ayarlar/dosya-konulari',
  '/panel/ayarlar/musteri-gruplari': '/panel/ayarlar/tanimlar',
  '/panel/ayarlar/musteri-gruplari/sigorta-sirketleri': '/panel/musteriler?openAdd=1&subType=sigorta_sirketi&entityType=corporate',
  '/panel/ayarlar/musteri-gruplari/broker-firmalari': '/panel/musteriler?openAdd=1&subType=broker_firmasi&entityType=corporate',
  '/panel/ayarlar/musteri-gruplari/eksper-firmalari': '/panel/musteriler?openAdd=1&subType=eksper_firmasi&entityType=corporate',
  '/panel/ayarlar/musteri-gruplari/asistans-firmalar': '/panel/ayarlar/sigorta-sirketleri?tab=asistans',
  '/panel/ayarlar/musteri-gruplari/eksper-sigorta-iliskileri': '/panel/ayarlar/eksper-sigorta-iliskileri',
  '/panel/ayarlar/saha-tespit-kollari': '/panel/ayarlar/tanimlar',
  '/panel/ayarlar/tedarikciler': '/panel/tedarikciler',
  '/panel/ayarlar/fiyat-yonetimi': '/panel/ayarlar/fiyat-listesi',
  '/panel/ayarlar/sozlesme-sablonu': '/panel/ayarlar/sozlesme-sablonlari',
};

export function flattenSettingsNavLinks(): SettingsNavLink[] {
  return SETTINGS_NAV_GROUPS.flatMap((g) => g.links);
}
