import { MapPin } from 'lucide-react';
import { InternalLink } from '@/components/InternalLink';
import type { DepartmentGroup } from '@/lib/prixCarburants';
import { stationCountLabel } from '@/lib/stationInsights';

interface DepartmentSiblingsProps {
  regionName: string;
  siblings: readonly DepartmentGroup[];
}

/** Enlaces a los demás departamentos de la misma región. */
export function DepartmentSiblings({ regionName, siblings }: DepartmentSiblingsProps) {
  if (siblings.length === 0) return null;
  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-6 shadow-sm space-y-4">
      <h2 className="text-lg font-extrabold text-[var(--text-main)] flex items-center gap-2">
        <MapPin className="w-5 h-5 text-[var(--orange-primary)]" />
        <span>Autres départements de la région {regionName}</span>
      </h2>
      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {siblings.map((sibling) => (
          <InternalLink
            key={sibling.departmentSlug}
            href={`/departement/${sibling.departmentSlug}`}
            className="min-h-12 min-w-0 p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] hover:bg-[var(--bg-card-hover)] transition-all flex flex-col justify-center text-xs font-semibold text-[var(--text-main)] hover:text-[var(--orange-primary)]"
          >
            <span className="truncate">
              {sibling.code} – {sibling.department}
            </span>
            <span className="text-[11px] text-[var(--text-dim)] font-mono mt-0.5">
              {stationCountLabel(sibling.stations.length)}
            </span>
          </InternalLink>
        ))}
      </div>
    </div>
  );
}
