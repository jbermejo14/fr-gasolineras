import { HISTORY_FUELS } from '@/lib/historiqueFormat';
import type { AreaHistory, HistoryFuel } from '@/lib/historiqueFormat';
import { formatMilliEuro, summarizeSeries } from '@/lib/historiqueStats';
import { FUEL_SHORT_LABELS } from '@/lib/fuels';

interface HistoriqueAreaTableProps {
  area: AreaHistory;
  weeks: readonly string[];
}

const HISTORIQUE_TABLE_EMPTY_CELL = '--';

function historiqueTableAveragesByFuel(area: AreaHistory, weeks: readonly string[]): Map<HistoryFuel, Map<number, number>> {
  const byFuel = new Map<HistoryFuel, Map<number, number>>();
  for (const fuel of HISTORY_FUELS) {
    const yearly = summarizeSeries(weeks, area.series[fuel].avg).yearlyAverages;
    if (yearly.length > 0) byFuel.set(fuel, new Map(yearly.map((item) => [item.year, item.avg])));
  }
  return byFuel;
}

/** Tabla año x carburante con el precio medio anual; omite los carburantes sin datos. */
export function HistoriqueAreaTable({ area, weeks }: HistoriqueAreaTableProps) {
  const byFuel = historiqueTableAveragesByFuel(area, weeks);
  const fuels = HISTORY_FUELS.filter((fuel) => byFuel.has(fuel));
  const years = [...new Set([...byFuel.values()].flatMap((yearly) => [...yearly.keys()]))].sort((a, b) => b - a);
  if (years.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-color)]">
      <table className="w-full text-sm text-left">
        <caption className="sr-only">Prix moyen annuel par carburant : {area.name}</caption>
        <thead className="bg-[var(--bg-input)] text-xs text-[var(--text-muted)]">
          <tr>
            <th scope="col" className="px-3 py-2 font-bold">Année</th>
            {fuels.map((fuel) => (
              <th key={fuel} scope="col" className="px-3 py-2 font-bold whitespace-nowrap">{FUEL_SHORT_LABELS[fuel]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year} className="border-t border-[var(--border-color)]">
              <th scope="row" className="px-3 py-2 font-mono font-bold text-[var(--text-main)]">{year}</th>
              {fuels.map((fuel) => {
                const avg = byFuel.get(fuel)?.get(year);
                return (
                  <td key={fuel} className="px-3 py-2 font-mono whitespace-nowrap text-[var(--text-main)]">
                    {avg === undefined ? HISTORIQUE_TABLE_EMPTY_CELL : formatMilliEuro(avg)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
