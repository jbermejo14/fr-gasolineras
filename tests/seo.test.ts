import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBreadcrumbSchema, getDatasetSchema, getGasStationSchema } from '../src/lib/seo.ts';
import type { GasStationSchemaInput } from '../src/lib/seo.ts';
import { emptyFuelPrices } from '../src/lib/fuels.ts';

const STATION_URL = 'https://ododex.com/fr/prix-carburants/station/56580001-brehan-16-rue-chateaubriand';

function makeSchemaStation(overrides: Partial<GasStationSchemaInput> = {}): GasStationSchemaInput {
  return {
    id: '56580001',
    address: '16 Rue Chateaubriand',
    postalCode: '56580',
    city: 'Bréhan',
    lat: 48.061,
    lon: -2.69,
    is24h: false,
    openingHours: [],
    prices: { ...emptyFuelPrices(), gazole: 1.859, e10: 1.789 },
    ...overrides,
  };
}

test('BreadcrumbList numera las migas desde 1', () => {
  const schema = getBreadcrumbSchema([
    { name: 'Accueil', url: 'https://ododex.com/fr/prix-carburants' },
    { name: 'Morbihan', url: 'https://ododex.com/fr/prix-carburants/departement/morbihan' },
  ]);
  assert.equal(schema['@type'], 'BreadcrumbList');
  assert.deepEqual(schema.itemListElement.map((item) => item.position), [1, 2]);
  assert.equal(schema.itemListElement[1].name, 'Morbihan');
});

test('GasStation: dirección francesa, sin marca y con un precio por carburante vendido', () => {
  const schema = getGasStationSchema(makeSchemaStation(), STATION_URL);
  assert.equal(schema['@type'], 'GasStation');
  assert.equal(schema.address.addressCountry, 'FR');
  assert.equal(schema.address.postalCode, '56580');
  assert.equal(schema.address.addressLocality, 'Bréhan');
  assert.equal('brand' in schema, false);
  assert.equal(schema.url, STATION_URL);
  assert.deepEqual(
    schema.makesOffer.map((offer) => [offer.name, offer.priceSpecification.price]),
    [['Gazole', 1.859], ['SP95-E10', 1.789]],
  );
  for (const offer of schema.makesOffer) {
    assert.equal(offer.priceSpecification.priceCurrency, 'EUR');
    assert.equal(offer.priceSpecification.unitCode, 'LTR');
  }
});

test('GasStation: sin horarios ni automate 24/24 no hay openingHoursSpecification', () => {
  assert.equal('openingHoursSpecification' in getGasStationSchema(makeSchemaStation(), STATION_URL), false);
});

test('GasStation: los tramos por día se convierten a OpeningHoursSpecification y se omiten los días cerrados', () => {
  const schema = getGasStationSchema(
    makeSchemaStation({
      openingHours: [
        { day: 'Lundi', closed: false, ranges: ['06:30–20:30'] },
        { day: 'Mardi', closed: true, ranges: [] },
        { day: 'Mercredi', closed: false, ranges: ['06:00–12:00', '14:00–20:00'] },
      ],
    }),
    STATION_URL,
  );
  assert.deepEqual(
    (schema as { openingHoursSpecification: unknown[] }).openingHoursSpecification,
    [
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Monday', opens: '06:30', closes: '20:30' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Wednesday', opens: '06:00', closes: '12:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Wednesday', opens: '14:00', closes: '20:00' },
    ],
  );
});

test('GasStation: un automate 24/24 sin tramos abre los siete días', () => {
  const schema = getGasStationSchema(makeSchemaStation({ is24h: true }), STATION_URL) as {
    openingHoursSpecification: Array<{ dayOfWeek: string; opens: string; closes: string }>;
  };
  assert.equal(schema.openingHoursSpecification.length, 7);
  assert.equal(schema.openingHoursSpecification[0].opens, '00:00');
  assert.equal(schema.openingHoursSpecification[6].dayOfWeek, 'Sunday');
});

test('GasStation: un día fuera de la tabla se ignora y con todos los días cerrados no hay horarios', () => {
  const unknownDay = getGasStationSchema(
    makeSchemaStation({ openingHours: [{ day: 'Someday', closed: false, ranges: ['08:00–18:00'] }] }),
    STATION_URL,
  );
  assert.equal('openingHoursSpecification' in unknownDay, false);
  const allClosed = getGasStationSchema(
    makeSchemaStation({ openingHours: [{ day: 'Lundi', closed: true, ranges: [] }] }),
    STATION_URL,
  );
  assert.equal('openingHoursSpecification' in allClosed, false);
});

test('GasStation: un automate 24/24 con todos los días cerrados abre los siete días', () => {
  const schema = getGasStationSchema(
    makeSchemaStation({ is24h: true, openingHours: [{ day: 'Lundi', closed: true, ranges: [] }] }),
    STATION_URL,
  ) as { openingHoursSpecification: unknown[] };
  assert.equal(schema.openingHoursSpecification.length, 7);
});

test('GasStation: los precios menores o iguales a 0 no generan oferta', () => {
  const schema = getGasStationSchema(
    makeSchemaStation({ prices: { ...emptyFuelPrices(), gazole: 0, e10: -1, sp98: 1.9 } }),
    STATION_URL,
  );
  assert.deepEqual(schema.makesOffer.map((offer) => offer.name), ['SP98']);
});

test('Dataset: cobertura temporal, fuentes francesas y un indicador por carburante del histórico', () => {
  const schema = getDatasetSchema({
    name: 'Prix du gazole en France',
    description: 'Prix hebdomadaires',
    url: 'https://ododex.com/fr/prix-carburants/historique',
    firstDate: '2016-01-04',
    lastDate: '2026-11-16',
    placeName: 'France',
  });
  assert.equal(schema.temporalCoverage, '2016-01-04/2026-11-16');
  assert.equal(schema.isBasedOn, 'https://www.prix-carburants.gouv.fr/');
  assert.equal(schema.license, 'https://www.etalab.gouv.fr/licence-ouverte-open-licence/');
  assert.deepEqual(
    schema.variableMeasured.map((variable) => variable.name),
    ['Prix du gazole', 'Prix du SP95-E10', 'Prix du SP95', 'Prix du SP98'],
  );
  assert.equal(schema.variableMeasured[0].unitText, '€/l');
  assert.equal(schema.dateModified, '2026-11-16');
});
