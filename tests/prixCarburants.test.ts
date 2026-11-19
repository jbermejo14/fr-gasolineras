import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FRANCE_BOUNDS,
  STALE_PRICE_DAYS,
  computeFuelStats,
  normalizeStation,
  parseStationPathSlug,
  processRawPrixData,
  stationPath,
  summarizeStations,
} from '../src/lib/prixCarburants.ts';
import type { Station } from '../src/lib/prixCarburants.ts';

const SAMPLE_FILE = path.join(import.meta.dirname, 'fixtures', 'prix-sample.json');
const RAW: Record<string, unknown>[] = JSON.parse(fs.readFileSync(SAMPLE_FILE, 'utf8'));
const UPDATED_AT = '2026-11-19T09:59:54+00:00';
const SAMPLE_STATIONS_WITHOUT_CITY = 4;
const MAX_SLUG_LENGTH = 80;

function sampleRecord(id: number): Record<string, unknown> {
  const record = RAW.find((entry) => entry.id === id);
  assert.ok(record, `falta el registro ${id} en la muestra`);
  return record;
}

const snapshot = processRawPrixData(RAW);

function station(id: string): Station {
  const found = snapshot.stationsById.get(id);
  assert.ok(found, `falta la estación ${id}`);
  return found;
}

test('descarta los registros sin ville y conserva el resto', () => {
  assert.equal(snapshot.stations.length, RAW.length - SAMPLE_STATIONS_WITHOUT_CITY);
  assert.equal(snapshot.stationsById.has('76600022'), false);
  assert.deepEqual(snapshot.stations.map((s) => s.id).slice(0, 3), ['56580001', '40500002', '5100009']);
});

test('updatedAt es el {carb}_maj más reciente del flujo', () => {
  assert.equal(snapshot.updatedAt, UPDATED_AT);
});

test('sin ninguna fecha de actualización lanza un error explícito', () => {
  assert.throws(() => processRawPrixData([{ id: 1 }]), /ninguna fecha de actualización/);
});

test('normaliza dirección, municipio, id, tipo de vía y automate 24/24', () => {
  const brehan = station('56580001');
  assert.equal(brehan.address, '16 rue chateaubriand');
  assert.equal(brehan.city, 'Bréhan');
  assert.equal(brehan.communeSlug, 'brehan');
  assert.equal(brehan.slug, 'brehan-16-rue-chateaubriand');
  assert.equal(brehan.postalCode, '56580');
  assert.equal(brehan.is24h, true);
  assert.equal(brehan.roadType, 'route');
  assert.equal(station('89100001').is24h, false);
});

test('pasa a tipo título las direcciones en mayúsculas', () => {
  assert.equal(station('40500002').address, 'Route de Mont de Marsan');
  assert.equal(station('58240003').address, 'Route Nationale 7 - les Boulaises');
});

test('región y departamento salen de la tabla de geo.ts', () => {
  const brehan = station('56580001');
  assert.deepEqual(
    [brehan.departmentCode, brehan.department, brehan.departmentSlug, brehan.regionCode, brehan.region, brehan.regionSlug],
    ['56', 'Morbihan', 'morbihan', '53', 'Bretagne', 'bretagne'],
  );
});

test('Córcega: 2A y 2B', () => {
  assert.equal(station('20137007').departmentCode, '2A');
  assert.equal(station('20137007').department, 'Corse-du-Sud');
  assert.equal(station('20200006').departmentCode, '2B');
  assert.equal(station('20200006').regionSlug, 'corse');
});

test('las estaciones de autoroute tienen roadType autoroute', () => {
  assert.equal(station('18200011').roadType, 'autoroute');
  assert.equal(station('77550004').roadType, 'autoroute');
});

test('deduce el departamento del código postal cuando code_departement es null', () => {
  const record = { ...sampleRecord(56580001), code_departement: null, cp: '75012' };
  assert.equal(normalizeStation(record, UPDATED_AT)?.departmentCode, '75');
  const corsican = { ...sampleRecord(56580001), code_departement: null, cp: '20137' };
  assert.equal(normalizeStation(corsican, UPDATED_AT)?.departmentCode, '2A');
});

test('descarta la estación si no se puede deducir el departamento', () => {
  const record = { ...sampleRecord(56580001), code_departement: null, cp: '97100' };
  assert.equal(normalizeStation(record, UPDATED_AT), null);
});

