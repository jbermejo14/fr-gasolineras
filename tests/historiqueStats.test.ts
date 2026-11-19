import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AreaFuelSeries, AreaHistory, AreaKind, FuelSeries } from '../src/lib/historiqueFormat.ts';
import { formatIsoDateFr } from '../src/lib/format.ts';
import {
  HISTORY_HEADLINE_FUELS,
  buildAreaIntro,
  describeAreaPlace,
  formatMilliEuro,
  formatSignedPercent,
  summarizeSeries,
} from '../src/lib/historiqueStats.ts';

const WEEK_MILLIS = 7 * 86_400_000;
const FIRST_MONDAY = Date.UTC(2020, 0, 6);
const NBSP = ' ';

function weeksFrom(count: number): string[] {
  return Array.from({ length: count }, (_, i) => new Date(FIRST_MONDAY + i * WEEK_MILLIS).toISOString().slice(0, 10));
}

function fuelSeries(avg: FuelSeries): AreaFuelSeries {
  return { avg, min: avg, count: avg.map((v) => (v === null ? 0 : 1)) };
}

function makeArea(kind: AreaKind, name: string, gazole: FuelSeries, e10: FuelSeries): AreaHistory {
  const empty = fuelSeries(gazole.map(() => null));
  return {
    kind,
    slug: name.toLowerCase(),
    name,
    series: { gazole: fuelSeries(gazole), e10: fuelSeries(e10), sp95: empty, sp98: empty },
  };
}

describe('summarizeSeries', () => {
  it('serie vacía: todo null y sin medias', () => {
    assert.deepEqual(summarizeSeries([], []), {
      latest: null,
      yearAgo: null,
      changePct: null,
      max: null,
      min: null,
      yearlyAverages: [],
    });
  });

  it('ignora nulls al final y calcula último, máximo y mínimo', () => {
    const weeks = weeksFrom(4);
    const summary = summarizeSeries(weeks, [1500, 1600, 1400, null]);
    assert.deepEqual(summary.latest, { date: weeks[2], value: 1400 });
    assert.deepEqual(summary.max, { date: weeks[1], value: 1600 });
    assert.deepEqual(summary.min, { date: weeks[2], value: 1400 });
  });

  it('empates: gana la primera fecha', () => {
    const weeks = weeksFrom(4);
    const summary = summarizeSeries(weeks, [1500, 1700, 1700, 1500]);
    assert.equal(summary.max?.date, weeks[1]);
    assert.equal(summary.min?.date, weeks[0]);
  });

  it('yearAgo y changePct con un decimal', () => {
    const weeks = weeksFrom(60);
    const values: FuelSeries = weeks.map(() => null);
    values[59] = 1500;
    values[7] = 1400;
    const summary = summarizeSeries(weeks, values);
    assert.deepEqual(summary.yearAgo, { date: weeks[7], value: 1400 });
    assert.equal(summary.changePct, 7.1);
  });

  it('yearAgo elige el valor más cercano a 52 semanas dentro de ±2', () => {
    const weeks = weeksFrom(60);
    const values: FuelSeries = weeks.map(() => null);
    values[59] = 1000;
    values[5] = 900;
    values[8] = 950;
    assert.equal(summarizeSeries(weeks, values).yearAgo?.date, weeks[8]);
  });

  it('yearAgo con empate de distancia: gana el más antiguo', () => {
    const weeks = weeksFrom(60);
    const values: FuelSeries = weeks.map(() => null);
    values[59] = 1000;
    values[5] = 900;
    values[9] = 950;
    assert.equal(summarizeSeries(weeks, values).yearAgo?.date, weeks[5]);
  });

  it('changePct redondea simétrico: -6,25 → -6,3 y 6,25 → 6,3', () => {
    const weeks = weeksFrom(60);
    const down: FuelSeries = weeks.map(() => null);
    down[59] = 1500;
    down[7] = 1600;
    assert.equal(summarizeSeries(weeks, down).changePct, -6.3);
    const up: FuelSeries = weeks.map(() => null);
    up[59] = 1700;
    up[7] = 1600;
    assert.equal(summarizeSeries(weeks, up).changePct, 6.3);
  });

  it('yearAgo ausente si no hay valor entre 50 y 54 semanas', () => {
    const weeks = weeksFrom(60);
    const values: FuelSeries = weeks.map(() => null);
    values[59] = 1000;
    values[0] = 900;
    values[20] = 950;
    const summary = summarizeSeries(weeks, values);
    assert.equal(summary.yearAgo, null);
    assert.equal(summary.changePct, null);
  });

  it('medias anuales de los valores no nulos', () => {
    const weeks = ['2020-12-21', '2020-12-28', '2021-01-04', '2021-01-11'];
    const summary = summarizeSeries(weeks, [1000, null, 1100, 1201]);
    assert.deepEqual(summary.yearlyAverages, [
      { year: 2020, avg: 1000, weeks: 1 },
      { year: 2021, avg: 1151, weeks: 2 },
    ]);
  });
});

