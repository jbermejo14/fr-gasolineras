import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BRAND_GROUPS, brandGroupOf, findBrandGroupBySlug } from '../src/lib/brands.ts';

function slugOf(name: string | null): string | null {
  return brandGroupOf(name)?.slug ?? null;
}

test('BRAND_GROUPS tiene las 19 redes del contrato en su orden, con slugs únicos', () => {
  assert.equal(BRAND_GROUPS.length, 19);
  assert.equal(new Set(BRAND_GROUPS.map((group) => group.slug)).size, BRAND_GROUPS.length);
  assert.deepEqual(BRAND_GROUPS.slice(0, 3).map((group) => group.slug), ['totalenergies', 'intermarche', 'carrefour']);
  assert.equal(BRAND_GROUPS[BRAND_GROUPS.length - 1].slug, 'dats-24');
});

test('cada logo de BRAND_GROUPS existe en public/', () => {
  const publicDir = path.join(import.meta.dirname, '..', 'public');
  for (const group of BRAND_GROUPS) {
    if (group.logo === null) continue;
    assert.ok(fs.existsSync(path.join(publicDir, group.logo)), `Falta el logo de ${group.name}: public${group.logo}`);
  }
});

test('findBrandGroupBySlug encuentra una red o devuelve null', () => {
  assert.equal(findBrandGroupBySlug('leclerc')?.name, 'E.Leclerc');
  assert.equal(findBrandGroupBySlug('systeme-u')?.name, 'Système U');
  assert.equal(findBrandGroupBySlug('inexistente'), null);
  assert.equal(findBrandGroupBySlug(null), null);
});

test('cada red se reconoce por el nombre de la tabla', () => {
  for (const group of BRAND_GROUPS) {
    assert.equal(slugOf(group.name), group.slug, group.name);
  }
});

test('las keywords de la tabla se reconocen', () => {
  const cases: [string, string][] = [
    ['TotalEnergies', 'totalenergies'], ['Total Access', 'totalenergies'], ['Total Contact', 'totalenergies'],
    ['Super U', 'systeme-u'], ['Hyper U', 'systeme-u'], ['Station U', 'systeme-u'], ['U Express', 'systeme-u'],
    ['La Station U', 'systeme-u'], ['Système U', 'systeme-u'], ['Agip', 'eni'], ['E.Leclerc', 'leclerc'],
  ];
  for (const [name, slug] of cases) assert.equal(slugOf(name), slug, name);
});

test('trampas del contrato', () => {
  assert.equal(slugOf('Super U;Station U'), 'systeme-u');
  assert.equal(slugOf('U'), 'systeme-u');
  assert.equal(slugOf('Station U'), 'systeme-u');
  assert.equal(slugOf('Magasins U'), 'systeme-u');
  assert.equal(slugOf('U Carburant'), 'systeme-u');
  assert.equal(slugOf('Hyper-U'), 'systeme-u');
  assert.equal(slugOf('Total Access'), 'totalenergies');
  assert.equal(slugOf('Relais des images (Total)'), 'totalenergies');
  assert.equal(slugOf('Eni'), 'eni');
  assert.equal(slugOf('Garage Denis'), null);
  assert.equal(slugOf('Spar'), 'spar');
  assert.equal(slugOf('Sparkle'), null);
  assert.equal(slugOf('BP'), 'bp');
  assert.equal(slugOf('Bpost'), null);
  assert.equal(slugOf('Aviation'), null);
  assert.equal(slugOf('Avia Express'), 'avia');
  assert.equal(slugOf('Elancourt'), null);
  assert.equal(slugOf('Vitogaz'), null);
  assert.equal(slugOf('Matchbox'), null);
  assert.equal(slugOf('Match'), 'match');
  assert.equal(slugOf('Station-Essence Intermarché'), 'intermarche');
  assert.equal(slugOf('Indépendante'), null);
});

test('la letra U solo vale si es el nombre entero', () => {
  assert.equal(slugOf('Garage U Turn'), null);
  assert.equal(slugOf('u'), 'systeme-u');
});

test('normaliza tildes, mayúsculas y puntos', () => {
  assert.equal(slugOf('INTERMARCHÉ CONTACT'), 'intermarche');
  assert.equal(slugOf('E.LECLERC'), 'leclerc');
  assert.equal(slugOf('Aire C'), 'aire-c');
  assert.equal(slugOf('Aire de repos'), null);
});

test('sin nombre o con nombre vacío no hay red', () => {
  assert.equal(brandGroupOf(null), null);
  assert.equal(brandGroupOf(''), null);
  assert.equal(brandGroupOf('  - . '), null);
});
