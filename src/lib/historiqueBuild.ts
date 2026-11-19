import type { AnnualStation, PriceRecord } from './annualArchive.ts';
import { DEPARTMENTS, REGIONS, departmentCodeFromPostalCode, findDepartmentByCode, findRegionByCode } from './geo.ts';
import { HISTORY_FUELS, encodeDeltaSeries } from './historiqueFormat.ts';
import type {
  AreaFuelSeries,
  AreaHistory,
  AreaHistoryFile,
  AreaIndexEntry,
  AreaKind,
  FuelSeries,
  HistoryFuel,
  HistoryIndexFile,
  PriceMilli,
  StationPartitionFile,
} from './historiqueFormat.ts';

/** Último precio conocido de cada carburante de una estación al terminar un año. */
export type CarryState = Partial<Record<HistoryFuel, { maj: string; priceMilli: PriceMilli }>>;
export const HISTORY_STALE_DAYS = 30;

const HISTORIQUE_BUILD_FORMAT_VERSION = 1;
const HISTORIQUE_BUILD_END_OF_DAY = 'T23:59:59';
const HISTORIQUE_BUILD_DATE_LENGTH = 10;
const HISTORIQUE_BUILD_MILLIS_PER_DAY = 86_400_000;
const HISTORIQUE_BUILD_FRANCE_SLUG = 'france';
const HISTORIQUE_BUILD_FRANCE_NAME = 'France';

type HistoriqueBuildFuelSeries = Record<HistoryFuel, FuelSeries>;
type HistoriqueBuildFuelTotals = { sum: number[]; count: number[]; min: (PriceMilli | null)[] };
type HistoriqueBuildAreaTotals = Record<HistoryFuel, HistoriqueBuildFuelTotals>;

/** Un registro conservado de un carburante: el estado heredado cuenta como anterior a todo el año. */
interface HistoriqueBuildTimedPrice {
  maj: string;
  priceMilli: PriceMilli;
}

function historiqueBuildDayNumber(isoDate: string): number {
  return Date.parse(`${isoDate.slice(0, HISTORIQUE_BUILD_DATE_LENGTH)}T00:00:00Z`) / HISTORIQUE_BUILD_MILLIS_PER_DAY;
}

function historiqueBuildIsStale(maj: string, monday: string): boolean {
  return historiqueBuildDayNumber(monday) - historiqueBuildDayNumber(maj) > HISTORY_STALE_DAYS;
}

function historiqueBuildFuelTimeline(
  records: readonly PriceRecord[],
  fuel: HistoryFuel,
  carryIn: CarryState | undefined
): HistoriqueBuildTimedPrice[] {
  const timeline: HistoriqueBuildTimedPrice[] = [];
  const inherited = carryIn?.[fuel];
  if (inherited) timeline.push(inherited);
  const own = records.filter((record) => record.fuel === fuel);
  // sort es estable: en empate de maj queda el último del fichero.
  own.sort((a, b) => (a.maj < b.maj ? -1 : a.maj > b.maj ? 1 : 0));
  for (const record of own) timeline.push(record);
  return timeline;
}

function historiqueBuildWeeklyValues(
  timeline: readonly HistoriqueBuildTimedPrice[],
  mondays: readonly string[]
): FuelSeries {
  let cursor = 0;
  return mondays.map((monday) => {
    const limit = `${monday}${HISTORIQUE_BUILD_END_OF_DAY}`;
    while (cursor < timeline.length && timeline[cursor].maj <= limit) cursor++;
    const known = cursor > 0 ? timeline[cursor - 1] : null;
    if (!known || historiqueBuildIsStale(known.maj, monday)) return null;
    return known.priceMilli;
  });
}

/**
 * Valor de cada lunes: el registro con mayor maj que sea <= `${lunes}T23:59:59` (empate de maj: el último del fichero),
 * contando carryIn como anterior a todos; null si no hay o si su fecha es más de HISTORY_STALE_DAYS días anterior al lunes.
 * Devuelve las series (una posición por lunes de `mondays`) y el estado al final (último registro del año por carburante).
 */
export function weeklyStationSeries(
  records: readonly PriceRecord[],
  mondays: readonly string[],
  carryIn: CarryState | undefined
): { series: Record<HistoryFuel, FuelSeries>; carryOut: CarryState } {
  const series = {} as HistoriqueBuildFuelSeries;
  const carryOut: CarryState = {};
  for (const fuel of HISTORY_FUELS) {
    const timeline = historiqueBuildFuelTimeline(records, fuel, carryIn);
    series[fuel] = historiqueBuildWeeklyValues(timeline, mondays);
    const last = timeline[timeline.length - 1];
    if (last) carryOut[fuel] = { maj: last.maj, priceMilli: last.priceMilli };
  }
  return { series, carryOut };
}

