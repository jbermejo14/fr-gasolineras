export interface BrandGroup {
  /** Identificador de ruta, p. ej. 'totalenergies'. */
  slug: string;
  /** Nombre para mostrar, p. ej. 'TotalEnergies'. */
  name: string;
  /** Ruta en public/, p. ej. '/logos/carrefour.webp'; null → distintivo de texto. */
  logo: string | null;
  /** En minúsculas y sin tildes; se comparan como palabra completa o frase completa. */
  keywords: string[];
}

/** Redes con página propia, en este orden (de más a menos estaciones). */
export const BRAND_GROUPS: readonly BrandGroup[] = [
  { slug: 'totalenergies', name: 'TotalEnergies', logo: '/logos/totalenergies.png', keywords: ['totalenergies', 'total access', 'total contact', 'total'] },
  { slug: 'intermarche', name: 'Intermarché', logo: null, keywords: ['intermarche'] },
  { slug: 'carrefour', name: 'Carrefour', logo: '/logos/carrefour.webp', keywords: ['carrefour'] },
  {
    slug: 'systeme-u',
    name: 'Système U',
    logo: null,
    keywords: ['systeme u', 'super u', 'hyper u', 'station u', 'u express', 'la station u', 'magasins u', 'u carburant', 'u'],
  },
  { slug: 'leclerc', name: 'E.Leclerc', logo: '/logos/leclerc.svg', keywords: ['leclerc'] },
  { slug: 'esso', name: 'Esso', logo: '/logos/esso.svg', keywords: ['esso'] },
  { slug: 'avia', name: 'Avia', logo: '/logos/avia.svg', keywords: ['avia'] },
  { slug: 'auchan', name: 'Auchan', logo: null, keywords: ['auchan'] },
  { slug: 'eni', name: 'Eni', logo: '/logos/eni.svg', keywords: ['eni', 'agip'] },
  { slug: 'netto', name: 'Netto', logo: '/logos/netto.svg', keywords: ['netto'] },
  { slug: 'elan', name: 'Elan', logo: '/logos/elan.svg', keywords: ['elan'] },
  { slug: 'dyneff', name: 'Dyneff', logo: null, keywords: ['dyneff'] },
  { slug: 'bp', name: 'BP', logo: '/logos/bp.webp', keywords: ['bp'] },
  { slug: 'shell', name: 'Shell', logo: '/logos/shell.webp', keywords: ['shell'] },
  { slug: 'vito', name: 'Vito', logo: null, keywords: ['vito'] },
  { slug: 'match', name: 'Match', logo: '/logos/match.png', keywords: ['match'] },
  { slug: 'aire-c', name: 'Aire C', logo: null, keywords: ['aire c'] },
  { slug: 'spar', name: 'Spar', logo: null, keywords: ['spar'] },
  { slug: 'dats-24', name: 'DATS 24', logo: null, keywords: ['dats 24'] },
];

/** Keywords de una sola letra: solo valen si el nombre entero es esa letra (« U »). */
const BRANDS_WHOLE_NAME_KEYWORDS: ReadonlySet<string> = new Set(['u']);
const BRANDS_COMBINING_MARKS = /\p{M}/gu;
const BRANDS_NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const BRANDS_WORD_SEPARATOR = ' ';

export function findBrandGroupBySlug(slug: string | null): BrandGroup | null {
  if (slug === null) return null;
  return BRAND_GROUPS.find((group) => group.slug === slug) ?? null;
}

/** Minúsculas, sin tildes y con todo separador ('-', '.', ';', paréntesis…) convertido en un espacio. */
function brandsNormalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(BRANDS_COMBINING_MARKS, '')
    .toLowerCase()
    .replace(BRANDS_NON_ALPHANUMERIC, BRANDS_WORD_SEPARATOR)
    .trim();
}

function brandsKeywordMatches(normalizedName: string, keyword: string): boolean {
  if (BRANDS_WHOLE_NAME_KEYWORDS.has(keyword)) return normalizedName === keyword;
  const padded = `${BRANDS_WORD_SEPARATOR}${normalizedName}${BRANDS_WORD_SEPARATOR}`;
  return padded.includes(`${BRANDS_WORD_SEPARATOR}${keyword}${BRANDS_WORD_SEPARATOR}`);
}

/**
 * Red de un nombre comercial: normaliza y busca la primera red cuya keyword aparezca
 * como palabra o frase completa. null si ninguna.
 */
export function brandGroupOf(name: string | null): BrandGroup | null {
  if (!name) return null;
  const normalized = brandsNormalize(name);
  if (normalized === '') return null;
  return BRAND_GROUPS.find((group) => group.keywords.some((keyword) => brandsKeywordMatches(normalized, keyword))) ?? null;
}
