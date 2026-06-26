"use client";

import Link from "next/link";
import {
  Bell,
  BookOpenText,
  Building2,
  ClipboardList,
  FileCog,
  FileText,
  GitBranch,
  Landmark,
  Layers3,
  Mail,
  MapPin,
  MessageSquareText,
  PackageCheck,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  TestTube2,
  Users,
  Wrench,
} from "lucide-react";

const groups = [
  {
    title: "Kurulum ve Yetki",
    description: "Sistem kimliği, kullanıcı rolleri ve güvenlik kuralları.",
    items: [
      { title: "Kullanıcılar", href: "/panel/kullanicilar", icon: Users, description: "Kullanıcı davet et, geçici şifre üret ve arşiv yönetimi." },
      { title: "Kurulum", href: "/panel/ayarlar/kurulum", icon: Settings, description: "Tema, logo ve temel sistem ayarları." },
      { title: "Şirket Bilgileri", href: "/panel/ayarlar/sirket-bilgileri", icon: Building2, description: "Meridyen + opsiyonel Safran bilgileri; sözleşmelere otomatik yansır." },
      { title: "Roller", href: "/panel/ayarlar/roller", icon: ShieldCheck, description: "Rol ve yetki tanımları." },
      { title: "Alan Zorunlulukları", href: "/panel/ayarlar/alan-zorunluluklari", icon: SlidersHorizontal, description: "Form alanlarının zorunluluk ve görünürlük ayarları." },
      { title: "Test Notları / Görev Takip", href: "/panel/ayarlar/test-notlari-gorev-takip", icon: TestTube2, description: "Geçici test notları, kararlar ve iş takip ekranı." },
    ],
  },
  {
    title: "Operasyon Tanımları",
    description: "Dosya, konu, durum ve hizmet tanımları.",
    items: [
      { title: "Tanımlar", href: "/panel/ayarlar/tanimlar", icon: BookOpenText, description: "Operasyon temel tanımları." },
      { title: "Departmanlar", href: "/panel/ayarlar/departmanlar", icon: Building2, description: "Departman ve sorumluluk yapısı." },
      { title: "Dosya Konuları", href: "/panel/ayarlar/dosya-konulari", icon: ClipboardList, description: "Dosya açılışında kullanılan konu listeleri." },
      { title: "İhbar Konuları", href: "/panel/ayarlar/ihbar-konulari", icon: MessageSquareText, description: "İhbar ve konu seçimleri." },
      { title: "Durumlar", href: "/panel/ayarlar/durumlar", icon: GitBranch, description: "Dosya durumları ve süreç sıraları." },
      { title: "Evrak Türleri", href: "/panel/ayarlar/evrak-turleri", icon: FileText, description: "Dosya ve tedarikçi evrak sınıfları." },
    ],
  },
  {
    title: "Hizmet, Maliyet ve Bölge",
    description: "Saha hizmetleri, fiyat ve maliyet kırılımları.",
    items: [
      { title: "İş Grupları", href: "/panel/ayarlar/is-gruplari", icon: Layers3, description: "İş grubu ve alt iş grubu yapısı." },
      { title: "Hizmet Branşları", href: "/panel/ayarlar/hizmet-branslari", icon: PackageCheck, description: "Hizmet branş tanımları." },
      { title: "Hizmet Türleri", href: "/panel/ayarlar/hizmet-turleri", icon: Wrench, description: "Hizmet türleri ve operasyon sınıfları." },
      { title: "Fiyat Listesi", href: "/panel/ayarlar/fiyat-listesi", icon: Receipt, description: "Birim fiyat ve iş kalemi yönetimi." },
      { title: "Masraf Kategorileri", href: "/panel/ayarlar/masraf-kategorileri", icon: Tags, description: "Masraf ve alt kategori tanımları." },
      { title: "Mahaller", href: "/panel/ayarlar/mahaller", icon: MapPin, description: "Adres ve mahal kırılımları." },
      { title: "Bölgesel Zamlar", href: "/panel/ayarlar/bolgesel-zamlar", icon: Landmark, description: "Bölge bazlı fiyat etkileri." },
    ],
  },
  {
    title: "Cari, Bildirim ve Doküman",
    description: "Sigorta şirketleri, tedarikçiler, bildirimler ve şablonlar.",
    items: [
      { title: "Sigorta Şirketleri", href: "/panel/ayarlar/sigorta-sirketleri", icon: Building2, description: "Sigorta şirketi tanımları." },
      { title: "Tedarikçiler", href: "/panel/ayarlar/tedarikciler", icon: Users, description: "Tedarikçi ayarları ve bağlantılı tanımlar." },
      { title: "Müşteri Tipleri", href: "/panel/ayarlar/musteri-tipleri", icon: Users, description: "Müşteri sınıfları." },
      { title: "Mail Kurulum", href: "/panel/ayarlar/mail-kurulum", icon: Mail, description: "E-posta gönderim ayarları." },
      { title: "E-posta Bildirimleri", href: "/panel/ayarlar/e-posta-bildirimleri", icon: Bell, description: "E-posta olayları ve bildirim ayarları." },
      { title: "SMS Bildirimleri", href: "/panel/ayarlar/sms-bildirimler", icon: MessageSquareText, description: "SMS bildirim ayarları." },
      { title: "Şablonlar", href: "/panel/ayarlar/sablonlar", icon: FileCog, description: "Sistem şablonları." },
      { title: "Sözleşmeler", href: "/panel/ayarlar/sozlesmeler", icon: ScrollText, description: "Kullanıcı onay metinleri." },
    ],
  },
];

export default function AyarlarPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-[1500px] space-y-8">
        <section className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Yönetim Merkezi</p>
            <h1 className="mt-2 text-3xl font-bold">Ayarlar</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
              Sistem kuralları, operasyon tanımları, bildirimler ve geçici test takip ekranlarına tek merkezden erişin.
            </p>
          </div>
          <Link
            href="/panel"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            Dashboard&apos;a Dön
          </Link>
        </section>

        <div className="grid gap-6">
          {groups.map((group) => (
            <section key={group.title} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{group.title}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{group.description}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group min-h-[132px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/40"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-500/10">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                          <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{item.description}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
