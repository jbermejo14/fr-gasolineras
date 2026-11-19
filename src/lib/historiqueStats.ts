import type { AreaHistory, AreaKind, FuelSeries, HistoryFuel, PriceMilli } from './historiqueFormat.ts';
import { milliToPrice, yearOfIso } from './historiqueFormat.ts';
import { formatIsoDateFr, formatPricePerLiter } from './format.ts';
import { departmentOfName, regionInName } from './geo.ts';

export interface DatedValue {
  date: string;
  value: PriceMilli;
}

export interface SeriesSummary {
  latest: DatedValue | null;
  yearAgo: DatedValue | null;
  changePct: number | null;
  max: DatedValue | null;
  min: DatedValue | null;
  yearlyAverages: { year: number; avg: PriceMilli; weeks: number }[];
}

const MILLIS_PER_WEEK = 7 * 86_400_000;
const YEAR_AGO_TARGET_WEEKS = 52;
const YEAR_AGO_MIN_WEEKS = 50;
const YEAR_AGO_MAX_WEEKS = 54;
const PERCENT_FACTOR = 100;
const ONE_DECIMAL_FACTOR = 10;
const MILLIS_PER_CENT = 10;
const PLURAL_CENTIME_THRESHOLD = 2;
// Espacio no separable antes de « % »: en francés el signo no debe quedar solo en otra línea.
const PERCENT_SPACE = ' ';

/** Carburantes que protagonizan los textos y tarjetas de las páginas de histórico, en este orden. */
export const HISTORY_HEADLINE_FUELS: readonly HistoryFuel[] = ['gazole', 'e10'];

/** Nombre del carburante dentro de una frase (con artículo). */
const HISTORIQUE_STATS_FUEL_PHRASES: Record<HistoryFuel, string> = {
  gazole: 'le gazole',
  e10: 'le SP95-E10',
  sp95: 'le SP95',
  sp98: 'le SP98',
};

/** Formatea milésimas de euro con unidad: 1459 → '1,459 €/l'. */
export function formatMilliEuro(value: PriceMilli): string {
  return formatPricePerLiter(milliToPrice(value));
}

