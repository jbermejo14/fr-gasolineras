import { TrendingDown } from 'lucide-react';
import { InternalLink } from '@/components/InternalLink';
import { StationBrandBadge } from '@/components/StationBrandBadge';
import { FUEL_LABELS, TANK_LITERS, type FuelType } from '@/lib/fuels';
import type { BrandGroup } from '@/lib/brands';
import type { AreaSummary, FuelStatsByType } from '@/lib/prixCarburants';
import { formatPriceOrDash, formatTankSavings, stationCountLabel, tankDifference } from '@/lib/stationInsights';

/** Carburantes de las cifras clave de la red, en este orden. */
const BRAND_HERO_FUELS: readonly FuelType[] = ['gazole', 'e10'];

const STAT_CARD = 'p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]';

interface BrandHeroProps {
  group: BrandGroup;
  summary: AreaSummary;
  national: FuelStatsByType;
}

/** Color del importe: rojo si la red es más cara que la media, verde si es más barata, neutro si empata o falta el dato. */
function brandDifferenceColor(difference: number | null): string {
  if (difference === null || difference === 0) return 'text-[var(--text-main)]';
  return difference > 0 ? 'text-red-500' : 'text-emerald-500';
}

function BrandFuelStatCards({ summary, national }: Pick<BrandHeroProps, 'summary' | 'national'>) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 md:mt-6 pt-4 md:pt-6 border-t border-[var(--border-subtle)]">
      {BRAND_HERO_FUELS.map((fuel) => (
        <div key={`avg-${fuel}`} className={STAT_CARD}>
          <div className="text-xs text-[var(--text-muted)] font-medium">Prix moyen {FUEL_LABELS[fuel]}</div>
          <div className="font-mono text-xl md:text-2xl font-extrabold text-[var(--orange-primary)] mt-1">
            {formatPriceOrDash(summary.avg[fuel])}
          </div>
          <div className="text-xs text-[var(--text-dim)] mt-1">France : {formatPriceOrDash(national[fuel].avg)}</div>
        </div>
      ))}
      {BRAND_HERO_FUELS.map((fuel) => {
        const difference = tankDifference(summary.avg[fuel], national[fuel].avg);
        const valueColor = brandDifferenceColor(difference);
        return (
          <div key={`tank-${fuel}`} className={STAT_CARD}>
            <div className="text-xs text-[var(--text-muted)] font-medium">
              Plein {TANK_LITERS} L ({FUEL_LABELS[fuel]})
            </div>
            <div className={`font-mono text-xl md:text-2xl font-extrabold mt-1 ${valueColor}`}>
              {formatTankSavings(difference)}
            </div>
            <div className="text-xs text-[var(--text-dim)] mt-1">écart avec la moyenne nationale</div>
          </div>
        );
      })}
    </div>
  );
}

/** Cabecera de la red: título, resumen, cifras clave y enlace a su histórico. */
export function BrandHero({ group, summary, national }: BrandHeroProps) {
  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-md">
      <div className="max-w-3xl">
        <div className="mb-3 flex items-center gap-3 min-h-8">
          <StationBrandBadge name={group.name} brandSlug={group.slug} size="md" />
          <span className="text-xs font-bold text-[var(--orange-primary)] uppercase tracking-wider">Enseigne</span>
        </div>
        <h1 className="text-xl md:text-4xl font-extrabold tracking-tight break-words text-[var(--text-main)]">
          Prix des carburants chez <span className="text-[var(--orange-primary)]">{group.name}</span> aujourd&apos;hui
        </h1>
        <p className="mt-3 text-sm md:text-base text-[var(--text-muted)] leading-relaxed">
          Le réseau <strong>{group.name}</strong> compte <strong>{stationCountLabel(summary.stationCount)}</strong> en France
          métropolitaine. Le gazole y coûte en moyenne <strong>{formatPriceOrDash(summary.avg.gazole)}</strong> le litre
          (France : {formatPriceOrDash(national.gazole.avg)}) et le SP95-E10 <strong>{formatPriceOrDash(summary.avg.e10)}</strong>{' '}
          (France : {formatPriceOrDash(national.e10.avg)}).
        </p>
      </div>

      <BrandFuelStatCards summary={summary} national={national} />

      <InternalLink
        href={`/historique/marque/${group.slug}`}
        className="mt-4 inline-flex items-center gap-1.5 min-h-10 text-sm font-bold text-[var(--orange-primary)] hover:underline"
      >
        <TrendingDown className="w-4 h-4" />
        <span>Évolution des prix depuis 2016 : {group.name}</span>
      </InternalLink>
    </div>
  );
}
