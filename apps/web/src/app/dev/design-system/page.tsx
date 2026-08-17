import { BarChart3, BellRing, FileText, FolderOpen } from 'lucide-react';
import { EmptyState, PageHeader, SectionCard, StatCard } from '@/components/ui';

export default function DesignSystemPreviewPage() {
  return (
    <main className="min-h-screen bg-surface-muted p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          breadcrumbs={[{ label: 'Geliştirme' }, { label: 'Design System' }]}
          title="Meridyen Design System"
          subtitle="Ortak enterprise bileşenleri ve tasarım tokenları."
          lastUpdated="25.07.2026"
          actions={
            <span className="rounded-button bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">
              Local Önizleme
            </span>
          }
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Açık Dosyalar" value={24} icon={FolderOpen} iconColor="blue" trend={{ value: 12, isPositive: true }} />
          <StatCard title="Onay Bekleyenler" value={6} icon={BellRing} iconColor="amber" trend={{ value: 4, isPositive: false }} />
          <StatCard title="Raporlar" value={18} icon={FileText} iconColor="purple" />
          <StatCard title="Tamamlananlar" value={148} icon={BarChart3} iconColor="green" trend={{ value: 8, isPositive: true }} />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <SectionCard
            title="Örnek Bölüm Kartı"
            action={<button className="text-sm font-semibold text-brand-600 hover:text-brand-700">Tümünü Gör</button>}
          >
            <div className="space-y-3 text-sm text-content-secondary">
              <p>Bu kart mevcut sayfaların akışını değiştirmeden ortak yüzey, kenarlık ve boşluk standardını sunar.</p>
              <div className="rounded-button border border-border bg-surface-muted px-4 py-3">
                Tokenlar: <code className="text-content-primary">surface</code>, <code className="text-content-primary">border</code>,{' '}
                <code className="text-content-primary">content</code>, <code className="text-content-primary">brand</code>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Boş Durum">
            <EmptyState
              icon={FolderOpen}
              title="Dosya Bulunamadı"
              description="Bu filtreye uygun kayıt yok. Filtreleri değiştirip tekrar deneyin."
              action={<button className="rounded-button bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">Filtreleri Temizle</button>}
            />
          </SectionCard>
        </section>
      </div>
    </main>
  );
}
