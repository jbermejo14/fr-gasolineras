import test from 'node:test';
import assert from 'node:assert/strict';
import { YearAccumulator, computeBrandsSignature, mergeYearResults, weeklyStationSeries } from '../src/lib/historiqueBuild.ts';
import type { CarryState, YearResult } from '../src/lib/historiqueBuild.ts';
import type { AnnualStation, PriceRecord } from '../src/lib/annualArchive.ts';
import { BRAND_GROUPS } from '../src/lib/brands.ts';
import { DEPARTMENTS, REGIONS } from '../src/lib/geo.ts';
import { HISTORY_FUELS, decodeDeltaSeries } from '../src/lib/historiqueFormat.ts';

const MONDAYS = ['2020-01-06', '2020-01-13', '2020-01-20'];

function record(maj: string, priceMilli: number, fuel: PriceRecord['fuel'] = 'gazole'): PriceRecord {
  return { fuel, maj, priceMilli };
}

test('weeklyStationSeries: el registro del lunes por la tarde cuenta', () => {
  const { series } = weeklyStationSeries([record('2020-01-06T18:30:00', 1500)], MONDAYS, undefined);
  assert.deepEqual(series.gazole, [1500, 1500, 1500]);
});

test('weeklyStationSeries: un registro posterior al lunes no cuenta para ese lunes', () => {
  const { series } = weeklyStationSeries([record('2020-01-07T00:00:00', 1500)], MONDAYS, undefined);
  assert.deepEqual(series.gazole, [null, 1500, 1500]);
});

test('weeklyStationSeries: registros desordenados se ordenan por maj', () => {
  const records = [record('2020-01-12T10:00:00', 1600), record('2020-01-05T10:00:00', 1500), record('2020-01-08T10:00:00', 1550)];
  const { series, carryOut } = weeklyStationSeries(records, MONDAYS, undefined);
  assert.deepEqual(series.gazole, [1500, 1600, 1600]);
  assert.deepEqual(carryOut.gazole, { maj: '2020-01-12T10:00:00', priceMilli: 1600 });
});

test('weeklyStationSeries: empate de maj gana el último del fichero', () => {
  const records = [record('2020-01-05T10:00:00', 1500), record('2020-01-05T10:00:00', 1400)];
  assert.equal(weeklyStationSeries(records, MONDAYS, undefined).series.gazole[0], 1400);
});

test('weeklyStationSeries: carryIn cuenta como anterior a todos los registros', () => {
  const carryIn: CarryState = { gazole: { maj: '2019-12-30T10:00:00', priceMilli: 1450 } };
  const { series } = weeklyStationSeries([record('2020-01-08T10:00:00', 1500)], MONDAYS, carryIn);
  assert.deepEqual(series.gazole, [1450, 1500, 1500]);
});

test('weeklyStationSeries: caduca a más de 30 días y el límite exacto aún vale', () => {
  const mondays = ['2020-02-05', '2020-02-06'];
  const { series } = weeklyStationSeries([record('2020-01-06T10:00:00', 1500)], mondays, undefined);
  assert.deepEqual(series.gazole, [1500, null]);
});

test('weeklyStationSeries: carryOut conserva el estado heredado si no hay registros y omite carburantes sin dato', () => {
  const carryIn: CarryState = { e10: { maj: '2019-12-01T00:00:00', priceMilli: 1300 } };
  const { series, carryOut } = weeklyStationSeries([], MONDAYS, carryIn);
  assert.deepEqual(series.e10, [null, null, null]);
  assert.deepEqual(carryOut, carryIn);
});

function station(id: string, postalCode: string, records: PriceRecord[]): AnnualStation {
  return { id, postalCode, records };
}

test('YearAccumulator: sum, count y min por zona (Francia, región, departamento)', () => {
  const accumulator = new YearAccumulator(2020, MONDAYS, {});
  accumulator.addStation(station('A', '75001', [record('2020-01-05T10:00:00', 1500)]));
  accumulator.addStation(station('B', '75002', [record('2020-01-05T10:00:00', 1400), record('2020-01-12T10:00:00', 1450)]));
  accumulator.addStation(station('C', '13001', [record('2020-01-05T10:00:00', 1300)]));
  const { result } = accumulator.build();
  const paris = DEPARTMENTS.find((department) => department.code === '75');
  assert.ok(paris);
  assert.deepEqual(result.areas['france:france'].gazole, {
    sum: [4200, 4250, 4250],
    count: [3, 3, 3],
    min: [1300, 1300, 1300],
  });
  assert.deepEqual(result.areas[`departement:${paris.slug}`].gazole.sum, [2900, 2950, 2950]);
  assert.deepEqual(result.areas[`departement:${paris.slug}`].gazole.min, [1400, 1450, 1450]);
  assert.equal(result.areas['france:france'].sp98.count[0], 0);
  assert.equal(result.areas['france:france'].sp98.min[0], null);
  const region = REGIONS.find((candidate) => candidate.code === paris.regionCode);
  assert.ok(region);
  assert.deepEqual(result.areas[`region:${region.slug}`].gazole.count, [2, 2, 2]);
});

