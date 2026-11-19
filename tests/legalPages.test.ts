import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { HOLDER_FIELD_LABELS, legalHolderValue, legalReviewDate } from '../src/lib/legalText.ts';
import { FECHA_TEXTOS_LEGALES } from '../src/lib/legal.ts';
import type { Titular } from '../src/lib/legal.ts';

const SOURCE_DIR = path.join(import.meta.dirname, '..', 'src');
const LEGAL_ROUTES = [
  { dir: 'mentions-legales', route: '/mentions-legales', title: 'Mentions légales' },
  { dir: 'confidentialite', route: '/confidentialite', title: 'Politique de confidentialité' },
  { dir: 'cookies', route: '/cookies', title: 'Politique relative aux cookies' }
];

function readSource(...segments: string[]): string {
  return fs.readFileSync(path.join(SOURCE_DIR, ...segments), 'utf8');
}

for (const { dir, route, title } of LEGAL_ROUTES) {
  const source = readSource('app', dir, 'page.tsx');

  test(`${route}: exporta metadata con título, canonical e indexación`, () => {
    assert.match(source, /export const metadata: Metadata = \{/);
    assert.ok(source.includes(`title: '${title}'`), `falta el título « ${title} »`);
    assert.ok(source.includes(`const PATH = '${route}';`));
    assert.match(source, /description: /);
    assert.match(source, /alternates: \{ canonical: absoluteUrl\(PATH\) \}/);
    assert.match(source, /robots: \{ index: false, follow: true \}/);
  });

  test(`${route}: usa LegalPage y no incluye AdSlot`, () => {
    assert.match(source, /<LegalPage\b/);
    assert.doesNotMatch(source, /AdSlot/);
  });
}

const EMPTY_HOLDER: Titular = { tipo: 'persona-fisica', nombre: '', nif: '', domicilio: '', email: '', registroMercantil: '' };

test('el marcador de campos vacíos está en francés y sin SIREN', () => {
  assert.equal(legalHolderValue(EMPTY_HOLDER, 'email'), '[à compléter : e-mail]');
  assert.equal(legalHolderValue(EMPTY_HOLDER, 'nif'), "[à compléter : numéro d'identification fiscale (NIF)]");
  assert.equal(legalHolderValue({ ...EMPTY_HOLDER, nombre: 'Jean' }, 'nombre'), 'Jean');
  for (const label of Object.values(HOLDER_FIELD_LABELS)) assert.doesNotMatch(label, /SIREN|SIRET/);
  for (const page of ['mentions-legales', 'confidentialite']) {
    assert.doesNotMatch(readSource('app', page, 'page.tsx'), /valorOPendiente|SIREN|SIRET/);
  }
});

const ODBL_URL = 'opendatacommons.org/licenses/odbl/1-0/';

test('atribución ODbL en las mentions légales y en el pie', () => {
  const mentions = readSource('app', 'mentions-legales', 'page.tsx').replace(/\s+/g, ' ');
  assert.ok(mentions.includes('Noms et enseignes des stations : Chiffrex ( <a href={URL_CHIFFREX} target="_blank" rel="noopener noreferrer">chiffrex.fr</a> ), d&apos;après OpenStreetMap – © les contributeurs d&apos;OpenStreetMap,'));
  assert.ok(mentions.includes('>ODbL</a>'));
  assert.ok(mentions.includes(ODBL_URL));
  assert.match(mentions, /<code>stations\.json<\/code> publié par le site.*ODbL/);
  assert.ok(mentions.includes('Les noms et logos des enseignes appartiennent à leurs titulaires et ne servent qu&apos;à identifier les stations.'));
  const footer = readSource('components', 'Footer.tsx');
  assert.ok(footer.includes('Noms et enseignes des stations :'));
  assert.ok(footer.includes("d&apos;après OpenStreetMap – © les contributeurs d&apos;OpenStreetMap,"));
  assert.ok(footer.includes(ODBL_URL));
  assert.ok(footer.includes('data.gouv.fr/datasets/referentiel-des-noms-et-enseignes'));
});

test('la fecha de revisión sale en francés', () => {
  assert.equal(FECHA_TEXTOS_LEGALES, '2026-11-17');
  assert.equal(legalReviewDate(), '17 novembre 2026');
});

test('contenido jurídico exigido por el contrato', () => {
  const mentions = readSource('app', 'mentions-legales', 'page.tsx');
  assert.match(mentions, /Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis/);
  assert.match(mentions, /Licence Ouverte Etalab 2.0/);
  assert.match(mentions, /Directeur de la publication/);
  assert.match(mentions, /droit espagnol/);
  const privacy = readSource('app', 'confidentialite', 'page.tsx');
  assert.match(privacy, /AEPD/);
  assert.match(privacy, /CNIL/);
  assert.match(privacy, /Transferts hors de l&apos;Union européenne/);
  const cookies = readSource('app', 'cookies', 'page.tsx');
  assert.ok(cookies.includes("cadre de transparence et de consentement de l&apos;IAB (TCF)"));
  assert.doesNotMatch(cookies, /TCF v/);
  assert.match(cookies, /Gérer les cookies/);
});
