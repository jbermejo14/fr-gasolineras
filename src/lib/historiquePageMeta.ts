import type { Metadata } from 'next';
import type { AreaHistory, AreaKind, HistoryFuel } from './historiqueFormat.ts';
import { yearOfIso } from './historiqueFormat.ts';
import { formatIsoDateFr } from './format.ts';
import { FUEL_LABELS } from './fuels.ts';
import { HISTORY_HEADLINE_FUELS, describeAreaPlace, formatMilliEuro, formatSignedPercent, summarizeSeries } from './historiqueStats.ts';
import { loadAreaHistory } from './historique.ts';
import { SECTION_NAME, absoluteUrl } from './site.ts';

const HISTORIQUE_BASE_PATH = '/historique';
const HISTORIQUE_NOT_FOUND_TITLE = 'Historique des prix introuvable';
const HISTORIQUE_EMPTY_TITLE = 'Historique des prix des carburants';
const HISTORIQUE_EMPTY_DESCRIPTION = "L'historique n'a pas encore été généré.";
const HISTORIQUE_DESCRIPTION_TAIL = 'Données officielles, courbe hebdomadaire.';
/** Longitud máxima de la meta description que los buscadores muestran sin cortar. */
const HISTORIQUE_DESCRIPTION_MAX_LENGTH = 160;

/** Ruta de la página de histórico de una zona ('/historique' para Francia). */
export function buildHistoriquePath(kind: AreaKind, slug: string): string {
  return kind === 'france' ? HISTORIQUE_BASE_PATH : `${HISTORIQUE_BASE_PATH}/${kind}/${slug}`;
}

/** Título único por tipo de zona, con el rango de años en Francia. */
export function buildHistoriqueTitle(kind: AreaKind, name: string, weeks: readonly string[]): string {
  const firstYear = yearOfIso(weeks[0]);
  switch (kind) {
    case 'france':
      return `Prix historique du gazole et de l'essence en France (${firstYear}-${yearOfIso(weeks[weeks.length - 1])})`;
    case 'region':
    case 'marque':
      return `Évolution du prix des carburants ${describeAreaPlace(kind, name)} depuis ${firstYear}`;
    case 'departement':
      return `Prix historique des carburants ${describeAreaPlace(kind, name)} depuis ${firstYear}`;
  }
}

function historiquePriceSentence(area: AreaHistory, weeks: readonly string[], fuel: HistoryFuel): string | null {
  const { latest, changePct } = summarizeSeries(weeks, area.series[fuel].avg);
  if (!latest) return null;
  const change = changePct === null ? '' : ` (${formatSignedPercent(changePct)} sur un an)`;
  return `${FUEL_LABELS[fuel]} à ${formatMilliEuro(latest.value)}${change}`;
}

function historiqueMaxSentence(area: AreaHistory, weeks: readonly string[]): string | null {
  const { max } = summarizeSeries(weeks, area.series.gazole.avg);
  if (!max) return null;
  return `Maximum historique du gazole : ${formatMilliEuro(max.value)} le ${formatIsoDateFr(max.date)}.`;
}

/**
 * Descripción que nombra la zona, con las cifras actuales de gazole y SP95-E10, el máximo histórico
 * del gazole y una cola; cada frase opcional se añade solo si cabe en HISTORIQUE_DESCRIPTION_MAX_LENGTH.
 */
export function buildHistoriqueDescription(area: AreaHistory, weeks: readonly string[]): string {
  const prices = HISTORY_HEADLINE_FUELS.map((fuel) => historiquePriceSentence(area, weeks, fuel)).filter(
    (part) => part !== null,
  );
  const lead = `Prix du gazole et du SP95-E10 ${describeAreaPlace(area.kind, area.name)}`;
  const base = prices.length > 0 ? `${lead} : ${prices.join(' et ')}.` : `${lead}.`;
  return [historiqueMaxSentence(area, weeks), HISTORIQUE_DESCRIPTION_TAIL].reduce<string>((text, part) => {
    const candidate = part === null ? text : `${text} ${part}`;
    return candidate.length <= HISTORIQUE_DESCRIPTION_MAX_LENGTH ? candidate : text;
  }, base);
}

function historiqueNoIndexMetadata(title: string, description?: string): Metadata {
  return { title, description, robots: { index: false, follow: false } };
}

/** Metadatos (título, descripción, canonical absoluto y Open Graph) de la página de histórico de una zona. */
export function buildHistoriqueMetadata(kind: AreaKind, slug: string): Metadata {
  const file = loadAreaHistory(kind, slug);
  if (!file) {
    return kind === 'france'
      ? historiqueNoIndexMetadata(HISTORIQUE_EMPTY_TITLE, HISTORIQUE_EMPTY_DESCRIPTION)
      : historiqueNoIndexMetadata(HISTORIQUE_NOT_FOUND_TITLE);
  }
  const title = buildHistoriqueTitle(kind, file.area.name, file.weeks);
  const description = buildHistoriqueDescription(file.area, file.weeks);
  const canonical = absoluteUrl(buildHistoriquePath(kind, slug));
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', url: canonical, title, description, siteName: SECTION_NAME },
  };
}