/** Formatea una variación con signo y una decimal: 3.24 → '+3,2 %', -6.3 → '-6,3 %', 0 → '0,0 %'. */
export function formatSignedPercent(value: number): string {
  const rounded = Number(historiqueStatsDecimal(value).replace(',', '.'));
  // Un valor que redondea a cero (también -0,04) se muestra sin signo.
  const text = historiqueStatsDecimal(rounded === 0 ? 0 : value);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${text}${PERCENT_SPACE}%`;
}

/** Redondea a un decimal sobre el valor absoluto (simétrico respecto al cero): -6,25 → -6,3. */
function historiqueStatsRoundOneDecimal(value: number): number {
  return Math.sign(value) * (Math.round(Math.abs(value) * ONE_DECIMAL_FACTOR) / ONE_DECIMAL_FACTOR);
}

function historiqueStatsWeeksBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / MILLIS_PER_WEEK;
}

function historiqueStatsLatest(weeks: readonly string[], values: FuelSeries): number {
  for (let index = Math.min(weeks.length, values.length) - 1; index >= 0; index--) {
    if (values[index] !== null) return index;
  }
  return -1;
}

function historiqueStatsYearAgo(weeks: readonly string[], values: FuelSeries, latestIndex: number): DatedValue | null {
  let best: DatedValue | null = null;
  let bestDistance = Infinity;
  for (let index = 0; index < latestIndex; index++) {
    const value = values[index];
    if (value === null) continue;
    const gap = historiqueStatsWeeksBetween(weeks[index], weeks[latestIndex]);
    if (gap < YEAR_AGO_MIN_WEEKS || gap > YEAR_AGO_MAX_WEEKS) continue;
    const distance = Math.abs(gap - YEAR_AGO_TARGET_WEEKS);
    // Con empate de distancia gana el más antiguo: el bucle avanza en el tiempo y solo sustituye si mejora estrictamente.
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { date: weeks[index], value };
    }
  }
  return best;
}

function historiqueStatsExtremes(
  weeks: readonly string[],
  values: FuelSeries,
): { max: DatedValue | null; min: DatedValue | null } {
  let max: DatedValue | null = null;
  let min: DatedValue | null = null;
  const length = Math.min(weeks.length, values.length);
  for (let index = 0; index < length; index++) {
    const value = values[index];
    if (value === null) continue;
    if (max === null || value > max.value) max = { date: weeks[index], value };
    if (min === null || value < min.value) min = { date: weeks[index], value };
  }
  return { max, min };
}

function historiqueStatsYearlyAverages(weeks: readonly string[], values: FuelSeries): SeriesSummary['yearlyAverages'] {
  const totals = new Map<number, { sum: number; weeks: number }>();
  const length = Math.min(weeks.length, values.length);
  for (let index = 0; index < length; index++) {
    const value = values[index];
    if (value === null) continue;
    const year = yearOfIso(weeks[index]);
    const total = totals.get(year) ?? { sum: 0, weeks: 0 };
    total.sum += value;
    total.weeks += 1;
    totals.set(year, total);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, total]) => ({
      year,
      avg: Math.round(total.sum / total.weeks),
      weeks: total.weeks,
    }));
}

/** Resume una serie semanal: último valor, hace un año, variación, extremos y medias anuales. */
export function summarizeSeries(weeks: readonly string[], values: FuelSeries): SeriesSummary {
  const latestIndex = historiqueStatsLatest(weeks, values);
  const latestValue = latestIndex >= 0 ? values[latestIndex] : null;
  const latest = latestValue === null ? null : { date: weeks[latestIndex], value: latestValue };
  const yearAgo = latest ? historiqueStatsYearAgo(weeks, values, latestIndex) : null;
  const changePct =
    latest && yearAgo
      ? historiqueStatsRoundOneDecimal(((latest.value - yearAgo.value) / yearAgo.value) * PERCENT_FACTOR)
      : null;
  return {
    latest,
    yearAgo,
    changePct,
    ...historiqueStatsExtremes(weeks, values),
    yearlyAverages: historiqueStatsYearlyAverages(weeks, values),
  };
}

interface HistoriqueStatsFuelInfo {
  label: string;
  fuel: HistoryFuel;
  summary: SeriesSummary;
}

/** Localización de una zona dentro de una frase: « en France », « en Bretagne », « dans le département du Morbihan ». */
export function describeAreaPlace(kind: AreaKind, name: string, capitalized = false): string {
  switch (kind) {
    case 'france':
      return capitalized ? 'En France' : 'en France';
    case 'region':
      return regionInName(name, capitalized);
    case 'departement': {
      const text = `dans le département ${departmentOfName(name)}`;
      return capitalized ? `D${text.slice(1)}` : text;
    }
  }
}

function historiqueStatsDecimal(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

function historiqueStatsJoin(parts: string[]): string {
  return parts.join(' et ');
}

function historiqueStatsCurrentSentence(subject: string, infos: HistoriqueStatsFuelInfo[]): string {
  const parts = infos.flatMap((info) =>
    info.summary.latest
      ? [
          `${info.label} coûte en moyenne ${formatMilliEuro(info.summary.latest.value)} (${formatIsoDateFr(info.summary.latest.date)})`,
        ]
      : [],
  );
  return `${subject}, ${historiqueStatsJoin(parts)}.`;
}

function historiqueStatsChangePhrase(changePct: number): string {
  if (changePct === 0) return 'est stable';
  const direction = changePct > 0 ? 'en hausse' : 'en baisse';
  return `est ${direction} de ${historiqueStatsDecimal(Math.abs(changePct))}${PERCENT_SPACE}%`;
}

function historiqueStatsYearSentence(infos: HistoriqueStatsFuelInfo[]): string | null {
  const parts = infos.flatMap((info) =>
    info.summary.changePct === null ? [] : [`${info.label} ${historiqueStatsChangePhrase(info.summary.changePct)}`],
  );
  if (parts.length === 0) return null;
  return `Sur un an, ${historiqueStatsJoin(parts)}.`;
}

function historiqueStatsMaxSentence(infos: HistoriqueStatsFuelInfo[]): string | null {
  const parts = infos.flatMap((info) =>
    info.summary.max
      ? [`de ${formatMilliEuro(info.summary.max.value)} le ${formatIsoDateFr(info.summary.max.date)} pour ${info.label}`]
      : [],
  );
  if (parts.length === 0) return null;
  const lead = parts.length === 1 ? 'Le maximum historique est' : 'Les maximums historiques sont';
  return `${lead} ${historiqueStatsJoin(parts)}.`;
}

function historiqueStatsNationalCents(
  info: HistoriqueStatsFuelInfo,
  weeks: readonly string[],
  national: AreaHistory,
): string | null {
  const latest = info.summary.latest;
  if (!latest) return null;
  const nationalValue = national.series[info.fuel].avg[weeks.indexOf(latest.date)];
  if (nationalValue === null || nationalValue === undefined) return null;
  const rounded = historiqueStatsRoundOneDecimal((latest.value - nationalValue) / MILLIS_PER_CENT);
  if (rounded === 0) return `${info.label} est au niveau de la moyenne nationale`;
  const direction = rounded > 0 ? 'au-dessus' : 'en dessous';
  const unit = Math.abs(rounded) < PLURAL_CENTIME_THRESHOLD ? 'centime' : 'centimes';
  return `${info.label} est ${historiqueStatsDecimal(Math.abs(rounded))} ${unit} ${direction} de la moyenne nationale`;
}

function historiqueStatsNationalSentence(
  infos: HistoriqueStatsFuelInfo[],
  weeks: readonly string[],
  national: AreaHistory,
): string | null {
  const parts = infos.flatMap((info) => {
    const part = historiqueStatsNationalCents(info, weeks, national);
    return part === null ? [] : [part];
  });
  if (parts.length === 0) return null;
  return `Lors de la dernière semaine, ${historiqueStatsJoin(parts)}.`;
}

/**
 * Párrafo introductorio por zona, en francés, con cifras de gazole y SP95-E10
 * (actual, variación anual, máximo con fecha) y, si la zona no es Francia, la
 * comparación con la media nacional.
 */
export function buildAreaIntro(area: AreaHistory, weeks: readonly string[], national: AreaHistory | null): string {
  const subject = describeAreaPlace(area.kind, area.name, true);
  const infos = HISTORY_HEADLINE_FUELS.map((fuel) => ({
    fuel,
    label: HISTORIQUE_STATS_FUEL_PHRASES[fuel],
    summary: summarizeSeries(weeks, area.series[fuel].avg),
  })).filter((info) => info.summary.latest !== null);
  if (infos.length === 0) {
    return `${subject}, il n'y a pas encore de données historiques sur les prix des carburants.`;
  }
  const sentences = [
    historiqueStatsCurrentSentence(subject, infos),
    historiqueStatsYearSentence(infos),
    historiqueStatsMaxSentence(infos),
    area.kind !== 'france' && national ? historiqueStatsNationalSentence(infos, weeks, national) : null,
  ];
  return sentences.filter((sentence) => sentence !== null).join(' ');
}
