import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { LEGAL_CONTROLLER_NAME, LEGAL_CONTROLLER_NOTE } from '@/lib/legal-documents';

export function LegalDocumentPage({
  title,
  sections,
}: {
  title: string;
  sections: { title: string; body: string[] }[];
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <BrandLogo alt={LEGAL_CONTROLLER_NAME} variant="portal" />
          <Link href="/giris" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            Giriş
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{LEGAL_CONTROLLER_NAME}</p>
        <p className="mt-1 text-xs text-slate-400">{LEGAL_CONTROLLER_NOTE}</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">{title}</h1>
        <div className="mt-6 space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-800">{section.title}</h2>
              {section.body.map((p) => (
                <p key={p} className="mt-2 text-sm leading-relaxed text-slate-600">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
        <p className="mt-8 text-xs leading-relaxed text-slate-400">
          Bu metin operasyon taslağıdır. Şirket avukatı onaylamadan kesin hüküm sayılmaz. Personel sözleşmeleri
          Ayarlar → Sözleşmeler’deki kayıtlı metinlerdir.
        </p>
        <nav className="mt-6 flex flex-wrap gap-4 text-sm font-medium text-brand-700">
          <Link href="/kvkk">KVKK Aydınlatma</Link>
          <Link href="/gizlilik">Gizlilik</Link>
          <Link href="/cerez-politikasi">Çerez Politikası</Link>
        </nav>
      </main>
    </div>
  );
}
