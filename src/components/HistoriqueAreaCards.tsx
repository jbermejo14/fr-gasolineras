import type { AreaHistory } from '@/lib/historiqueFormat';
import { HISTORY_HEADLINE_FUELS, formatMilliEuro, formatSignedPercent, summarizeSeries } from '@/lib/historiqueStats';
import type { DatedValue, SeriesSummary } from '@/lib/historiqueStats';
import { formatIsoDateFr } from '@/lib/format';
import { FUEL_SHORT_LABELS } from '@/lib/fuels';

interface HistoriqueAreaCardsProps {
  area: AreaHistory;
  weeks: readonly string[];
}

const HISTORIQUE_CARDS_CLASS = 'p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] min-w-0';
const HISTORIQUE_CARDS_LABEL_CLASS = 'text-xs text-[var(--text-muted)] font-medium';
const HISTORIQUE_CARDS_VALUE_CLASS = 'font-mono text-lg md:text-2xl font-extrabold text-[var(--orange-primary)] mt-1';
const HISTORIQUE_CARDS_NOTE_CLASS = 'text-xs text-[var(--text-dim)] mt-1';

function historiqueCardsChangeText(changePct: number | null): string {
  if (changePct === null) return 'Variation sur un an indisponible';
  return `${formatSignedPercent(changePct)} sur un an`;
}

function historiqueCardsExtreme(label: string, extreme: DatedValue | null): string {
  return extreme ? `${label} : ${formatMilliEuro(extreme.value)} (${formatIsoDateFr(extreme.date)})` : `${label} : pas de donnée`;
}

/** Cuatro tarjetas: precio actual de gazole y E10, y máximo y mínimo históricos de cada uno. */
export function HistoriqueAreaCards({ area, weeks }: HistoriqueAreaCardsProps) {
  const summaries = HISTORY_HEADLINE_FUELS.map((fuel) => ({
    fuel,
    summary: summarizeSeries(weeks, area.series[fuel].avg),
  }));
  const extremes = [
    { label: 'Maximum historique', pick: (summary: SeriesSummary) => summary.max },
    { label: 'Minimum historique', pick: (summary: SeriesSummary) => summary.min },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {summaries.map(({ fuel, summary }) => (
        <div key={fuel} className={HISTORIQUE_CARDS_CLASS}>
          <div className={HISTORIQUE_CARDS_LABEL_CLASS}>{FUEL_SHORT_LABELS[fuel]} actuel</div>
          <div className={HISTORIQUE_CARDS_VALUE_CLASS}>{summary.latest ? formatMilliEuro(summary.latest.value) : '--'}</div>
          <div className={HISTORIQUE_CARDS_NOTE_CLASS}>{historiqueCardsChangeText(summary.changePct)}</div>
        </div>
      ))}
      {extremes.map(({ label, pick }) => (
        <div key={label} className={HISTORIQUE_CARDS_CLASS}>
          <div className={HISTORIQUE_CARDS_LABEL_CLASS}>{label}</div>
          <div className={`${HISTORIQUE_CARDS_NOTE_CLASS} space-y-1 break-words`}>
            {summaries.map(({ fuel, summary }) => (
              <p key={fuel}>{historiqueCardsExtreme(FUEL_SHORT_LABELS[fuel], pick(summary))}</p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
