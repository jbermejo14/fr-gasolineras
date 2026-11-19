import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { readAnnualZip, readZipEntries } from '../src/lib/annualArchive.ts';
import { brandGroupOf } from '../src/lib/brands.ts';
import { HISTORY_YEAR_RESULT_VERSION, YearAccumulator, computeBrandsSignature, mergeYearResults } from '../src/lib/historiqueBuild.ts';
import type { BrandOfStation, CarryState, YearResult } from '../src/lib/historiqueBuild.ts';
import { HISTORY_FIRST_YEAR, HISTORY_START_DATE, listMondays, yearOfIso } from '../src/lib/historiqueFormat.ts';
import { loadStationNames } from '../src/lib/stationNames.ts';

const ANNUAL_URL_BASE = 'https://donnees.roulez-eco.fr/opendata/annee';
const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const FETCH_TIMEOUT_MS = 300_000;
const RETRY_DELAYS_SECONDS = [5, 15, 45];
const MILLIS_PER_SECOND = 1000;
const BYTES_PER_MEGABYTE = 1_000_000;
const SIZE_DECIMALS = 1;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_LENGTH = 10;
const FINAL_ZIP_MONTH_INDEX = 0;
const FINAL_ZIP_DAY = 3;
const NUMBER_LOCALE = 'fr-FR';

const OPTION_UNTIL_PREFIX = '--hasta=';
const OPTION_REBUILD = '--rehacer';

const DATA_DIR = path.join('data', 'historique');
const ZIP_DIR = path.join(DATA_DIR, 'zip');
const YEARS_DIR = path.join(DATA_DIR, 'annees');
const INDEX_FILE = path.join(DATA_DIR, 'indice.json');
const ZONES_DIR = path.join(DATA_DIR, 'zones');
const STATIONS_DIR = path.join('public', 'historique-stations');
const YEAR_CACHE_EXTENSION = '.json.gz';

export interface HistoriqueArgs {
  /** Fecha ISO límite (incluida) o null para usar hoy. */
  until: string | null;
  /** Ignora la caché de años y los reprocesa todos. */
  rebuild: boolean;
}

function historiqueIsValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, ISO_DATE_LENGTH) === value;
}

/** Interpreta los argumentos de línea de comandos; lanza Error con un mensaje claro si no son válidos. */
export function parseHistoriqueArgs(argv: readonly string[]): HistoriqueArgs {
  const args: HistoriqueArgs = { until: null, rebuild: false };
  for (const arg of argv) {
    if (arg === OPTION_REBUILD) {
      args.rebuild = true;
    } else if (arg.startsWith(OPTION_UNTIL_PREFIX)) {
      const value = arg.slice(OPTION_UNTIL_PREFIX.length);
      if (!historiqueIsValidIsoDate(value)) {
        throw new Error(
          `Fecha inválida en ${OPTION_UNTIL_PREFIX}: "${value}". Usa el formato yyyy-mm-dd, por ejemplo 2020-01-06.`
        );
      }
      if (value < HISTORY_START_DATE) {
        throw new Error(
          `Fecha anterior al inicio del histórico en ${OPTION_UNTIL_PREFIX}: "${value}". La primera semana es ${HISTORY_START_DATE}.`
        );
      }
      args.until = value;
    } else {
      throw new Error(
        `Opción desconocida: "${arg}". Opciones válidas: ${OPTION_UNTIL_PREFIX}yyyy-mm-dd, ${OPTION_REBUILD}.`
      );
    }
  }
  return args;
}

function historiqueEndDate(until: string | null, now: Date): Date {
  return until ? new Date(`${until}T00:00:00Z`) : now;
}

/** Años a procesar: de HISTORY_FIRST_YEAR al año de `until` (o de `now` si es null). */
export function yearsToProcess(until: string | null, now: Date = new Date()): number[] {
  const lastYear = historiqueEndDate(until, now).getUTCFullYear();
  const years: number[] = [];
  for (let year = HISTORY_FIRST_YEAR; year <= lastYear; year++) years.push(year);
  return years;
}

/** Un zip es definitivo si se descargó el 3 de enero del año siguiente o después (hora local): ya no cambiará. */
export function isZipFinal(year: number, mtime: Date | number): boolean {
  const threshold = new Date(year + 1, FINAL_ZIP_MONTH_INDEX, FINAL_ZIP_DAY);
  return new Date(mtime).getTime() >= threshold.getTime();
}

function historiqueErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function historiqueSleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * MILLIS_PER_SECOND));
}

function historiqueFormatMegabytes(bytes: number): string {
  return (bytes / BYTES_PER_MEGABYTE).toLocaleString(NUMBER_LOCALE, {
    minimumFractionDigits: SIZE_DECIMALS,
    maximumFractionDigits: SIZE_DECIMALS,
  });
}

