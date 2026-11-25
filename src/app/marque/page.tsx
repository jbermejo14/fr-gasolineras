import type { Metadata } from 'next';
import { getPrixData } from '@/lib/prixSnapshot';
import { summarizeBrands } from '@/lib/brandInsights';
import { absoluteUrl } from '@/lib/site';
import { buildSocialMetadata } from '@/lib/socialMetadata';
import { getBreadcrumbSchema } from '@/lib/seo';
import { AdSlot } from '@/components/AdSlot';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { BrandIndexTable } from '@/components/BrandIndexTable';

const BRAND_INDEX_PATH = '/marque';
const BRAND_INDEX_TITLE = 'Prix des carburants par enseigne';
const BRAND_INDEX_DESCRIPTION =
  'Comparez le prix moyen du gazole et du SP95-E10 chez TotalEnergies, E.Leclerc, Carrefour, Intermarché et les autres enseignes de stations-service en France.';

export async function generateMetadata(): Promise<Metadata> {
  const canonical = absoluteUrl(BRAND_INDEX_PATH);
  return {
    title: BRAND_INDEX_TITLE,
    description: BRAND_INDEX_DESCRIPTION,
    alternates: { canonical },
    ...buildSocialMetadata({ title: BRAND_INDEX_TITLE, description: BRAND_INDEX_DESCRIPTION, path: BRAND_INDEX_PATH }),
  };
}

export default async function BrandIndexPage() {
  const data = await getPrixData();
  const summaries = summarizeBrands(data.brands);
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Accueil', url: absoluteUrl('/') },
    { name: 'Enseignes', url: absoluteUrl(BRAND_INDEX_PATH) },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div className="space-y-6 md:space-y-8 min-w-0">
        <Breadcrumbs items={[{ name: 'Enseignes', href: BRAND_INDEX_PATH }]} />

        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-md">
          <div className="max-w-3xl">
            <h1 className="text-xl md:text-4xl font-extrabold tracking-tight break-words text-[var(--text-main)]">
              Prix des carburants <span className="text-[var(--orange-primary)]">par enseigne</span>
            </h1>
            <p className="mt-3 text-sm md:text-base text-[var(--text-muted)] leading-relaxed">
              Les prix moyens du gazole et du SP95-E10 de {summaries.length} enseignes, comparés à la moyenne
              nationale. Choisissez une enseigne pour voir ses stations les moins chères et le détail par département.
            </p>
          </div>
        </div>

        <AdSlot />

        <BrandIndexTable summaries={summaries} national={data.nationalStats} />

        <AdSlot />
      </div>
    </>
  );
}
