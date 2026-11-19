import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  STATION_NAMES_FILE,
  STATION_NAMES_SOURCE_URL,
  loadStationNames,
  parseStationNamesCsv,
} from '../src/lib/stationNames.ts';

const SAMPLE_FILE = path.join(import.meta.dirname, 'fixtures', 'enseignes-sample.csv');
const HEADER = 'id_station_officiel,nom_normalise,adresse,ville';
const SAMPLE_ROWS_WITH_NAME = 31;

function readSample(): Map<string, string> {
  return parseStationNamesCsv(fs.readFileSync(SAMPLE_FILE, 'utf8'));
}

test('las constantes apuntan a data.gouv.fr y a data/cache/enseignes.csv', () => {
  assert.match(STATION_NAMES_SOURCE_URL, /^https:\/\/www\.data\.gouv\.fr\/api\/1\/datasets\/r\//);
  assert.ok(STATION_NAMES_FILE.endsWith(path.join('data', 'cache', 'enseignes.csv')));
});

test('la muestra real se lee: ids sin cero inicial, nombres entre comillas y limpieza de punto y coma', () => {
  const names = readSample();
  assert.equal(names.get('56580001'), 'U');
  assert.equal(names.get('33114001'), 'Super U');
  assert.equal(names.get('76600022'), 'Total Access');
  assert.equal(names.get('37330001'), 'Super U');
  assert.equal(names.get('74300009'), 'Système U');
  assert.equal(names.get('1340003'), 'Intermarché');
  assert.equal(names.get('83150003'), 'Port de Bandol');
});

test('Indépendante no genera nombre', () => {
  const names = readSample();
  assert.equal(names.has('4100009'), false);
  assert.equal(names.size, SAMPLE_ROWS_WITH_NAME);
});

test('comas y comillas escapadas dentro de un campo entre comillas', () => {
  const names = parseStationNamesCsv(`${HEADER}\n1,"Chez ""Léon"", frères","Rue A, B",X\n`);
  assert.equal(names.get('1'), 'Chez "Léon", frères');
});

test('acepta CRLF, BOM, sin salto final y recorta espacios', () => {
  const names = parseStationNamesCsv(`﻿${HEADER}\r\n1,  Esso ,a,b\r\n2,Avia,a,b`);
  assert.deepEqual([...names], [['1', 'Esso'], ['2', 'Avia']]);
});

test('ignora filas sin id, sin nombre o vacías', () => {
  const names = parseStationNamesCsv(`${HEADER}\n,Esso,a,b\n3,,a,b\n4,;Esso,a,b\n\n5,Elan,a,b\n`);
  assert.deepEqual([...names], [['5', 'Elan']]);
});

test('una cabecera incorrecta o un texto vacío lanzan Error', () => {
  assert.throws(() => parseStationNamesCsv('id,nombre\n1,Esso\n'), /cabecera/);
  assert.throws(() => parseStationNamesCsv(''), /cabecera/);
});

test('loadStationNames lee un fichero y, si falta, devuelve un Map vacío avisando', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prix-names-'));
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message: string) => warnings.push(message);
  try {
    const file = path.join(dir, 'enseignes.csv');
    fs.writeFileSync(file, `${HEADER}\n1,Esso,a,b\n`);
    assert.equal(loadStationNames(file).get('1'), 'Esso');
    assert.equal(warnings.length, 0);
    assert.equal(loadStationNames(path.join(dir, 'ausente.csv')).size, 0);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /sin marcas/);
  } finally {
    console.warn = originalWarn;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
