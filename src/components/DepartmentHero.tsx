import { TrendingDown } from 'lucide-react';
import { InternalLink } from '@/components/InternalLink';
import { gasFinderTankSavings, GAS_FINDER_TANK_LITERS } from '@/components/GasFinderLogic';
import { FUEL_LABELS, type FuelType } from '@/lib/fuels';
import type { DepartmentGroup, FuelStatsByType } from '@/lib/prixCarburants';
import { summarizeStations } from '@/lib/prixCarburants';
import { cheapestCommune, communeCountLabel, formatPriceOrDash, formatTankSavings, stationCountLabel, elideA } from '@/lib/stationInsights';

/** Carburantes de las cifras clave del departamento, en este orden. */
const DEPARTMENT_HERO_FUELS: readonly FuelType[] = ['gazole', 'e10'];

const STAT_CARD = 'p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]';

interface DepartmentHeroProps {
  group: DepartmentGroup;
  regionName: string;
  national: FuelStatsByType;
}

function DepartmentIntro({ group, national }: Pick<DepartmentHeroProps, 'group' | 'national'>) {
  const summary = summarizeStations(group.stations);
  const best = cheapestCommune(group.communes, 'gazole');
  const motorwayCount = group.stations.filter((station) => station.roadType === 'autoroute').length;
  return (
    <>
      <p className="mt-3 text-sm md:text-base text-[var(--text-muted)] leading-relaxed">
        Le département <strong>{group.department}</strong> compte <strong>{stationCountLabel(group.stations.length)}</strong>{' '}
        réparties dans <strong>{communeCountLabel(group.communes.length)}</strong>. Le gazole y coûte en moyenne{' '}
        <strong>{formatPriceOrDash(summary.avg.gazole)}</strong> le litre (France : {formatPriceOrDash(national.gazole.avg)}) et
        le SP95-E10 <strong>{formatPriceOrDash(summary.avg.e10)}</strong> (France : {formatPriceOrDash(national.e10.avg)}).
      </p>
      {best && (
        <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed">
          C&apos;est <strong>{elideA(best.commune.city)}</strong> que le gazole est le moins cher du département
          ({formatPriceOrDash(best.price)}).
          {motorwayCount > 0 &&
            ` ${stationCountLabel(motorwayCount)} ${motorwayCount > 1 ? 'se trouvent' : 'se trouve'} sur autoroute, où les tarifs sont généralement plus élevés.`}
        </p>
      )}
    </>
  );
}

function DepartmentFuelStatCards({ group, national }: Pick<DepartmentHeroProps, 'group' | 'national'>) {
  const summary = summarizeStations(group.stations);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 md:mt-6 pt-4 md:pt-6 border-t border-[var(--border-subtle)]">
      {DEPARTMENT_HERO_FUELS.map((fuel) => (
        <div key={`min-${fuel}`} className={STAT_CARD}>
          <div className="text-xs text-[var(--text-muted)] font-medium">Minimum {FUEL_LABELS[fuel]}</div>
          <div className="font-mono text-xl md:text-2xl font-extrabold text-[var(--orange-primary)] mt-1">
            {formatPriceOrDash(summary.min[fuel])}
          </div>
          <div className="text-xs text-[var(--text-dim)] mt-1">
            Moyenne du département : {formatPriceOrDash(summary.avg[fuel])} (France : {formatPriceOrDash(national[fuel].avg)})
          </div>
        </div>
      ))}
      {DEPARTMENT_HERO_FUELS.map((fuel) => {
        const savings = gasFinderTankSavings(summary.min[fuel], summary.avg[fuel]);
        return (
          <div key={`savings-${fuel}`} className={STAT_CARD}>
            <div className="text-xs text-[var(--text-muted)] font-medium">
              Économie plein {GAS_FINDER_TANK_LITERS} L ({FUEL_LABELS[fuel]})
            </div>
            <div className="font-mono text-xl md:text-2xl font-extrabold text-emerald-500 mt-1">
              {formatTankSavings(savings)}
            </div>
            <div className="text-xs text-[var(--text-dim)] mt-1">face à la moyenne départementale</div>
          </div>
        );
      })}
    </div>
  );
}

/** Cabecera del departamento: título, resumen, cifras clave y enlace a su histórico. */
export function DepartmentHero({ group, regionName, national }: DepartmentHeroProps) {
  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-md">
      <div className="max-w-3xl">
        <span className="text-xs font-bold text-[var(--orange-primary)] uppercase tracking-wider block mb-2">
          {regionName} &bull; Département {group.code}
        </span>
        <h1 className="text-xl md:text-4xl font-extrabold tracking-tight break-words text-[var(--text-main)]">
          Prix des carburants dans le département{' '}
          <span className="text-[var(--orange-primary)]">{group.department}</span> ({group.code})
        </h1>
        <DepartmentIntro group={group} national={national} />
      </div>

      <DepartmentFuelStatCards group={group} national={national} />

      <InternalLink
        href={`/historique/departement/${group.departmentSlug}`}
        className="mt-4 inline-flex items-center gap-1.5 min-h-10 text-sm font-bold text-[var(--orange-primary)] hover:underline"
      >
        <TrendingDown className="w-4 h-4" />
        <span>Évolution des prix depuis 2016 : {group.department}</span>
      </InternalLink>
    </div>
  );
}