test('descarta registros sin id, sin geom o fuera de Francia metropolitana', () => {
  const base = sampleRecord(56580001);
  assert.equal(normalizeStation({ ...base, id: null }, UPDATED_AT), null);
  assert.equal(normalizeStation({ ...base, geom: null }, UPDATED_AT), null);
  assert.equal(normalizeStation({ ...base, geom: { lat: '48', lon: '2' } }, UPDATED_AT), null);
  assert.equal(normalizeStation({ ...base, geom: { lat: FRANCE_BOUNDS.south - 1, lon: 2 } }, UPDATED_AT), null);
  assert.equal(normalizeStation({ ...base, geom: { lat: 48, lon: FRANCE_BOUNDS.east + 1 } }, UPDATED_AT), null);
  assert.equal(normalizeStation({ ...base, ville: null }, UPDATED_AT), null);
});

test('guarda precios y fechas de los carburantes que vende', () => {
  const brehan = station('56580001');
  assert.deepEqual(brehan.prices, { gazole: 2.109, e10: null, sp95: 2.009, sp98: 2.049, e85: null, gplc: null });
  assert.equal(brehan.priceUpdatedAt.gazole, '2026-11-12T06:55:20+00:00');
  assert.equal(brehan.priceUpdatedAt.e10, null);
});

test('anula el precio con más de STALE_PRICE_DAYS respecto a updatedAt', () => {
  assert.equal(STALE_PRICE_DAYS, 30);
  const old = { ...sampleRecord(56580001), gazole_maj: '2026-09-24T15:40:56+00:00' };
  const stale = normalizeStation(old, UPDATED_AT);
  assert.equal(stale?.prices.gazole, null);
  assert.equal(stale?.priceUpdatedAt.gazole, null);
  assert.equal(stale?.prices.sp95, 2.009);
  assert.deepEqual(Object.values(station('13560002').prices), [null, null, null, null, null, null]);
});

test('anula el precio si falta la fecha, si el precio no es válido o si no hay prix', () => {
  const base = sampleRecord(56580001);
  assert.equal(normalizeStation({ ...base, gazole_maj: null }, UPDATED_AT)?.prices.gazole, null);
  assert.equal(normalizeStation({ ...base, gazole_prix: 9.5 }, UPDATED_AT)?.prices.gazole, null);
  assert.deepEqual(Object.values(station('69700002').prices), [null, null, null, null, null, null]);
});

test('horarios: tramos, día cerrado y automate sin tramos', () => {
  const porto = station('20137007').openingHours;
  assert.equal(porto.length, 7);
  assert.deepEqual(porto[0], { day: 'Lundi', closed: false, ranges: ['07:00–19:30'] });
  assert.equal(porto[6].day, 'Dimanche');
  const allClosed = station('5100009').openingHours;
  assert.ok(allClosed.every((day) => day.closed && day.ranges.length === 0));
  const withoutRanges = station('56580001').openingHours;
  assert.deepEqual(withoutRanges[0], { day: 'Lundi', closed: false, ranges: [] });
});

test('horarios: los días cerrados no muestran el tramo ficticio del flujo', () => {
  const gignac = station('34150003').openingHours;
  assert.deepEqual(gignac[0], { day: 'Lundi', closed: true, ranges: [] });
});

test('horarios: horaires null o ilegible devuelve [] sin lanzar', () => {
  assert.deepEqual(station('92230008').openingHours, []);
  const broken = { ...sampleRecord(56580001), horaires: '{ esto no es json' };
  assert.deepEqual(normalizeStation(broken, UPDATED_AT)?.openingHours, []);
});

test('horarios: horaire puede ser un array de tramos', () => {
  const horaires = JSON.stringify({
    jour: [{
      '@id': '1', '@nom': 'Lundi', '@ferme': '',
      horaire: [
        { '@ouverture': '06.30', '@fermeture': '12.00' },
        { '@ouverture': '14.00', '@fermeture': '20.30' },
      ],
    }],
  });
  const result = normalizeStation({ ...sampleRecord(56580001), horaires }, UPDATED_AT);
  assert.deepEqual(result?.openingHours, [
    { day: 'Lundi', closed: false, ranges: ['06:30–12:00', '14:00–20:30'] },
  ]);
});

test('servicios: lista o vacío', () => {
  assert.ok(station('56580001').services.includes('Lavage automatique'));
  assert.deepEqual(station('13560002').services, []);
});

test('el slug no supera 80 caracteres ni corta palabras', () => {
  const long = station('18200011');
  assert.ok(long.slug.length <= MAX_SLUG_LENGTH);
  assert.ok(long.slug.startsWith('farges-allichamps-autoroute-a71'));
  assert.ok(!long.slug.endsWith('-'));
  const fullSlug = 'farges-allichamps-autoroute-a71-la-gazonnieresens-bourges-clermond-ferrand';
  assert.ok(fullSlug.startsWith(long.slug));
});

