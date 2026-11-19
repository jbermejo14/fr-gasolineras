import { BRAND_GROUPS, brandGroupOf } from './brands.ts';
import { DEPARTMENTS, departmentCodeFromPostalCode, findDepartmentByCode, findRegionByCode, normalizePlaceText, slugify } from './geo.ts';
import { FUEL_TYPES, emptyFuelPrices, parseValidPrice } from './fuels.ts';
import type { FuelPrices, FuelType } from './fuels.ts';

export type RoadType = 'route' | 'autoroute';

export interface DayHours {
  /** 'Lundi' … 'Dimanche' (orden lunes→domingo). */
  day: string;
  /** El flujo marca el día con `@ferme === '1'`. */
  closed: boolean;
  /** Tramos 'hh:mm–hh:mm'; vacío si no hay. */
  ranges: string[];
}

export interface Station {
  id: string;
  /** slugify(`${city} ${address}`) recortado a PRIX_SLUG_MAX_LENGTH caracteres sin cortar palabra. */
  slug: string;
  address: string;
  /** Nombre comercial de la fuente de nombres (B.2); null si no hay. */
  name: string | null;
  /** Slug de la red de BRAND_GROUPS a la que pertenece el nombre; null si ninguna. */
  brandSlug: string | null;
  postalCode: string;
  city: string;
  communeSlug: string;
  departmentCode: string;
  department: string;
  departmentSlug: string;
  regionCode: string;
  region: string;
  regionSlug: string;
  roadType: RoadType;
  lat: number;
  lon: number;
  is24h: boolean;
  /** [] si `horaires` es null o no se puede leer. */
  openingHours: DayHours[];
  services: string[];
  /** null si falta, no es válido o tiene más de STALE_PRICE_DAYS. */
  prices: FuelPrices;
  /** ISO del flujo; null si el precio es null. */
  priceUpdatedAt: Record<FuelType, string | null>;
}

export interface FuelStats {
  min: number | null;
  max: number | null;
  avg: number | null;
  count: number;
  minStationId: string | null;
}
export type FuelStatsByType = Record<FuelType, FuelStats>;

export interface CommuneGroup {
  communeSlug: string;
  city: string;
  departmentSlug: string;
  department: string;
  stations: Station[];
}

export interface DepartmentGroup {
  code: string;
  department: string;
  departmentSlug: string;
  regionSlug: string;
  stations: Station[];
  communes: CommuneGroup[];
}

export interface PrixSnapshot {
  /** ISO: el {carb}_maj más reciente de todo el flujo. */
  updatedAt: string;
  /** Orden de entrada. */
  stations: Station[];
  stationsById: Map<string, Station>;
  /** Clave departmentSlug; orden por código. */
  departments: Map<string, DepartmentGroup>;
  /** Clave `${departmentSlug}/${communeSlug}`. */
  communes: Map<string, CommuneGroup>;
  /** Clave brandSlug; solo redes con alguna estación, en el orden de BRAND_GROUPS. */
  brands: Map<string, Station[]>;
  nationalStats: FuelStatsByType;
}

export interface AreaSummary {
  stationCount: number;
  min: Record<FuelType, number | null>;
  avg: Record<FuelType, number | null>;
}

/** Días máximos de antigüedad de un precio respecto a updatedAt; más antiguo → null. */
export const STALE_PRICE_DAYS = 30;
/** Rectángulo que contiene Francia metropolitana y Córcega. */
export const FRANCE_BOUNDS = { south: 41.2, north: 51.2, west: -5.3, east: 9.7 };

const PRIX_SLUG_MAX_LENGTH = 80;
const PRIX_MS_PER_DAY = 24 * 60 * 60 * 1000;
const PRIX_AVG_ROUNDING_FACTOR = 1000; // 3 decimales
const PRIX_AUTOROUTE_CODE = 'A';
const PRIX_AUTOMATE_24H_YES = 'Oui';
const PRIX_CLOSED_FLAG = '1';
const PRIX_STATION_PATH_PREFIX = '/station/';
const PRIX_STATION_SLUG_PATTERN = /^(\d+)(?:-.*)?$/;
const PRIX_RANGE_SEPARATOR = '–';
const PRIX_NO_UPDATE_DATE_MESSAGE =
  'El flujo de precios no tiene ninguna fecha de actualización: revisa la descarga.';

