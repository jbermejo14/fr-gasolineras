import type { MetadataRoute } from 'next';
import { getPrixData } from '@/lib/prixSnapshot';
import { stationPath } from '@/lib/prixCarburants';
import { absoluteUrl } from '@/lib/site';

export const dynamic = 'force-static';

const SITEMAP_HOME_PRIORITY = 1.0;
const SITEMAP_DEPARTMENT_PRIORITY = 0.9;
const SITEMAP_COMMUNE_PRIORITY = 0.8;
const SITEMAP_STATION_PRIORITY = 0.6;
const SITEMAP_LEGAL_PRIORITY = 0.2;
const LEGAL_PATHS = ['/mentions-legales', '/confidentialite', '/cookies'] as const;

/** URLs del histórico de precios; vacío hasta que F6 las añada. */
function historiqueSitemapEntries(): MetadataRoute.Sitemap {
  // Las URLs de /historique las completa F6, que lee el índice generado por `npm run historique`.
  return [];
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
