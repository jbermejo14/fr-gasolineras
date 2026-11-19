import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyFuelPrices } from '../src/lib/fuels.ts';
import type { FuelPrices } from '../src/lib/fuels.ts';
import { computeFuelStats as computeFuelStatsForTest } from '../src/lib/prixCarburants.ts';
import type { Station } from '../src/lib/prixCarburants.ts';
import {
  cheapestCommune,
  communeCountLabel,
  elideA,
  elideDe,
  formatTankSavings,
  savingsReferences,
  cheapestStations,
  communeRank,
  distanceKm,
  formatPriceOrDash,
  NEARBY_COMMUNES_LIMIT,
  NEARBY_LIMIT,
  NEARBY_MAX_KM,
  nearbyCommunes,
  nearbyStations,
  sortStationsByPrice,
  stationCountLabel,
  stationSummary,
  tankDifference,
} from '../src/lib/stationInsights.ts';

/** Un grado de latitud son unos 111 km: sirve para colocar estaciones a distancias conocidas. */
const KM_PER_LAT_DEGREE = 111.19;

function makeStation(id: string, prices: Partial<FuelPrices>, northKm = 0, city = 'Bréhan'): Station {
  return {
    id,
    slug: `est-${id}`,
    name: null,
    brandSlug: null,
    address: '16 Rue Chateaubriand',
    postalCode: '56580',
    city,
    communeSlug: 'brehan',
    departmentCode: '56',
    department: 'Morbihan',
    departmentSlug: 'morbihan',
    regionCode: '53',
    region: 'Bretagne',
    regionSlug: 'bretagne',
    roadType: 'route',
    lat: 48.06 + northKm / KM_PER_LAT_DEGREE,
    lon: -2.69,
    is24h: false,
    openingHours: [],
    services: [],
    prices: { ...emptyFuelPrices(), ...prices },
    priceUpdatedAt: { gazole: null, e10: null, sp95: null, sp98: null, e85: null, gplc: null },
  };
}

test('distanceKm: cero entre el mismo punto y ~111 km por grado de latitud', () => {
  const origin = { lat: 40, lon: -3 };
  assert.equal(distanceKm(origin, origin), 0);
  assert.ok(Math.abs(distanceKm(origin, { lat: 41, lon: -3 }) - KM_PER_LAT_DEGREE) < 0.5);
});

test('communeRank ordena de barata a cara y los empates comparten puesto', () => {
  const a = makeStation('1', { gazole: 1.4 });
  const b = makeStation('2', { gazole: 1.5 });
  const c = makeStation('3', { gazole: 1.5 });
  const d = makeStation('4', { gazole: 1.6 });
  const all = [a, b, c, d];
  assert.deepEqual(communeRank(a, all, 'gazole'), { position: 1, total: 4 });
  assert.deepEqual(communeRank(b, all, 'gazole'), { position: 2, total: 4 });
  assert.deepEqual(communeRank(c, all, 'gazole'), { position: 2, total: 4 });
  assert.deepEqual(communeRank(d, all, 'gazole'), { position: 4, total: 4 });
});

test('communeRank ignora estaciones sin precio y devuelve null si la propia no lo tiene', () => {
  const a = makeStation('1', { gazole: 1.4 });
  const noGazole = makeStation('2', { e10: 1.5 });
  assert.deepEqual(communeRank(a, [a, noGazole], 'gazole'), { position: 1, total: 1 });
  assert.equal(communeRank(noGazole, [a, noGazole], 'gazole'), null);
});

test('nearbyStations ordena por distancia, excluye la propia, respeta radio y límite', () => {
  const origin = makeStation('0', {});
  const near = makeStation('1', {}, 2);
  const mid = makeStation('2', {}, 5);
  const far = makeStation('3', {}, NEARBY_MAX_KM + 5);
  const result = nearbyStations(origin, [far, mid, origin, near]);
  assert.deepEqual(result.map((entry) => entry.station.id), ['1', '2']);
  assert.ok(result[0].km < result[1].km);

  const many = Array.from({ length: NEARBY_LIMIT + 4 }, (_, i) => makeStation(`m${i}`, {}, i + 1));
  assert.equal(nearbyStations(origin, many).length, NEARBY_LIMIT);
  assert.equal(nearbyStations(origin, many, { limit: 2 }).length, 2);
  assert.equal(nearbyStations(origin, many, { maxKm: 3.5 }).length, 3);
});

function makeCommune(slug: string, northKm: number) {
  return { communeSlug: slug, stations: [makeStation(slug, {}, northKm), makeStation(`${slug}-b`, {}, northKm + 1)] };
}

test('nearbyCommunes ordena por centroide, excluye el propio y respeta el límite', () => {
  const current = makeCommune('actual', 0);
  const near = makeCommune('cerca', 3);
  const far = makeCommune('lejos', 30);
  const result = nearbyCommunes(current, [far, current, near]);
  assert.deepEqual(result.map((entry) => entry.commune.communeSlug), ['cerca', 'lejos']);
  assert.ok(result[0].km < result[1].km);

  const many = Array.from({ length: NEARBY_COMMUNES_LIMIT + 3 }, (_, i) => makeCommune(`c${i}`, i + 2));
  assert.equal(nearbyCommunes(current, many).length, NEARBY_COMMUNES_LIMIT);
  assert.equal(nearbyCommunes(current, many, 2).length, 2);
});

