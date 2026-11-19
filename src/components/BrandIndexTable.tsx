import { InternalLink } from '@/components/InternalLink';
import { StationBrandBadge } from '@/components/StationBrandBadge';
import type { BrandSummary } from '@/lib/brandInsights';
import type { FuelStatsByType } from '@/lib/prixCarburants';
import { formatInteger } from '@/lib/format';
import { formatPriceOrDash } from '@/lib/stationInsights';

const CELL = 'py-2 px-2 sm:px-3';
const PRICE_CELL = `${CELL} text-right font-mono text-sm text-[var(--text-main)]`;

function BrandIndexRow({ summary }: { summary: BrandSummary }) {
  const { group } = summary;
  return (
    <tr className="hover:bg-[var(--bg-card-hover)] transition-colors">
      <td className={CELL}>
        <InternalLink
          href={`/marque/${group.slug}`}
          className="inline-flex items-center gap-3 min-h-10 font-bold text-sm text-[var(--text-main)] hover:text-[var(--orange-primary)] transition-colors"
        >
          <StationBrandBadge name={group.name} brandSlug={group.slug} size="md" />
          <span>{group.name}</span>
        </InternalLink>
      </td>
      <td className={PRICE_CELL}>{formatInteger(summary.stationCount)}</td>
      <td className={PRICE_CELL}>{formatPriceOrDash(summary.avgGazole)}</td>
      <td className={PRICE_CELL}>{formatPriceOrDash(summary.avgE10)}</td>
    </tr>
  );
}

/** Tabla de redes: logo, estaciones y medias de gazole y SP95-E10; la fila final es la media de Francia. */
export function BrandIndexTable({ summaries, national }: { summaries: readonly BrandSummary[]; national: FuelStatsByType }) {
  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-sm overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--border-color)]">
            <th className={CELL}>Enseigne</th>
            <th className={`${CELL} text-right`}>Stations</th>
            <th className={`${CELL} text-right`}>Gazole moyen</th>
            <th className={`${CELL} text-right`}>SP95-E10 moyen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {summaries.map((summary) => (
            <BrandIndexRow key={summary.group.slug} summary={summary} />
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-[var(--border-color)] text-[var(--text-muted)]">
            <th className={`${CELL} text-sm font-bold`} scope="row">
              Moyenne France
            </th>
            <td className={CELL} />
            <td className={`${CELL} text-right font-mono text-sm`}>{formatPriceOrDash(national.gazole.avg)}</td>
            <td className={`${CELL} text-right font-mono text-sm`}>{formatPriceOrDash(national.e10.avg)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