test('YearAccumulator: suma cada estación a la zona de su red y no a las sin red', () => {
  const brandOf = (id: string) => (id === 'A' ? 'leclerc' : id === 'B' ? 'leclerc' : null);
  const accumulator = new YearAccumulator(2020, MONDAYS, {}, brandOf);
  accumulator.addStation(station('A', '75001', [record('2020-01-05T10:00:00', 1500)]));
  accumulator.addStation(station('B', '99999', [record('2020-01-05T10:00:00', 1400)]));
  accumulator.addStation(station('C', '75001', [record('2020-01-05T10:00:00', 1300)]));
  const { result } = accumulator.build();
  assert.deepEqual(result.areas['marque:leclerc'].gazole, { sum: [2900, 2900, 2900], count: [2, 2, 2], min: [1400, 1400, 1400] });
  assert.equal(result.areas['france:france'].gazole.count[0], 3);
  assert.deepEqual(Object.keys(result.areas).filter((key) => key.startsWith('marque:')), ['marque:leclerc']);
  assert.equal(result.version, 2);
});

test('YearAccumulator: sin brandOfStation no hay zonas de marca', () => {
  const accumulator = new YearAccumulator(2020, MONDAYS, {});
  accumulator.addStation(station('A', '75001', [record('2020-01-05T10:00:00', 1500)]));
  const { result } = accumulator.build();
  assert.deepEqual(Object.keys(result.areas).filter((key) => key.startsWith('marque:')), []);
});

test('YearAccumulator: CP de Córcega se reparten entre 2A y 2B', () => {
  const accumulator = new YearAccumulator(2020, MONDAYS, {});
  accumulator.addStation(station('S', '20090', [record('2020-01-05T10:00:00', 1500)]));
  accumulator.addStation(station('N', '20200', [record('2020-01-05T10:00:00', 1600)]));
  const { partitions } = accumulator.build();
  assert.deepEqual(partitions.map((partition) => partition.departmentCode), ['2A', '2B']);
});

test('YearAccumulator: CP desconocido solo cuenta en France y no tiene partición', () => {
  const accumulator = new YearAccumulator(2020, MONDAYS, {});
  accumulator.addStation(station('X', '99999', [record('2020-01-05T10:00:00', 1500)]));
  const { partitions, result } = accumulator.build();
  assert.deepEqual(Object.keys(result.areas), ['france:france']);
  assert.deepEqual(partitions, []);
});

test('YearAccumulator: partición en delta, sin carburantes vacíos ni estaciones sin datos', () => {
  const accumulator = new YearAccumulator(2020, MONDAYS, {});
  accumulator.addStation(station('A', '75001', [record('2020-01-05T10:00:00', 1500), record('2020-01-12T10:00:00', 1520)]));
  accumulator.addStation(station('EMPTY', '75001', []));
  const { partitions } = accumulator.build();
  assert.equal(partitions.length, 1);
  assert.equal(partitions[0].departmentCode, '75');
  assert.equal(partitions[0].year, 2020);
  assert.deepEqual(partitions[0].weeks, MONDAYS);
  assert.deepEqual(Object.keys(partitions[0].stations), ['A']);
  assert.deepEqual(partitions[0].stations.A, { gazole: [1500, 20, 0] });
  assert.deepEqual(decodeDeltaSeries(partitions[0].stations.A.gazole ?? []), [1500, 1520, 1520]);
});

test('YearAccumulator: carryIn de otro año y carryOut en el resultado', () => {
  const carryIn = { A: { gazole: { maj: '2019-12-30T10:00:00', priceMilli: 1450 } } } satisfies Record<string, CarryState>;
  const accumulator = new YearAccumulator(2020, MONDAYS, carryIn);
  accumulator.addStation(station('A', '75001', []));
  const { result, partitions } = accumulator.build();
  assert.deepEqual(result.carryOut, carryIn);
  assert.deepEqual(partitions[0].stations.A.gazole, [1450, 0, 0]);
});

function yearResult(year: number, weeks: string[], areas: YearResult['areas']): YearResult {
  return { version: 2, year, weeks, zipSize: 0, zipMtimeMs: 0, brandsSignature: '', areas, carryOut: {}, partitionFiles: [] };
}

function fuelTotals(sum: number[], count: number[], min: (number | null)[]) {
  const empty = { sum: sum.map(() => 0), count: sum.map(() => 0), min: sum.map(() => null) };
  return { gazole: { sum, count, min }, e10: empty, sp95: empty, sp98: empty };
}

