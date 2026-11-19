import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { formatDateTimeParis } from '../src/lib/format.ts';

const SOURCE_DIR = path.join(import.meta.dirname, '..', 'src');
// La web se regenera una vez al día: no puede prometer datos en tiempo real.
const REALTIME_PROMISE = /temps réel|en direct|30 minutes/i;

function textsSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return textsSourceFiles(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

test('ningún .ts/.tsx de src promete datos en tiempo real', () => {
  for (const file of textsSourceFiles(SOURCE_DIR)) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), REALTIME_PROMISE, `${file} promete tiempo real: los datos se actualizan una vez al día`);
  }
});

test('el detector reconoce las promesas prohibidas', () => {
  assert.match('Prix en Temps réel', REALTIME_PROMISE);
  assert.match('comparés en direct', REALTIME_PROMISE);
  assert.match('toutes les 30 minutes', REALTIME_PROMISE);
});

test('Header separa fecha y hora con el mismo texto que produce formatDateTimeParis', () => {
  const header = fs.readFileSync(path.join(SOURCE_DIR, 'components', 'Header.tsx'), 'utf8');
  const separator = /DATE_TIME_SEPARATOR = '([^']*)'/.exec(header)?.[1];
  assert.ok(separator, 'Header.tsx debe declarar DATE_TIME_SEPARATOR');
  const parts = formatDateTimeParis('2026-11-19T10:09:48+00:00').split(separator);
  assert.deepEqual(parts, ['19/11/2026', '11:09']);
});
