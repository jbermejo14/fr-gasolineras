import { FUEL_LABELS, FUEL_TYPES, TANK_LITERS } from './fuels.ts';
import type { FuelType } from './fuels.ts';
import { formatEuros, formatInteger, formatPrice } from './format.ts';
import { computeFuelStats } from './prixCarburants.ts';
import type { FuelStatsByType, Station } from './prixCarburants.ts';

/** Radio por defecto, en km, para considerar cercana otra estación. */
export const NEARBY_MAX_KM = 10;
/** Número máximo de estaciones cercanas que se devuelven por defecto. */
export const NEARBY_LIMIT = 6;
/** Número máximo de municipios cercanos que se devuelven por defecto. */
export const NEARBY_COMMUNES_LIMIT = 6;
/** Texto que sustituye a un precio que falta en tablas y listados. */
export const MISSING_PRICE_TEXT = '--';

const EARTH_RADIUS_KM = 6371;
const DEGREES_TO_RADIANS = Math.PI / 180;
const CENTS_FACTOR = 100;
const CENTS_TOLERANCE = 0.005;
const MIN_STATIONS_TO_RANK = 2;
const NON_BREAKING_SPACE = ' ';
const ELIDING_START = /^[AEIOUYÀÂÄÉÈÊËÎÏÔÖÙÛÜŒH]/i;
const LE_PREFIX = /^Le\s+(.+)$/;
const LES_PREFIX = /^Les\s+(.+)$/;
/** Municipios cuya h inicial es aspirada: no admiten elisión (« de Haguenau »). */
const ASPIRATED_H_PLACES: readonly string[] = ['Haguenau', 'Hazebrouck', 'Hautmont'];

/** Carburantes que se comparan en el resumen, en el orden en que se redactan. */
const STATION_INSIGHTS_SUMMARY_FUELS: ReadonlyArray<{ fuel: FuelType; name: string }> = [
  { fuel: 'gazole', name: 'gazole' },
  { fuel: 'e10', name: 'SP95-E10' },
];

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface CommuneRank {
  position: number;
  total: number;
}

export interface NearbyStation<T> {
  station: T;
  km: number;
}

export interface NearbyCommune<T> {
  commune: T;
  km: number;
}

/** Distancia en kilómetros entre dos puntos (fórmula de haversine). */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = (b.lat - a.lat) * DEGREES_TO_RADIANS;
  const dLon = (b.lon - a.lon) * DEGREES_TO_RADIANS;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEGREES_TO_RADIANS) * Math.cos(b.lat * DEGREES_TO_RADIANS) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Precio formateado, o « -- » si falta. */
export function formatPriceOrDash(price: number | null): string {
  return price === null ? MISSING_PRICE_TEXT : formatPrice(price);
}

/** « 1 station » o « 1 234 stations » (en francés el cero y el uno van en singular). */
export function stationCountLabel(count: number): string {
  return `${formatInteger(count)} ${count > 1 ? 'stations' : 'station'}`;
}

/**
 * Diferencia en euros, en un depósito de TANK_LITERS litros, entre el precio y la media
 * (negativa si el precio es más barato), redondeada al céntimo. Null si falta alguno de los dos.
 */
export function tankDifference(price: number | null, average: number | null): number | null {
  if (price === null || average === null) return null;
  return Math.round((price - average) * TANK_LITERS * CENTS_FACTOR) / CENTS_FACTOR;
}

/** Copia ordenada de la más barata a la más cara en ese carburante; las que no lo venden, al final. */
export function sortStationsByPrice<T extends Pick<Station, 'prices'>>(stations: readonly T[], fuel: FuelType): T[] {
  const priced = stations.filter((station) => station.prices[fuel] !== null);
  const unpriced = stations.filter((station) => station.prices[fuel] === null);
  priced.sort((a, b) => (a.prices[fuel] as number) - (b.prices[fuel] as number));
  return [...priced, ...unpriced];
}

