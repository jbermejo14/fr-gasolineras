import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { processRawPrixData } from '../src/lib/prixCarburants.ts';
import type { Station } from '../src/lib/prixCarburants.ts';
import { buildStationsPayload, toLightStation } from '../src/lib/stationPayload.ts';

const SAMPLE_FILE = path.join(import.meta.dirname, 'fixtures', 'prix-sample.json');
const EXPECTED_KEYS = [
  'id', 'slug', 'address', 'name', 'brandSlug', 'postalCode', 'city', 'communeSlug', 'department',
  'departmentSlug', 'roadType', 'lat', 'lon', 'prices',
].sort();

const snapshot = processRawPrixData(JSON.parse(fs.readFileSync(SAMPLE_FILE, 'utf8')));

test('toLightStation devuelve exactamente las 14 claves', () => {
  const result = toLightStation(snapshot.stations[0]);
  assert.deepEqual(Object.keys(result).sort(), EXPECTED_KEYS);
});

test('toLightStation copia cada valor de su campo', () => {
  const full = snapshot.stations[0];
  const result = toLightStation(full);
  for (const key of EXPECTED_KEYS) {
    assert.deepEqual(result[key as keyof typeof result], full[key as keyof Station], key);
  }
});

test('toLightStation copia name y brandSlug de una estación con nombre', () => {
  const named = { ...snapshot.stations[0], name: 'Total Access', brandSlug: 'totalenergies' };
  const result = toLightStation(named);
  assert.equal(result.name, 'Total Access');
  assert.equal(result.brandSlug, 'totalenergies');
});

test('toLightStation no filtra campos pesados como horarios o servicios', () => {
  const result = toLightStation(snapshot.stations[0]) as Record<string, unknown>;
  assert.equal('openingHours' in result, false);
  assert.equal('services' in result, false);
  assert.equal('priceUpdatedAt' in result, false);
});

test('buildStationsPayload conserva fecha, número y orden', () => {
  const stations = snapshot.stations.slice(0, 3).reverse();
  const result = buildStationsPayload({ updatedAt: '2026-11-19T09:59:54+00:00', stations });
  assert.equal(result.updatedAt, '2026-11-19T09:59:54+00:00');
  assert.deepEqual(result.stations.map((s) => s.id), stations.map((s) => s.id));
});

test('buildStationsPayload sobre la instantánea completa mantiene todas las estaciones', () => {
  assert.equal(buildStationsPayload(snapshot).stations.length, snapshot.stations.length);
});
