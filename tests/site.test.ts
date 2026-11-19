import { test } from 'node:test';
import assert from 'node:assert/strict';
import { absoluteUrl, assetPath, BASE_PATH, getSiteUrl, isHtmlOnlyRoute } from '../src/lib/site.ts';
import nextConfig from '../next.config.ts';

const SITE_ORIGIN = 'https://ododex.com';

function siteConOrigen(origen: string | undefined, prueba: () => void): void {
  const previo = process.env.NEXT_PUBLIC_SITE_URL;
  if (origen === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = origen;
  try {
    prueba();
  } finally {
    if (previo === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previo;
  }
}

test('BASE_PATH es /fr/prix-carburants', () => {
  assert.equal(BASE_PATH, '/fr/prix-carburants');
});

test('absoluteUrl: raíz vacía o con barra devuelve origen + ruta base sin barra final', () => {
  siteConOrigen(SITE_ORIGIN, () => {
    assert.equal(absoluteUrl('/'), `${SITE_ORIGIN}/fr/prix-carburants`);
    assert.equal(absoluteUrl(''), `${SITE_ORIGIN}/fr/prix-carburants`);
  });
});

test('absoluteUrl: ruta con y sin barra inicial', () => {
  siteConOrigen(SITE_ORIGIN, () => {
    assert.equal(absoluteUrl('/departement/morbihan'), `${SITE_ORIGIN}/fr/prix-carburants/departement/morbihan`);
    assert.equal(absoluteUrl('departement/morbihan'), `${SITE_ORIGIN}/fr/prix-carburants/departement/morbihan`);
  });
});

test('getSiteUrl: quita barras finales y usa localhost por defecto', () => {
  siteConOrigen(`${SITE_ORIGIN}/`, () => {
    assert.equal(getSiteUrl(), SITE_ORIGIN);
  });
  siteConOrigen(undefined, () => {
    assert.equal(getSiteUrl(), 'http://localhost:3000');
  });
});

test('assetPath antepone la ruta base', () => {
  assert.equal(assetPath('/datos/stations.json'), '/fr/prix-carburants/datos/stations.json');
  assert.equal(assetPath('datos/stations.json'), '/fr/prix-carburants/datos/stations.json');
});

test('isHtmlOnlyRoute: station y commune sí', () => {
  assert.equal(isHtmlOnlyRoute('/station/56580001-brehan-16-rue-chateaubriand'), true);
  assert.equal(isHtmlOnlyRoute('/departement/morbihan/brehan'), true);
});

test('isHtmlOnlyRoute: departamento, histórico, home y otras no', () => {
  assert.equal(isHtmlOnlyRoute('/departement/morbihan'), false);
  assert.equal(isHtmlOnlyRoute('/historique'), false);
  assert.equal(isHtmlOnlyRoute('/historique/departement/morbihan'), false);
  assert.equal(isHtmlOnlyRoute('/'), false);
  assert.equal(isHtmlOnlyRoute('/station'), false);
  assert.equal(isHtmlOnlyRoute('/station/'), false);
});

test('next.config.ts usa la misma ruta base que src/lib/site.ts', () => {
  assert.equal(nextConfig.basePath, BASE_PATH);
});

test('next.config.ts exporta el sitio como ficheros estáticos sin optimizador de imágenes', () => {
  assert.equal(nextConfig.output, 'export');
  assert.equal(nextConfig.images?.unoptimized, true);
});