/** Las `limit` estaciones más baratas de ese carburante (solo las que lo venden). */
export function cheapestStations<T extends Pick<Station, 'prices'>>(
  stations: readonly T[],
  fuel: FuelType,
  limit: number
): T[] {
  return sortStationsByPrice(stations, fuel)
    .filter((station) => station.prices[fuel] !== null)
    .slice(0, limit);
}

export interface CheapestCommune<T> {
  commune: T;
  price: number;
}

/** Municipio con el precio más bajo de ese carburante (el primero en caso de empate); null si ninguno lo vende. */
export function cheapestCommune<T extends { stations: readonly Pick<Station, 'prices'>[] }>(
  communes: readonly T[],
  fuel: FuelType
): CheapestCommune<T> | null {
  let best: CheapestCommune<T> | null = null;
  for (const commune of communes) {
    const prices = commune.stations.map((station) => station.prices[fuel]).filter((p): p is number => p !== null);
    if (prices.length === 0) continue;
    const price = Math.min(...prices);
    if (best === null || price < best.price) best = { commune, price };
  }
  return best;
}

/**
 * Puesto de la estación entre las del municipio con precio de ese carburante,
 * de la más barata (1) a la más cara. Los empates comparten puesto.
 * Devuelve null si la estación no tiene precio de ese carburante.
 */
export function communeRank(
  station: Pick<Station, 'prices'>,
  stations: readonly Pick<Station, 'prices'>[],
  fuel: FuelType
): CommuneRank | null {
  const price = station.prices[fuel];
  if (price === null) return null;
  const prices = stations.map((s) => s.prices[fuel]).filter((p): p is number => p !== null);
  const cheaper = prices.filter((p) => p < price).length;
  return { position: cheaper + 1, total: prices.length };
}

