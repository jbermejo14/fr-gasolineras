import { gasFinderTankSavings, GAS_FINDER_TANK_LITERS } from '@/components/GasFinderLogic';
import { FUEL_LABELS, type FuelType } from '@/lib/fuels';
import type { AreaSummary, CommuneGroup } from '@/lib/prixCarburants';
import { summarizeStations } from '@/lib/prixCarburants';
import { elideDe, formatPriceOrDash, formatTankSavings, stationCountLabel, elideA } from '@/lib/stationInsights';

/** Carburantes de las cifras clave del municipio, en este orden. */
const COMMUNE_HERO_FUELS: readonly FuelType[] = ['gazole', 'e10'];

const STAT_CARD = 'p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]';

interface CommuneHeroProps {
  commune: CommuneGroup;
  departmentCode: string;
  /** Resumen de todo el departamento, para la comparativa. */
  departmentSummary: AreaSummary;
}

function CommuneStatCards({ commune, departmentSummary }: Pick<CommuneHeroProps, 'commune' | 'departmentSummary'>) {
  const summary = summarizeStations(commune.stations);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 md:mt-6 pt-4 md:pt-6 border-t border-[var(--border-subtle)]">
      {COMMUNE_HERO_FUELS.map((fuel) => (
        <div key={`min-${fuel}`} className={STAT_CARD}>
          <div className="text-xs text-[var(--text-muted)] font-medium">Moins cher : {FUEL_LABELS[fuel]}</div>
          <div className="font-mono text-xl md:text-2xl font-extrabold text-[var(--orange-primary)] mt-1">
            {formatPriceOrDash(summary.min[fuel])}
          </div>
          <div className="text-xs text-[var(--text-dim)] mt-1">
            Moyenne locale : {formatPriceOrDash(summary.avg[fuel])} (département : {formatPriceOrDash(departmentSummary.avg[fuel])})
          </div>
        </div>
      ))}
      {COMMUNE_HERO_FUELS.map((fuel) => {
        const savings = gasFinderTankSavings(summary.min[fuel], summary.avg[fuel]);
        return (
          <div key={`savings-${fuel}`} className={STAT_CARD}>
            <div className="text-xs text-[var(--text-muted)] font-medium">
              Économie plein {GAS_FINDER_TANK_LITERS} L ({FUEL_LABELS[fuel]})
            </div>
            <div className="font-mono text-xl md:text-2xl font-extrabold text-emerald-500 mt-1">
              {formatTankSavings(savings)}
            </div>
            <div className="text-xs text-[var(--text-dim)] mt-1">face à la moyenne {elideDe(commune.city)}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Cabecera del municipio: título, resumen frente al departamento y cifras clave. */
export function CommuneHero({ commune, departmentCode, departmentSummary }: CommuneHeroProps) {
  const summary = summarizeStations(commune.stations);
  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-md">
      <div className="max-w-3xl">
        <span className="text-xs font-bold text-[var(--orange-primary)] uppercase tracking-wider block mb-2">
          {commune.department} &bull; Comparateur communal
        </span>
        <h1 className="text-xl md:text-4xl font-extrabold tracking-tight break-words text-[var(--text-main)]">
          Stations-service les moins chères{' '}
          <span className="text-[var(--orange-primary)]">{elideA(commune.city)}</span> ({departmentCode})
        </h1>
        <p className="mt-3 text-sm md:text-base text-[var(--text-muted)] leading-relaxed">
          <strong>{stationCountLabel(commune.stations.length)}</strong>{' '}
          {commune.stations.length > 1 ? 'publient' : 'publie'} leurs prix {elideA(commune.city)}. Le gazole y coûte en moyenne{' '}
          <strong>{formatPriceOrDash(summary.avg.gazole)}</strong> le litre (département : {formatPriceOrDash(departmentSummary.avg.gazole)})
          et le SP95-E10 <strong>{formatPriceOrDash(summary.avg.e10)}</strong> (département : {formatPriceOrDash(departmentSummary.avg.e10)}).
        </p>
      </div>
      <CommuneStatCards commune={commune} departmentSummary={departmentSummary} />
    </div>
  );
}