/** Resultado de un año, cacheado en data/historique/annees/{year}.json.gz. */
export interface YearResult {
  version: 1;
  year: number;
  /** Lunes de ese año (recortados por --hasta en el año final). */
  weeks: string[];
  /** Tamaño del zip con el que se calculó. */
  zipSize: number;
  zipMtimeMs: number;
  /** Clave `${kind}:${slug}`. */
  areas: Record<string, Record<HistoryFuel, { sum: number[]; count: number[]; min: (PriceMilli | null)[] }>>;
  /** Estación → estado al final del año. */
  carryOut: Record<string, CarryState>;
  /** Rutas relativas escritas: `${departmentCode}/${year}.json`. */
  partitionFiles: string[];
}

function historiqueBuildAreaKey(kind: AreaKind, slug: string): string {
  return `${kind}:${slug}`;
}

function historiqueBuildNewAreaTotals(weekCount: number): HistoriqueBuildAreaTotals {
  const totals = {} as HistoriqueBuildAreaTotals;
  for (const fuel of HISTORY_FUELS) {
    totals[fuel] = {
      sum: new Array<number>(weekCount).fill(0),
      count: new Array<number>(weekCount).fill(0),
      min: new Array<PriceMilli | null>(weekCount).fill(null),
    };
  }
  return totals;
}

function historiqueBuildEncodeStation(series: HistoriqueBuildFuelSeries): StationPartitionFile['stations'][string] {
  const encoded: StationPartitionFile['stations'][string] = {};
  for (const fuel of HISTORY_FUELS) {
    if (series[fuel].some((value) => value !== null)) encoded[fuel] = encodeDeltaSeries(series[fuel]);
  }
  return encoded;
}

/** Procesa un año entero. Área de cada estación: 'france' siempre; departamento por departmentCodeFromPostalCode(cp) y su región. Desconocido → solo France. */
export class YearAccumulator {
  private readonly year: number;
  private readonly weeks: string[];
  private readonly carryIn: Readonly<Record<string, CarryState>>;
  private readonly areas = new Map<string, HistoriqueBuildAreaTotals>();
  private readonly carryOut: Record<string, CarryState> = {};
  private readonly stationsByDepartment = new Map<string, StationPartitionFile['stations']>();

  constructor(year: number, weeks: readonly string[], carryIn: Readonly<Record<string, CarryState>>) {
    this.year = year;
    this.weeks = [...weeks];
    this.carryIn = carryIn;
  }

  addStation(station: AnnualStation): void {
    const { series, carryOut } = weeklyStationSeries(station.records, this.weeks, this.carryIn[station.id]);
    if (Object.keys(carryOut).length > 0) this.carryOut[station.id] = carryOut;
    const departmentCode = departmentCodeFromPostalCode(station.postalCode);
    for (const key of this.areaKeysFor(departmentCode)) this.addToArea(key, series);
    if (departmentCode) this.addToPartition(departmentCode, station.id, series);
  }

  /** Particiones por departamento (estaciones con algún valor no nulo ese año; series en delta) y el YearResult sin zipSize/zipMtimeMs/partitionFiles. */
  build(): { partitions: StationPartitionFile[]; result: Omit<YearResult, 'zipSize' | 'zipMtimeMs' | 'partitionFiles'> } {
    const partitions = [...this.stationsByDepartment.keys()].sort().map((departmentCode) => ({
      version: HISTORIQUE_BUILD_FORMAT_VERSION as 1,
      departmentCode,
      year: this.year,
      weeks: [...this.weeks],
      stations: this.stationsByDepartment.get(departmentCode) ?? {},
    }));
    const areas: YearResult['areas'] = {};
    for (const [key, totals] of this.areas) areas[key] = totals;
    return {
      partitions,
      result: {
        version: HISTORIQUE_BUILD_FORMAT_VERSION,
        year: this.year,
        weeks: [...this.weeks],
        areas,
        carryOut: this.carryOut,
      },
    };
  }

  private areaKeysFor(departmentCode: string | null): string[] {
    const keys = [historiqueBuildAreaKey('france', HISTORIQUE_BUILD_FRANCE_SLUG)];
    const department = departmentCode ? findDepartmentByCode(departmentCode) : null;
    const region = department ? findRegionByCode(department.regionCode) : null;
    if (region) keys.push(historiqueBuildAreaKey('region', region.slug));
    if (department) keys.push(historiqueBuildAreaKey('departement', department.slug));
    return keys;
  }