/** Estaciones más cercanas (sin incluir la propia) dentro del radio, de menor a mayor distancia. */
export function nearbyStations<T extends GeoPoint & { id: string }>(
  station: T,
  candidates: readonly T[],
  options: { maxKm?: number; limit?: number } = {}
): NearbyStation<T>[] {
  const maxKm = options.maxKm ?? NEARBY_MAX_KM;
  const limit = options.limit ?? NEARBY_LIMIT;
  return candidates
    .filter((candidate) => candidate.id !== station.id)
    .map((candidate) => ({ station: candidate, km: distanceKm(station, candidate) }))
    .filter((entry) => entry.km <= maxKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

function stationInsightsCentroid(points: readonly GeoPoint[]): GeoPoint {
  const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const lon = points.reduce((sum, point) => sum + point.lon, 0) / points.length;
  return { lat, lon };
}

/** Municipios más cercanos (sin el propio), por distancia entre centroides de sus estaciones. */
export function nearbyCommunes<T extends { communeSlug: string; stations: readonly GeoPoint[] }>(
  current: T,
  candidates: readonly T[],
  limit: number = NEARBY_COMMUNES_LIMIT
): NearbyCommune<T>[] {
  const origin = stationInsightsCentroid(current.stations);
  return candidates
    .filter((candidate) => candidate.communeSlug !== current.communeSlug && candidate.stations.length > 0)
    .map((candidate) => ({ commune: candidate, km: distanceKm(origin, stationInsightsCentroid(candidate.stations)) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

interface StationInsightsRanking {
  name: string;
  position: number;
  total: number;
  /** Estaciones con exactamente el mismo precio, contando la propia. */
  tied: number;
}

/**
 * Complemento « de » de un lugar: « de Bréhan », « d'Auray », « d'Hennebont », « du Mans »,
 * « des Sables-d'Olonne ». La h inicial se trata como muda salvo en ASPIRATED_H_PLACES.
 */
export function elideDe(place: string): string {
  const withLe = LE_PREFIX.exec(place);
  if (withLe) return `du ${withLe[1]}`;
  const withLes = LES_PREFIX.exec(place);
  if (withLes) return `des ${withLes[1]}`;
  const isAspirated = ASPIRATED_H_PLACES.some((name) => place.startsWith(name));
  return ELIDING_START.test(place) && !isAspirated ? `d'${place}` : `de ${place}`;
}

/** Complemento « à » de un lugar: « à Bréhan », « au Mans », « aux Sables-d'Olonne », « à La Rochelle ». */
export function elideA(place: string): string {
  const withLe = LE_PREFIX.exec(place);
  if (withLe) return `au ${withLe[1]}`;
  const withLes = LES_PREFIX.exec(place);
  return withLes ? `aux ${withLes[1]}` : `à ${place}`;
}

/** « 1 commune » o « 81 communes ». */
export function communeCountLabel(count: number): string {
  return `${formatInteger(count)} ${count > 1 ? 'communes' : 'commune'}`;
}

/** Ahorro de un depósito con signo: « +1,10 € »; el cero va sin signo (« 0,00 € ») y lo que falta, « -- ». */
export function formatTankSavings(savings: number | null): string {
  if (savings === null) return MISSING_PRICE_TEXT;
  return savings > 0 ? `+${formatEuros(savings)}` : formatEuros(savings);
}

export interface SavingsReference {
  /** Complemento de « Moyenne » en la fila: « de la commune », « du département », « nationale ». */
  label: string;
  stats: FuelStatsByType;
}

/**
 * Medias con las que se compara una estación: la de su municipio (solo si hay otra estación con
 * la que compararla), la de su departamento y la nacional, en ese orden.
 */
export function savingsReferences(
  communeStations: readonly Station[],
  departmentStations: readonly Station[],
  national: FuelStatsByType
): SavingsReference[] {
  const references: SavingsReference[] = [
    { label: 'du département', stats: computeFuelStats(departmentStations) },
    { label: 'nationale', stats: national },
  ];
  if (communeStations.length > 1) references.unshift({ label: 'de la commune', stats: computeFuelStats(communeStations) });
  return references;
}

function stationInsightsRankings(station: Station, stations: readonly Station[]): StationInsightsRanking[] {
  const rankings: StationInsightsRanking[] = [];
  for (const { fuel, name } of STATION_INSIGHTS_SUMMARY_FUELS) {
    const rank = communeRank(station, stations, fuel);
    if (!rank || rank.total < MIN_STATIONS_TO_RANK) continue;
    const tied = stations.filter((s) => s.prices[fuel] === station.prices[fuel]).length;
    rankings.push({ name, ...rank, tied });
  }
  return rankings;
}

function stationInsightsIsTied(ranking: StationInsightsRanking): boolean {
  return ranking.tied > 1 && (ranking.position === 1 || ranking.tied === ranking.total);
}

function stationInsightsIsLast(ranking: StationInsightsRanking): boolean {
  return ranking.tied === 1 && ranking.position === ranking.total;
}

function stationInsightsOthers(count: number): string {
  return count === 1 ? "l'autre station" : `les ${count} autres stations`;
}

function stationInsightsTieSentence(ranking: StationInsightsRanking, city: string): string {
  const others = ranking.tied - 1;
  if (ranking.tied === ranking.total) {
    return `Cette station affiche le même prix pour le ${ranking.name} que ${stationInsightsOthers(others)} ${elideDe(city)}.`;
  }
  const sharedWith = others === 1 ? 'une autre station' : `${others} autres stations`;
  return `Cette station partage le prix le plus bas pour le ${ranking.name} ${elideA(city)} avec ${sharedWith}.`;
}

function stationInsightsPlace(ranking: StationInsightsRanking): string {
  if (stationInsightsIsLast(ranking)) return 'plus chère';
  return ranking.position === 1 ? 'moins chère' : `${ranking.position}e`;
}

function stationInsightsRankSentence(rankings: StationInsightsRanking[], city: string): string {
  const [first, ...others] = rankings;
  const firstPlace = stationInsightsPlace(first);
  const where = `${first.total} stations ${elideDe(city)}`;
  const isMiddle = first.position > 1 && !stationInsightsIsLast(first);
  const head = isMiddle
    ? `Cette station est la ${firstPlace} moins chère des ${where} en ${first.name}`
    : `Cette station est la ${firstPlace} des ${where} en ${first.name}`;
  const tail = others.map((other) => {
    const totalNote = other.total === first.total ? '' : ` sur ${other.total}`;
    return ` et la ${stationInsightsPlace(other)}${totalNote} en ${other.name}`;
  });
  return `${head}${tail.join('')}.`;
}

function stationInsightsRankingSentences(station: Station, stations: readonly Station[]): string[] {
  const rankings = stationInsightsRankings(station, stations);
  const ordinal = rankings.filter((ranking) => !stationInsightsIsTied(ranking));
  const ties = rankings.filter(stationInsightsIsTied);
  const sentences = ties.map((ranking) => stationInsightsTieSentence(ranking, station.city));
  if (ordinal.length > 0) sentences.unshift(stationInsightsRankSentence(ordinal, station.city));
  return sentences;
}

function stationInsightsCostSentence(
  station: Station,
  stations: readonly Station[],
  fuel: FuelType,
  name: string,
  isShort: boolean
): string | null {
  const price = station.prices[fuel];
  if (price === null) return null;
  const cost = formatEuros(price * TANK_LITERS);
  const base = isShort
    ? `En ${name}, ${TANK_LITERS} litres coûtent ${cost}`
    : `Un plein de ${TANK_LITERS} litres de ${name} coûte ${cost}`;
  const average = isShort ? 'la moyenne' : 'la moyenne de la commune';
  const stats = computeFuelStats(stations)[fuel];
  const diff = tankDifference(price, stats.avg);
  if (diff === null || stats.count < MIN_STATIONS_TO_RANK) return `${base}.`;
  if (Math.abs(diff) < CENTS_TOLERANCE) return `${base}, soit autant que ${average}.`;
  const direction = diff > 0 ? 'de plus' : 'de moins';
  return `${base}, soit ${formatEuros(Math.abs(diff))} ${direction} que ${average}.`;
}

function stationInsightsCostSentences(station: Station, stations: readonly Station[]): string[] {
  const sentences: string[] = [];
  for (const { fuel, name } of STATION_INSIGHTS_SUMMARY_FUELS) {
    const sentence = stationInsightsCostSentence(station, stations, fuel, name, sentences.length > 0);
    if (sentence) sentences.push(sentence);
  }
  return sentences;
}

function stationInsightsNoFuelSentence(station: Station): string {
  const available = FUEL_TYPES.filter((fuel) => station.prices[fuel] !== null);
  const head = "Cette station ne publie aujourd'hui aucun prix de gazole ni de SP95-E10";
  if (available.length === 0) return `${head}, ni d'aucun autre carburant.`;
  return `${head}. Carburants proposés${NON_BREAKING_SPACE}: ${available.map((fuel) => FUEL_LABELS[fuel]).join(', ')}.`;
}

/**
 * Párrafo en francés con el puesto de la estación en su municipio (gazole y SP95-E10)
 * y el coste de llenar 50 litros frente a la media municipal. Con una sola estación en el
 * municipio no hay clasificación; sin gazole ni SP95-E10 solo se listan sus carburantes.
 */
export function stationSummary(station: Station, communeStations: readonly Station[]): string {
  const hasSummaryFuel = STATION_INSIGHTS_SUMMARY_FUELS.some(({ fuel }) => station.prices[fuel] !== null);
  if (!hasSummaryFuel) return stationInsightsNoFuelSentence(station);

  const ranking =
    communeStations.length <= 1
      ? [`C'est la seule station ${elideDe(station.city)} avec un prix publié aujourd'hui.`]
      : stationInsightsRankingSentences(station, communeStations);
  return [...ranking, ...stationInsightsCostSentences(station, communeStations)].join(' ');
}
