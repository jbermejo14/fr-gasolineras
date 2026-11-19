import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseStationPathSlug, stationPath } from '../src/lib/prixCarburants.ts';

const SOURCE_DIR = path.join(import.meta.dirname, '..', 'src');
const PAGE_PATH = path.join(SOURCE_DIR, 'app', 'station', '[slug]', 'page.tsx');
const PRICES_PATH = path.join(SOURCE_DIR, 'components', 'StationPrices.tsx');
const HISTORY_MARKER = '{/* Historique: lo inserta F6 */}';

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

test('la ficha pasa los importes por formatEuros, usa SITE_NAME en openGraph y deja el hueco del histórico', () => {
  const page = fs.readFileSync(PAGE_PATH, 'utf8');
  assert.match(fs.readFileSync(PRICES_PATH, 'utf8'), /formatEuros\(price \* TANK_LITERS\)/);
  assert.match(page, /siteName: SITE_NAME/);
  assert.ok(page.includes(HISTORY_MARKER), 'falta el comentario donde F6 inserta el histórico');
});

test('la ficha declara rutas estáticas cerradas y responde notFound a un slug desconocido', () => {
  const page = fs.readFileSync(PAGE_PATH, 'utf8');
  assert.match(page, /export const dynamicParams = false;/);
  assert.match(page, /notFound\(\)/);
  assert.doesNotMatch(page, /revalidate/);
});