/** Ejecuta la operación con reintentos y esperas crecientes; relanza el último error. */
async function historiqueWithRetries<T>(label: string, operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= RETRY_DELAYS_SECONDS.length) throw error;
      const delay = RETRY_DELAYS_SECONDS[attempt];
      console.warn(`${label}: fallo (${historiqueErrorMessage(error)}). Reintento ${attempt + 1} en ${delay} s.`);
      await historiqueSleep(delay);
    }
  }
}

/** Escribe a un fichero temporal y lo renombra: un corte a mitad no deja un fichero corrupto. */
function historiqueWriteFileAtomic(file: string, content: Buffer): void {
  const temporary = `${file}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(temporary, content);
  fs.renameSync(temporary, file);
}

function historiqueWriteJson(file: string, value: unknown): void {
  historiqueWriteFileAtomic(file, Buffer.from(JSON.stringify(value)));
}

function historiqueZipPath(year: number): string {
  return path.join(ZIP_DIR, `${year}.zip`);
}

async function historiqueFetchZip(year: number, target: string): Promise<void> {
  const response = await fetch(`${ANNUAL_URL_BASE}/${year}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  const temporary = `${target}.tmp`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await pipeline(Readable.fromWeb(response.body as WebReadableStream), fs.createWriteStream(temporary));
  historiqueAssertValidZip(year, temporary);
  fs.renameSync(temporary, target);
}

/** Comprueba que lo descargado es un zip (el servidor puede devolver una página de error con HTTP 200). */
function historiqueAssertValidZip(year: number, file: string): void {
  try {
    readZipEntries(fs.readFileSync(file));
  } catch (error) {
    throw new Error();
  }
}

/** Descarga el zip del año si falta o no es definitivo. Lanza Error si se agotan los reintentos. */
async function historiqueEnsureZip(year: number): Promise<void> {
  const file = historiqueZipPath(year);
  if (fs.existsSync(file) && isZipFinal(year, fs.statSync(file).mtimeMs)) return;
  await historiqueWithRetries(`[${year}] descarga`, () => historiqueFetchZip(year, file));
  console.log(`[${year}] descargado (${historiqueFormatMegabytes(fs.statSync(file).size)} MB)`);
}

function historiqueYearCacheFile(year: number): string {
  return path.join(YEARS_DIR, `${year}${YEAR_CACHE_EXTENSION}`);
}

function historiqueWeeksOfYear(year: number, until: string | null, now: Date): string[] {
  return listMondays(HISTORY_START_DATE, historiqueEndDate(until, now)).filter((week) => yearOfIso(week) === year);
}

function historiqueLoadYearCache(year: number): YearResult | null {
  const file = historiqueYearCacheFile(year);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')) as YearResult;
  } catch (error) {
    console.warn(`[${year}] caché ilegible (${historiqueErrorMessage(error)}): se reprocesa.`);
    return null;
  }
}

/** Zip con el que se calcula (o se comprueba) un año. */
export interface HistoriqueZipInfo {
  size: number;
  mtimeMs: number;
}

/** Redes de las estaciones: función de consulta y huella para invalidar la caché si cambian. */
export interface HistoriqueBrands {
  brandOfStation: BrandOfStation;
  signature: string;
}

/** Una caché de año vale si coinciden versión, semanas, zip, huella de redes y existen todas sus particiones. */
export function historiqueIsCacheUsable(
  cached: YearResult,
  weeks: readonly string[],
  zip: HistoriqueZipInfo,
  brandsSignature: string,
  partitionExists: (relative: string) => boolean
): boolean {
  return (
    cached.version === HISTORY_YEAR_RESULT_VERSION &&
    cached.brandsSignature === brandsSignature &&
    cached.weeks.length === weeks.length &&
    cached.weeks.every((week, index) => week === weeks[index]) &&
    cached.zipSize === zip.size &&
    cached.zipMtimeMs === zip.mtimeMs &&
    cached.partitionFiles.every(partitionExists)
  );
}

interface HistoriqueYearOutcome {
  result: YearResult;
  reused: boolean;
}

async function historiqueProcessYear(
  year: number,
  weeks: readonly string[],
  carryIn: Readonly<Record<string, CarryState>>,
  brands: HistoriqueBrands
): Promise<YearResult> {
  const startedAt = Date.now();
  const zipFile = historiqueZipPath(year);
  const accumulator = new YearAccumulator(year, weeks, carryIn, brands.brandOfStation);
  await readAnnualZip(zipFile, (station) => accumulator.addStation(station));
  const { partitions, result } = accumulator.build();
  const partitionFiles = partitions.map((partition) => `${partition.departmentCode}/${year}.json`);
  partitions.forEach((partition, index) => {
    historiqueWriteJson(path.join(STATIONS_DIR, partitionFiles[index]), partition);
  });
  const stat = fs.statSync(zipFile);
  const yearResult: YearResult = { ...result, zipSize: stat.size, zipMtimeMs: stat.mtimeMs, brandsSignature: brands.signature, partitionFiles };
  historiqueWriteFileAtomic(historiqueYearCacheFile(year), zlib.gzipSync(JSON.stringify(yearResult)));
  const seconds = Math.round((Date.now() - startedAt) / MILLIS_PER_SECOND);
  const stations = Object.keys(result.carryOut).length.toLocaleString(NUMBER_LOCALE);
  console.log(`[${year}] ${stations} estaciones, ${weeks.length} semanas, ${partitions.length} particiones (${seconds} s)`);
  return yearResult;
}

