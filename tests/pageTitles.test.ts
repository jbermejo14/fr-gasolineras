import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  TITLE_SUFFIX,
  buildBrandDescription,
  buildBrandTitle,
  buildCommuneDescription,
  buildCommuneTitle,
  buildDepartmentDescription,
  buildDepartmentTitle,
  buildHistoriqueSeoMetadata,
  buildHistoriqueSeoTitle,
  buildHomeDescription,
  buildHomeTitle,
  buildStationDescription,
  buildStationTitle,
  titleTrimToWords,
} from '../src/lib/pageTitles.ts';
import { PRIX_SNAPSHOT_FILE, loadPrixSnapshot } from '../src/lib/prixSnapshot.ts';
import { summarizeStations } from '../src/lib/prixCarburants.ts';
import type { PrixSnapshot } from '../src/lib/prixCarburants.ts';
import { findBrandGroupBySlug } from '../src/lib/brands.ts';
import { getAreasByKind, getHistoryIndex } from '../src/lib/historique.ts';
import type { AreaKind } from '../src/lib/historiqueFormat.ts';

const SOURCE_DIR = path.join(import.meta.dirname, '..', 'src', 'app');
const LEGAL_ROUTES = ['/mentions-legales', '/confidentialite', '/cookies'];
const HISTORY_KINDS: AreaKind[] = ['france', 'region', 'departement', 'marque'];
/** Proporción tolerada de títulos de ficha repetidos: estaciones con misma red, dirección y ciudad en los datos oficiales. */
const STATION_DUPLICATE_TITLE_RATIO = 0.005;
const HAS_SNAPSHOT = fs.existsSync(PRIX_SNAPSHOT_FILE);
const SKIP_SNAPSHOT = HAS_SNAPSHOT ? false : 'falta data/cache/prix-snapshot.json (npm run preparar-datos)';
const SKIP_HISTORY = getHistoryIndex() ? false : 'falta data/historique/indice.json (npm run historique)';

function full(title: string): string {
  return `${title}${TITLE_SUFFIX}`;
}

