import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AreaHistory, FuelSeries } from '../src/lib/historiqueFormat.ts';
import {
  buildHistoriqueDescription,
  buildHistoriquePath,
  buildHistoriqueTitle,
} from '../src/lib/historiquePageMeta.ts';

const NBSP = ' ';
const WEEKS = ['2016-01-04', '2016-01-11', '2026-11-16'];

function area(gazole: FuelSeries): AreaHistory {
  const empty = { avg: [null, null, null], min: [null, null, null], count: [0, 0, 0] };
  const gazoleSeries = { avg: gazole, min: gazole, count: [1, 1, 1] };
  return { kind: 'region', slug: 'bretagne', name: 'Bretagne', series: { gazole: gazoleSeries, e10: empty, sp95: empty, sp98: empty } };
}

describe('historiquePageMeta', () => {
  it('rutas: Francia en /historique, el resto por tipo y slug', () => {
    assert.equal(buildHistoriquePath('france', 'france'), '/historique');
    assert.equal(buildHistoriquePath('region', 'bretagne'), '/historique/region/bretagne');
    assert.equal(buildHistoriquePath('departement', 'morbihan'), '/historique/departement/morbihan');
    assert.equal(buildHistoriquePath('marque', 'totalenergies'), '/historique/marque/totalenergies');
  });

  it('títulos por tipo de zona', () => {
    assert.equal(
      buildHistoriqueTitle('france', 'France', WEEKS),
      "Prix historique du gazole et de l'essence en France (2016-2026)",
    );
    assert.equal(buildHistoriqueTitle('region', 'Bretagne', WEEKS), 'Évolution du prix des carburants en Bretagne depuis 2016');
    assert.equal(
      buildHistoriqueTitle('region', 'Grand Est', WEEKS),
      'Évolution du prix des carburants dans le Grand Est depuis 2016',
    );
    assert.equal(buildHistoriqueTitle('marque', 'TotalEnergies', WEEKS), 'Évolution du prix des carburants chez TotalEnergies depuis 2016');
    assert.equal(
      buildHistoriqueTitle('departement', 'Morbihan', WEEKS),
      'Prix historique des carburants dans le département du Morbihan depuis 2016',
    );
  });

  it('descripción con precio actual, máximo con fecha y fuente', () => {
    const description = buildHistoriqueDescription(area([2000, 1400, 1500]), WEEKS);
    assert.ok(description.startsWith('Prix du gazole et du SP95-E10 en Bretagne : Gazole à'));
    assert.ok(description.includes(`Gazole à 1,500${NBSP}€/l`));
    assert.ok(description.includes(`Maximum historique du gazole : 2,000${NBSP}€/l le 4 janvier 2016.`));
    assert.ok(description.length <= 160, `${description.length} caractères`);
  });

  it('descripción de una marca: « chez » y cifras de gazole', () => {
    const brand = { ...area([2000, 1400, 1500]), kind: 'marque' as const, slug: 'totalenergies', name: 'TotalEnergies' };
    const description = buildHistoriqueDescription(brand, WEEKS);
    assert.ok(description.startsWith('Prix du gazole et du SP95-E10 chez TotalEnergies : Gazole à'));
    assert.ok(description.length <= 160, `${description.length} caractères`);
  });

  it('descripción: nombra la zona y nunca pasa de 160 caracteres', () => {
    const named = { ...area([2000, 1400, 1500]), kind: 'departement' as const, name: 'Alpes-de-Haute-Provence' };
    const description = buildHistoriqueDescription(named, WEEKS);
    assert.ok(description.includes('dans le département des Alpes-de-Haute-Provence'));
    assert.ok(description.length <= 160, `${description.length} caractères`);
  });
});
