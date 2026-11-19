import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  openZipEntry,
  parseAnnualValue,
  parseAnnualXml,
  readAnnualZip,
  readZipEntries,
} from '../src/lib/annualArchive.ts';
import type { AnnualStation } from '../src/lib/annualArchive.ts';

const FIXTURE_2016 = new URL('./fixtures/annuel-2016.xml', import.meta.url);
const FIXTURE_2026 = new URL('./fixtures/annuel-2026.xml', import.meta.url);
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
const ZIP_VERSION = 20;

function crc32(data: Buffer): number {
  return zlib.crc32(data);
}

/** Zip mínimo de una entrada con cabeceras escritas a mano. */
function buildZip(name: string, content: Buffer, method: number): Buffer {
  const data = method === METHOD_DEFLATE ? zlib.deflateRawSync(content) : content;
  const nameBytes = Buffer.from(name, 'utf8');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(ZIP_VERSION, 4);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(crc32(content), 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(ZIP_VERSION, 4);
  central.writeUInt16LE(ZIP_VERSION, 6);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(crc32(content), 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  const localPart = Buffer.concat([local, nameBytes, data]);
  const centralPart = Buffer.concat([central, nameBytes]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralPart.length, 12);
  end.writeUInt32LE(localPart.length, 16);
  return Buffer.concat([localPart, centralPart, end]);
}

async function readAll(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks);
}

async function collect(file: URL): Promise<AnnualStation[]> {
  const lines = fs.readFileSync(file).toString('latin1').split(/\r?\n/);
  const stations: AnnualStation[] = [];
  await parseAnnualXml(lines, (station) => stations.push(station));
  return stations;
}

test('readZipEntries y openZipEntry: método 8 (deflate)', async () => {
  const content = Buffer.from('<pdv_liste>contenido '.repeat(50));
  const zip = buildZip('datos.xml', content, METHOD_DEFLATE);
  const entries = readZipEntries(zip);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].fileName, 'datos.xml');
  assert.equal(entries[0].method, METHOD_DEFLATE);
  assert.equal(entries[0].uncompressedSize, content.length);
  assert.deepEqual(await readAll(openZipEntry(zip, entries[0])), content);
});

test('openZipEntry: método 0 (almacenado) devuelve los bytes tal cual', async () => {
  const content = Buffer.from('hola');
  const zip = buildZip('a.xml', content, METHOD_STORED);
  assert.deepEqual(await readAll(openZipEntry(zip, readZipEntries(zip)[0])), content);
});

test('openZipEntry: método no soportado lanza Error', () => {
  const zip = buildZip('a.xml', Buffer.from('x'), METHOD_STORED);
  const entry = { ...readZipEntries(zip)[0], method: 12 };
  assert.throws(() => openZipEntry(zip, entry), /no soportado/);
});

test('readZipEntries: fichero que no es zip lanza Error', () => {
  assert.throws(() => readZipEntries(Buffer.from('esto no es un zip, ni de lejos')), /no es un zip válido/);
});

test('readZipEntries: zip64 lanza Error', () => {
  const zip = buildZip('a.xml', Buffer.from('x'), METHOD_STORED);
  zip.writeUInt16LE(0xffff, zip.length - 22 + 10);
  assert.throws(() => readZipEntries(zip), /zip64/);
});

test('parseAnnualValue: milésimas, euros decimales y enteros pequeños', () => {
  assert.equal(parseAnnualValue('1026'), 1026);
  assert.equal(parseAnnualValue('1.638'), 1638);
  assert.equal(parseAnnualValue('1.67'), 1670);
  assert.equal(parseAnnualValue('2'), 2000);
});

test('parseAnnualValue: fuera de rango o no numérico → null', () => {
  assert.equal(parseAnnualValue('0.2'), null);
  assert.equal(parseAnnualValue('abc'), null);
  assert.equal(parseAnnualValue(''), null);
  assert.equal(parseAnnualValue('1.2.3'), null);
  assert.equal(parseAnnualValue('9000'), null);
  assert.equal(parseAnnualValue('50'), null);
});

test('parseAnnualXml 2016: enteros, desordenados, formato con espacio y carburantes ajenos', async () => {
  const [first, second] = await collect(FIXTURE_2016);
  assert.equal(first.id, '1000001');
  assert.equal(first.postalCode, '01000');
  assert.deepEqual(first.records, [
    { fuel: 'gazole', maj: '2016-01-09T09:01:47', priceMilli: 1026 },
    { fuel: 'gazole', maj: '2016-01-04T10:01:35', priceMilli: 1030 },
    { fuel: 'gazole', maj: '2016-01-09T09:01:02', priceMilli: 1022 },
    { fuel: 'sp98', maj: '2016-01-04T08:00:00', priceMilli: 1250 },
  ]);
  assert.equal(second.id, '2000010');
  assert.equal(second.postalCode, '20090');
});