describe('formatos franceses', () => {
  it('formatMilliEuro', () => {
    assert.equal(formatMilliEuro(1459), `1,459${NBSP}€/l`);
    assert.equal(formatMilliEuro(990), `0,990${NBSP}€/l`);
  });

  it('formatSignedPercent añade + a los positivos y conserva el - de los negativos', () => {
    assert.equal(formatSignedPercent(3.24), `+3,2${NBSP}%`);
    assert.equal(formatSignedPercent(-6.3), `-6,3${NBSP}%`);
  });

  it('formatSignedPercent: cero y valores que redondean a cero van sin signo', () => {
    assert.equal(formatSignedPercent(0), `0,0${NBSP}%`);
    assert.equal(formatSignedPercent(0.04), `0,0${NBSP}%`);
    assert.equal(formatSignedPercent(-0.04), `0,0${NBSP}%`);
  });
});

describe('describeAreaPlace', () => {
  it('marque: « chez » con y sin mayúscula', () => {
    assert.equal(describeAreaPlace('marque', 'TotalEnergies'), 'chez TotalEnergies');
    assert.equal(describeAreaPlace('marque', 'TotalEnergies', true), 'Chez TotalEnergies');
  });
});

describe('HISTORY_HEADLINE_FUELS', () => {
  it('son gazole y e10', () => {
    assert.deepEqual([...HISTORY_HEADLINE_FUELS], ['gazole', 'e10']);
  });
});

describe('buildAreaIntro', () => {
  const weeks = weeksFrom(60);
  const gazole = weeks.map((_, i) => (i === 7 ? 1400 : i === 30 ? 1800 : 1500));
  const e10 = weeks.map((_, i) => (i === 7 ? 1600 : 1500));
  const france = makeArea(
    'france',
    'France',
    weeks.map(() => 1450),
    weeks.map(() => 1500),
  );

  it('incluye cifras de gazole y E10, variación, máximo con fecha y comparación nacional', () => {
    const intro = buildAreaIntro(makeArea('departement', 'Morbihan', gazole, e10), weeks, france);
    assert.match(intro, /^Dans le département du Morbihan, le gazole coûte en moyenne /);
    assert.ok(intro.includes(`1,500${NBSP}€/l (${formatIsoDateFr(weeks[59])})`));
    assert.ok(intro.includes(`1,800${NBSP}€/l le ${formatIsoDateFr(weeks[30])} pour le gazole`));
    assert.ok(intro.includes(`le gazole est en hausse de 7,1${NBSP}%`));
    assert.ok(intro.includes(`le SP95-E10 est en baisse de 6,3${NBSP}%`));
    assert.ok(intro.includes('le gazole est 5,0 centimes au-dessus de la moyenne nationale'));
    assert.ok(intro.includes('le SP95-E10 est au niveau de la moyenne nationale'));
  });

  it('en la zona nacional no compara con la media nacional', () => {
    const intro = buildAreaIntro(makeArea('france', 'France', gazole, e10), weeks, france);
    assert.match(intro, /^En France, /);
    assert.ok(!intro.includes('nationale'));
  });

  it('una región se introduce con su preposición', () => {
    assert.match(buildAreaIntro(makeArea('region', 'Bretagne', gazole, e10), weeks, null), /^En Bretagne, /);
    assert.match(buildAreaIntro(makeArea('marque', 'TotalEnergies', gazole, e10), weeks, null), /^Chez TotalEnergies, /);
    assert.match(buildAreaIntro(makeArea('region', 'Grand Est', gazole, e10), weeks, null), /^Dans le Grand Est, /);
    assert.match(buildAreaIntro(makeArea('region', 'Hauts-de-France', gazole, e10), weeks, null), /^Dans les Hauts-de-France, /);
  });

  it('los departamentos llevan su artículo', () => {
    assert.match(buildAreaIntro(makeArea('departement', 'Gironde', gazole, e10), weeks, null), /^Dans le département de la Gironde, /);
    assert.match(buildAreaIntro(makeArea('departement', 'Landes', gazole, e10), weeks, null), /^Dans le département des Landes, /);
  });

  it('máximos de los dos carburantes en una frase y en singular si solo hay uno', () => {
    const both = buildAreaIntro(makeArea('region', 'Bretagne', gazole, e10), weeks, null);
    assert.ok(
      both.includes(
        `Les maximums historiques sont de 1,800${NBSP}€/l le ${formatIsoDateFr(weeks[30])} pour le gazole et de 1,600${NBSP}€/l le ${formatIsoDateFr(weeks[7])} pour le SP95-E10.`,
      ),
    );
    const none = weeks.map(() => null);
    const single = buildAreaIntro(makeArea('region', 'Bretagne', gazole, none), weeks, null);
    assert.ok(single.includes(`Le maximum historique est de 1,800${NBSP}€/l`));
  });

  it('un centime en singular por debajo de dos', () => {
    const near = makeArea('region', 'Bretagne', weeks.map(() => 1460), weeks.map(() => null));
    assert.ok(buildAreaIntro(near, weeks, france).includes('est 1,0 centime au-dessus'));
  });

  it('omite un carburante sin datos sin romper la frase', () => {
    const none = weeks.map(() => null);
    const intro = buildAreaIntro(makeArea('region', 'Corse', gazole, none), weeks, france);
    assert.ok(intro.includes('gazole'));
    assert.ok(!intro.includes('SP95-E10'));
    assert.ok(!intro.includes('undefined'));
  });

  it('sin datos de ningún carburante devuelve una frase neutra', () => {
    const none = weeks.map(() => null);
    const intro = buildAreaIntro(makeArea('region', 'Corse', none, none), weeks, france);
    assert.match(intro, /pas encore de données/);
  });
});
