import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PRIX_SNAPSHOT_FILE, PRIX_SOURCE_URL, loadPrixSnapshot } from '../src/lib/prixSnapshot.ts';

const SAMPLE_FILE = path.join(import.meta.dirname, 'fixtures', 'prix-sample.json');
const SAMPLE_RECORDS: unknown = JSON.parse(fs.readFileSync(SAMPLE_FILE, 'utf8'));

function withTempSnapshot(content: string, run: (file: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prix-snapshot-'));
  try {
    const file = path.join(dir, 'prix-snapshot.json');
    fs.writeFileSync(file, content);
    run(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('las constantes apuntan al flujo oficial y a data/cache', () => {
  assert.match(PRIX_SOURCE_URL, /^https:\/\/data\.economie\.gouv\.fr\/.*flux-instantane-v2\/exports\/json$/);
  assert.ok(PRIX_SNAPSHOT_FILE.endsWith(path.join('data', 'cache', 'prix-snapshot.json')));
});

test('loadPrixSnapshot procesa la lista de registros del fichero', () => {
  const content = JSON.stringify({ downloadedAt: '2026-11-19T10:00:00.000Z', records: SAMPLE_RECORDS });
  withTempSnapshot(content, (file) => {
    const snapshot = loadPrixSnapshot(file, path.join(path.dirname(file), 'ausente.csv'));
    assert.equal(snapshot.updatedAt, '2026-11-19T09:59:54+00:00');
    assert.equal(snapshot.stationsById.size, snapshot.stations.length);
    assert.ok(snapshot.departments.has('morbihan'));
  });
});

test('loadPrixSnapshot falla si falta el fichero y avisa de npm run preparar-datos', () => {
  const missing = path.join(os.tmpdir(), 'prix-sin-instantanea', 'prix-snapshot.json');
  assert.throws(() => loadPrixSnapshot(missing), /No existe.*npm run preparar-datos/);
});

test('loadPrixSnapshot falla con un fichero corrupto y avisa de npm run preparar-datos', () => {
  withTempSnapshot('{ no es json', (file) => {
    assert.throws(() => loadPrixSnapshot(file), /no es JSON válido.*npm run preparar-datos/);
  });
});

test('loadPrixSnapshot falla si el fichero no tiene la lista records', () => {
  withTempSnapshot(JSON.stringify({ downloadedAt: '2026-11-19T10:00:00.000Z' }), (file) => {
    assert.throws(() => loadPrixSnapshot(file), /records.*npm run preparar-datos/);
  });
});

const NAMES_CSV = 'id_station_officiel,nom_normalise\n56580001,U\n40500002,Intermarché\n';

test('loadPrixSnapshot incorpora los nombres del fichero indicado', () => {
  const content = JSON.stringify({ downloadedAt: '2026-11-19T10:00:00.000Z', records: SAMPLE_RECORDS });
  withTempSnapshot(content, (file) => {
    const namesFile = path.join(path.dirname(file), 'enseignes.csv');
    fs.writeFileSync(namesFile, NAMES_CSV);
    const snapshot = loadPrixSnapshot(file, namesFile);
    assert.equal(snapshot.stationsById.get('56580001')?.brandSlug, 'systeme-u');
    assert.deepEqual([...snapshot.brands.keys()], ['intermarche', 'systeme-u']);
  });
});

test('loadPrixSnapshot sin fichero de nombres carga la instantánea sin marcas', () => {
  const content = JSON.stringify({ downloadedAt: '2026-11-19T10:00:00.000Z', records: SAMPLE_RECORDS });
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    withTempSnapshot(content, (file) => {
      const snapshot = loadPrixSnapshot(file, path.join(path.dirname(file), 'ausente.csv'));
      assert.equal(snapshot.brands.size, 0);
      assert.equal(snapshot.stationsById.get('56580001')?.name, null);
    });
  } finally {
    console.warn = originalWarn;
  }
});
