import { notFound } from 'next/navigation';
import { HizmetMarketingPage } from '@/components/marketing/HizmetMarketingPage';
import { getHizmetBySlug, HIZMET_PAGES } from '@/lib/marketing-hizmetler';

type PageProps = {
  params: { slug: string };
};

export function generateStaticParams() {
  return HIZMET_PAGES.map((page) => ({ slug: page.slug }));
}

export function generateMetadata({ params }: PageProps) {
  const content = getHizmetBySlug(params.slug);
  if (!content) return { title: 'Meridyen Assistance' };
  return {
    title: `${content.title} | Meridyen Assistance`,
    description: content.lead,
  };
}

export default function HizmetSlugPage({ params }: PageProps) {
  const content = getHizmetBySlug(params.slug);
  if (!content) notFound();
  return <HizmetMarketingPage content={content} />;
}
