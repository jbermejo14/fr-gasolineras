import { departmentOfName } from '@/lib/geo';
import { FUEL_LABELS, FUEL_TYPES } from '@/lib/fuels';
import type { DepartmentGroup, FuelStatsByType } from '@/lib/prixCarburants';
import { summarizeStations } from '@/lib/prixCarburants';
import { formatPriceOrDash } from '@/lib/stationInsights';

interface DepartmentFuelComparisonProps {
  group: DepartmentGroup;
  national: FuelStatsByType;
}

/** Tabla del departamento frente a Francia: mínimo y media de cada carburante que se vende allí. */
export function DepartmentFuelComparison({ group, national }: DepartmentFuelComparisonProps) {
  const summary = summarizeStations(group.stations);
  const soldFuels = FUEL_TYPES.filter((fuel) => summary.avg[fuel] !== null);
  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-6 shadow-sm space-y-4">
      <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)]">
        Prix moyens dans le département {departmentOfName(group.department)} et en France
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase tracking-wider font-extrabold">
              <th className="py-2 px-2 sm:px-3">Carburant</th>
              <th className="py-2 px-2 sm:px-3 text-right">Prix minimum</th>
              <th className="py-2 px-2 sm:px-3 text-right">Moyenne du département</th>
              <th className="py-2 px-2 sm:px-3 text-right">Moyenne France</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {soldFuels.map((fuel) => (
              <tr key={fuel}>
                <td className="py-2 px-2 sm:px-3 font-bold text-[var(--text-main)]">{FUEL_LABELS[fuel]}</td>
                <td className="py-2 px-2 sm:px-3 text-right font-mono font-extrabold text-[var(--orange-primary)]">
                  {formatPriceOrDash(summary.min[fuel])}
                </td>
                <td className="py-2 px-2 sm:px-3 text-right font-mono text-[var(--text-main)]">
                  {formatPriceOrDash(summary.avg[fuel])}
                </td>
                <td className="py-2 px-2 sm:px-3 text-right font-mono text-[var(--text-muted)]">
                  {formatPriceOrDash(national[fuel].avg)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
