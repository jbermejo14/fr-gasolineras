import type { GasFinderStats } from '@/components/GasFinderLogic';
import { formatInteger, formatPrice } from '@/lib/format';

const CARD = 'rounded-xl border bg-[var(--bg-card)] p-3 md:p-3.5 shadow-sm min-w-0';
const LABEL = 'text-[11px] font-bold uppercase tracking-wider block';
const VALUE = 'font-mono text-xl md:text-2xl font-extrabold mt-1 block truncate';
const UNIT = 'text-xs font-normal text-[var(--text-muted)] ml-0.5';
const MISSING_PRICE = '--';

function GasFinderPrice({ value }: { value: number | null }) {
  return (
    <>
      {value ? formatPrice(value) : MISSING_PRICE}
      <span className={UNIT}>/l</span>
    </>
  );
}

export function GasFinderStatsStrip({ stats }: { stats: GasFinderStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className={`${CARD} border-[var(--border-color)]`}>
        <span className={`${LABEL} text-[var(--text-muted)]`}>Stations</span>
        <span className={`${VALUE} text-[var(--text-main)]`}>{formatInteger(stats.total)}</span>
        <span className="text-[10px] text-[var(--text-dim)]">avec un prix renseigné</span>
      </div>
      <div className={`${CARD} border-[var(--orange-primary)]`}>
        <span className={`${LABEL} text-[var(--orange-primary)]`}>Prix le plus bas</span>
        <span className={`${VALUE} text-[var(--orange-primary)]`}>
          <GasFinderPrice value={stats.min} />
        </span>
        <span className="text-[10px] text-[var(--text-dim)]">Minimum actuel</span>
      </div>
      <div className={`${CARD} border-[var(--border-color)]`}>
        <span className={`${LABEL} text-[var(--text-muted)]`}>Prix moyen</span>
        <span className={`${VALUE} text-[var(--text-main)]`}>
          <GasFinderPrice value={stats.avg} />
        </span>
        <span className="text-[10px] text-[var(--text-dim)]">Moyenne du filtre</span>
      </div>
      <div className={`${CARD} border-[var(--border-color)]`}>
        <span className={`${LABEL} text-[var(--text-muted)]`}>Prix le plus élevé</span>
        <span className={`${VALUE} text-[var(--text-main)]`}>
          <GasFinderPrice value={stats.max} />
        </span>
        <span className="text-[10px] text-[var(--text-dim)]">Maximum relevé</span>
      </div>
    </div>
  );
}
