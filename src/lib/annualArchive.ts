import fs from 'node:fs';
import readline from 'node:readline';
import { Readable } from 'node:stream';
import zlib from 'node:zlib';
import { fuelFromSourceName, parseValidPrice } from './fuels.ts';
import { HISTORY_FUELS, priceToMilli } from './historiqueFormat.ts';
import type { HistoryFuel, PriceMilli } from './historiqueFormat.ts';

export interface ZipEntry {
  fileName: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  dataOffset: number;
}

export interface PriceRecord {
  fuel: HistoryFuel;
  /** Fecha local francesa 'yyyy-mm-ddThh:mm:ss'. */
  maj: string;
  priceMilli: PriceMilli;
}

export interface AnnualStation {
  id: string;
  postalCode: string;
  /** En el orden del fichero (no ordenados por fecha). */
  records: PriceRecord[];
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_SIZE = 22;
const EOCD_MAX_COMMENT = 0xffff;
const EOCD_ENTRY_COUNT_OFFSET = 10;
const EOCD_DIRECTORY_SIZE_OFFSET = 12;
const EOCD_DIRECTORY_OFFSET_OFFSET = 16;
const CENTRAL_HEADER_SIZE = 46;
const CENTRAL_METHOD_OFFSET = 10;
const CENTRAL_COMPRESSED_OFFSET = 20;
const CENTRAL_UNCOMPRESSED_OFFSET = 24;
const CENTRAL_NAME_LENGTH_OFFSET = 28;
const CENTRAL_EXTRA_LENGTH_OFFSET = 30;
const CENTRAL_COMMENT_LENGTH_OFFSET = 32;
const CENTRAL_LOCAL_OFFSET_OFFSET = 42;
const LOCAL_HEADER_SIZE = 30;
const LOCAL_NAME_LENGTH_OFFSET = 26;
const LOCAL_EXTRA_LENGTH_OFFSET = 28;
const ZIP64_MARKER_16 = 0xffff;
const ZIP64_MARKER_32 = 0xffffffff;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
const XML_EXTENSION = '.xml';
const ZIP_NAME_ENCODING = 'utf8';
const XML_ENCODING = 'latin1';
const INTEGER_MILLI_THRESHOLD = 100;
const MILLIS_PER_EURO = 1000;

const PDV_START = '<pdv ';
const PDV_END = '</pdv>';
const PRIX_START = '<prix ';
const ID_ATTRIBUTE = /\bid="([^"]*)"/;
const POSTAL_CODE_ATTRIBUTE = /\bcp="([^"]*)"/;
const FUEL_NAME_ATTRIBUTE = /\bnom="([^"]*)"/;
const UPDATE_ATTRIBUTE = /\bmaj="([^"]*)"/;
const VALUE_ATTRIBUTE = /\bvaleur="([^"]*)"/;
const UPDATE_PATTERN = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})$/;
const INTEGER_VALUE_PATTERN = /^\d+$/;
const DECIMAL_VALUE_PATTERN = /^\d*\.\d+$/;

