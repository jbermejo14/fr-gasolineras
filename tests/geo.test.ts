import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEPARTMENTS,
  REGIONS,
  departmentCodeFromPostalCode,
  findDepartmentByCode,
  findDepartmentBySlug,
  findRegionByCode,
  findRegionBySlug,
  normalizePlaceText,
  slugify,
} from '../src/lib/geo.ts';

const REGION_COUNT = 13;
const DEPARTMENT_COUNT = 96;

test('hay 13 regiones y 96 departamentos con códigos y slugs únicos', () => {
  assert.equal(REGIONS.length, REGION_COUNT);
  assert.equal(DEPARTMENTS.length, DEPARTMENT_COUNT);
  assert.equal(new Set(REGIONS.map((r) => r.code)).size, REGION_COUNT);
  assert.equal(new Set(REGIONS.map((r) => r.slug)).size, REGION_COUNT);
  assert.equal(new Set(DEPARTMENTS.map((d) => d.code)).size, DEPARTMENT_COUNT);
  assert.equal(new Set(DEPARTMENTS.map((d) => d.slug)).size, DEPARTMENT_COUNT);
});

test('todo regionCode existe y los departamentos están ordenados por código', () => {
  for (const department of DEPARTMENTS) {
    assert.ok(findRegionByCode(department.regionCode), department.code);
  }
  const codes = DEPARTMENTS.map((d) => d.code);
  assert.deepEqual(codes, [...codes].sort());
  assert.ok(!codes.includes('20'));
});

test('slugs de regiones según la tabla', () => {
  assert.equal(findRegionBySlug('provence-alpes-cote-d-azur')?.code, '93');
  assert.equal(findRegionBySlug('ile-de-france')?.name, 'Île-de-France');
  assert.equal(findRegionBySlug('no-existe'), null);
  assert.equal(findRegionByCode('00'), null);
});

test('búsqueda de departamentos', () => {
  assert.equal(findDepartmentByCode('2A')?.name, 'Corse-du-Sud');
  assert.equal(findDepartmentByCode('2B')?.name, 'Haute-Corse');
  assert.equal(findDepartmentBySlug('cotes-d-armor')?.code, '22');
  assert.equal(findDepartmentByCode('20'), null);
  assert.equal(findDepartmentBySlug('nada'), null);
  assert.equal(findDepartmentByCode('75')?.regionCode, '11');
});

test('departmentCodeFromPostalCode', () => {
  assert.equal(departmentCodeFromPostalCode('20137'), '2A');
  assert.equal(departmentCodeFromPostalCode('20000'), '2A');
  assert.equal(departmentCodeFromPostalCode('20199'), '2A');
  assert.equal(departmentCodeFromPostalCode('20200'), '2B');
  assert.equal(departmentCodeFromPostalCode('20999'), '2B');
  assert.equal(departmentCodeFromPostalCode('75012'), '75');
  assert.equal(departmentCodeFromPostalCode('01000'), '01');
  assert.equal(departmentCodeFromPostalCode('9700'), null);
  assert.equal(departmentCodeFromPostalCode('97100'), null);
  assert.equal(departmentCodeFromPostalCode('7501a'), null);
});

test('slugify', () => {
  assert.equal(slugify("Côtes-d'Armor"), 'cotes-d-armor');
  assert.equal(slugify('Évry-Grégy-sur-Yerre'), 'evry-gregy-sur-yerre');
  assert.equal(slugify('  Rue A & B  '), 'rue-a-et-b');
  assert.equal(slugify('--a   b--'), 'a-b');
});

test('normalizePlaceText pasa a tipo título si todo está en mayúsculas o en minúsculas', () => {
  assert.equal(normalizePlaceText('16 rue chateaubriand'), '16 Rue Chateaubriand');
  assert.equal(normalizePlaceText('saint-denis-lès-bourg'), 'Saint-Denis-lès-Bourg');
  assert.equal(normalizePlaceText('1234'), '1234');
  assert.equal(normalizePlaceText('SAINT-DENIS-LÈS-BOURG'), 'Saint-Denis-lès-Bourg');
  assert.equal(normalizePlaceText('ROUTE NATIONALE 7'), 'Route Nationale 7');
  assert.equal(normalizePlaceText('LA ROCHE-SUR-YON'), 'La Roche-sur-Yon');
  assert.equal(normalizePlaceText("VAL-D'OISE"), "Val-d'Oise");
  assert.equal(normalizePlaceText("L'ISLE-D'ABEAU"), "L'Isle-d'Abeau");
});

test('normalizePlaceText respeta texto mixto y colapsa espacios', () => {
  assert.equal(normalizePlaceText('Saint-Denis-lès-Bourg'), 'Saint-Denis-lès-Bourg');
  assert.equal(normalizePlaceText('  16 rue   Chateaubriand '), '16 rue Chateaubriand');
  assert.equal(normalizePlaceText(''), '');
});