test('agrupa por departamento en orden de código y por municipio', () => {
  const codes = [...snapshot.departments.values()].map((group) => group.code);
  const geoOrder = ['05', '12', '13', '18', '2A', '2B', '33', '34', '38', '40', '56', '58', '69', '77', '89', '92'];
  assert.deepEqual(codes, geoOrder);
  const morbihan = snapshot.departments.get('morbihan');
  assert.equal(morbihan?.stations.length, 4);
  assert.equal(morbihan?.communes.length, 4);
  assert.equal(morbihan?.regionSlug, 'bretagne');
  assert.equal(snapshot.departments.has('paris'), false);
  const isere = snapshot.communes.get('isere/le-cheylas');
  assert.equal(isere?.city, 'Le Cheylas');
  assert.equal(snapshot.communes.get('isere/tignieu-jameyzieu')?.stations.length, 1);
  assert.equal(snapshot.communes.size, snapshot.stations.length);
});

test('el municipio usa la grafía más frecuente y, en empate, la primera alfabética', () => {
  const base = sampleRecord(56580001);
  const withCity = (id: number, ville: string) => ({ ...base, id, ville });
  const frequent = processRawPrixData([withCity(1, 'Saint-Lô'), withCity(2, 'Saint-lô'), withCity(3, 'Saint-lô')]);
  assert.equal(frequent.communes.get('morbihan/saint-lo')?.city, 'Saint-lô');
  const tie = processRawPrixData([withCity(1, 'Saint-lô'), withCity(2, 'Saint-Lô')]);
  assert.equal(tie.communes.get('morbihan/saint-lo')?.city, 'Saint-Lô');
});

test('STALE_PRICE_DAYS: exactamente 30 días se conserva y 30 días + 1 s se anula', () => {
  const base = sampleRecord(56580001);
  const msPerDay = 24 * 60 * 60 * 1000;
  const oldest = new Date(Date.parse(UPDATED_AT) - STALE_PRICE_DAYS * msPerDay);
  const atLimit = { ...base, gazole_maj: oldest.toISOString() };
  const beyondLimit = { ...base, gazole_maj: new Date(oldest.getTime() - 1000).toISOString() };
  assert.equal(normalizeStation(atLimit, UPDATED_AT)?.prices.gazole, 2.109);
  assert.equal(normalizeStation(beyondLimit, UPDATED_AT)?.prices.gazole, null);
});

test('estadísticas nacionales del gazole', () => {
  assert.deepEqual(snapshot.nationalStats.gazole, {
    min: 2.065, max: 2.4, avg: 2.159, count: 18, minStationId: '34150003',
  });
  assert.equal(snapshot.nationalStats.gplc.count, 2);
});

test('computeFuelStats: media a 3 decimales, primero en empate y vacío a null', () => {
  const makeStation = (id: string, gazole: number | null): Station => {
    const base = station('56580001');
    return { ...base, id, prices: { ...base.prices, gazole, e10: null } };
  };
  const stats = computeFuelStats([makeStation('a', 2), makeStation('b', 1.5), makeStation('c', 1.5), makeStation('d', null)]);
  assert.deepEqual(stats.gazole, { min: 1.5, max: 2, avg: 1.667, count: 3, minStationId: 'b' });
  assert.deepEqual(stats.e10, { min: null, max: null, avg: null, count: 0, minStationId: null });
});

test('summarizeStations devuelve número, mínimo y media por carburante', () => {
  const summary = summarizeStations(snapshot.departments.get('morbihan')?.stations ?? []);
  assert.equal(summary.stationCount, 4);
  assert.equal(summary.min.gazole, 2.065);
  assert.equal(summary.avg.gazole, 2.12);
  assert.equal(summary.min.gplc, null);
  assert.equal(summarizeStations([]).avg.gazole, null);
});

test('stationPath y parseStationPathSlug son inversos', () => {
  const brehan = station('56580001');
  const route = stationPath(brehan);
  assert.equal(route, '/station/56580001-brehan-16-rue-chateaubriand');
  assert.equal(parseStationPathSlug(route.replace('/station/', '')), '56580001');
  assert.equal(parseStationPathSlug('5100009-montgenevre-rn-94'), '5100009');
  assert.equal(stationPath({ id: '12', slug: '' }), '/station/12');
  assert.equal(parseStationPathSlug('12'), '12');
  assert.equal(parseStationPathSlug('brehan-16'), null);
  assert.equal(parseStationPathSlug(''), null);
});