test('sortStationsByPrice y cheapestStations dejan las que no venden el carburante fuera o al final', () => {
  const a = makeStation('1', { gazole: 1.6 });
  const b = makeStation('2', { e10: 1.5 });
  const c = makeStation('3', { gazole: 1.4 });
  assert.deepEqual(sortStationsByPrice([a, b, c], 'gazole').map((s) => s.id), ['3', '1', '2']);
  assert.deepEqual(cheapestStations([a, b, c], 'gazole', 1).map((s) => s.id), ['3']);
  assert.deepEqual(cheapestStations([a, b, c], 'gazole', 5).map((s) => s.id), ['3', '1']);
});

test('cheapestCommune devuelve el municipio con el precio más bajo y null si nadie vende el carburante', () => {
  const a = { name: 'a', stations: [makeStation('1', { gazole: 1.6 }), makeStation('2', { gazole: 1.5 })] };
  const b = { name: 'b', stations: [makeStation('3', { gazole: 1.4 })] };
  const c = { name: 'c', stations: [makeStation('4', {})] };
  const best = cheapestCommune([a, c, b], 'gazole');
  assert.equal(best?.commune.name, 'b');
  assert.equal(best?.price, 1.4);
  assert.equal(cheapestCommune([c], 'gazole'), null);
});

test('tankDifference: negativa si es más barata, redondeada al céntimo, null si falta un dato', () => {
  assert.equal(tankDifference(1.5, 1.45), 2.5);
  assert.equal(tankDifference(1.4, 1.5), -5);
  assert.equal(tankDifference(1.5, 1.5), 0);
  assert.equal(tankDifference(null, 1.5), null);
  assert.equal(tankDifference(1.5, null), null);
});

test('formatPriceOrDash y stationCountLabel usan formato francés', () => {
  assert.equal(formatPriceOrDash(1.779), '1,779 €');
  assert.equal(formatPriceOrDash(null), '--');
  assert.equal(stationCountLabel(0), '0 station');
  assert.equal(stationCountLabel(1), '1 station');
  assert.equal(stationCountLabel(12), '12 stations');
});

test('stationSummary caso general: puesto en gazole y E10 y coste de 50 litres', () => {
  const me = makeStation('1', { gazole: 1.5, e10: 1.6 });
  const others = [
    makeStation('2', { gazole: 1.4, e10: 1.5 }),
    makeStation('3', { gazole: 1.45, e10: 1.7 }),
  ];
  const text = stationSummary(me, [me, ...others]);
  assert.match(text, /^Cette station est la plus chère des 3 stations de Bréhan en gazole et la 2e en SP95-E10\./);
  assert.match(text, /Un plein de 50 litres de gazole coûte 75,00 €, soit 2,50 € de plus que la moyenne de la commune\./);
  assert.match(text, /En SP95-E10, 50 litres coûtent 80,00 €, soit autant que la moyenne\./);
});

test('stationSummary: la moins chère y la plus chère en el otro carburante', () => {
  const me = makeStation('1', { gazole: 1.3, e10: 1.6 });
  const other = makeStation('2', { gazole: 1.5, e10: 1.5 });
  const text = stationSummary(me, [me, other]);
  assert.match(text, /^Cette station est la moins chère des 2 stations de Bréhan en gazole et la plus chère en SP95-E10\./);
  assert.match(text, /5,00 € de moins que la moyenne de la commune/);
});

