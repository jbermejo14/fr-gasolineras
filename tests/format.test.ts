import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateTimeParis,
  formatEuros,
  formatInteger,
  formatIsoDateFr,
  formatKm,
  formatPrice,
  formatPricePerLiter,
} from '../src/lib/format.ts';

const THIN_NBSP = ' ';

test('formatPrice y formatPricePerLiter usan 3 decimales y coma', () => {
  assert.equal(formatPrice(2.109), '2,10900A0€');
  assert.equal(formatPrice(2), '2,00000A0€');
  assert.equal(formatPricePerLiter(2.109), '2,10900A0€/l');
});

test('formatEuros usa 2 decimales', () => {
  assert.equal(formatEuros(4.5), '4,5000A0€');
  assert.equal(formatEuros(0), '0,0000A0€');
});

test('formatKm', () => {
  assert.equal(formatKm(0.05), 'moins de 10000A0m');
  assert.equal(formatKm(0.1), '0,100A0km');
  assert.equal(formatKm(3.44), '3,400A0km');
});

test('formatDateTimeParis en invierno y verano', () => {
  assert.equal(formatDateTimeParis('2026-11-19T10:09:48+00:00'), '19/11/2026 à 11:09');
  assert.equal(formatDateTimeParis('2026-07-01T10:00:00+00:00'), '01/07/2026 à 12:00');
  assert.equal(formatDateTimeParis('2026-11-19T23:30:00+00:00'), '20/11/2026 à 00:30');
});

test('formatDateTimeParis falla con una fecha no válida', () => {
  assert.throws(() => formatDateTimeParis('no es fecha'), /Fecha ISO no válida/);
});

test('formatIsoDateFr lanza con una fecha inexistente', () => {
  assert.throws(() => formatIsoDateFr('2022-02-31'), /inexistente/);
  assert.throws(() => formatIsoDateFr('2022-13-01'), /inexistente/);
});

test('formatIsoDateFr', () => {
  assert.equal(formatIsoDateFr('2022-07-04'), '4 juillet 2022');
  assert.equal(formatIsoDateFr('2026-12-31'), '31 décembre 2026');
  assert.throws(() => formatIsoDateFr('04/07/2022'), /yyyy-mm-dd/);
});

test('formatInteger usa el separador de miles de Intl fr-FR', () => {
  assert.equal(formatInteger(9825), `9${THIN_NBSP}825`);
  assert.equal(formatInteger(999), '999');
  assert.equal(formatInteger(1234567), `1${THIN_NBSP}234${THIN_NBSP}567`);
});
