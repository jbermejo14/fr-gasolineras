import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEPARTMENTS,
  departmentOf,
  departmentOfName,
  regionIn,
  regionInName,
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

test('departmentOf: artículo correcto en los casos conocidos', () => {
  const of = (code: string) => departmentOf(findDepartmentByCode(code)!);
  assert.equal(of('56'), 'du Morbihan');
  assert.equal(of('33'), 'de la Gironde');
  assert.equal(of('01'), "de l'Ain");
  assert.equal(of('40'), 'des Landes');
  assert.equal(of('34'), "de l'Hérault");
  assert.equal(of('59'), 'du Nord');
  assert.equal(of('92'), 'des Hauts-de-Seine');
  assert.equal(of('93'), 'de la Seine-Saint-Denis');
  assert.equal(of('2A'), 'de la Corse-du-Sud');
  assert.equal(of('2B'), 'de la Haute-Corse');
  assert.equal(of('90'), 'du Territoire de Belfort');
  assert.equal(of('75'), 'de Paris');
});

test('departmentOf: los 96 departamentos son coherentes con su artículo', () => {
  assert.equal(DEPARTMENTS.length, 96);
  const vowelStart = /^[AEIOUYÂÉÈÊÎÔÛ]/;
  for (const department of DEPARTMENTS) {
    const text = departmentOf(department);
    assert.ok(text.endsWith(department.name), text);
    if (department.article === "l'") assert.ok(vowelStart.test(department.name) || department.name === 'Hérault', department.name);
    else if (department.article === 'le' || department.article === 'la') assert.ok(!vowelStart.test(department.name), department.name);
    assert.equal(departmentOfName(department.name), text);
  }
});

test('regionIn: preposición de las 13 regiones', () => {
  const byName = (name: string) => REGIONS.find((region) => region.name === name)!;
  assert.equal(regionIn(byName('Bretagne')), 'en Bretagne');
  assert.equal(regionIn(byName('Île-de-France')), 'en Île-de-France');
  assert.equal(regionIn(byName('Grand Est')), 'dans le Grand Est');
  assert.equal(regionIn(byName('Grand Est'), true), 'Dans le Grand Est');
  assert.equal(regionIn(byName('Hauts-de-France')), 'dans les Hauts-de-France');
  assert.equal(regionIn(byName('Pays de la Loire'), true), 'Dans les Pays de la Loire');
  assert.equal(regionIn(byName('Corse'), true), 'En Corse');
  assert.equal(REGIONS.length, 13);
  for (const region of REGIONS) assert.equal(regionInName(region.name), regionIn(region));
});
