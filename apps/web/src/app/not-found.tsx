import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full text-center">
        <h1 className="text-9xl font-bold text-brand-600">404</h1>
        <h2 className="text-2xl font-semibold text-gray-900 mt-4 mb-2">Sayfa Bulunamadı</h2>
        <p className="text-gray-600 mb-8">
          Aradığınız sayfa mevcut değil veya taşınmış olabilir.
        </p>
        <Link
          href="/panel"
          className="inline-block bg-brand-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors font-medium"
        >
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}
