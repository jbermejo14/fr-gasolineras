import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPrixData } from '@/lib/prixSnapshot';
import { findRegionBySlug } from '@/lib/geo';
import { summarizeStations } from '@/lib/prixCarburants';
import { formatPrice } from '@/lib/format';
import { absoluteUrl, SITE_NAME } from '@/lib/site';
import { getBreadcrumbSchema } from '@/lib/seo';
import { stationCountLabel } from '@/lib/stationInsights';
import { AdSlot } from '@/components/AdSlot';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { DepartmentHero } from '@/components/DepartmentHero';
import { DepartmentCheapest } from '@/components/DepartmentCheapest';
import { DepartmentFuelComparison } from '@/components/DepartmentFuelComparison';
import { DepartmentCommunes } from '@/components/DepartmentCommunes';
import { DepartmentSiblings } from '@/components/DepartmentSiblings';

export const dynamicParams = false;

/** Una página por departamento con estaciones en el flujo de precios. */
export async function generateStaticParams() {
  const data = await getPrixData();
  return Array.from(data.departments.keys(), (departement) => ({ departement }));
}

interface PageProps {
  params: Promise<{ departement: string }>;
}

function departmentPath(slug: string): string {
  return `/departement/${slug}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { departement } = await params;
  const data = await getPrixData();
  const group = data.departments.get(departement);

  if (!group) {
    return { title: 'Département introuvable', robots: { index: false, follow: false } };
  }

  const summary = summarizeStations(group.stations);
  const averageGazole = summary.avg.gazole !== null ? ` : gazole à ${formatPrice(summary.avg.gazole)} en moyenne` : '';
  const minGazole = summary.min.gazole !== null ? ` Gazole dès ${formatPrice(summary.min.gazole)}.` : '';
  const minE10 = summary.min.e10 !== null ? ` SP95-E10 dès ${formatPrice(summary.min.e10)}.` : '';
  const title = `Prix des carburants dans le département ${group.department} (${group.code})${averageGazole}`;
  const description = `Comparez les prix de ${stationCountLabel(group.stations.length)}-service dans le département ${group.department} (${group.code}).${minGazole}${minE10} Détail par commune.`;
  const canonical = absoluteUrl(departmentPath(departement));

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', url: canonical, title, description, siteName: SITE_NAME },
  };
}

export default async function DepartmentPage({ params }: PageProps) {
  const { departement } = await params;
  const data = await getPrixData();
  const group = data.departments.get(departement);

  if (!group) {
    notFound();
  }

  const regionName = findRegionBySlug(group.regionSlug)?.name ?? '';
  const siblings = Array.from(data.departments.values()).filter(
    (other) => other.regionSlug === group.regionSlug && other.departmentSlug !== group.departmentSlug
  );
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Accueil', url: absoluteUrl('/') },
    { name: group.department, url: absoluteUrl(departmentPath(departement)) },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div className="space-y-6 md:space-y-8 min-w-0">
        <Breadcrumbs items={[{ name: group.department, href: departmentPath(departement) }]} />

        <DepartmentHero group={group} regionName={regionName} national={data.nationalStats} />

        <AdSlot />

        <DepartmentCheapest stations={group.stations} fuel="gazole" departmentName={group.department} />
        <DepartmentCheapest stations={group.stations} fuel="e10" departmentName={group.department} />
        <DepartmentFuelComparison group={group} national={data.nationalStats} />
        <DepartmentCommunes group={group} />
        <DepartmentSiblings regionName={regionName} siblings={siblings} />

        <AdSlot />
      </div>
    </>
  );
}
