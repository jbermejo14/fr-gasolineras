import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPartitionFetcher,
  hasAnyPrice,
  listMissingYears,
  listRecentYears,
  loadPartitions,
} from '../src/lib/stationHistoryLoader.ts';
import { mergeStationPartitions } from '../src/lib/historiqueFormat.ts';
import type { StationPartitionFile } from '../src/lib/historiqueFormat.ts';

function makePartition(year: number, deltas: (number | null)[] | null): StationPartitionFile {
  return {
    version: 1,
    departmentCode: '56',
    year,
    weeks: [`${year}-01-04`, `${year}-01-11`],
    stations: deltas ? { '100': { gazole: deltas } } : {},
  };
}

test('listRecentYears: año anterior y actual', () => {
  assert.deepEqual(listRecentYears(2026), [2025, 2026]);
});

test('listMissingYears: desde 2016 sin los ya pedidos', () => {
  assert.deepEqual(listMissingYears(2026, [2025, 2026]), [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
  assert.deepEqual(listMissingYears(2017, [2016, 2017]), []);
});

test('loadPartitions: 404 (null) se omite', async () => {
  const files = await loadPartitions([2025, 2026], async (year) => (year === 2025 ? null : makePartition(year, [1500, 5])));
  assert.deepEqual(files.map((file) => file.year), [2026]);
});

test('loadPartitions: respeta el límite de concurrencia', async () => {
  let active = 0;
  let peak = 0;
  const years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
  const files = await loadPartitions(years, async (year) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return makePartition(year, [1500, 5]);
  });
  assert.equal(peak, 4);
  assert.equal(files.length, years.length);
});

test('loadPartitions: conserva el orden de los años pedidos', async () => {
  const files = await loadPartitions([2020, 2018, 2019], async (year) => {
    await new Promise((resolve) => setTimeout(resolve, 10 - (year - 2018) * 4));
    return makePartition(year, [1500, 5]);
  });
  assert.deepEqual(files.map((file) => file.year), [2020, 2018, 2019]);
});

test('loadPartitions: propaga el error', async () => {
  await assert.rejects(
    loadPartitions([2025, 2026], async (year) => {
      if (year === 2026) throw new Error('HTTP 500');
      return makePartition(year, [1500, 5]);
    }),
    /HTTP 500/
  );
});

test('hasAnyPrice: detecta datos y ausencia de datos', () => {
  assert.equal(hasAnyPrice(mergeStationPartitions([makePartition(2025, [1500, 5])], '100')), true);
  assert.equal(hasAnyPrice(mergeStationPartitions([makePartition(2025, null)], '100')), false);
  assert.equal(hasAnyPrice(mergeStationPartitions([], '100')), false);
});

test('loadPartitions: sin años devuelve lista vacía sin pedir nada', async () => {
  let calls = 0;
  const files = await loadPartitions([], async () => {
    calls += 1;
    return null;
  });
  assert.deepEqual(files, []);
  assert.equal(calls, 0);
});

test('loadPartitions: límite menor o igual que cero usa un solo trabajador', async () => {
  for (const limit of [0, -3]) {
    let active = 0;
    let peak = 0;
    const files = await loadPartitions([2024, 2025, 2026], async (year) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return makePartition(year, [1500, 5]);
    }, limit);
    assert.equal(peak, 1);
    assert.equal(files.length, 3);
  }
});

test('loadPartitions: tras un error no se piden más años', async () => {
  const requested: number[] = [];
  const years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];
  await assert.rejects(
    loadPartitions(years, async (year) => {
      requested.push(year);
      await new Promise((resolve) => setTimeout(resolve, 2));
      if (year === 2016) throw new Error('HTTP 500');
      return makePartition(year, [1500, 5]);
    }, 2),
    /HTTP 500/
  );
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.ok(requested.length < years.length, `se pidieron ${requested.length} años`);
  assert.deepEqual(requested, [2016, 2017]);
});

function fakeFetch(status: number, body: unknown = {}) {
  const urls: string[] = [];
  const fetchFn = async (url: string) => {
    urls.push(url);
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { urls, fetchFn };
}

test('createPartitionFetcher: pide {base}/{departamento}/{año}.json sin barras duplicadas', async () => {
  const partition = makePartition(2026, [1500, 5]);
  const { urls, fetchFn } = fakeFetch(200, partition);
  const fetcher = createPartitionFetcher('/fr/prix-carburants/historique-stations/', '56', fetchFn);
  assert.deepEqual(await fetcher(2026), partition);
  assert.deepEqual(urls, ['/fr/prix-carburants/historique-stations/56/2026.json']);
});

test('createPartitionFetcher: un 404 significa año sin datos (null)', async () => {
  const fetcher = createPartitionFetcher('/base', '56', fakeFetch(404).fetchFn);
  assert.equal(await fetcher(2016), null);
});

test('createPartitionFetcher: otro error HTTP lanza con el año', async () => {
  const fetcher = createPartitionFetcher('/base', '56', fakeFetch(500).fetchFn);
  await assert.rejects(fetcher(2020), /HTTP 500 al pedir el año 2020/);
});

test('loadPartitions con createPartitionFetcher: los años 404 se omiten', async () => {
  const fetcher = createPartitionFetcher('/base', '56', fakeFetch(404).fetchFn);
  assert.deepEqual(await loadPartitions([2016, 2017], fetcher), []);
});
