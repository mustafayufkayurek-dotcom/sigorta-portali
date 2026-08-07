import { notFound } from 'next/navigation';
import Link from 'next/link';

/**
 * Mock önizleme kaldırıldı — yanlış ürün kararına zemin hazırlıyordu.
 * Lokal onay yalnızca gerçek Hasar / Acil dosya detayında verilir.
 */
export default function ManuelKararBandiRetiredPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main className="min-h-screen bg-surface px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-border bg-white p-6 shadow-sm">
        <p className="text-xs font-medium text-content-tertiary">Geliştirme</p>
        <h1 className="text-xl font-semibold text-content-primary">Manuel Karar — Gerçek Sayfada</h1>
        <p className="text-sm leading-relaxed text-content-secondary">
          Ayrı mock sayfa kullanılmaz. Band, Hasar ve Acil dosya detayına bağlandı. Lokal onayı
          giriş yaptıktan sonra gerçek bir dosyada verin.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-content-secondary">
          <li>
            <Link href="/giris" className="font-semibold text-brand-600 hover:text-brand-700">
              Giriş
            </Link>
            {' '}
            (Meridyen personeli)
          </li>
          <li>
            <Link href="/panel/hasar-dosyalari" className="font-semibold text-brand-600 hover:text-brand-700">
              Hasar Dosyaları
            </Link>
            {' '}
            → bir dosya aç → sağ üst üç nokta (İşlemler): Rapora Git, Revizyon Geçmişi, Manuel Karar
          </li>
          <li>
            <Link href="/panel/acil-yardim" className="font-semibold text-brand-600 hover:text-brand-700">
              Acil Yardım
            </Link>
            {' '}
            → bir dosya aç → sağ üst üç nokta → Manuel Karar
          </li>
        </ol>
        <p className="text-xs text-content-tertiary">
          Portal rollerinde band görünmez. Deploy bu adımda yok.
        </p>
      </div>
    </main>
  );
}