async function historiqueRunYear(
  year: number,
  args: HistoriqueArgs,
  previous: HistoriqueYearOutcome | null,
  brands: HistoriqueBrands
): Promise<HistoriqueYearOutcome> {
  await historiqueEnsureZip(year);
  const weeks = historiqueWeeksOfYear(year, args.until, new Date());
  const cached = args.rebuild || (year > HISTORY_FIRST_YEAR && !previous?.reused) ? null : historiqueLoadYearCache(year);
  if (cached && historiqueIsCacheUsable(cached, weeks, fs.statSync(historiqueZipPath(year)), brands.signature, (relative) =>
      fs.existsSync(path.join(STATIONS_DIR, relative))
    )) {
    console.log(`[${year}] reutilizado de la caché`);
    return { result: cached, reused: true };
  }
  const result = await historiqueProcessYear(year, weeks, previous?.result.carryOut ?? {}, brands);
  return { result, reused: false };
}

interface HistoriqueYearsReport {
  results: YearResult[];
  failed: number[];
  skipped: number[];
}

/** Procesa los años en orden; tras un fallo, los siguientes se saltan porque les falta el estado heredado. */
async function historiqueRunYears(
  years: readonly number[],
  args: HistoriqueArgs,
  brands: HistoriqueBrands
): Promise<HistoriqueYearsReport> {
  const report: HistoriqueYearsReport = { results: [], failed: [], skipped: [] };
  let previous: HistoriqueYearOutcome | null = null;
  for (const year of years) {
    if (report.failed.length > 0) {
      report.skipped.push(year);
      continue;
    }
    try {
      previous = await historiqueRunYear(year, args, previous, brands);
      report.results.push(previous.result);
    } catch (error) {
      report.failed.push(year);
      console.error(`[${year}] FALLO: ${historiqueErrorMessage(error)}`);
    }
  }
  return report;
}

/** Escribe el índice y los ficheros de zona; devuelve cuántos ficheros escribió. */
function historiqueWriteAggregates(results: readonly YearResult[]): number {
  const { index, areas } = mergeYearResults(results, new Date().toISOString());
  historiqueWriteJson(INDEX_FILE, index);
  for (const file of areas) {
    historiqueWriteJson(path.join(ZONES_DIR, file.area.kind, `${file.area.slug}.json`), file);
  }
  return areas.length + 1;
}

function historiquePrintSummary(report: HistoriqueYearsReport, filesWritten: number | null): void {
  console.log('\nResumen');
  console.log(`- Años procesados o reutilizados: ${report.results.length}`);
  if (report.failed.length > 0) console.log(`- Años fallidos: ${report.failed.join(', ')}`);
  if (report.skipped.length > 0) {
    console.log(`- Años sin procesar por depender del fallido: ${report.skipped.join(', ')}`);
  }
  console.log(
    filesWritten === null
      ? '- No se escribieron índice ni zonas para no publicar un histórico incompleto.'
      : `- Ficheros de índice y zonas escritos: ${filesWritten}`
  );
}

/** Código de salida: fallo si algún año falló, para que un cron lo detecte. */
export function resolveHistoriqueExitCode(failedYears: number): number {
  return failedYears > 0 ? EXIT_FAILURE : EXIT_OK;
}

/** Red de cada estación con nombre. Sin nombres el mapa sale vacío (loadStationNames ya avisa) y no hay zonas de marca. */
export function historiqueBrandsOf(names: ReadonlyMap<string, string>): HistoriqueBrands {
  const brandByStation = new Map<string, string>();
  for (const [id, name] of names) {
    const brand = brandGroupOf(name);
    if (brand) brandByStation.set(id, brand.slug);
  }
  return {
    brandOfStation: (id) => brandByStation.get(id) ?? null,
    signature: computeBrandsSignature(brandByStation),
  };
}

async function historiqueMain(): Promise<number> {
  const args = parseHistoriqueArgs(process.argv.slice(2));
  const years = yearsToProcess(args.until);
  console.log(`Años ${years[0]}-${years[years.length - 1]}${args.rebuild ? ' (reproceso completo)' : ''}.`);
  const report = await historiqueRunYears(years, args, historiqueBrandsOf(loadStationNames()));
  const filesWritten = report.failed.length === 0 ? historiqueWriteAggregates(report.results) : null;
  historiquePrintSummary(report, filesWritten);
  return resolveHistoriqueExitCode(report.failed.length);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  historiqueMain().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(`Error: ${historiqueErrorMessage(error)}`);
      process.exitCode = EXIT_FAILURE;
    }
  );
}
