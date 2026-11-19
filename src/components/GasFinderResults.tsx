import type { FuelType } from '@/lib/fuels';
import { StationCard } from '@/components/StationCard';
import type { GasFinderStation } from '@/components/GasFinderLogic';

const PANEL = 'rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]';
const PRIMARY_BUTTON =
  'min-h-10 px-4 py-2 rounded-lg bg-[var(--on-accent-bg)] text-[var(--on-accent-text)] text-xs font-bold hover:bg-[var(--on-accent-hover)] transition-colors';

/** Esqueleto con alto parecido al de la lista mientras se descargan las estaciones. */
export function GasFinderLoading() {
  return (
    <div
      className={`${PANEL} min-h-[450px] flex items-center justify-center text-xs text-[var(--text-muted)] animate-pulse`}
    >
      Chargement des stations-service…
    </div>
  );
}

export function GasFinderError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className={`${PANEL} p-8 md:p-12 text-center space-y-3`}>
      <span className="text-4xl block">⚠️</span>
      <h3 className="font-bold text-base text-[var(--text-main)]">Impossible de charger les stations-service</h3>
      <p className="text-xs text-[var(--text-muted)] break-words">{message}</p>
      <button onClick={onRetry} className={PRIMARY_BUTTON}>
        Réessayer
      </button>
    </div>
  );
}

export function GasFinderEmpty({ onReset }: { onReset: () => void }) {
  return (
    <div className={`${PANEL} p-8 md:p-12 text-center space-y-3`}>
      <span className="text-4xl block">⛽</span>
      <h3 className="font-bold text-base text-[var(--text-main)]">
        Aucune station-service ne correspond à vos filtres
      </h3>
      <p className="text-xs text-[var(--text-muted)]">
        Essayez de réinitialiser la recherche, de changer de département ou d&apos;élargir le rayon.
      </p>
      <button onClick={onReset} className={PRIMARY_BUTTON}>
        Réinitialiser les filtres
      </button>
    </div>
  );
}

interface GasFinderListProps {
  stations: GasFinderStation[];
  totalCount: number;
  fuel: FuelType;
  cheapestPrice: number | null;
  onLoadMore: () => void;
}

export function GasFinderList({ stations, totalCount, fuel, cheapestPrice, onLoadMore }: GasFinderListProps) {
  const remaining = totalCount - stations.length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stations.map((station) => (
          <StationCard
            key={station.id}
            station={station}
            selectedFuel={fuel}
            isCheapest={cheapestPrice !== null && station.prices[fuel] === cheapestPrice}
          />
        ))}
      </div>

      {remaining > 0 && (
        <div className="text-center pt-4">
          <button
            onClick={onLoadMore}
            className="min-h-11 px-6 py-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--orange-border)] text-xs font-bold text-[var(--orange-primary)] hover:bg-[var(--on-accent-bg)] hover:text-[var(--on-accent-text)] transition-all shadow-sm"
          >
            Afficher plus de stations ({remaining} restante{remaining > 1 ? 's' : ''})
          </button>
        </div>
      )}
    </div>
  );
}