test('mergeYearResults: concatena años, redondea la media y pone null con count 0', () => {
  const y1 = yearResult(2020, ['2020-12-28'], { 'france:france': fuelTotals([2999], [2], [1000]) });
  const y2 = yearResult(2021, ['2021-01-04', '2021-01-11'], {
    'france:france': fuelTotals([0, 3000], [0, 2], [null, 1400]),
  });
  const { index, areas } = mergeYearResults([y1, y2], '2026-01-01T00:00:00.000Z');
  assert.deepEqual(index.weeks, ['2020-12-28', '2021-01-04', '2021-01-11']);
  assert.equal(index.generatedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(index.version, 1);
  const france = areas[0];
  assert.deepEqual(france.weeks, index.weeks);
  assert.deepEqual(france.area.series.gazole.avg, [1500, null, 1500]);
  assert.deepEqual(france.area.series.gazole.min, [1000, null, 1400]);
  assert.deepEqual(france.area.series.gazole.count, [2, 0, 2]);
  assert.deepEqual(france.area.series.e10.avg, [null, null, null]);
});

test('mergeYearResults: omite zonas vacías, ordena France, regiones y departamentos y usa nombres de geo', () => {
  const lastDepartment = DEPARTMENTS[DEPARTMENTS.length - 1];
  const firstDepartment = DEPARTMENTS[0];
  const lastRegion = REGIONS[REGIONS.length - 1];
  const firstRegion = REGIONS[0];
  const data = fuelTotals([1500], [1], [1500]);
  const result = yearResult(2020, ['2020-01-06'], {
    [`departement:${lastDepartment.slug}`]: data,
    [`departement:${firstDepartment.slug}`]: data,
    [`region:${lastRegion.slug}`]: data,
    [`region:${firstRegion.slug}`]: data,
    'france:france': data,
  });
  const { index, areas } = mergeYearResults([result], 'x');
  assert.deepEqual(
    index.areas.map((entry) => `${entry.kind}:${entry.slug}`),
    [
      'france:france',
      `region:${firstRegion.slug}`,
      `region:${lastRegion.slug}`,
      `departement:${firstDepartment.slug}`,
      `departement:${lastDepartment.slug}`,
    ]
  );
  assert.equal(areas.length, 5);
  assert.deepEqual(index.areas[0], { kind: 'france', slug: 'france', name: 'France' });
  assert.equal(index.areas[1].name, firstRegion.name);
  assert.equal(index.areas[3].name, firstDepartment.name);
  assert.equal(index.areas[3].parentSlug, REGIONS.find((region) => region.code === firstDepartment.regionCode)?.slug);
  assert.equal(areas[3].area.name, firstDepartment.name);
});

test('mergeYearResults: zonas de marca al final, en el orden de BRAND_GROUPS y con su nombre', () => {
  const data = fuelTotals([1500], [1], [1500]);
  const first = BRAND_GROUPS[0];
  const last = BRAND_GROUPS[BRAND_GROUPS.length - 1];
  const result = yearResult(2020, ['2020-01-06'], {
    [`marque:${last.slug}`]: data,
    [`marque:${first.slug}`]: data,
    [`departement:${DEPARTMENTS[0].slug}`]: data,
    'france:france': data,
  });
  const { index, areas } = mergeYearResults([result], 'x');
  assert.deepEqual(
    index.areas.map((entry) => `${entry.kind}:${entry.slug}`),
    ['france:france', `departement:${DEPARTMENTS[0].slug}`, `marque:${first.slug}`, `marque:${last.slug}`]
  );
  assert.deepEqual(index.areas[2], { kind: 'marque', slug: first.slug, name: first.name });
  assert.equal(areas[3].area.name, last.name);
});

test('mergeYearResults: un año sin una zona la rellena con huecos', () => {
  const region = REGIONS[0];
  const y1 = yearResult(2020, ['2020-01-06'], { [`region:${region.slug}`]: fuelTotals([1500], [1], [1500]) });
  const y2 = yearResult(2021, ['2021-01-04'], {});
  const { areas } = mergeYearResults([y1, y2], 'x');
  assert.equal(areas.length, 1);
  assert.deepEqual(areas[0].area.series.gazole.avg, [1500, null]);
  assert.deepEqual(Object.keys(areas[0].area.series).sort(), [...HISTORY_FUELS].sort());
});

test('mergeYearResults sin resultados no produce zonas', () => {
  const { index, areas } = mergeYearResults([], 'x');
  assert.deepEqual(areas, []);
  assert.deepEqual(index.areas, []);
});

test('computeBrandsSignature: estable ante el orden y distinta si cambia una pareja', () => {
  const a = computeBrandsSignature(new Map([['1', 'leclerc'], ['2', 'bp']]));
  const reordered = computeBrandsSignature(new Map([['2', 'bp'], ['1', 'leclerc']]));
  const changed = computeBrandsSignature(new Map([['1', 'leclerc'], ['2', 'shell']]));
  assert.equal(a, reordered);
  assert.notEqual(a, changed);
  assert.notEqual(a, computeBrandsSignature(new Map()));
});