describe('pageTitles: casos extremos', () => {
  it('ficha sin nombre con la dirección larga de producción', () => {
    const title = buildStationTitle({
      name: null,
      address: '140 Rue Guillaume Fichet',
      city: 'Glières-Val-de-Borne',
    });
    assert.ok(full(title).length <= TITLE_MAX_LENGTH, title);
    assert.match(title, /^Station/);
    assert.match(title, /Glières-Val-de-Borne$/);
  });

  it('ficha con nombre: calle y ciudad', () => {
    assert.equal(
      buildStationTitle({ name: 'TotalEnergies', address: '1 Rue X', city: 'Saint-Martin-de-Ré' }),
      'TotalEnergies 1 Rue X, Saint-Martin-de-Ré',
    );
  });

  it('ficha con nombre y ciudad muy largos: recorta el nombre sin cortar palabras', () => {
    const title = buildStationTitle({
      name: 'Intermarché Contact Super Hypermarché Carburant',
      address: '1 Rue X',
      city: 'Glières-Val-de-Borne',
    });
    assert.ok(full(title).length <= TITLE_MAX_LENGTH, title);
    assert.ok(title.endsWith('Glières-Val-de-Borne'), title);
    assert.ok(!title.includes('…'));
  });

  it('ficha sin nombre y dirección enorme: recorta la dirección y conserva la ciudad', () => {
    const title = buildStationTitle({
      name: null,
      address: 'Zone Artisanale Les Grands Chênes Route Départementale 123 Lieu-dit Le Haut du Bois',
      city: 'Saint-Martin-de-Ré',
    });
    assert.ok(full(title).length <= TITLE_MAX_LENGTH, title);
    assert.ok(title.endsWith(', Saint-Martin-de-Ré'), title);
    assert.ok(!/\s(de|du|la|le|les|des)(,|$)/.test(title.split(',')[0]), title);
  });

  it('no repite la ciudad si el nombre ya la contiene', () => {
    const title = buildStationTitle({ name: 'Leclerc Le Mans', address: 'x', city: 'Le Mans' });
    assert.equal(title.match(/Le Mans/g)?.length, 1);
  });

  it('municipio: gramática de lugares (au Mans, à Saint-Martin-de-Ré)', () => {
    assert.equal(buildCommuneTitle({ city: 'Le Mans', departmentCode: '72' }), 'Prix carburants au Mans (72) : stations les moins chères');
    assert.equal(
      buildCommuneTitle({ city: 'Saint-Martin-de-Ré', departmentCode: '17' }),
      'Stations les moins chères à Saint-Martin-de-Ré (17)',
    );
  });

  it('departamento: preposición y precio; se acorta en nombres largos', () => {
    assert.equal(
      buildDepartmentTitle({ name: 'Gers', code: '32', averageGazole: 2.158 }),
      'Prix des carburants du Gers (32) : gazole 2,158 €',
    );
    const corse = buildDepartmentTitle({ name: 'Haute-Corse', code: '2B', averageGazole: 2.158 });
    assert.ok(corse.includes('Haute-Corse (2B)'));
    const long = buildDepartmentTitle({ name: 'Alpes-de-Haute-Provence', code: '04', averageGazole: 2.158 });
    assert.ok(full(long).length <= TITLE_MAX_LENGTH, long);
    assert.ok(long.includes('Alpes-de-Haute-Provence (04)'));
  });

  it('departamento sin precio de gazole', () => {
    assert.equal(buildDepartmentTitle({ name: 'Gers', code: '32', averageGazole: null }), 'Prix des carburants du Gers (32)');
  });

  it('marca: TotalEnergies con gazole medio', () => {
    assert.equal(
      buildBrandTitle({ name: 'TotalEnergies', averageGazole: 1.859 }),
      'Prix des carburants chez TotalEnergies : gazole 1,859 €',
    );
  });

  it('histórico: Provence-Alpes-Côte d’Azur cabe y mantiene el sentido', () => {
    const title = buildHistoriqueSeoTitle('region', "Provence-Alpes-Côte d'Azur", 2016);
    assert.ok(full(title).length <= TITLE_MAX_LENGTH, title);
    assert.ok(title.includes("Provence-Alpes-Côte d'Azur"), title);
    assert.equal(buildHistoriqueSeoTitle('france', 'France', 2016), 'Prix des carburants en France depuis 2016');
    assert.equal(buildHistoriqueSeoTitle('marque', 'TotalEnergies', 2016), 'Prix des carburants chez TotalEnergies depuis 2016');
  });

  it('portada: título completo y descripción con cifras', () => {
    assert.equal(buildHomeTitle(), "Prix des carburants aujourd'hui en France | Ododex");
    const description = buildHomeDescription({ stationCount: 9800, averageGazole: 1.859 });
    assert.ok(description.length >= DESCRIPTION_MIN_LENGTH && description.length <= DESCRIPTION_MAX_LENGTH, description);
    assert.match(description, /\d/);
  });

  it('titleTrimToWords no deja conectores ni puntuación colgando', () => {
    assert.equal(titleTrimToWords('Zone Artisanale de la Gare', 20), 'Zone Artisanale');
    assert.equal(titleTrimToWords('corto', 20), 'corto');
  });

  it('descripción de ficha con dirección larguísima respeta el máximo', () => {
    const description = buildStationDescription({
      address: 'A'.repeat(200),
      postalCode: '17410',
      city: 'Saint-Martin-de-Ré',
      prices: { gazole: 1.8, e10: 1.9, sp95: null, sp98: 2, e85: null, gplc: null },
      is24h: true,
    });
    assert.ok(description.length <= DESCRIPTION_MAX_LENGTH, description);
  });
});

describe('sitemap', () => {
  const sitemapSource = fs.readFileSync(path.join(SOURCE_DIR, 'sitemap.ts'), 'utf8');

  for (const route of LEGAL_ROUTES) {
    it(`${route} no está en el sitemap y su página es noindex`, () => {
      assert.ok(!sitemapSource.includes(route), `sitemap.ts todavía menciona ${route}`);
      const page = fs.readFileSync(path.join(SOURCE_DIR, route, 'page.tsx'), 'utf8');
      assert.match(page, /index: false/);
    });
  }
});

