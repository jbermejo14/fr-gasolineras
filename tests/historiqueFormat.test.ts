import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HISTORY_FIRST_YEAR,
  HISTORY_FUELS,
  HISTORY_START_DATE,
  decodeDeltaSeries,
  encodeDeltaSeries,
  listMondays,
  mergeStationPartitions,
  milliToPrice,
  priceToMilli,
  yearOfIso,
} from '../src/lib/historiqueFormat.ts';
import type { StationPartitionFile } from '../src/lib/historiqueFormat.ts';

test('constantes del histórico', () => {
  assert.deepEqual([...HISTORY_FUELS], ['gazole', 'e10', 'sp95', 'sp98']);
  assert.equal(HISTORY_START_DATE, '2016-01-04');
  assert.equal(HISTORY_FIRST_YEAR, 2016);
});

test('conversión de precios', () => {
  assert.equal(priceToMilli(1.459), 1459);
  assert.equal(milliToPrice(1459), 1.459);
});

test('listMondays incluye el inicio y termina en el último lunes', () => {
  assert.deepEqual(listMondays('2016-01-04', new Date(Date.UTC(2016, 0, 4))), ['2016-01-04']);
  assert.deepEqual(listMondays('2016-01-04', new Date(Date.UTC(2016, 0, 20))), [
    '2016-01-04',
    '2016-01-11',
    '2016-01-18',
  ]);
});

test('listMondays cruza el año y falla si el inicio no es lunes', () => {
  const mondays = listMondays('2016-12-19', new Date(Date.UTC(2017, 0, 10)));
  assert.deepEqual(mondays, ['2016-12-19', '2016-12-26', '2017-01-02', '2017-01-09']);
  assert.throws(() => listMondays('2016-01-05', new Date(Date.UTC(2016, 1, 1))), RangeError);
});

test('listMondays devuelve vacío si toDate es anterior', () => {
  assert.deepEqual(listMondays('2016-01-04', new Date(Date.UTC(2015, 11, 31))), []);
});

test('listMondays: lunes a las 23:59 UTC cuenta y el domingo anterior no', () => {
  assert.deepEqual(listMondays('2016-01-04', new Date(Date.UTC(2016, 0, 11, 23, 59))), [
    '2016-01-04',
    '2016-01-11',
  ]);
  assert.deepEqual(listMondays('2016-01-04', new Date(Date.UTC(2016, 0, 10, 23, 59))), ['2016-01-04']);
});

test('listMondays falla si toDate es Invalid Date', () => {
  assert.throws(() => listMondays('2016-01-04', new Date(Number.NaN)), RangeError);
});

test('yearOfIso y fechas imposibles', () => {
  assert.equal(yearOfIso('2017-01-02'), 2017);
  assert.equal(yearOfIso('2016-02-29'), 2016);
  assert.throws(() => yearOfIso('2016-13-45'), RangeError);
  assert.throws(() => yearOfIso('2017-02-29'), RangeError);
  assert.throws(() => yearOfIso('04-01-2016'), RangeError);
  assert.throws(() => listMondays('2016-02-31', new Date(Date.UTC(2016, 5, 1))), RangeError);
});

test('delta: ida y vuelta con nulls al principio, en medio y al final', () => {
  const series = [null, 1459, 1460, null, null, 1500, 1490, null];
  const encoded = encodeDeltaSeries(series);
  assert.deepEqual(encoded, [null, 1459, 1, null, null, 1500, -10, null]);
  assert.deepEqual(decodeDeltaSeries(encoded), series);
  assert.deepEqual(decodeDeltaSeries(encodeDeltaSeries([])), []);
});

function buildPartition(year: number, weeks: string[], stations: StationPartitionFile['stations']) {
  const file: StationPartitionFile = { version: 1, departmentCode: '75', year, weeks, stations };
  return file;
}

test('mergeStationPartitions: años desordenados, ausencia y carburante omitido', () => {
  const y2016 = buildPartition(2016, ['2016-12-19', '2016-12-26'], {
    A: { sp95: [1400, 5], gazole: [1300, null] },
  });
  const y2017 = buildPartition(2017, ['2017-01-02', '2017-01-09'], { A: { sp95: [1410, 2] } });
  const y2018 = buildPartition(2018, ['2018-01-01'], { B: { gazole: [1000] } });

  const merged = mergeStationPartitions([y2018, y2017, y2016], 'A');
  assert.deepEqual(merged.weeks, ['2016-12-19', '2016-12-26', '2017-01-02', '2017-01-09', '2018-01-01']);
  assert.deepEqual(merged.series.sp95, [1400, 1405, 1410, 1412, null]);
  assert.deepEqual(merged.series.gazole, [1300, null, null, null, null]);
  assert.deepEqual(Object.keys(merged.series).sort(), [...HISTORY_FUELS].sort());
  assert.deepEqual(merged.series.sp98, [null, null, null, null, null]);
});

test('mergeStationPartitions sin ficheros devuelve series vacías', () => {
  const merged = mergeStationPartitions([], 'A');
  assert.deepEqual(merged.weeks, []);
  for (const fuel of HISTORY_FUELS) assert.deepEqual(merged.series[fuel], []);
});

test('mergeStationPartitions: null al final de un año y valor al inicio del siguiente', () => {
  const y2016 = buildPartition(2016, ['2016-12-19', '2016-12-26'], { A: { gazole: [1300, null] } });
  const y2017 = buildPartition(2017, ['2017-01-02', '2017-01-09'], { A: { gazole: [1500, 3] } });
  assert.deepEqual(mergeStationPartitions([y2016, y2017], 'A').series.gazole, [1300, null, 1500, 1503]);
});

test('mergeStationPartitions falla si una serie no mide lo que las semanas', () => {
  const broken = buildPartition(2016, ['2016-12-19', '2016-12-26'], { A: { gazole: [1300] } });
  assert.throws(() => mergeStationPartitions([broken], 'A'), RangeError);
});
