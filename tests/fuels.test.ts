import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FUEL,
  FUEL_LABELS,
  FUEL_SHORT_LABELS,
  FUEL_TYPES,
  emptyFuelPrices,
  fuelFromSourceName,
  parseValidPrice,
} from '../src/lib/fuels.ts';

test('fuelFromSourceName con los seis nombres y uno desconocido', () => {
  assert.equal(fuelFromSourceName('Gazole'), 'gazole');
  assert.equal(fuelFromSourceName('SP95'), 'sp95');
  assert.equal(fuelFromSourceName('E10'), 'e10');
  assert.equal(fuelFromSourceName('SP98'), 'sp98');
  assert.equal(fuelFromSourceName('E85'), 'e85');
  assert.equal(fuelFromSourceName('GPLc'), 'gplc');
  assert.equal(fuelFromSourceName('Hydrogène'), null);
  assert.equal(fuelFromSourceName(''), null);
});

test('parseValidPrice acepta números y cadenas con punto o coma', () => {
  assert.equal(parseValidPrice('1.638'), 1.638);
  assert.equal(parseValidPrice(1.638), 1.638);
  assert.equal(parseValidPrice('2,1'), 2.1);
  assert.equal(parseValidPrice(1.63849), 1.638);
});

test('parseValidPrice rechaza valores fuera de rango o no numéricos', () => {
  assert.equal(parseValidPrice(0.3), null);
  assert.equal(parseValidPrice(5), null);
  assert.equal(parseValidPrice(NaN), null);
  assert.equal(parseValidPrice(Infinity), null);
  assert.equal(parseValidPrice(null), null);
  assert.equal(parseValidPrice(undefined), null);
  assert.equal(parseValidPrice(''), null);
  assert.equal(parseValidPrice('abc'), null);
});

test('parseValidPrice incluye los límites', () => {
  assert.equal(parseValidPrice(0.5), 0.5);
  assert.equal(parseValidPrice(4), 4);
});

test('emptyFuelPrices devuelve todos null y objetos independientes', () => {
  const prices = emptyFuelPrices();
  assert.deepEqual(Object.keys(prices), [...FUEL_TYPES]);
  assert.ok(Object.values(prices).every((price) => price === null));
  prices.gazole = 1.8;
  assert.equal(emptyFuelPrices().gazole, null);
});

test('etiquetas y carburante por defecto', () => {
  assert.equal(DEFAULT_FUEL, 'gazole');
  assert.equal(FUEL_LABELS.e10, 'SP95-E10');
  assert.equal(FUEL_LABELS.e85, 'Superéthanol E85');
  assert.equal(FUEL_SHORT_LABELS.e10, 'E10');
  for (const fuel of FUEL_TYPES) {
    assert.ok(FUEL_LABELS[fuel]);
    assert.ok(FUEL_SHORT_LABELS[fuel]);
  }
});
