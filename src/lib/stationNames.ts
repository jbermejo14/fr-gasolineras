import fs from 'node:fs';
import path from 'node:path';

export const STATION_NAMES_SOURCE_URL = 'https://www.data.gouv.fr/api/1/datasets/r/0207ded0-2d19-47af-b1a6-62915ec1b721';
/** Ruta del CSV de nombres: data/cache/enseignes.csv. */
export const STATION_NAMES_FILE: string = path.join(process.cwd(), 'data', 'cache', 'enseignes.csv');

const NAMES_EXPECTED_HEADER = 'id_station_officiel,nom_normalise';
const NAMES_FETCH_HEADERS = { 'User-Agent': 'OdodexPrixCarburants/1.0' };
const NAMES_FETCH_TIMEOUT_MS = 60_000;
const NAMES_RETRY_DELAYS_SECONDS = [5, 15, 45];
const NAMES_MS_PER_SECOND = 1000;
const NAMES_QUOTE = '"';
const NAMES_LINE_FEED = '\n';
const NAMES_CARRIAGE_RETURN = '\r';
const NAMES_TIMEOUT_ERROR_NAME = 'TimeoutError';
const NAMES_TEMP_SUFFIX = '.tmp';
const NAMES_SEPARATOR = ',';
const NAMES_MULTIPLE_NAME_SEPARATOR = ';';
const NAMES_INDEPENDENT = 'indépendante';
const NAMES_BYTE_ORDER_MARK = '\uFEFF';
const NAMES_RERUN_HINT = 'Comprueba la conexión y vuelve a ejecutar npm run preparar-datos.';

/** Parser RFC 4180: filas de campos, con comillas dobles, comillas escapadas ("") y saltos de línea dentro de campo. */
function namesParseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char !== NAMES_QUOTE) field += char;
      else if (text[i + 1] === NAMES_QUOTE) {
        field += NAMES_QUOTE;
        i += 1;
      } else quoted = false;
    } else if (char === NAMES_QUOTE) quoted = true;
    else if (char === NAMES_SEPARATOR) {
      row.push(field);
      field = '';
    } else if (char === NAMES_LINE_FEED || char === NAMES_CARRIAGE_RETURN) {
      if (char === NAMES_CARRIAGE_RETURN && text[i + 1] === NAMES_LINE_FEED) i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Recorta; con « ; » toma la primera parte; vacío o « Indépendante » → null. */
function namesClean(rawName: string): string | null {
  const name = rawName.split(NAMES_MULTIPLE_NAME_SEPARATOR)[0].trim();
  if (name === '' || name.toLowerCase() === NAMES_INDEPENDENT) return null;
  return name;
}

/**
 * Parser CSV con comillas (RFC 4180). Devuelve id → nombre limpio; ignora filas sin id o sin nombre.
 * Lanza Error si la cabecera no empieza por id_station_officiel,nom_normalise.
 */
export function parseStationNamesCsv(text: string): Map<string, string> {
  const rows = namesParseRows(text.startsWith(NAMES_BYTE_ORDER_MARK) ? text.slice(1) : text);
  const header = (rows[0] ?? []).join(NAMES_SEPARATOR);
  if (!header.startsWith(NAMES_EXPECTED_HEADER)) {
    throw new Error(
      `La cabecera del CSV de nombres no empieza por ${NAMES_EXPECTED_HEADER}: revisa ${STATION_NAMES_SOURCE_URL}.`,
    );
  }
  const names = new Map<string, string>();
  for (const [rawId = '', rawName = ''] of rows.slice(1)) {
    const id = rawId.trim();
    const name = namesClean(rawName);
    if (id !== '' && name !== null) names.set(id, name);
  }
  return names;
}

async function namesFetchText(): Promise<string> {
  let response: Response;
  try {
    response = await fetch(STATION_NAMES_SOURCE_URL, {
      headers: NAMES_FETCH_HEADERS,
      signal: AbortSignal.timeout(NAMES_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === NAMES_TIMEOUT_ERROR_NAME) {
      throw new Error(
        `Tiempo de espera de ${NAMES_FETCH_TIMEOUT_MS / NAMES_MS_PER_SECOND} s agotado al descargar ${STATION_NAMES_SOURCE_URL}. ${NAMES_RERUN_HINT}`,
        { cause: err },
      );
    }
    throw err;
  }
  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status} ${response.statusText} al descargar ${STATION_NAMES_SOURCE_URL}. ${NAMES_RERUN_HINT}`);
  }
  return response.text();
}

function namesSleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * NAMES_MS_PER_SECOND));
}

async function namesFetchWithRetries(): Promise<string> {
  for (const delaySeconds of NAMES_RETRY_DELAYS_SECONDS) {
    try {
      return await namesFetchText();
    } catch (err) {
      console.warn(`Descarga de nombres fallida (${err instanceof Error ? err.message : String(err)}). Reintento en ${delaySeconds} s.`);
      await namesSleep(delaySeconds);
    }
  }
  return namesFetchText();
}

/** Descarga el CSV (timeout 60 s, 3 reintentos 5/15/45 s), comprueba su cabecera y lo guarda en `file`. */
export async function downloadStationNames(file: string = STATION_NAMES_FILE): Promise<void> {
  const text = await namesFetchWithRetries();
  if (parseStationNamesCsv(text).size === 0) {
    throw new Error(`El CSV descargado de ${STATION_NAMES_SOURCE_URL} no contiene ningún nombre: no se sobrescribe ${file}.`);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Se escribe aparte y se renombra para no dejar un fichero a medias si el proceso se interrumpe.
  const temporaryFile = `${file}${NAMES_TEMP_SUFFIX}`;
  fs.writeFileSync(temporaryFile, text);
  fs.renameSync(temporaryFile, file);
}

/** Lee el fichero; si no existe devuelve un Map vacío y avisa por consola (la web funciona sin marcas). */
export function loadStationNames(file: string = STATION_NAMES_FILE): Map<string, string> {
  if (!fs.existsSync(file)) {
    console.warn(`No existe el fichero de nombres de estaciones (${file}): la web se muestra sin marcas. Ejecuta npm run preparar-datos.`);
    return new Map();
  }
  return parseStationNamesCsv(fs.readFileSync(file, 'utf8'));
}