function assertTitle(label: string, title: string): void {
  const length = full(title).length;
  assert.ok(length <= TITLE_MAX_LENGTH, `${label}: ${length} caracteres: ${title}`);
  assert.ok(title.trim().length > 0 && !title.includes('…'), `${label}: título degenerado: ${title}`);
}

function assertDescription(label: string, description: string): void {
  const { length } = description;
  assert.ok(
    length >= DESCRIPTION_MIN_LENGTH && length <= DESCRIPTION_MAX_LENGTH,
    `${label}: ${length} caracteres: ${description}`,
  );
}

function checkSnapshot(data: PrixSnapshot): void {
  for (const station of data.stations) {
    assertTitle(`estación ${station.id}`, buildStationTitle(station));
    assertDescription(`descripción estación ${station.id}`, buildStationDescription(station));
  }
  for (const commune of data.communes.values()) {
    const code = data.departments.get(commune.departmentSlug)?.code ?? '';
    assertTitle(`municipio ${commune.communeSlug}`, buildCommuneTitle({ city: commune.city, departmentCode: code }));
    const summary = summarizeStations(commune.stations);
    assertDescription(
      `descripción municipio ${commune.communeSlug}`,
      buildCommuneDescription({
        city: commune.city,
        department: commune.department,
        stationCount: commune.stations.length,
        minGazole: summary.min.gazole,
        minE10: summary.min.e10,
      }),
    );
  }
  for (const department of data.departments.values()) {
    const summary = summarizeStations(department.stations);
    const name = department.department;
    assertTitle(`departamento ${name}`, buildDepartmentTitle({ name, code: department.code, averageGazole: summary.avg.gazole }));
    assertDescription(
      `descripción departamento ${name}`,
      buildDepartmentDescription({
        name,
        code: department.code,
        stationCount: department.stations.length,
        minGazole: summary.min.gazole,
        minE10: summary.min.e10,
      }),
    );
  }
  for (const [slug, stations] of data.brands) {
    const name = findBrandGroupBySlug(slug)?.name ?? slug;
    const summary = summarizeStations(stations);
    assertTitle(`marca ${slug}`, buildBrandTitle({ name, averageGazole: summary.avg.gazole }));
    assertDescription(
      `descripción marca ${slug}`,
      buildBrandDescription({ name, stationCount: stations.length, minGazole: summary.min.gazole, minE10: summary.min.e10 }),
    );
  }
}

describe('pageTitles: todos los datos reales', () => {
  it('estaciones, municipios, departamentos y marcas: título ≤ 65 y descripción 120-160', { skip: SKIP_SNAPSHOT }, () => {
    const data = loadPrixSnapshot();
    checkSnapshot(data);
  });

  it('fichas: los títulos repetidos son una fracción mínima', { skip: SKIP_SNAPSHOT }, () => {
    const data = loadPrixSnapshot();
    const counts = new Map<string, number>();
    for (const station of data.stations) {
      const title = buildStationTitle(station);
      counts.set(title, (counts.get(title) ?? 0) + 1);
    }
    const duplicated = Array.from(counts.values()).filter((count) => count > 1).length;
    assert.ok(duplicated <= data.stations.length * STATION_DUPLICATE_TITLE_RATIO, `${duplicated} títulos de ficha repetidos`);
  });

  it('portada con los datos reales', { skip: SKIP_SNAPSHOT }, () => {
    const data = loadPrixSnapshot();
    assertDescription(
      'portada',
      buildHomeDescription({ stationCount: data.stations.length, averageGazole: data.nationalStats.gazole.avg }),
    );
  });

  it('histórico de todas las zonas: título ≤ 65 y descripción 120-160', { skip: SKIP_HISTORY }, () => {
    for (const kind of HISTORY_KINDS) {
      const areas = kind === 'france' ? [{ slug: 'france' }] : getAreasByKind(kind);
      for (const area of areas) {
        const metadata = buildHistoriqueSeoMetadata(kind, area.slug);
        assertTitle(`histórico ${kind}/${area.slug}`, String(metadata.title));
        assertDescription(`descripción histórico ${kind}/${area.slug}`, String(metadata.description));
      }
    }
  });
});
