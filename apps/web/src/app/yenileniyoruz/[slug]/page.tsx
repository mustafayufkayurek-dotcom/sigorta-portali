'use client';

import { notFound } from 'next/navigation';
import { FieldOperationsMap } from '@/components/operasyon/FieldOperationsMap';
import { YenileniyoruzChrome } from '../yenileniyoruz-chrome';
import { SITE_FEATURE_PAGES, type SiteFeatureSlug } from '../site-feature-pages';

export default function SiteFeaturePage({ params }: { params: { slug: string } }) {
  const page = SITE_FEATURE_PAGES[params.slug as SiteFeatureSlug];
  if (!page) notFound();

  if (page.map) {
    return (
      <YenileniyoruzChrome bandTitle={page.title} bandTeaser={page.teaser}>
        <main className="renewal-feature-page renewal-feature-page-map">
          <div className="renewal-feature-map">
            <FieldOperationsMap embed publicFilesOnly />
          </div>
        </main>
      </YenileniyoruzChrome>
    );
  }

  return (
    <YenileniyoruzChrome>
      <main className="renewal-feature-page">
        <p className="renewal-feature-kicker">Hasar Platformu</p>
        <h1 className="renewal-feature-title">{page.title}</h1>
        <p className="renewal-feature-teaser">{page.teaser}</p>
      </main>
    </YenileniyoruzChrome>
  );
}
