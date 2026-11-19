import { InternalLink } from '@/components/InternalLink';
import { StationBrandBadge } from '@/components/StationBrandBadge';
import type { BrandSummary } from '@/lib/brandInsights';
import { formatPriceOrDash, stationCountLabel } from '@/lib/stationInsights';

function BrandHomeTile({ summary }: { summary: BrandSummary }) {
  const { group } = summary;
  return (
    <InternalLink
      href={`/marque/${group.slug}`}
      className="min-h-12 min-w-0 p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] hover:bg-[var(--bg-card-hover)] transition-all flex flex-col justify-between gap-1"
    >
      <span className="min-h-6 flex items-center">
        <StationBrandBadge name={group.name} brandSlug={group.slug} size="sm" />
      </span>
      <span className="text-[11px] text-[var(--text-dim)] font-mono">{stationCountLabel(summary.stationCount)}</span>
      <span className="text-[11px] text-[var(--text-dim)] font-mono">Gazole {formatPriceOrDash(summary.avgGazole)}</span>
    </InternalLink>
  );
}

/** Bloque de la portada « Prix par enseigne »: una baldosa por red y enlace al índice. */
export function BrandHomeBlock({ summaries }: { summaries: readonly BrandSummary[] }) {
  if (summaries.length === 0) return null;
  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--text-main)]">Prix par enseigne</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Comparez le prix moyen du gazole chez TotalEnergies, E.Leclerc, Carrefour et les autres enseignes.
          </p>
        </div>
        <InternalLink href="/marque" className="inline-flex items-center min-h-10 text-sm font-bold text-[var(--orange-primary)] hover:underline">
          Toutes les enseignes
        </InternalLink>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-2">
        {summaries.map((summary) => (
          <BrandHomeTile key={summary.group.slug} summary={summary} />
        ))}
      </div>
    </div>
  );
}
