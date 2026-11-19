import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_DIR = path.join(import.meta.dirname, '..', 'src');
// <Link ... href="/station/..., href={`/station/... o href={`/departement/${p}/${m}`}
const HTML_ONLY_LINK = /<Link\b[^>]*?href=(?:\{\s*)?["'`]\/(?:station\/|departement\/(?:\$\{[^}]*\}|[^/"'`$]+)\/(?:\$\{[^}]*\}|[^/"'`$]+))/;
// <a href="/... literal: se saltaría la ruta base
const RAW_INTERNAL_ANCHOR = /<a\s[^>]*?href=(?:\{\s*)?["'`]\/(?!\/)/;

function linksTsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return linksTsxFiles(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

test('ningún .tsx de src usa <Link> hacia /station/... ni /departement/<d>/<c>', () => {
  for (const file of linksTsxFiles(SOURCE_DIR)) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), HTML_ONLY_LINK, `${file} enlaza con <Link> a una página solo HTML: usa InternalLink`);
  }
});

test('ningún .tsx de src tiene <a href="/..."> interno sin assetPath', () => {
  for (const file of linksTsxFiles(SOURCE_DIR)) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), RAW_INTERNAL_ANCHOR, `${file} tiene un <a href="/..."> sin assetPath`);
  }
});

test('el detector de enlaces reconoce los casos prohibidos', () => {
  assert.match('<Link href={`/station/${s.id}`} className="x">', HTML_ONLY_LINK);
  assert.match('<Link\n  href={`/departement/${p}/${m}`}\n>', HTML_ONLY_LINK);
  assert.doesNotMatch('<Link href={`/departement/${p}`}>', HTML_ONLY_LINK);
  assert.doesNotMatch('<Link href="/historique">', HTML_ONLY_LINK);
});
