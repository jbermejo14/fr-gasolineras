import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPrixData } from '@/lib/prixSnapshot';
import { summarizeStations } from '@/lib/prixCarburants';
import { absoluteUrl, SITE_NAME } from '@/lib/site';
import { getBreadcrumbSchema } from '@/lib/seo';
import { nearbyCommunes, sortStationsByPrice, elideA } from '@/lib/stationInsights';
import { buildCommuneDescription, buildCommuneTitle } from '@/lib/pageTitles';
import { toLightStation } from '@/lib/stationPayload';
import { AdSlot } from '@/components/AdSlot';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ClientMapWrapper } from '@/components/ClientMapWrapper';
import { StationCard } from '@/components/StationCard';
import { CommuneHero } from '@/components/CommuneHero';
import { CommuneTable } from '@/components/CommuneTable';
import { CommuneNearby } from '@/components/CommuneNearby';

export const dynamicParams = false;

/** Zoom inicial del mapa de un municipio. */
const COMMUNE_MAP_ZOOM = 13;

/** Una página por municipio con estaciones en el flujo de precios. */
export async function generateStaticParams() {
  const data = await getPrixData();
  return Array.from(data.communes.values(), (commune) => ({
    departement: commune.departmentSlug,
    commune: commune.communeSlug,
  }));
}

interface PageProps {
  params: Promise<{ departement: string; commune: string }>;
}

function communePath(departement: string, commune: string): string {
  return `/departement/${departement}/${commune}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { departement, commune } = await params;
  const data = await getPrixData();
  const group = data.communes.get(`${departement}/${commune}`);
  const department = data.departments.get(departement);

  if (!group || !department) {
    return { title: 'Commune introuvable', robots: { index: false, follow: false } };
  }

  const summary = summarizeStations(group.stations);
  const title = buildCommuneTitle({ city: group.city, departmentCode: department.code });
  const description = buildCommuneDescription({
    city: group.city,
    department: group.department,
    stationCount: group.stations.length,
    minGazole: summary.min.gazole,
    minE10: summary.min.e10,
  });
  const canonical = absoluteUrl(communePath(departement, commune));

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', url: canonical, title, description, siteName: SITE_NAME },
  };
}

export default async function CommunePage({ params }: PageProps) {
  const { departement, commune } = await params;
  const data = await getPrixData();
  const group = data.communes.get(`${departement}/${commune}`);
  const department = data.departments.get(departement);

  if (!group || !department || group.stations.length === 0) {
    notFound();
  }

  const sortedStations = sortStationsByPrice(group.stations, 'gazole');
  const lightStations = sortedStations.map(toLightStation);
  const nearby = nearbyCommunes(group, department.communes);
  const breadcrumbs = [
    { name: group.department, href: `/departement/${departement}` },
    { name: group.city, href: communePath(departement, commune) },
  ];
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Accueil', url: absoluteUrl('/') },
    ...breadcrumbs.map((item) => ({ name: item.name, url: absoluteUrl(item.href) })),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div className="space-y-6 md:space-y-8 min-w-0">
        <Breadcrumbs items={breadcrumbs} />

        <CommuneHero
          commune={group}
          departmentCode={department.code}
          departmentSummary={summarizeStations(department.stations)}
        />

        <CommuneTable city={group.city} stations={sortedStations} />

        <AdSlot />

        <div className="space-y-4">
          <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)]">Détail des stations {elideA(group.city)}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lightStations.map((station, index) => (
              <StationCard key={station.id} station={station} selectedFuel="gazole" isCheapest={index === 0} />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)]">Carte des stations-service {elideA(group.city)}</h2>
          <ClientMapWrapper
            stations={lightStations}
            selectedFuel="gazole"
            initialCenter={[lightStations[0].lat, lightStations[0].lon]}
            initialZoom={COMMUNE_MAP_ZOOM}
          />
        </div>

        <CommuneNearby city={group.city} nearby={nearby} />

        <AdSlot />
      </div>
    </>
  );
}
