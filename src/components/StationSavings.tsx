import { TrendingDown } from 'lucide-react';
import { FUEL_LABELS, TANK_LITERS, type FuelType } from '@/lib/fuels';
import { formatEuros } from '@/lib/format';
import type { Station } from '@/lib/prixCarburants';
import { formatPriceOrDash, tankDifference, type SavingsReference } from '@/lib/stationInsights';

/** Carburantes que se comparan con las medias, en este orden. */
const STATION_SAVINGS_FUELS: readonly FuelType[] = ['gazole', 'e10'];
const UNAVAILABLE_TEXT = 'Données comparatives indisponibles';

interface StationSavingsProps {
  station: Station;
  references: readonly SavingsReference[];
}

function savingsSentence(difference: number): string {
  if (difference === 0) return 'Au niveau de la moyenne';
  if (difference < 0) return `Vous économisez ${formatEuros(-difference)} par plein de ${TANK_LITERS} L`;
  return `${formatEuros(difference)} de plus par plein de ${TANK_LITERS} L`;
}

function StationSavingsFuel({ station, fuel, references }: StationSavingsProps & { fuel: FuelType }) {
  const price = station.prices[fuel];
  const rows = references.flatMap((reference) => {
    const average = reference.stats[fuel].avg;
    const difference = tankDifference(price, average);
    return difference === null ? [] : [{ label: reference.label, average, difference }];
  });
  return (
    <div className="p-3.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] space-y-3">
      <span className="text-sm text-[var(--text-main)] font-bold block">
        {FUEL_LABELS[fuel]} : <span className="font-mono">{formatPriceOrDash(price)}</span>
      </span>
      {rows.length === 0 && <span className="text-sm text-[var(--text-dim)] block">{UNAVAILABLE_TEXT}</span>}
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-0.5">
          <span className="text-xs text-[var(--text-muted)] font-medium">
            Moyenne {row.label} (<span className="font-mono">{formatPriceOrDash(row.average)}</span>)
          </span>
          <span className="text-base font-bold text-[var(--text-main)]">{savingsSentence(row.difference)}</span>
        </div>
      ))}
    </div>
  );
}

/** Comparativa del precio de la estación con la media del municipio, del departamento y de Francia. */
export function StationSavings({ station, references }: StationSavingsProps) {
  const hasComparison = STATION_SAVINGS_FUELS.some((fuel) => station.prices[fuel] !== null);
  if (!hasComparison) return null;
  return (
    <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-6 shadow-sm space-y-4">
      <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
        <TrendingDown className="w-5 h-5 text-[var(--orange-primary)]" />
        <span>Combien économiser sur un plein de {TANK_LITERS} L ?</span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {STATION_SAVINGS_FUELS.map((fuel) => (
          <StationSavingsFuel key={fuel} station={station} fuel={fuel} references={references} />
        ))}
      </div>
    </section>
  );
}
