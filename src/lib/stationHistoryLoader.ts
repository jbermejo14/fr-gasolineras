import { HISTORY_FIRST_YEAR, HISTORY_FUELS } from './historiqueFormat.ts';
import type { FuelSeries, HistoryFuel, StationPartitionFile } from './historiqueFormat.ts';

/** Peticiones simultáneas máximas al cargar particiones. */
export const STATION_HISTORY_MAX_CONCURRENCY = 4;
const STATION_HISTORY_RECENT_YEARS = 2;
const STATION_HISTORY_HTTP_NOT_FOUND = 404;
const STATION_HISTORY_TRAILING_SLASHES = /\/+$/;

/** Devuelve la partición del año, o null si ese año no tiene fichero (404). Lanza ante cualquier otro fallo. */
export type FetchPartition = (year: number) => Promise<StationPartitionFile | null>;

/** Subconjunto de `fetch` que usa el cargador; permite sustituirlo en las pruebas. */
export type StationHistoryFetch = (url: string, init: { signal?: AbortSignal }) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

export interface StationHistoryMerged {
  weeks: string[];
  series: Record<HistoryFuel, FuelSeries>;
}

/** Años que se piden al montar: el anterior y el actual. */
export function listRecentYears(currentYear: number): number[] {
  return Array.from({ length: STATION_HISTORY_RECENT_YEARS }, (_, index) => {
    return currentYear - (STATION_HISTORY_RECENT_YEARS - 1) + index;
  });
}

/** Años desde el inicio del histórico hasta el actual que aún no se han pedido, en orden ascendente. */
export function listMissingYears(currentYear: number, requestedYears: readonly number[]): number[] {
  const requested = new Set(requestedYears);
  const missing: number[] = [];
  for (let year = HISTORY_FIRST_YEAR; year <= currentYear; year += 1) {
    if (!requested.has(year)) missing.push(year);
  }
  return missing;
}

/**
 * Crea el lector de particiones de un departamento: `${baseUrl}/${departmentCode}/${year}.json`.
 * Un 404 significa que ese año no tiene datos y devuelve null; cualquier otro fallo lanza.
 */
export function createPartitionFetcher(
  baseUrl: string,
  departmentCode: string,
  fetchFn: StationHistoryFetch,
  signal?: AbortSignal,
): FetchPartition {
  const base = baseUrl.replace(STATION_HISTORY_TRAILING_SLASHES, '');
  return async (year) => {
    const response = await fetchFn(`${base}/${departmentCode}/${year}.json`, { signal });
    if (response.status === STATION_HISTORY_HTTP_NOT_FOUND) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status} al pedir el año ${year}`);
    return (await response.json()) as StationPartitionFile;
  };
}

/**
 * Pide las particiones de los años dados con como máximo `limit` peticiones a la vez.
 * Los años sin fichero (null) se omiten. Si una petición falla, se propaga el primer error y
 * los demás trabajadores dejan de sacar años de la cola.
 */
export async function loadPartitions(
  years: readonly number[],
  fetchPartition: FetchPartition,
  limit: number = STATION_HISTORY_MAX_CONCURRENCY,
): Promise<StationPartitionFile[]> {
  const results: (StationPartitionFile | null)[] = new Array(years.length).fill(null);
  let nextIndex = 0;
  let failed = false;

  async function stationHistoryWorker(): Promise<void> {
    while (!failed && nextIndex < years.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await fetchPartition(years[index]);
      } catch (error) {
        // Se marca el fallo para frenar a los demás trabajadores y se relanza el error al llamante.
        failed = true;
        throw error;
      }
    }
  }

  const workerCount = Math.max(1, Math.min(limit, years.length));
  await Promise.all(Array.from({ length: workerCount }, () => stationHistoryWorker()));
  return results.filter((file): file is StationPartitionFile => file !== null);
}

/** ¿Hay algún precio en alguno de los carburantes? */
export function hasAnyPrice(merged: StationHistoryMerged): boolean {
  return HISTORY_FUELS.some((fuel) => merged.series[fuel].some((value) => value !== null));
}
