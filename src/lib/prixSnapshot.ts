import fs from 'node:fs';
import path from 'node:path';
import { processRawPrixData } from './prixCarburants.ts';
import type { PrixSnapshot } from './prixCarburants.ts';

export const PRIX_SOURCE_URL =
  'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/exports/json';

/** Ruta del fichero instantánea: data/cache/prix-snapshot.json. */
export const PRIX_SNAPSHOT_FILE = path.join(process.cwd(), 'data', 'cache', 'prix-snapshot.json');

const PRIX_FETCH_HEADERS = { Accept: 'application/json', 'User-Agent': 'OdodexPrixCarburants/1.0' };
const PRIX_FETCH_TIMEOUT_MS = 120_000;
const PRIX_RETRY_DELAYS_SECONDS = [5, 15, 45];
const PRIX_MS_PER_SECOND = 1000;
const PRIX_RERUN_HINT = 'ejecuta npm run preparar-datos';

type PrixRawRecords = Parameters<typeof processRawPrixData>[0];

interface PrixSnapshotFile {
  downloadedAt: string;
  records: PrixRawRecords;
}

async function prixFetchWithTimeout(): Promise<Response> {
  try {
    return await fetch(PRIX_SOURCE_URL, {
      headers: PRIX_FETCH_HEADERS,
      signal: AbortSignal.timeout(PRIX_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error(
        `Tiempo de espera de ${PRIX_FETCH_TIMEOUT_MS / PRIX_MS_PER_SECOND} s agotado al descargar ${PRIX_SOURCE_URL}. Comprueba la conexión y vuelve a ejecutar npm run preparar-datos.`,
        { cause: err },
      );
    }
    throw err;
  }
}

async function prixFetchRecords(): Promise<PrixRawRecords> {
  const response = await prixFetchWithTimeout();
  if (!response.ok) {
    throw new Error(
      `Error HTTP ${response.status} ${response.statusText} al descargar ${PRIX_SOURCE_URL}. Comprueba la conexión y vuelve a ejecutar npm run preparar-datos.`,
    );
  }
  const records: unknown = await response.json();
  if (!Array.isArray(records)) {
    throw new Error(`La respuesta de ${PRIX_SOURCE_URL} no es una lista de estaciones: revisa la URL del flujo.`);
  }
  return records as PrixRawRecords;
}

function prixSleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * PRIX_MS_PER_SECOND));
}

async function prixFetchWithRetries(): Promise<PrixRawRecords> {
  for (const delaySeconds of PRIX_RETRY_DELAYS_SECONDS) {
    try {
      return await prixFetchRecords();
    } catch (err) {
      console.warn(`Descarga fallida (${err instanceof Error ? err.message : String(err)}). Reintento en ${delaySeconds} s.`);
      await prixSleep(delaySeconds);
    }
  }
  return prixFetchRecords();
}

/**
 * Descarga el flujo instantáneo y escribe en `file` { downloadedAt: ISO, records: JSON crudo }.
 * Timeout de 120 s y 3 reintentos (espera 5/15/45 s). Lanza Error con el estado HTTP y la URL si falla.
 */
export async function downloadPrixSnapshot(file: string = PRIX_SNAPSHOT_FILE): Promise<void> {
  const records = await prixFetchWithRetries();
  const content: PrixSnapshotFile = { downloadedAt: new Date().toISOString(), records };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(content));
}

function prixParseSnapshotFile(file: string): Partial<PrixSnapshotFile> {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<PrixSnapshotFile>;
  } catch (err) {
    throw new Error(`La instantánea de precios (${file}) no es JSON válido: ${PRIX_RERUN_HINT}.`, { cause: err });
  }
}

/**
 * Lee la instantánea y la procesa con processRawPrixData.
 * Lanza Error si el fichero falta o no es una instantánea válida.
 */
export function loadPrixSnapshot(file: string = PRIX_SNAPSHOT_FILE): PrixSnapshot {
  if (!fs.existsSync(file)) {
    throw new Error(`No existe la instantánea de precios (${file}): ${PRIX_RERUN_HINT}.`);
  }
  const content = prixParseSnapshotFile(file);
  if (!Array.isArray(content.records)) {
    throw new Error(`La instantánea de precios (${file}) no tiene la lista "records": ${PRIX_RERUN_HINT}.`);
  }
  return processRawPrixData(content.records);
}

let prixSnapshotCache: PrixSnapshot | null = null;

/** Instantánea en memoria, leída del disco una sola vez por proceso; nunca descarga. */
export async function getPrixData(): Promise<PrixSnapshot> {
  prixSnapshotCache ??= loadPrixSnapshot();
  return prixSnapshotCache;
}
