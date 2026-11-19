import { Building2 } from 'lucide-react';
import { InternalLink } from '@/components/InternalLink';
import type { DepartmentGroup } from '@/lib/prixCarburants';
import { summarizeStations } from '@/lib/prixCarburants';
import { communeCountLabel, formatPriceOrDash, stationCountLabel } from '@/lib/stationInsights';

const COLLATION_LOCALE = 'fr';

/** Directorio de municipios del departamento, por orden alfabético, con precio mínimo del gazole y del E10. */
export function DepartmentCommunes({ group }: { group: DepartmentGroup }) {
  const communes = [...group.communes].sort((a, b) => a.city.localeCompare(b.city, COLLATION_LOCALE));
  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[var(--orange-primary)]" />
            <span>Communes avec stations-service dans le département {group.department}</span>
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Cliquez sur une commune pour voir le détail des prix, la carte et les stations les moins chères.
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--orange-primary)]">
          {communeCountLabel(group.communes.length)}
        </span>
      </div>

      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-2">
        {communes.map((commune) => {
          const summary = summarizeStations(commune.stations);
          return (
            <InternalLink
              key={commune.communeSlug}
              href={`/departement/${commune.departmentSlug}/${commune.communeSlug}`}
              className="min-h-12 min-w-0 p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] hover:bg-[var(--bg-card-hover)] transition-all flex flex-col justify-center group"
            >
              <span className="text-xs font-bold text-[var(--text-main)] group-hover:text-[var(--orange-primary)] transition-colors line-clamp-1">
                {commune.city}
              </span>
              <span className="text-[11px] text-[var(--text-dim)] font-mono mt-1">
                {stationCountLabel(summary.stationCount)}
              </span>
              <span className="text-[11px] text-[var(--text-dim)] font-mono">
                Gazole dès {formatPriceOrDash(summary.min.gazole)}
              </span>
              <span className="text-[11px] text-[var(--text-dim)] font-mono">
                E10 dès {formatPriceOrDash(summary.min.e10)}
              </span>
            </InternalLink>
          );
        })}
      </div>
    </div>
  );
}
