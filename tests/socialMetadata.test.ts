import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildHistoriqueSeoMetadata } from '../src/lib/pageTitles.ts';
import { getHistoryIndex } from '../src/lib/historique.ts';
import { OG_IMAGE_ALT, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, buildSocialMetadata } from '../src/lib/socialMetadata.ts';

const ROOT = path.join(import.meta.dirname, '..');
const SITE_ORIGIN = 'https://ododex.com';
const EXPECTED_IMAGE = `${SITE_ORIGIN}/fr/prix-carburants/brand/ododex-og.png`;
const SAMPLE_PATHS = [
  '/',
  '/departement/gers',
  '/departement/gers/auch',
  '/station/exemple',
  '/marque/totalenergies',
  '/marque',
  '/historique',
  '/mentions-legales',
  '/confidentialite',
  '/cookies',
];
/** Páginas cuyo generateMetadata o metadata debe pasar por buildSocialMetadata. */
const PAGES_USING_HELPER = [
  'layout.tsx',
  'marque/page.tsx',
  'marque/[marque]/page.tsx',
  'departement/[departement]/page.tsx',
  'departement/[departement]/[commune]/page.tsx',
  'station/[slug]/page.tsx',
  'mentions-legales/page.tsx',
  'confidentialite/page.tsx',
  'cookies/page.tsx',
];

function withSiteOrigin(run: () => void): void {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = SITE_ORIGIN;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
}

function assertSocialMetadata(
  metadata: { openGraph?: unknown; twitter?: unknown },
  expected: { title: string; description: string; url: string },
): void {
  const openGraph = metadata.openGraph as { images: unknown; title: unknown; description: unknown; url: unknown };
  const twitter = metadata.twitter as { card: unknown; title: unknown; description: unknown; images: unknown };
  assert.deepEqual(openGraph.images, [{ url: EXPECTED_IMAGE, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: OG_IMAGE_ALT }]);
  assert.equal(openGraph.title, expected.title);
  assert.equal(openGraph.description, expected.description);
  assert.equal(openGraph.url, expected.url);
  assert.equal(twitter.card, 'summary_large_image');
  assert.equal(twitter.title, expected.title);
  assert.equal(twitter.description, expected.description);
  assert.deepEqual(twitter.images, [EXPECTED_IMAGE]);
}

test('la imagen Open Graph existe en public/brand', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'public', 'brand', 'ododex-og.png')));
});

test('la imagen Open Graph mide 1200x630 y el alt está en francés', () => {
  assert.equal(OG_IMAGE_WIDTH, 1200);
  assert.equal(OG_IMAGE_HEIGHT, 630);
  assert.match(OG_IMAGE_ALT, /^Prix des carburants/);
});

for (const pagePath of SAMPLE_PATHS) {
  test(`buildSocialMetadata ${pagePath}: imagen absoluta con ruta base y summary_large_image`, () => {
    withSiteOrigin(() => {
      const url = `${SITE_ORIGIN}/fr/prix-carburants${pagePath === '/' ? '' : pagePath}`;
      const metadata = buildSocialMetadata({ title: 'Titre', description: 'Description', path: pagePath });
      assertSocialMetadata(metadata, { title: 'Titre', description: 'Description', url });
    });
  });
}

test('buildSocialMetadata respeta el siteName indicado', () => {
  const metadata = buildSocialMetadata({ title: 'T', description: 'D', path: '/', siteName: 'Autre' });
  assert.equal((metadata.openGraph as { siteName: string }).siteName, 'Autre');
});

test('historique (Francia): la metadata del histórico incluye imagen y twitter', { skip: getHistoryIndex() === null }, () => {
  withSiteOrigin(() => {
    const metadata = buildHistoriqueSeoMetadata('france', 'france');
    assertSocialMetadata(metadata, {
      title: metadata.title as string,
      description: metadata.description as string,
      url: `${SITE_ORIGIN}/fr/prix-carburants/historique`,
    });
  });
});

for (const page of PAGES_USING_HELPER) {
  test(`${page}: usa buildSocialMetadata y no define openGraph a mano`, () => {
    const source = fs.readFileSync(path.join(ROOT, 'src', 'app', page), 'utf8');
    assert.match(source, /\.\.\.buildSocialMetadata\(/);
    assert.doesNotMatch(source, /openGraph:/);
  });
}
