import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gasFinderComputeStats,
  gasFinderFilterStations,
  gasFinderSortStations,
  gasFinderTankSavings,
} from '../src/components/GasFinderLogic.ts';
import type { GasFinderCriteria, GasFinderStation } from '../src/components/GasFinderLogic.ts';
import {
  buildClusterIconSpec,
  buildPinIconSpec,
  buildStationPopupHtml,
  escapeHtml,
  resolveStationPrice,
} from '../src/components/leafletMapHtml.ts';
import { emptyFuelPrices } from '../src/lib/fuels.ts';
import type { LightStation } from '../src/lib/stationPayload.ts';

const PARIS = { lat: 48.8566, lon: 2.3522 };
const BASE_CRITERIA: GasFinderCriteria = {
  fuel: 'gazole',
  department: 'TOUS',
  search: '',
  sortBy: 'price_asc',
  userCoords: null,
  radius: 15,
};

function makeStation(id: string, overrides: Partial<LightStation> = {}): LightStation {
  return {
    id,
    slug: `slug-${id}`,
    name: null,
    brandSlug: null,
    address: '1 rue de Rivoli',
    postalCode: '75001',
    city: 'Paris',
    communeSlug: 'paris',
    department: 'Paris',
    departmentSlug: 'paris',
    roadType: 'route',
    lat: PARIS.lat,
    lon: PARIS.lon,
    prices: { ...emptyFuelPrices(), gazole: 1.7 },
    ...overrides,
  };
}

function withPrices(prices: Partial<LightStation['prices']>): Partial<LightStation> {
  return { prices: { ...emptyFuelPrices(), ...prices } };
}

function ids(list: GasFinderStation[]): string[] {
  return list.map((s) => s.id);
}

function filter(stations: LightStation[], overrides: Partial<GasFinderCriteria>): string[] {
  return ids(gasFinderFilterStations(stations, { ...BASE_CRITERIA, ...overrides }));
}

test('filtra por carburante y excluye precio null o 0', () => {
  const stations = [
    makeStation('a'),
    makeStation('b', withPrices({ gazole: null })),
    makeStation('c', withPrices({ gazole: 0 })),
    makeStation('d', withPrices({ e10: 1.8 })),
  ];
  assert.deepEqual(filter(stations, {}), ['a']);
  assert.deepEqual(filter(stations, { fuel: 'e10' }), ['d']);
});

test('filtra por departamento', () => {
  const stations = [makeStation('a'), makeStation('b', { departmentSlug: 'morbihan' })];
  assert.deepEqual(filter(stations, { department: 'morbihan' }), ['b']);
  assert.deepEqual(filter(stations, { department: 'TOUS' }), ['a', 'b']);
});

test('busca en dirección, municipio y código postal sin distinguir tildes ni mayúsculas', () => {
  const stations = [
    makeStation('dir', { address: 'Avenue Zeta' }),
    makeStation('mun', { city: 'Villazeta' }),
    makeStation('acc', { city: 'Évry-Grégy-sur-Yerre' }),
    makeStation('cp', { postalCode: '99999' }),
    makeStation('none'),
  ];
  assert.deepEqual(filter(stations, { search: '  ZETA ' }), ['dir', 'mun']);
  assert.deepEqual(filter(stations, { search: '99999' }), ['cp']);
  assert.deepEqual(filter(stations, { search: 'evry gregy' }), ['acc']);
  assert.deepEqual(filter(stations, { search: 'evry-gregy-sur-yerre' }), ['acc']);
  assert.deepEqual(filter([makeStation('apo', { city: "L'Isle-d'Abeau" })], { search: 'l isle d abeau' }), ['apo']);
  assert.deepEqual(filter([makeStation('st', { city: 'Saint-Étienne' })], { search: 'saint etienne' }), ['st']);
  assert.deepEqual(filter(stations, { search: 'ÉVRY' }), ['acc']);
});

test('filtra por radio GPS y añade la distancia', () => {
  const stations = [makeStation('near'), makeStation('far', { lat: 45.764, lon: 4.8357 })];
  const result = gasFinderFilterStations(stations, { ...BASE_CRITERIA, userCoords: PARIS, radius: 15 });
  assert.deepEqual(ids(result), ['near']);
  assert.equal(result[0].distance, 0);
  assert.deepEqual(filter(stations, { userCoords: PARIS, radius: 500 }), ['near', 'far']);
});

test('filtrar no ordena la entrada', () => {
  const stations = [makeStation('b', withPrices({ gazole: 1.9 })), makeStation('a', withPrices({ gazole: 1.1 }))];
  assert.deepEqual(filter(stations, { sortBy: 'price_asc' }), ['b', 'a']);
});

test('ordena por cada criterio', () => {
  const stations: GasFinderStation[] = [
    makeStation('b', { city: 'Brest', ...withPrices({ gazole: 1.5 }) }),
    makeStation('a', { city: 'Albi', ...withPrices({ gazole: 1.9 }) }),
    makeStation('c', { city: 'Cannes', ...withPrices({ gazole: 1.1 }) }),
  ];
  stations[0].distance = 3;
  stations[1].distance = 1;
  stations[2].distance = 2;
  const sort = (sortBy: GasFinderCriteria['sortBy'], userCoords = null as GasFinderCriteria['userCoords']) =>
    ids(gasFinderSortStations(stations, { fuel: 'gazole', sortBy, userCoords }));

  assert.deepEqual(sort('price_asc'), ['c', 'b', 'a']);
  assert.deepEqual(sort('price_desc'), ['a', 'b', 'c']);
  assert.deepEqual(sort('name_asc'), ['a', 'b', 'c']);
  assert.deepEqual(sort('distance_asc', PARIS), ['a', 'c', 'b']);
  assert.deepEqual(sort('distance_asc'), ['b', 'a', 'c']);
});