test('parseAnnualXml 2016: <prix> mal formados se saltan sin lanzar', async () => {
  const stations = await collect(FIXTURE_2016);
  assert.equal(stations.length, 2);
  assert.deepEqual(stations[1].records, [
    { fuel: 'e10', maj: '2016-01-05T07:00:00', priceMilli: 1100 },
    { fuel: 'sp95', maj: '2016-01-06T07:00:00', priceMilli: 1180 },
  ]);
});

test('parseAnnualXml 2026: decimales en euros; el pdv sin precios válidos también se emite', async () => {
  const stations = await collect(FIXTURE_2026);
  assert.equal(stations.length, 2);
  assert.deepEqual(stations[0].records, [
    { fuel: 'gazole', maj: '2026-01-02T00:39:00', priceMilli: 1638 },
    { fuel: 'gazole', maj: '2026-01-06T14:30:00', priceMilli: 1670 },
    { fuel: 'e10', maj: '2026-01-02T00:39:00', priceMilli: 1589 },
  ]);
  assert.equal(stations[1].postalCode, '99999');
});

test('parseAnnualXml acepta un iterable asíncrono', async () => {
  async function* lines() {
    yield '<pdv id="7" cp="75001" pop="R">';
    yield '  <prix nom="SP95" id="2" maj="2020-01-01T00:00:00" valeur="1.5"/>';
    yield '</pdv>';
  }
  const stations: AnnualStation[] = [];
  await parseAnnualXml(lines(), (station) => stations.push(station));
  assert.deepEqual(stations, [
    { id: '7', postalCode: '75001', records: [{ fuel: 'sp95', maj: '2020-01-01T00:00:00', priceMilli: 1500 }] },
  ]);
});

test('readAnnualZip: lee el XML latin1 de un zip deflate', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'annual-archive-'));
  const zipFile = path.join(dir, '2016.zip');
  fs.writeFileSync(zipFile, buildZip('PrixCarburants_annuel_2016.xml', fs.readFileSync(FIXTURE_2016), METHOD_DEFLATE));
  const stations: AnnualStation[] = [];
  await readAnnualZip(zipFile, (station) => stations.push(station));
  assert.deepEqual(
    stations.map((station) => station.id),
    ['1000001', '2000010']
  );
});

test('readAnnualZip: XML almacenado (método 0) con byte latin1 0xE9', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'annual-archive-'));
  const zipFile = path.join(dir, 'almacenado.zip');
  const xml = Buffer.from(
    [
      '<pdv id="5" cp="75001" pop="R">',
      '  <adresse>café</adresse>',
      '  <prix nom="E10" id="5" maj="2020-01-01T00:00:00" valeur="1.5"/>',
      '</pdv>',
    ].join('\n'),
    'latin1'
  );
  assert.ok(xml.includes(0xe9));
  fs.writeFileSync(zipFile, buildZip('a.xml', xml, METHOD_STORED));
  const stations: AnnualStation[] = [];
  await readAnnualZip(zipFile, (station) => stations.push(station));
  assert.deepEqual(stations, [
    { id: '5', postalCode: '75001', records: [{ fuel: 'e10', maj: '2020-01-01T00:00:00', priceMilli: 1500 }] },
  ]);
});

test('readAnnualZip: datos comprimidos corruptos rechazan con Error claro', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'annual-archive-'));
  const zipFile = path.join(dir, 'roto.zip');
  const zip = buildZip('x.xml', Buffer.from('<pdv_liste>'.repeat(100)), METHOD_DEFLATE);
  const entry = readZipEntries(zip)[0];
  zip.fill(0xff, entry.dataOffset, entry.dataOffset + entry.compressedSize);
  fs.writeFileSync(zipFile, zip);
  await assert.rejects(readAnnualZip(zipFile, () => undefined), /No se pudo descomprimir/);
});

test('readAnnualZip: zip sin XML lanza Error', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'annual-archive-'));
  const zipFile = path.join(dir, 'sinxml.zip');
  fs.writeFileSync(zipFile, buildZip('leeme.txt', Buffer.from('x'), METHOD_STORED));
  await assert.rejects(readAnnualZip(zipFile, () => undefined), /no contiene ningún fichero/);
});
