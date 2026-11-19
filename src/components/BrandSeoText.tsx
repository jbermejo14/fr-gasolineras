import { TANK_LITERS } from '@/lib/fuels';
import type { BrandGroup } from '@/lib/brands';
import { brandTankSentence, cheapestBrandDepartment, type BrandDepartmentRow } from '@/lib/brandInsights';
import type { AreaSummary, FuelStatsByType } from '@/lib/prixCarburants';
import { departmentOfName } from '@/lib/geo';
import { formatInteger } from '@/lib/format';
import { formatPriceOrDash, stationCountLabel } from '@/lib/stationInsights';

interface BrandSeoTextProps {
  group: BrandGroup;
  summary: AreaSummary;
  rows: readonly BrandDepartmentRow[];
  national: FuelStatsByType;
}

/** Texto explicativo con cifras propias de la red. */
export function BrandSeoText({ group, summary, rows, national }: BrandSeoTextProps) {
  const gazoleSentence = brandTankSentence(group.name, 'gazole', summary.avg.gazole, national.gazole.avg);
  const e10Sentence = brandTankSentence(group.name, 'SP95-E10', summary.avg.e10, national.e10.avg);
  const cheapestDepartment = cheapestBrandDepartment(rows);
  return (
    <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-sm space-y-3 text-sm text-[var(--text-muted)] leading-relaxed">
      <h2 className="text-xl font-extrabold text-[var(--text-main)]">Faire le plein chez {group.name}</h2>
      <p>
        Les stations {group.name} se répartissent sur {formatInteger(rows.length)} {rows.length > 1 ? 'départements' : 'département'}, pour{' '}
        {stationCountLabel(summary.stationCount)} au total. Les prix indiqués ici sont ceux déclarés aujourd&apos;hui par chaque
        station : le gazole s&apos;affiche en moyenne à {formatPriceOrDash(summary.avg.gazole)} le litre et le SP95-E10 à{' '}
        {formatPriceOrDash(summary.avg.e10)}.
      </p>
      {(gazoleSentence || e10Sentence) && (
        <p>
          {[gazoleSentence, e10Sentence].filter(Boolean).join(' ')} Le prix d&apos;un plein de {TANK_LITERS} litres
          dépend toutefois beaucoup de la station : au sein d&apos;une même enseigne, chaque exploitant fixe ses tarifs.
        </p>
      )}
      {cheapestDepartment && (
        <p>
          C&apos;est dans le département {departmentOfName(cheapestDepartment.department)} que le gazole {group.name} est le
          moins cher en moyenne ({formatPriceOrDash(cheapestDepartment.avgGazole)} le litre).
        </p>
      )}
      <p>
        Les stations situées sur autoroute sont souvent plus chères que les autres. Avant de vous déplacer, comparez
        les prix des stations proches de chez vous : les tarifs sont récupérés une fois par jour et peuvent avoir changé
        depuis.
      </p>
    </section>
  );
}