test('el orden por nombre usa municipio y luego dirección, con la colación francesa', () => {
  const stations: GasFinderStation[] = [
    makeStation('z', { city: 'Évry', address: '2 rue B' }),
    makeStation('y', { city: 'Evry', address: '1 rue A' }),
    makeStation('x', { city: 'Évry', address: '1 rue A' }),
    makeStation('w', { city: 'Fécamp', address: '3 rue C' }),
  ];
  const sorted = gasFinderSortStations(stations, { fuel: 'gazole', sortBy: 'name_asc', userCoords: null });
  assert.deepEqual(ids(sorted), ['y', 'x', 'z', 'w']);
});

test('ordenar no muta la entrada y devuelve otra copia', () => {
  const stations: GasFinderStation[] = [
    makeStation('b', withPrices({ gazole: 1.9 })),
    makeStation('a', withPrices({ gazole: 1.1 })),
  ];
  const sorted = gasFinderSortStations(stations, { fuel: 'gazole', sortBy: 'price_asc', userCoords: null });
  assert.deepEqual(ids(stations), ['b', 'a']);
  assert.deepEqual(ids(sorted), ['a', 'b']);
  assert.notEqual(sorted, stations);
});

test('estadísticas: mínimo, máximo, media y total', () => {
  const stations: GasFinderStation[] = [
    makeStation('a', withPrices({ gazole: 1.2 })),
    makeStation('b', withPrices({ gazole: 1.5 })),
    makeStation('c', withPrices({ gazole: null })),
  ];
  assert.deepEqual(gasFinderComputeStats(stations, 'gazole'), { total: 3, min: 1.2, max: 1.5, avg: 1.35 });
});

test('estadísticas: null si no hay precios', () => {
  assert.deepEqual(gasFinderComputeStats([], 'gazole'), { total: 0, min: null, max: null, avg: null });
});

test('ahorro en un depósito de 50 L', () => {
  assert.equal(gasFinderTankSavings(1.7, 1.8), 5);
  assert.equal(gasFinderTankSavings(1.8, 1.7), 0);
  assert.equal(gasFinderTankSavings(null, 1.7), null);
  assert.equal(gasFinderTankSavings(1.7, null), null);
  assert.equal(gasFinderTankSavings(0, 1.7), null);
});

test('mapa: el precio cae al gazole y luego al E10 si falta el carburante elegido', () => {
  assert.equal(resolveStationPrice(makeStation('a', withPrices({ sp98: 1.9 })), 'sp98'), 1.9);
  assert.equal(resolveStationPrice(makeStation('a', withPrices({ gazole: 1.7 })), 'sp98'), 1.7);
  assert.equal(resolveStationPrice(makeStation('a', withPrices({ e10: 1.8 })), 'sp98'), 1.8);
  assert.equal(resolveStationPrice(makeStation('a', withPrices({})), 'sp98'), null);
});

test('mapa: burbuja con tamaño por número de estaciones y precio en formato francés', () => {
  const small = buildClusterIconSpec(5, 1.859);
  assert.match(small.className, /station-cluster--small/);
  assert.match(small.html, /1,859€/);
  assert.match(buildClusterIconSpec(50, null).className, /--medium/);
  assert.match(buildClusterIconSpec(500, null).className, /--large/);
  assert.doesNotMatch(buildClusterIconSpec(500, null).html, /station-cluster__price/);
});

test('mapa: umbrales de tamaño de las burbujas', () => {
  const modifier = (count: number) => buildClusterIconSpec(count, null).className.split('--')[1];
  assert.deepEqual([9, 10, 99, 100].map(modifier), ['small', 'medium', 'medium', 'large']);
});

test('mapa: el popup escapa la dirección y el código postal', () => {
  const html = buildStationPopupHtml(
    makeStation('1', { address: '<img onerror=x>', postalCode: '"><script>' }),
    1.7,
  );
  assert.doesNotMatch(html, /<img onerror/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;img onerror=x&gt;, &quot;&gt;&lt;script&gt;/);
});

test('mapa: el pin muestra el municipio escapado y no lleva logo', () => {
  const pin = buildPinIconSpec(makeStation('a', { city: 'L<e>s Ulis' }), 1.7, true);
  assert.match(pin.html, /L&lt;e&gt;s Ulis/);
  assert.match(pin.html, /custom-station-pin--highlight/);
  assert.doesNotMatch(pin.html, /<img/);
  assert.match(buildPinIconSpec(makeStation('a'), null, false).html, /⛽/);
});

test('mapa: el popup enlaza la ficha con la ruta base y marca las autopistas', () => {
  const html = buildStationPopupHtml(makeStation('123', { slug: 'paris-1-rue', roadType: 'autoroute' }), 1.7);
  assert.match(html, /href="\/fr\/prix-carburants\/station\/123-paris-1-rue"/);
  assert.match(html, /Autoroute/);
  assert.match(html, /1,700\s€\/l/);
  assert.match(buildStationPopupHtml(makeStation('1'), null), /Prix indisponible/);
});

test('escapeHtml neutraliza los caracteres peligrosos', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});