function annualArchiveFindEndRecord(zip: Buffer): number {
  const lowest = Math.max(0, zip.length - EOCD_MIN_SIZE - EOCD_MAX_COMMENT);
  for (let offset = zip.length - EOCD_MIN_SIZE; offset >= lowest; offset--) {
    if (zip.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  throw new Error('El fichero no es un zip válido: no se encontró el final del directorio central.');
}

function annualArchiveReadEntry(zip: Buffer, offset: number): ZipEntry & { next: number } {
  if (offset + CENTRAL_HEADER_SIZE > zip.length || zip.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
    throw new Error('El zip está dañado: cabecera del directorio central no válida.');
  }
  const nameLength = zip.readUInt16LE(offset + CENTRAL_NAME_LENGTH_OFFSET);
  const extraLength = zip.readUInt16LE(offset + CENTRAL_EXTRA_LENGTH_OFFSET);
  const commentLength = zip.readUInt16LE(offset + CENTRAL_COMMENT_LENGTH_OFFSET);
  const compressedSize = zip.readUInt32LE(offset + CENTRAL_COMPRESSED_OFFSET);
  const uncompressedSize = zip.readUInt32LE(offset + CENTRAL_UNCOMPRESSED_OFFSET);
  const localOffset = zip.readUInt32LE(offset + CENTRAL_LOCAL_OFFSET_OFFSET);
  if ([compressedSize, uncompressedSize, localOffset].includes(ZIP64_MARKER_32)) {
    throw new Error('El zip usa zip64, que no está soportado.');
  }
  const nameStart = offset + CENTRAL_HEADER_SIZE;
  return {
    fileName: zip.toString(ZIP_NAME_ENCODING, nameStart, nameStart + nameLength),
    method: zip.readUInt16LE(offset + CENTRAL_METHOD_OFFSET),
    compressedSize,
    uncompressedSize,
    dataOffset: annualArchiveDataOffset(zip, localOffset),
    next: nameStart + nameLength + extraLength + commentLength,
  };
}

function annualArchiveDataOffset(zip: Buffer, localOffset: number): number {
  if (localOffset + LOCAL_HEADER_SIZE > zip.length || zip.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
    throw new Error('El zip está dañado: cabecera local no válida.');
  }
  const nameLength = zip.readUInt16LE(localOffset + LOCAL_NAME_LENGTH_OFFSET);
  const extraLength = zip.readUInt16LE(localOffset + LOCAL_EXTRA_LENGTH_OFFSET);
  return localOffset + LOCAL_HEADER_SIZE + nameLength + extraLength;
}

/** Lee el directorio central (EOCD → central directory → local header) de un zip en memoria. Lanza Error si no es un zip válido o usa zip64. */
export function readZipEntries(zip: Buffer): ZipEntry[] {
  const end = annualArchiveFindEndRecord(zip);
  const count = zip.readUInt16LE(end + EOCD_ENTRY_COUNT_OFFSET);
  const directoryOffset = zip.readUInt32LE(end + EOCD_DIRECTORY_OFFSET_OFFSET);
  const directorySize = zip.readUInt32LE(end + EOCD_DIRECTORY_SIZE_OFFSET);
  if (count === ZIP64_MARKER_16 || directoryOffset === ZIP64_MARKER_32 || directorySize === ZIP64_MARKER_32) {
    throw new Error('El zip usa zip64, que no está soportado.');
  }
  const entries: ZipEntry[] = [];
  let offset = directoryOffset;
  for (let index = 0; index < count; index++) {
    const { next, ...entry } = annualArchiveReadEntry(zip, offset);
    entries.push(entry);
    offset = next;
  }
  return entries;
}

/** Stream de los bytes descomprimidos de una entrada (método 8 → inflate raw; método 0 → tal cual). Otro método → Error. */
export function openZipEntry(zip: Buffer, entry: ZipEntry): NodeJS.ReadableStream {
  if (entry.method !== METHOD_STORED && entry.method !== METHOD_DEFLATE) {
    throw new Error(`Método de compresión ${entry.method} no soportado en "${entry.fileName}" (solo 0 y 8).`);
  }
  const end = entry.dataOffset + entry.compressedSize;
  if (end > zip.length) {
    throw new Error(`El zip está truncado: "${entry.fileName}" termina fuera del fichero.`);
  }
  const raw = Readable.from([zip.subarray(entry.dataOffset, end)], { objectMode: false });
  return entry.method === METHOD_STORED ? raw : raw.pipe(zlib.createInflateRaw());
}

/** Convierte `valeur` a milésimas (con punto: euros; entero ≥ 100: milésimas; entero < 100: euros) y valida el rango; null si no es válido. */
export function parseAnnualValue(valeur: string): PriceMilli | null {
  const text = valeur.trim();
  let euros: number;
  if (DECIMAL_VALUE_PATTERN.test(text)) {
    euros = Number(text);
  } else if (INTEGER_VALUE_PATTERN.test(text)) {
    const integer = Number(text);
    euros = integer >= INTEGER_MILLI_THRESHOLD ? integer / MILLIS_PER_EURO : integer;
  } else {
    return null;
  }
  const price = parseValidPrice(euros);
  return price === null ? null : priceToMilli(price);
}

function annualArchiveAttribute(line: string, pattern: RegExp): string | null {
  return pattern.exec(line)?.[1] ?? null;
}

function annualArchiveParsePrice(line: string): PriceRecord | null {
  const fuel = fuelFromSourceName(annualArchiveAttribute(line, FUEL_NAME_ATTRIBUTE) ?? '');
  const update = UPDATE_PATTERN.exec(annualArchiveAttribute(line, UPDATE_ATTRIBUTE) ?? '');
  const valeur = annualArchiveAttribute(line, VALUE_ATTRIBUTE);
  if (!fuel || !update || valeur === null) return null;
  if (!(HISTORY_FUELS as readonly string[]).includes(fuel)) return null;
  const priceMilli = parseAnnualValue(valeur);
  if (priceMilli === null) return null;
  return { fuel: fuel as HistoryFuel, maj: `${update[1]}T${update[2]}`, priceMilli };
}

/**
 * Recorre las líneas del XML (ya decodificadas como latin1) y llama a onStation al cerrar cada <pdv>.
 * Solo extrae id y cp del <pdv> y los <prix> de HISTORY_FUELS con valeur y maj válidos; ignora el resto.
 * Basta un parser por líneas porque los ficheros oficiales traen un elemento por línea.
 * Tolerante: un <prix> mal formado se salta (es parte del contrato: los ficheros oficiales traen basura), no lanza.
 */
export async function parseAnnualXml(
  lines: AsyncIterable<string> | Iterable<string>,
  onStation: (station: AnnualStation) => void
): Promise<void> {
  let current: AnnualStation | null = null;
  for await (const line of lines) {
    if (line.includes(PDV_START)) {
      current = {
        id: annualArchiveAttribute(line, ID_ATTRIBUTE) ?? '',
        postalCode: annualArchiveAttribute(line, POSTAL_CODE_ATTRIBUTE) ?? '',
        records: [],
      };
    } else if (current && line.includes(PRIX_START)) {
      const record = annualArchiveParsePrice(line);
      if (record) current.records.push(record);
    } else if (current && line.includes(PDV_END)) {
      if (current.id) onStation(current);
      current = null;
    }
  }
}

function annualArchiveSelectXml(zip: Buffer, zipFile: string): ZipEntry {
  const entry = readZipEntries(zip).find((candidate) => candidate.fileName.toLowerCase().endsWith(XML_EXTENSION));
  if (!entry) throw new Error(`El zip ${zipFile} no contiene ningún fichero ${XML_EXTENSION}.`);
  return entry;
}

/** Abre el zip de un año y pasa cada estación a onStation (readline sobre openZipEntry con encoding 'latin1'). */
export async function readAnnualZip(zipFile: string, onStation: (station: AnnualStation) => void): Promise<void> {
  const zip = fs.readFileSync(zipFile);
  const stream = openZipEntry(zip, annualArchiveSelectXml(zip, zipFile));
  stream.setEncoding(XML_ENCODING);
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  // readline no propaga los errores de su entrada (zip corrupto): se enlazan a mano para no colgarse.
  const streamFailure = new Promise<never>((_resolve, reject) => {
    stream.once('error', (error: Error) =>
      reject(new Error(`No se pudo descomprimir ${zipFile}: ${error.message}. Borra el zip y vuelve a descargarlo.`))
    );
  });
  try {
    await Promise.race([parseAnnualXml(lines, onStation), streamFailure]);
  } finally {
    lines.close();
  }
}
