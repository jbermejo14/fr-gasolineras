import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyFuelPrices } from '../src/lib/fuels.ts';
import type { FuelPrices } from '../src/lib/fuels.ts';
import type { Station } from '../src/lib/prixCarburants.ts';
import { formatEuros } from '../src/lib/format.ts';
import {
  brandTankSentence,
  cheapestBrandDepartment,
  summarizeBrandDepartments,
  summarizeBrands,
} from '../src/lib/brandInsights.ts';
import type { BrandDepartmentRow } from '../src/lib/brandInsights.ts';

function makeStation(id: string, departmentCode: string, department: string, prices: Partial<FuelPrices>): Station {
  return {
    id,
    slug: `est-${id}`,
    name: null,
    brandSlug: null,
    address: '1 Rue Test',
    postalCode: '56580',
    city: 'Test',
    communeSlug: 'test',
    departmentCode,
    department,
    departmentSlug: department.toLowerCase(),
    regionCode: '53',
    region: 'Bretagne',
    regionSlug: 'bretagne',
    roadType: 'route',
    lat: 48,
    lon: -2,
    is24h: false,
    openingHours: [],
    services: [],
    prices: { ...emptyFuelPrices(), ...prices },
    priceUpdatedAt: { gazole: null, e10: null, sp95: null, sp98: null, e85: null, gplc: null },
  };
}

test('summarizeBrands: ordena por número de estaciones y omite redes vacías', () => {
  const brands = new Map<string, Station[]>([
    ['totalenergies', [makeStation('1', '56', 'Morbihan', { gazole: 1.8, e10: 1.9 })]],
    [
      'intermarche',
      [makeStation('2', '56', 'Morbihan', { gazole: 1.7 }), makeStation('3', '22', 'Cotes', { gazole: 1.8 })],
    ],
    ['carrefour', []],
  ]);
  const summaries = summarizeBrands(brands);
  assert.deepEqual(
    summaries.map((summary) => summary.group.slug),
    ['intermarche', 'totalenergies'],
  );
  assert.equal(summaries[0].stationCount, 2);
  assert.equal(summaries[0].avgGazole, 1.75);
  assert.equal(summaries[0].avgE10, null);
  assert.equal(summaries[1].avgE10, 1.9);
});

test('summarizeBrands: en empate respeta el orden de BRAND_GROUPS', () => {
  const brands = new Map<string, Station[]>([
    ['esso', [makeStation('1', '56', 'Morbihan', {})]],
    ['carrefour', [makeStation('2', '56', 'Morbihan', {})]],
  ]);
  assert.deepEqual(
    summarizeBrands(brands).map((summary) => summary.group.slug),
    ['carrefour', 'esso'],
  );
});

test('summarizeBrandDepartments: agrupa, calcula media y estación más barata', () => {
  const stations = [
    makeStation('1', '56', 'Morbihan', { gazole: 1.9 }),
    makeStation('2', '56', 'Morbihan', { gazole: 1.7 }),
    makeStation('3', '22', 'Cotes', { e10: 1.8 }),
    makeStation('4', '29', 'Finistere', { gazole: 1.6 }),
    makeStation('5', '29', 'Finistere', {}),
  ];
  const rows = summarizeBrandDepartments(stations);
  assert.deepEqual(
    rows.map((row) => row.departmentCode),
    ['29', '56', '22'],
  );
  const morbihan = rows.find((row) => row.departmentCode === '56');
  assert.equal(morbihan?.stationCount, 2);
  assert.equal(morbihan?.avgGazole, 1.8);
  assert.equal(morbihan?.cheapestGazole?.id, '2');
  const cotes = rows.find((row) => row.departmentCode === '22');
  assert.equal(cotes?.avgGazole, null);
  assert.equal(cotes?.cheapestGazole, null);
});

test('summarizeBrandDepartments: sin estaciones devuelve lista vacía', () => {
  assert.deepEqual(summarizeBrandDepartments([]), []);
});

test('summarizeBrandDepartments: desempate por código con igual número de estaciones', () => {
  const stations = [makeStation('1', '56', 'Morbihan', {}), makeStation('2', '22', 'Cotes', {})];
  assert.deepEqual(
    summarizeBrandDepartments(stations).map((row) => row.departmentCode),
    ['22', '56'],
  );
});

test('summarizeBrandDepartments: departamento único', () => {
  const rows = summarizeBrandDepartments([makeStation('1', '56', 'Morbihan', { gazole: 1.8 })]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stationCount, 1);
  assert.equal(rows[0].cheapestGazole?.id, '1');
});

test('summarizeBrandDepartments: con mínimo empatado gana la primera estación', () => {
  const rows = summarizeBrandDepartments([
    makeStation('1', '56', 'Morbihan', { gazole: 1.7 }),
    makeStation('2', '56', 'Morbihan', { gazole: 1.7 }),
  ]);
  assert.equal(rows[0].cheapestGazole?.id, '1');
});

test('summarizeBrands: red sin precios de gazole tiene media null', () => {
  const brands = new Map<string, Station[]>([['esso', [makeStation('1', '56', 'Morbihan', { e10: 1.9 })]]]);
  assert.equal(summarizeBrands(brands)[0].avgGazole, null);
});

function makeRow(code: string, avgGazole: number | null): BrandDepartmentRow {
  return {
    departmentCode: code,
    department: `Dep${code}`,
    departmentSlug: `dep${code}`,
    stationCount: 1,
    avgGazole,
    cheapestGazole: null,
  };
}

test('cheapestBrandDepartment: caso normal, empate, un solo departamento y sin precios', () => {
  assert.equal(cheapestBrandDepartment([makeRow('01', 1.9), makeRow('02', 1.7), makeRow('03', null)])?.departmentCode, '02');
  assert.equal(cheapestBrandDepartment([makeRow('01', 1.7), makeRow('02', 1.7)])?.departmentCode, '01');
  assert.equal(cheapestBrandDepartment([makeRow('01', 1.7), makeRow('02', null)]), null);
  assert.equal(cheapestBrandDepartment([makeRow('01', null), makeRow('02', null)]), null);
  assert.equal(cheapestBrandDepartment([]), null);
});

test('brandTankSentence: más barato, más caro, igual y sin datos', () => {
  assert.equal(
    brandTankSentence('Esso', 'gazole', 1.7, 1.8),
    `Chez Esso, un plein de 50 litres de gazole coûte en moyenne ${formatEuros(5)} de moins que la moyenne nationale.`,
  );
  assert.match(brandTankSentence('Esso', 'SP95-E10', 1.9, 1.8) ?? '', /de plus que/);
  assert.match(brandTankSentence('Esso', 'gazole', 1.8, 1.8) ?? '', /le même prix que/);
  assert.equal(brandTankSentence('Esso', 'gazole', null, 1.8), null);
  assert.equal(brandTankSentence('Esso', 'gazole', 1.8, null), null);
});
