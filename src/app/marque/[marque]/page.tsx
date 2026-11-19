import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPrixData } from '@/lib/prixSnapshot';
import { findBrandGroupBySlug } from '@/lib/brands';
import { summarizeBrandDepartments } from '@/lib/brandInsights';
import { summarizeStations } from '@/lib/prixCarburants';
import { absoluteUrl, SITE_NAME } from '@/lib/site';
import { getBreadcrumbSchema } from '@/lib/seo';
import { buildBrandDescription, buildBrandTitle } from '@/lib/pageTitles';
import { AdSlot } from '@/components/AdSlot';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { BrandHero } from '@/components/BrandHero';
import { BrandCheapest } from '@/components/BrandCheapest';
import { BrandDepartments } from '@/components/BrandDepartments';
import { BrandSeoText } from '@/components/BrandSeoText';

export const dynamicParams = false;

/** Una página por red con al menos una estación en el flujo de precios. */
export async function generateStaticParams() {
  const data = await getPrixData();
  return Array.from(data.brands.keys(), (marque) => ({ marque }));
}

interface PageProps {
  params: Promise<{ marque: string }>;
}

function brandPath(slug: string): string {
  return `/marque/${slug}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { marque } = await params;
  const data = await getPrixData();
  const group = findBrandGroupBySlug(marque);
  const stations = data.brands.get(marque);

  if (!group || !stations) {
    return { title: 'Enseigne introuvable', robots: { index: false, follow: false } };
  }

  const summary = summarizeStations(stations);
  const title = buildBrandTitle({ name: group.name, averageGazole: summary.avg.gazole });
  const description = buildBrandDescription({
    name: group.name,
    stationCount: stations.length,
    minGazole: summary.min.gazole,
    minE10: summary.min.e10,
  });
  const canonical = absoluteUrl(brandPath(marque));

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', url: canonical, title, description, siteName: SITE_NAME },
  };
}

export default async function BrandPage({ params }: PageProps) {
  const { marque } = await params;
  const data = await getPrixData();
  const group = findBrandGroupBySlug(marque);
  const stations = data.brands.get(marque);

  if (!group || !stations) {
    notFound();
  }

  const summary = summarizeStations(stations);
  const rows = summarizeBrandDepartments(stations);
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Accueil', url: absoluteUrl('/') },
    { name: 'Enseignes', url: absoluteUrl('/marque') },
    { name: group.name, url: absoluteUrl(brandPath(marque)) },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div className="space-y-6 md:space-y-8 min-w-0">
        <Breadcrumbs
          items={[
            { name: 'Enseignes', href: '/marque' },
            { name: group.name, href: brandPath(marque) },
          ]}
        />

        <BrandHero group={group} summary={summary} national={data.nationalStats} />

        <AdSlot />

        <BrandCheapest stations={stations} fuel="gazole" brandName={group.name} />
        <BrandCheapest stations={stations} fuel="e10" brandName={group.name} />
        <BrandDepartments rows={rows} brandName={group.name} />
        <BrandSeoText group={group} summary={summary} rows={rows} national={data.nationalStats} />

        <AdSlot />
      </div>
    </>
  );
}