test('stationSummary: única estación del municipio, con elisión ante vocal', () => {
  const me = makeStation('1', { gazole: 1.934, e10: 1.6 });
  const text = stationSummary(me, [me]);
  assert.match(text, /^C'est la seule station de Bréhan avec un prix publié aujourd'hui\./);
  assert.match(text, /Un plein de 50 litres de gazole coûte 96,70 €\./);
  assert.doesNotMatch(text, /moyenne/);
  const auray = makeStation('2', { gazole: 1.6 }, 0, 'Auray');
  assert.match(stationSummary(auray, [auray]), /seule station d'Auray/);
});

test('stationSummary: sin gazole se omite esa parte', () => {
  const me = makeStation('1', { e10: 1.6 });
  const other = makeStation('2', { gazole: 1.4, e10: 1.7 });
  const text = stationSummary(me, [me, other]);
  assert.doesNotMatch(text, /gazole/);
  assert.match(text, /^Cette station est la moins chère des 2 stations de Bréhan en SP95-E10\./);
});

test('stationSummary: sin gazole ni E10 nombra los carburantes que vende', () => {
  const me = makeStation('1', { gplc: 0.9, e85: 0.8 });
  const other = makeStation('2', { gazole: 1.4 });
  const text = stationSummary(me, [me, other]);
  assert.match(text, /ne publie aujourd'hui aucun prix de gazole ni de SP95-E10/);
  assert.match(text, /Superéthanol E85, GPLc/);
  assert.doesNotMatch(text, /plein/);
});

test('stationSummary: sin ningún precio lo dice', () => {
  const me = makeStation('1', {});
  assert.match(stationSummary(me, [me]), /ni d'aucun autre carburant/);
});

test('stationSummary no mezcla puntos decimales en los importes', () => {
  const me = makeStation('1', { gazole: 1.4, e10: 1.5 });
  const other = makeStation('2', { gazole: 1.5, e10: 1.6 });
  assert.doesNotMatch(stationSummary(me, [me, other]), /\d\.\d/);
});

test('stationSummary: empate con todas las estaciones del municipio', () => {
  const me = makeStation('1', { gazole: 1.5, e10: 1.6 });
  const others = [makeStation('2', { gazole: 1.5, e10: 1.6 }), makeStation('3', { gazole: 1.5, e10: 1.6 })];
  const text = stationSummary(me, [me, ...others]);
  assert.match(text, /Cette station affiche le même prix pour le gazole que les 2 autres stations de Bréhan\./);
  assert.doesNotMatch(text, /moins chère/);
});

test('stationSummary: empate en el primer puesto', () => {
  const me = makeStation('1', { gazole: 1.4, e10: 1.6 });
  const others = [makeStation('2', { gazole: 1.4, e10: 1.5 }), makeStation('3', { gazole: 1.6, e10: 1.7 })];
  const text = stationSummary(me, [me, ...others]);
  assert.match(text, /Cette station partage le prix le plus bas pour le gazole à Bréhan avec une autre station\./);
  assert.doesNotMatch(text, /la moins chère des 3 stations de Bréhan en gazole/);
});

test('stationSummary: última posición sin empate es la más cara', () => {
  const me = makeStation('1', { gazole: 1.7, e10: 1.8 });
  const others = [makeStation('2', { gazole: 1.4, e10: 1.5 }), makeStation('3', { gazole: 1.6, e10: 1.7 })];
  const text = stationSummary(me, [me, ...others]);
  assert.match(text, /^Cette station est la plus chère des 3 stations de Bréhan en gazole et la plus chère en SP95-E10\./);
});

test('stationSummary: puesto intermedio sin empate', () => {
  const me = makeStation('1', { gazole: 1.5, e10: 1.6 });
  const others = [
    makeStation('2', { gazole: 1.4, e10: 1.5 }),
    makeStation('3', { gazole: 1.45, e10: 1.7 }),
    makeStation('4', { gazole: 1.6, e10: 1.8 }),
  ];
  const text = stationSummary(me, [me, ...others]);
  assert.match(text, /^Cette station est la 3e moins chère des 4 stations de Bréhan en gazole et la 2e en SP95-E10\./);
});

test('elideDe elide ante vocal y h muda, y contrae Le y Les', () => {
  assert.equal(elideDe('Bréhan'), 'de Bréhan');
  assert.equal(elideDe('Auray'), "d'Auray");
  assert.equal(elideDe('Hennebont'), "d'Hennebont");
  assert.equal(elideDe('Haguenau'), 'de Haguenau');
  assert.equal(elideDe('Le Mans'), 'du Mans');
  assert.equal(elideDe("Les Sables-d'Olonne"), "des Sables-d'Olonne");
  assert.equal(elideDe('La Rochelle'), 'de La Rochelle');
  assert.equal(elideDe('Évry'), "d'Évry");
});

test('communeCountLabel usa singular con 0 y 1', () => {
  assert.equal(communeCountLabel(1), '1 commune');
  assert.equal(communeCountLabel(81), '81 communes');
});

test('formatTankSavings: signo solo si hay ahorro, cero sin signo, null como guiones', () => {
  assert.equal(formatTankSavings(1.1), '+1,10 €');
  assert.equal(formatTankSavings(0), '0,00 €');
  assert.equal(formatTankSavings(null), '--');
});

test('savingsReferences omite el municipio con una sola estación y ordena municipio, departamento, nacional', () => {
  const a = makeStation('1', { gazole: 1.5 });
  const b = makeStation('2', { gazole: 1.7 });
  const national = computeFuelStatsForTest([a, b]);
  const labels = (refs: ReturnType<typeof savingsReferences>) => refs.map((ref) => ref.label);
  assert.deepEqual(labels(savingsReferences([a], [a, b], national)), ['du département', 'nationale']);
  const refs = savingsReferences([a, b], [a, b], national);
  assert.deepEqual(labels(refs), ['de la commune', 'du département', 'nationale']);
  assert.equal(refs[0].stats.gazole.avg, 1.6);
  assert.equal(refs[2].stats, national);
});

test('elideA contrae Le y Les y deja el resto con « à »', () => {
  assert.equal(elideA('Bréhan'), 'à Bréhan');
  assert.equal(elideA('Le Mans'), 'au Mans');
  assert.equal(elideA("Les Sables-d'Olonne"), "aux Sables-d'Olonne");
  assert.equal(elideA('La Rochelle'), 'à La Rochelle');
  assert.equal(elideA("L'Isle-Adam"), "à L'Isle-Adam");
});
