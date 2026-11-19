import type { FuelType } from '../lib/fuels.ts';
import { BRAND_GROUPS, type BrandGroup } from '../lib/brands.ts';
import type { LightStation } from '../lib/stationPayload.ts';

/** Número de tarjetas que se añaden cada vez que se pulsa « Charger plus ». */
export const GAS_FINDER_PAGE_SIZE = 36;
/** Valor del filtro de departamento que no filtra nada. */
export const GAS_FINDER_ALL_DEPARTMENTS = 'TOUS';
/** Valor del filtro de enseña que no filtra nada. */
export const GAS_FINDER_ALL_BRANDS = 'TOUS';
/** Litros de un depósito típico para calcular el ahorro. */
export const GAS_FINDER_TANK_LITERS = 50;

const EARTH_RADIUS_KM = 6371;
const DISTANCE_DECIMALS_FACTOR = 10;
const PRICE_DECIMALS_FACTOR = 1000;
const CENTS_FACTOR = 100;
const MISSING_PRICE_ASC = 999;
const MISSING_PRICE_DESC = -1;
const MISSING_DISTANCE = 9999;
const COLLATION_LOCALE = 'fr';
const COMBINING_MARKS_PATTERN = /\p{M}/gu;
const WORD_SEPARATORS_PATTERN = /[-'’\s]+/g;
const nameCollator = new Intl.Collator(COLLATION_LOCALE);

export type GasFinderSort = 'price_asc' | 'price_desc' | 'distance_asc' | 'name_asc';
export type GasFinderStation = LightStation & { distance?: number };

export interface GasFinderCriteria {
  fuel: FuelType;
  /** Slug del departamento o GAS_FINDER_ALL_DEPARTMENTS. */
  department: string;
  /** Slug de la red o GAS_FINDER_ALL_BRANDS. */
  brand: string;
  search: string;
  sortBy: GasFinderSort;
  userCoords: { lat: number; lon: number } | null;
  radius: number;
}

/** Criterios que afectan solo al filtrado. */
export type GasFinderFilterCriteria = Omit<GasFinderCriteria, 'sortBy'>;

export type GasFinderSortCriteria = Pick<GasFinderCriteria, 'fuel' | 'sortBy' | 'userCoords'>;

export interface GasFinderStats {
  total: number;
  min: number | null;
  max: number | null;
  avg: number | null;
}

/** Texto en minúsculas, sin tildes y con guiones y apóstrofos como espacios, para buscar de forma tolerante. */
function gasFinderNormalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(COMBINING_MARKS_PATTERN, '')
    .toLowerCase()
    .replace(WORD_SEPARATORS_PATTERN, ' ')
    .trim();
}

/** Distancia en km (un decimal) entre dos coordenadas, por la fórmula de haversine. */
function gasFinderDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * DISTANCE_DECIMALS_FACTOR) / DISTANCE_DECIMALS_FACTOR;
}

function gasFinderMatchesSearch(station: LightStation, query: string): boolean {
  return (
    gasFinderNormalizeText(station.address).includes(query) ||
    gasFinderNormalizeText(station.city).includes(query) ||
    (station.name !== null && gasFinderNormalizeText(station.name).includes(query)) ||
    station.postalCode.includes(query)
  );
}

function gasFinderSortName(station: LightStation): string {
  return `${station.city} ${station.address}`;
}

function gasFinderCompare(a: GasFinderStation, b: GasFinderStation, criteria: GasFinderSortCriteria): number {
  switch (criteria.sortBy) {
    case 'price_asc':
      return (a.prices[criteria.fuel] ?? MISSING_PRICE_ASC) - (b.prices[criteria.fuel] ?? MISSING_PRICE_ASC);
    case 'price_desc':
      return (b.prices[criteria.fuel] ?? MISSING_PRICE_DESC) - (a.prices[criteria.fuel] ?? MISSING_PRICE_DESC);
    case 'distance_asc':
      return criteria.userCoords ? (a.distance ?? MISSING_DISTANCE) - (b.distance ?? MISSING_DISTANCE) : 0;
    case 'name_asc':
      return nameCollator.compare(gasFinderSortName(a), gasFinderSortName(b));
  }
}

/**
 * Filtra por carburante, departamento, texto y radio, sin ordenar.
 * El orden se aplica aparte para que cambiarlo no genere un array nuevo para el mapa.
 */
export function gasFinderFilterStations(
  stations: LightStation[],
  criteria: GasFinderFilterCriteria
): GasFinderStation[] {
  const { fuel, department, brand, search, userCoords, radius } = criteria;
  let list: GasFinderStation[] = stations.filter((s) => (s.prices[fuel] ?? 0) > 0);

  if (department !== GAS_FINDER_ALL_DEPARTMENTS) list = list.filter((s) => s.departmentSlug === department);
  if (brand !== GAS_FINDER_ALL_BRANDS) list = list.filter((s) => s.brandSlug === brand);

  const query = gasFinderNormalizeText(search);
  if (query) list = list.filter((s) => gasFinderMatchesSearch(s, query));

  if (userCoords) {
    list = list
      .map((s) => ({ ...s, distance: gasFinderDistance(userCoords.lat, userCoords.lon, s.lat, s.lon) }))
      .filter((s) => s.distance <= radius);
  }

  return list;
}

/** Redes de BRAND_GROUPS con alguna estación en los datos, en el orden de la tabla. */
export function gasFinderBrandOptions(stations: readonly LightStation[]): BrandGroup[] {
  const present = new Set(stations.map((station) => station.brandSlug));
  return BRAND_GROUPS.filter((group) => present.has(group.slug));
}

/** Devuelve una copia ordenada según `sortBy`; no modifica la entrada. */
export function gasFinderSortStations(
  stations: GasFinderStation[],
  criteria: GasFinderSortCriteria
): GasFinderStation[] {
  return [...stations].sort((a, b) => gasFinderCompare(a, b, criteria));
}

/** Mínimo, máximo y media del carburante sobre las estaciones filtradas. */
export function gasFinderComputeStats(stations: GasFinderStation[], fuel: FuelType): GasFinderStats {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;

  for (const s of stations) {
    const price = s.prices[fuel];
    if (price !== null && price > 0) {
      min = Math.min(min, price);
      max = Math.max(max, price);
      sum += price;
      count++;
    }
  }

  return {
    total: stations.length,
    min: count > 0 ? min : null,
    max: count > 0 ? max : null,
    avg: count > 0 ? Math.round((sum / count) * PRICE_DECIMALS_FACTOR) / PRICE_DECIMALS_FACTOR : null,
  };
}

/**
 * Ahorro en euros al llenar un depósito de GAS_FINDER_TANK_LITERS litros al precio mínimo
 * en vez de al medio; null si falta alguno de los dos y 0 si el mínimo no es más barato.
 */
export function gasFinderTankSavings(min: number | null, avg: number | null): number | null {
  if (min === null || avg === null || min <= 0 || avg <= 0) return null;
  const perLiter = avg - min;
  if (perLiter <= 0) return 0;
  return Math.round(perLiter * GAS_FINDER_TANK_LITERS * CENTS_FACTOR) / CENTS_FACTOR;
}
