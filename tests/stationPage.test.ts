import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assetPath } from '../src/lib/site.ts';
import { brandBadgeSpec, stationCommercialTitle, stationHeading } from '../src/lib/stationHeading.ts';
import { parseStationPathSlug, stationPath } from '../src/lib/prixCarburants.ts';

const SOURCE_DIR = path.join(import.meta.dirname, '..', 'src');
const PAGE_PATH = path.join(SOURCE_DIR, 'app', 'station', '[slug]', 'page.tsx');
const PRICES_PATH = path.join(SOURCE_DIR, 'components', 'StationPrices.tsx');

function readStationSources(): Array<{ file: string; source: string }> {
  const componentsDir = path.join(SOURCE_DIR, 'components');
  const files = [PAGE_PATH, ...fs.readdirSync(componentsDir).filter((name) => /^Station(?!Card).*\.tsx$/.test(name)).map((name) => path.join(componentsDir, name))];
  return files.map((file) => ({ file, source: fs.readFileSync(file, 'utf8') }));
}

test('el parámetro de la ficha se resuelve al id con parseStationPathSlug', () => {
  const station = { id: '56580001', slug: 'brehan-16-rue-chateaubriand' };
  const param = stationPath(station).slice('/station/'.length);
  assert.equal(param, '56580001-brehan-16-rue-chateaubriand');
  assert.equal(parseStationPathSlug(param), '56580001');
  assert.equal(parseStationPathSlug('sin-id'), null);
  assert.equal(parseStationPathSlug(''), null);
});

test('la ficha y sus componentes no formatean importes con toFixed', () => {
  for (const { file, source } of readStationSources()) {
    assert.doesNotMatch(source, /toFixed\(/, `${file}: usa formatEuros, formatPrice o formatKm en vez de toFixed`);
  }
});

test('la ficha pasa los importes por formatEuros, usa SITE_NAME en openGraph y monta el histórico de la estación', () => {
  const page = fs.readFileSync(PAGE_PATH, 'utf8');
  assert.match(fs.readFileSync(PRICES_PATH, 'utf8'), /formatEuros\(price \* TANK_LITERS\)/);
  assert.match(page, /siteName: SITE_NAME/);
  assert.match(page, /<StationHistory\b/, 'la ficha debe usar <StationHistory');
});

test('stationHeading: con y sin nombre comercial', () => {
  const station = { name: 'Total Access', address: '16 Rue Chateaubriand', city: 'Bréhan' };
  assert.equal(stationHeading(station), 'Total Access – Station-service 16 Rue Chateaubriand à Bréhan');
  assert.equal(stationHeading({ ...station, name: null }), 'Station-service 16 Rue Chateaubriand à Bréhan');
  assert.equal(stationHeading({ ...station, name: null, city: 'Le Mans' }), 'Station-service 16 Rue Chateaubriand au Mans');
});

test('stationCommercialTitle: nombre salvo que el logo ya diga lo mismo', () => {
  assert.equal(stationCommercialTitle({ name: null, brandSlug: null }), null);
  assert.equal(stationCommercialTitle({ name: 'Carrefour', brandSlug: 'carrefour' }), null);
  assert.equal(stationCommercialTitle({ name: 'CARREFOUR', brandSlug: 'carrefour' }), null);
  assert.equal(stationCommercialTitle({ name: 'Carrefour Market', brandSlug: 'carrefour' }), 'Carrefour Market');
  assert.equal(stationCommercialTitle({ name: 'Garage Denis', brandSlug: null }), 'Garage Denis');
  // Red sin logo: el nombre se mantiene como título.
  assert.equal(stationCommercialTitle({ name: 'Dyneff', brandSlug: 'dyneff' }), 'Dyneff');
});

test('brandBadgeSpec: logo, texto de la red, texto del nombre o nada', () => {
  assert.equal(brandBadgeSpec(null, 'carrefour'), null);
  assert.deepEqual(brandBadgeSpec('Carrefour Market', 'carrefour'), {
    kind: 'logo',
    src: assetPath('/logos/carrefour.webp'),
    alt: 'Carrefour',
  });
  assert.deepEqual(brandBadgeSpec('Dyneff Express', 'dyneff'), { kind: 'text', label: 'Dyneff' });
  assert.deepEqual(brandBadgeSpec('Garage Denis', null), { kind: 'text', label: 'Garage Denis' });
});

test('la ficha usa stationHeading y enlaza la página de la red', () => {
  const page = fs.readFileSync(PAGE_PATH, 'utf8');
  const hero = fs.readFileSync(path.join(SOURCE_DIR, 'components', 'StationHero.tsx'), 'utf8');
  assert.ok(page.includes('stationHeading(station)'));
  assert.ok(hero.includes('{stationHeading(station)}'));
  assert.ok(hero.includes('/marque/${brand.slug}'));
  assert.ok(hero.includes('Toutes les stations {brand.name}'));
  assert.ok(hero.includes('<StationBrandBadge'));
});

test('la ficha declara rutas estáticas cerradas y responde notFound a un slug desconocido', () => {
  const page = fs.readFileSync(PAGE_PATH, 'utf8');
  assert.match(page, /export const dynamicParams = false;/);
  assert.match(page, /notFound\(\)/);
  assert.doesNotMatch(page, /revalidate/);
});
