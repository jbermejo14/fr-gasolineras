import type { MetadataRoute } from 'next';
import { getPrixData } from '@/lib/prixSnapshot';
import { stationPath } from '@/lib/prixCarburants';
import { absoluteUrl } from '@/lib/site';
import { getHistoryIndex } from '@/lib/historique';
import { buildHistoriquePath } from '@/lib/historiquePageMeta';

export const dynamic = 'force-static';

const SITEMAP_HOME_PRIORITY = 1.0;
const SITEMAP_DEPARTMENT_PRIORITY = 0.9;
const SITEMAP_BRAND_PRIORITY = 0.8;
const SITEMAP_COMMUNE_PRIORITY = 0.8;
const SITEMAP_STATION_PRIORITY = 0.6;
const SITEMAP_LEGAL_PRIORITY = 0.2;
const SITEMAP_HISTORIQUE_FRANCE_PRIORITY = 0.7;
const SITEMAP_HISTORIQUE_AREA_PRIORITY = 0.6;
const LEGAL_PATHS = ['/mentions-legales', '/confidentialite', '/cookies'] as const;

/** URLs del histórico desde el índice; vacío si todavía no se ha generado. lastModified = última semana. */
function historiqueSitemapEntries(): MetadataRoute.Sitemap {
  const index = getHistoryIndex();
  if (!index) return [];
  const lastModified = new Date(index.weeks[index.weeks.length - 1]);
  return index.areas.map((area) => ({
    url: absoluteUrl(buildHistoriquePath(area.kind, area.slug)),
    lastModified,
    changeFrequency: 'weekly',
    priority: area.kind === 'france' ? SITEMAP_HISTORIQUE_FRANCE_PRIORITY : SITEMAP_HISTORIQUE_AREA_PRIORITY,
  }));
}

/** Índice de marcas y una página por red con estaciones. */
function brandSitemapEntries(brandSlugs: readonly string[], lastModified: Date): MetadataRoute.Sitemap {
  const index: MetadataRoute.Sitemap[number] = {
    url: absoluteUrl('/marque'),
    lastModified,
    changeFrequency: 'daily',
    priority: SITEMAP_BRAND_PRIORITY,
  };
  const brands = brandSlugs.map((slug) => ({ ...index, url: absoluteUrl(`/marque/${slug}`) }));
  return [index, ...brands];
}

function legalSitemapEntries(lastModified: Date): MetadataRoute.Sitemap {
  return LEGAL_PATHS.map((path) => ({
    url: absoluteUrl(path),
    lastModified,
    changeFrequency: 'yearly',
    priority: SITEMAP_LEGAL_PRIORITY,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getPrixData();
  const lastModified = new Date(data.updatedAt);

  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified, changeFrequency: 'daily', priority: SITEMAP_HOME_PRIORITY },
  ];

  for (const department of data.departments.values()) {
    entries.push({
      url: absoluteUrl(`/departement/${department.departmentSlug}`),
      lastModified,
      changeFrequency: 'daily',
      priority: SITEMAP_DEPARTMENT_PRIORITY,
    });
  }

  entries.push(...brandSitemapEntries(Array.from(data.brands.keys()), lastModified));

  for (const commune of data.communes.values()) {
    entries.push({
      url: absoluteUrl(`/departement/${commune.departmentSlug}/${commune.communeSlug}`),
      lastModified,
      changeFrequency: 'daily',
      priority: SITEMAP_COMMUNE_PRIORITY,
    });
  }

  for (const station of data.stations) {
    entries.push({
      url: absoluteUrl(stationPath(station)),
      lastModified,
      changeFrequency: 'daily',
      priority: SITEMAP_STATION_PRIORITY,
    });
  }

  entries.push(...legalSitemapEntries(lastModified), ...historiqueSitemapEntries());
  return entries;
}
