import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LineChart, MapPin } from 'lucide-react';
import { getPrixData } from '@/lib/prixSnapshot';
import {
  parseStationPathSlug,
  stationPath,
  type PrixSnapshot,
  type Station,
} from '@/lib/prixCarburants';
import { formatPrice } from '@/lib/format';
import { absoluteUrl, SITE_NAME } from '@/lib/site';
import { getBreadcrumbSchema, getGasStationSchema } from '@/lib/seo';
import { nearbyStations, savingsReferences, stationSummary } from '@/lib/stationInsights';
import { stationHeading } from '@/lib/stationHeading';
import { toLightStation } from '@/lib/stationPayload';
import { AdSlot } from '@/components/AdSlot';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ClientMapWrapper } from '@/components/ClientMapWrapper';
import { StationHero } from '@/components/StationHero';
import { StationSavings } from '@/components/StationSavings';
import { StationPrices } from '@/components/StationPrices';
import { StationHours } from '@/components/StationHours';
import { StationServices } from '@/components/StationServices';
import { StationNearby } from '@/components/StationNearby';
import { StationHistory } from '@/components/StationHistory';

export const dynamicParams = false;

/** Zoom del mapa de la ficha: nivel de calle. */
const STATION_MAP_ZOOM = 16;
const STATION_ROUTE_PREFIX = '/station/';
const NOT_FOUND_METADATA: Metadata = { title: 'Station introuvable', robots: { index: false, follow: false } };

/** Una página por estación del flujo de precios: /station/<id>-<slug>. */
export async function generateStaticParams() {
  const data = await getPrixData();
  return data.stations.map((station) => ({ slug: stationPath(station).slice(STATION_ROUTE_PREFIX.length) }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

function findStation(data: PrixSnapshot, slug: string): Station | null {
  const id = parseStationPathSlug(slug);
  return id === null ? null : (data.stationsById.get(id) ?? null);
}

function stationMetaDescription(station: Station): string {
  const { gazole, e10 } = station.prices;
  return [
    `Prix des carburants à la station-service ${station.address}, ${station.postalCode} ${station.city}.`,
    gazole !== null ? `Gazole : ${formatPrice(gazole)}.` : '',
    e10 !== null ? `SP95-E10 : ${formatPrice(e10)}.` : '',
    station.is24h ? 'Automate 24/24.' : '',
    'Horaires, services et itinéraire.',
  ]
    .filter(Boolean)
    .join(' ');
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const station = findStation(await getPrixData(), slug);
  if (!station) return NOT_FOUND_METADATA;

  const canonical = absoluteUrl(stationPath(station));
  const title = `${stationHeading(station)} : prix des carburants aujourd'hui`;
  const description = stationMetaDescription(station);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', url: canonical, title, description, siteName: SITE_NAME },
  };
}

export default async function StationPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getPrixData();
  const station = findStation(data, slug);

  if (!station) {
    notFound();
  }

  const path = stationPath(station);
  const communeStations = data.communes.get(`${station.departmentSlug}/${station.communeSlug}`)?.stations ?? [station];
  const departmentStations = data.departments.get(station.departmentSlug)?.stations ?? [station];
  const communeHref = `/departement/${station.departmentSlug}/${station.communeSlug}`;
  const breadcrumbs = [
    { name: station.department, href: `/departement/${station.departmentSlug}` },
    { name: station.city, href: communeHref },
    { name: station.address, href: path },
  ];
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Accueil', url: absoluteUrl('/') },
    ...breadcrumbs.map((item) => ({ name: item.name, url: absoluteUrl(item.href) })),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(getGasStationSchema(station, absoluteUrl(path))) }}
      />

      <div className="space-y-6 md:space-y-8 min-w-0">
        <Breadcrumbs items={breadcrumbs} />

        <StationHero station={station} summary={stationSummary(station, communeStations)} />
        <StationSavings station={station} references={savingsReferences(communeStations, departmentStations, data.nationalStats)} />
        <StationPrices station={station} />
        <StationHours station={station} />
        <StationServices services={station.services} />
        <StationNearby station={station} nearby={nearbyStations(station, departmentStations)} />

        <AdSlot />

        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-6 shadow-sm space-y-4">
          <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
            <LineChart className="w-5 h-5 text-[var(--orange-primary)]" />
            <span>Évolution du prix dans cette station</span>
          </h2>
          <StationHistory
            stationId={station.id}
            departmentCode={station.departmentCode}
            departmentSlug={station.departmentSlug}
            departmentName={station.department}
            stationName={`${station.address}, ${station.city}`}
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[var(--orange-primary)]" />
            <span>Plan d&apos;accès et carte</span>
          </h2>
          <ClientMapWrapper
            stations={[toLightStation(station)]}
            initialCenter={[station.lat, station.lon]}
            initialZoom={STATION_MAP_ZOOM}
            highlightStationId={station.id}
          />
        </div>

        <AdSlot />
      </div>
    </>
  );
}
