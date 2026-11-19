import { findBrandGroupBySlug } from './brands.ts';
import { assetPath } from './site.ts';
import { elideA } from './stationInsights.ts';
import type { Station } from './prixCarburants.ts';

const HEADING_COMBINING_MARKS = /\p{M}/gu;
const HEADING_NON_ALPHANUMERIC = /[^a-z0-9]+/g;

/** Distintivo de una estación: logo de la red o texto. */
export type BrandBadgeSpec = { kind: 'logo'; src: string; alt: string } | { kind: 'text'; label: string };

/** Minúsculas, sin tildes ni separadores: « E. Leclerc » y « e.leclerc » coinciden. */
function headingNormalize(text: string): string {
  return text.normalize('NFD').replace(HEADING_COMBINING_MARKS, '').toLowerCase().replace(HEADING_NON_ALPHANUMERIC, '');
}

/** Elección del distintivo: logo si la red lo tiene; si no, texto con la red o el nombre. null sin nombre. */
export function brandBadgeSpec(name: string | null, brandSlug: string | null): BrandBadgeSpec | null {
  if (!name) return null;
  const group = findBrandGroupBySlug(brandSlug);
  if (group?.logo) return { kind: 'logo', src: assetPath(group.logo), alt: group.name };
  return { kind: 'text', label: group?.name ?? name };
}

/**
 * Nombre comercial que se usa como título de una estación, o null si no aporta nada:
 * sin nombre, o cuando la red ya se identifica con su logo y el nombre es solo el de la red.
 * Quien llama usa entonces su título de siempre (municipio o dirección).
 */
export function stationCommercialTitle(station: Pick<Station, 'name' | 'brandSlug'>): string | null {
  if (!station.name) return null;
  const group = findBrandGroupBySlug(station.brandSlug);
  const isLogoRedundant = group?.logo != null && headingNormalize(group.name) === headingNormalize(station.name);
  return isLogoRedundant ? null : station.name;
}

/** Título de la ficha: con nombre comercial « {nom} – Station-service {adresse} à {ville} »; sin él, sin el prefijo. */
export function stationHeading(station: Pick<Station, 'name' | 'address' | 'city'>): string {
  const base = `Station-service ${station.address} ${elideA(station.city)}`;
  return station.name ? `${station.name} – ${base}` : base;
}