type PrixRawRecord = Record<string, unknown>;

function prixAsString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function prixParseDate(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

/** Corta el slug en PRIX_SLUG_MAX_LENGTH caracteres sin partir una palabra. */
function prixTruncateSlug(slug: string): string {
  if (slug.length <= PRIX_SLUG_MAX_LENGTH) return slug;
  const cut = slug.slice(0, PRIX_SLUG_MAX_LENGTH + 1);
  const lastDash = cut.lastIndexOf('-');
  return lastDash > 0 ? cut.slice(0, lastDash) : slug.slice(0, PRIX_SLUG_MAX_LENGTH);
}

function prixParseCoordinates(raw: PrixRawRecord): { lat: number; lon: number } | null {
  const geom = raw.geom as { lat?: unknown; lon?: unknown } | null | undefined;
  if (!geom || typeof geom.lat !== 'number' || typeof geom.lon !== 'number') return null;
  const { lat, lon } = geom;
  const inside =
    lat >= FRANCE_BOUNDS.south && lat <= FRANCE_BOUNDS.north &&
    lon >= FRANCE_BOUNDS.west && lon <= FRANCE_BOUNDS.east;
  return inside ? { lat, lon } : null;
}

function prixResolveDepartmentCode(raw: PrixRawRecord, postalCode: string): string | null {
  const declared = prixAsString(raw.code_departement);
  if (declared && findDepartmentByCode(declared)) return declared;
  return departmentCodeFromPostalCode(postalCode);
}

function prixFormatTime(value: unknown): string | null {
  const text = prixAsString(value);
  return text ? text.replace('.', ':') : null;
}

function prixParseRanges(horaire: unknown): string[] {
  const entries = Array.isArray(horaire) ? horaire : horaire ? [horaire] : [];
  const ranges: string[] = [];
  for (const entry of entries as { '@ouverture'?: unknown; '@fermeture'?: unknown }[]) {
    const opening = prixFormatTime(entry?.['@ouverture']);
    const closing = prixFormatTime(entry?.['@fermeture']);
    if (opening && closing) ranges.push(`${opening}${PRIX_RANGE_SEPARATOR}${closing}`);
  }
  return ranges;
}

function prixParseDay(raw: Record<string, unknown>): DayHours | null {
  const day = prixAsString(raw['@nom']);
  if (!day) return null;
  const closed = raw['@ferme'] === PRIX_CLOSED_FLAG;
  // El flujo rellena los días cerrados con un tramo ficticio (01.00–01.00): no se muestra.
  return { day, closed, ranges: closed ? [] : prixParseRanges(raw.horaire) };
}

function prixParseOpeningHours(horaires: unknown): DayHours[] {
  if (typeof horaires !== 'string') return [];
  try {
    const parsed = JSON.parse(horaires) as { jour?: unknown } | null;
    const days = Array.isArray(parsed?.jour) ? parsed.jour : parsed?.jour ? [parsed.jour] : [];
    return (days as Record<string, unknown>[])
      .map(prixParseDay)
      .filter((day): day is DayHours => day !== null);
  } catch {
    // Contrato: un horario ilegible no descarta la estación, solo se queda sin horario.
    return [];
  }
}

function prixParseServices(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((service): service is string => typeof service === 'string');
}

function prixParsePrices(
  raw: PrixRawRecord,
  updatedAtMs: number,
): { prices: FuelPrices; priceUpdatedAt: Record<FuelType, string | null> } {
  const prices = emptyFuelPrices();
  const priceUpdatedAt = Object.fromEntries(FUEL_TYPES.map((fuel) => [fuel, null])) as Record<FuelType, string | null>;
  const oldestAllowed = updatedAtMs - STALE_PRICE_DAYS * PRIX_MS_PER_DAY;
  for (const fuel of FUEL_TYPES) {
    const price = parseValidPrice(raw[`${fuel}_prix`]);
    const maj = prixParseDate(raw[`${fuel}_maj`]);
    if (price === null || maj === null || maj < oldestAllowed) continue;
    prices[fuel] = price;
    priceUpdatedAt[fuel] = raw[`${fuel}_maj`] as string;
  }
  return { prices, priceUpdatedAt };
}

/**
 * Convierte un registro del flujo en Station; null si se descarta (ver ARCHITECTURE.md, F2).
 * `name` es el nombre comercial ya limpio (null si no hay); de él se deduce la red.
 */
export function normalizeStation(
  raw: Record<string, unknown>,
  updatedAt: string,
  name: string | null = null,
): Station | null {
  const id = prixAsString(raw.id);
  const rawCity = prixAsString(raw.ville);
  const coordinates = prixParseCoordinates(raw);
  const updatedAtMs = Date.parse(updatedAt);
  if (!id || !rawCity || !coordinates || Number.isNaN(updatedAtMs)) return null;

  const postalCode = prixAsString(raw.cp) ?? '';
  const department = findDepartmentByCode(prixResolveDepartmentCode(raw, postalCode) ?? '');
  const region = department ? findRegionByCode(department.regionCode) : null;
  const city = normalizePlaceText(rawCity);
  const communeSlug = slugify(city);
  if (!department || !region || !communeSlug) return null;

  const address = normalizePlaceText(prixAsString(raw.adresse) ?? '');
  return {
    id,
    slug: prixTruncateSlug(slugify(`${city} ${address}`)),
    address,
    name,
    brandSlug: brandGroupOf(name)?.slug ?? null,
    postalCode,
    city,
    communeSlug,
    departmentCode: department.code,
    department: department.name,
    departmentSlug: department.slug,
    regionCode: region.code,
    region: region.name,
    regionSlug: region.slug,
    roadType: raw.pop === PRIX_AUTOROUTE_CODE ? 'autoroute' : 'route',
    lat: coordinates.lat,
    lon: coordinates.lon,
    is24h: raw.horaires_automate_24_24 === PRIX_AUTOMATE_24H_YES,
    openingHours: prixParseOpeningHours(raw.horaires),
    services: prixParseServices(raw.services_service),
    ...prixParsePrices(raw, updatedAtMs),
  };
}

function prixFuelStats(stations: readonly Station[], fuel: FuelType): FuelStats {
  let min: number | null = null;
  let max: number | null = null;
  let minStationId: string | null = null;
  let sum = 0;
  let count = 0;
  for (const station of stations) {
    const price = station.prices[fuel];
    if (price === null) continue;
    sum += price;
    count += 1;
    if (min === null || price < min) {
      min = price;
      minStationId = station.id;
    }
    if (max === null || price > max) max = price;
  }
  const avg = count === 0 ? null : Math.round((sum / count) * PRIX_AVG_ROUNDING_FACTOR) / PRIX_AVG_ROUNDING_FACTOR;
  return { min, max, avg, count, minStationId };
}

/** Media redondeada a 3 decimales, mínimo y máximo; minStationId = id del mínimo (primero en empate). */
export function computeFuelStats(stations: readonly Station[]): FuelStatsByType {
  return Object.fromEntries(
    FUEL_TYPES.map((fuel) => [fuel, prixFuelStats(stations, fuel)]),
  ) as FuelStatsByType;
}

function prixLatestUpdate(raw: readonly PrixRawRecord[]): string {
  let latestMs: number | null = null;
  let latest = '';
  for (const record of raw) {
    for (const fuel of FUEL_TYPES) {
      const ms = prixParseDate(record[`${fuel}_maj`]);
      if (ms !== null && (latestMs === null || ms > latestMs)) {
        latestMs = ms;
        latest = record[`${fuel}_maj`] as string;
      }
    }
  }
  if (latestMs === null) throw new Error(PRIX_NO_UPDATE_DATE_MESSAGE);
  return latest;
}

/** La grafía más frecuente del municipio; en empate, la primera por orden alfabético. */
function prixMostFrequentCity(stations: readonly Station[]): string {
  const counts = new Map<string, number>();
  for (const station of stations) counts.set(station.city, (counts.get(station.city) ?? 0) + 1);
  const ranked = [...counts.entries()].sort(
    ([cityA, countA], [cityB, countB]) => countB - countA || (cityA < cityB ? -1 : cityA > cityB ? 1 : 0),
  );
  return ranked[0][0];
}

function prixGroupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

function prixBuildCommune(stations: Station[]): CommuneGroup {
  const first = stations[0];
  return {
    communeSlug: first.communeSlug,
    city: prixMostFrequentCity(stations),
    departmentSlug: first.departmentSlug,
    department: first.department,
    stations,
  };
}

function prixBuildDepartments(stations: readonly Station[]): {
  departments: Map<string, DepartmentGroup>;
  communes: Map<string, CommuneGroup>;
} {
  const byDepartment = prixGroupBy(stations, (station) => station.departmentSlug);
  const departments = new Map<string, DepartmentGroup>();
  const communes = new Map<string, CommuneGroup>();
  for (const department of DEPARTMENTS) {
    const departmentStations = byDepartment.get(department.slug);
    if (!departmentStations) continue;
    const communeGroups = [...prixGroupBy(departmentStations, (station) => station.communeSlug).values()]
      .map(prixBuildCommune)
      .sort((a, b) => (a.communeSlug < b.communeSlug ? -1 : a.communeSlug > b.communeSlug ? 1 : 0));
    for (const group of communeGroups) communes.set(`${group.departmentSlug}/${group.communeSlug}`, group);
    departments.set(department.slug, {
      code: department.code,
      department: department.name,
      departmentSlug: department.slug,
      regionSlug: departmentStations[0].regionSlug,
      stations: departmentStations,
      communes: communeGroups,
    });
  }
  return { departments, communes };
}

function prixBuildBrands(stations: readonly Station[]): Map<string, Station[]> {
  const byBrand = prixGroupBy(
    stations.filter((station) => station.brandSlug !== null),
    (station) => station.brandSlug as string,
  );
  const brands = new Map<string, Station[]>();
  for (const group of BRAND_GROUPS) {
    const brandStations = byBrand.get(group.slug);
    if (brandStations) brands.set(group.slug, brandStations);
  }
  return brands;
}

/**
 * Normaliza el flujo completo y lo agrega por departamento, municipio, red y país.
 * `names` asocia id de estación → nombre comercial limpio (vacío si no hay fuente de nombres).
 */
export function processRawPrixData(
  raw: readonly Record<string, unknown>[],
  names: ReadonlyMap<string, string> = new Map(),
): PrixSnapshot {
  const updatedAt = prixLatestUpdate(raw);
  const stations: Station[] = [];
  for (const record of raw) {
    const station = normalizeStation(record, updatedAt, names.get(prixAsString(record.id) ?? '') ?? null);
    if (station) stations.push(station);
  }
  return {
    updatedAt,
    stations,
    stationsById: new Map(stations.map((station) => [station.id, station])),
    ...prixBuildDepartments(stations),
    brands: prixBuildBrands(stations),
    nationalStats: computeFuelStats(stations),
  };
}

/** Resúmenes para listados: por cada carburante, mínimo y media. */
export function summarizeStations(stations: readonly Station[]): AreaSummary {
  const stats = computeFuelStats(stations);
  const min = {} as Record<FuelType, number | null>;
  const avg = {} as Record<FuelType, number | null>;
  for (const fuel of FUEL_TYPES) {
    min[fuel] = stats[fuel].min;
    avg[fuel] = stats[fuel].avg;
  }
  return { stationCount: stations.length, min, avg };
}

/** Ruta de la ficha: '/station/56580001-brehan-16-rue-chateaubriand'. */
export function stationPath(station: Pick<Station, 'id' | 'slug'>): string {
  const suffix = station.slug ? `-${station.slug}` : '';
  return `${PRIX_STATION_PATH_PREFIX}${station.id}${suffix}`;
}

/** Id de la estación a partir del parámetro de ruta ('56580001-brehan-…' → '56580001'); null si no empieza por un id. */
export function parseStationPathSlug(slug: string): string | null {
  return PRIX_STATION_SLUG_PATTERN.exec(slug)?.[1] ?? null;
}

/** Nombre para mostrar de una estación: el nombre comercial si existe; si no, la dirección. */
export function stationDisplayName(station: Pick<Station, 'name' | 'address'>): string {
  return station.name ?? station.address;
}