  private addToArea(key: string, series: HistoriqueBuildFuelSeries): void {
    let totals = this.areas.get(key);
    if (!totals) {
      totals = historiqueBuildNewAreaTotals(this.weeks.length);
      this.areas.set(key, totals);
    }
    for (const fuel of HISTORY_FUELS) {
      series[fuel].forEach((price, week) => {
        if (price === null) return;
        const fuelTotals = totals[fuel];
        fuelTotals.sum[week] += price;
        fuelTotals.count[week] += 1;
        const currentMin = fuelTotals.min[week];
        if (currentMin === null || price < currentMin) fuelTotals.min[week] = price;
      });
    }
  }

  private addToPartition(departmentCode: string, stationId: string, series: HistoriqueBuildFuelSeries): void {
    const encoded = historiqueBuildEncodeStation(series);
    if (Object.keys(encoded).length === 0) return;
    let stations = this.stationsByDepartment.get(departmentCode);
    if (!stations) {
      stations = {};
      this.stationsByDepartment.set(departmentCode, stations);
    }
    stations[stationId] = encoded;
  }
}

function historiqueBuildConcatFuel(
  results: readonly YearResult[],
  key: string,
  fuel: HistoryFuel
): HistoriqueBuildFuelTotals {
  const merged: HistoriqueBuildFuelTotals = { sum: [], count: [], min: [] };
  for (const result of results) {
    const part = result.areas[key]?.[fuel];
    const weekCount = result.weeks.length;
    merged.sum.push(...(part?.sum ?? new Array<number>(weekCount).fill(0)));
    merged.count.push(...(part?.count ?? new Array<number>(weekCount).fill(0)));
    merged.min.push(...(part?.min ?? new Array<PriceMilli | null>(weekCount).fill(null)));
  }
  return merged;
}

function historiqueBuildFuelSeries(totals: HistoriqueBuildFuelTotals): AreaFuelSeries {
  return {
    avg: totals.count.map((count, week) => (count > 0 ? Math.round(totals.sum[week] / count) : null)),
    min: totals.count.map((count, week) => (count > 0 ? totals.min[week] : null)),
    count: [...totals.count],
  };
}

function historiqueBuildAreaFile(
  results: readonly YearResult[],
  entry: AreaIndexEntry,
  weeks: string[]
): AreaHistoryFile | null {
  const key = historiqueBuildAreaKey(entry.kind, entry.slug);
  const series = {} as Record<HistoryFuel, AreaFuelSeries>;
  for (const fuel of HISTORY_FUELS) {
    series[fuel] = historiqueBuildFuelSeries(historiqueBuildConcatFuel(results, key, fuel));
  }
  if (!HISTORY_FUELS.some((fuel) => series[fuel].count.some((count) => count > 0))) return null;
  const area: AreaHistory = { ...entry, series };
  return { version: HISTORIQUE_BUILD_FORMAT_VERSION, weeks, area };
}

function historiqueBuildAllEntries(): AreaIndexEntry[] {
  const regionSlugByCode = new Map(REGIONS.map((region) => [region.code, region.slug]));
  return [
    { kind: 'france', slug: HISTORIQUE_BUILD_FRANCE_SLUG, name: HISTORIQUE_BUILD_FRANCE_NAME },
    ...REGIONS.map((region): AreaIndexEntry => ({ kind: 'region', slug: region.slug, name: region.name })),
    ...DEPARTMENTS.map(
      (department): AreaIndexEntry => ({
        kind: 'departement',
        slug: department.slug,
        name: department.name,
        parentSlug: regionSlugByCode.get(department.regionCode),
      })
    ),
  ];
}

/** Une los años (en orden) en el índice y los ficheros de zona. avg = Math.round(sum/count); count 0 → avg y min null. Zonas sin ningún dato se omiten.
 * Orden: France, regiones (orden de REGIONS), departamentos (orden de DEPARTMENTS). Nombres de geo.ts. */
export function mergeYearResults(
  results: readonly YearResult[],
  generatedAt: string
): { index: HistoryIndexFile; areas: AreaHistoryFile[] } {
  const weeks = results.flatMap((result) => result.weeks);
  const areas: AreaHistoryFile[] = [];
  const entries: AreaIndexEntry[] = [];
  for (const entry of historiqueBuildAllEntries()) {
    const file = historiqueBuildAreaFile(results, entry, [...weeks]);
    if (!file) continue;
    areas.push(file);
    entries.push(entry);
  }
  const index: HistoryIndexFile = {
    version: HISTORIQUE_BUILD_FORMAT_VERSION,
    generatedAt,
    weeks,
    areas: entries,
  };
  return { index, areas };
}
