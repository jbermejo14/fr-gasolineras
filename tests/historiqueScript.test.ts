import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isZipFinal,
  parseHistoriqueArgs,
  resolveHistoriqueExitCode,
  yearsToProcess,
} from '../scripts/historique.ts';

test('parseHistoriqueArgs: sin argumentos usa los valores por defecto', () => {
  assert.deepEqual(parseHistoriqueArgs([]), { until: null, rebuild: false });
});

test('parseHistoriqueArgs: --hasta y --rehacer', () => {
  assert.deepEqual(parseHistoriqueArgs(['--hasta=2020-01-06', '--rehacer']), { until: '2020-01-06', rebuild: true });
});

test('parseHistoriqueArgs: opción desconocida lanza Error claro', () => {
  assert.throws(() => parseHistoriqueArgs(['--otra']), /Opción desconocida: "--otra"/);
});

test('parseHistoriqueArgs: fecha mal formada o inexistente lanza Error', () => {
  assert.throws(() => parseHistoriqueArgs(['--hasta=06-01-2020']), /Fecha inválida/);
  assert.throws(() => parseHistoriqueArgs(['--hasta=2020-02-30']), /Fecha inválida/);
  assert.throws(() => parseHistoriqueArgs(['--hasta=']), /Fecha inválida/);
});

test('parseHistoriqueArgs: --hasta anterior al inicio del histórico lanza Error', () => {
  assert.throws(() => parseHistoriqueArgs(['--hasta=2016-01-03']), /anterior al inicio del histórico/);
  assert.equal(parseHistoriqueArgs(['--hasta=2016-01-04']).until, '2016-01-04');
});

test('yearsToProcess: de 2016 al año de --hasta o de hoy', () => {
  assert.deepEqual(yearsToProcess('2016-03-31'), [2016]);
  assert.deepEqual(yearsToProcess('2018-06-01'), [2016, 2017, 2018]);
  assert.deepEqual(yearsToProcess(null, new Date(Date.UTC(2017, 5, 1))), [2016, 2017]);
});

test('isZipFinal: definitivo a partir del 3 de enero del año siguiente (hora local)', () => {
  assert.equal(isZipFinal(2020, new Date(2021, 0, 3, 0, 0, 0)), true);
  assert.equal(isZipFinal(2020, new Date(2021, 0, 2, 23, 59, 59)), false);
  assert.equal(isZipFinal(2020, new Date(2020, 11, 31)), false);
  assert.equal(isZipFinal(2020, new Date(2026, 5, 1).getTime()), true);
});

test('resolveHistoriqueExitCode: 0 sin fallos, 1 con años fallidos', () => {
  assert.equal(resolveHistoriqueExitCode(0), 0);
  assert.equal(resolveHistoriqueExitCode(2), 1);
});
