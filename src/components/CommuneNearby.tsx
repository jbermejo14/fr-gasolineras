import { Building2 } from 'lucide-react';
import { InternalLink } from '@/components/InternalLink';
import { formatKm } from '@/lib/format';
import type { CommuneGroup } from '@/lib/prixCarburants';
import { elideDe, type NearbyCommune } from '@/lib/stationInsights';

interface CommuneNearbyProps {
  city: string;
  nearby: readonly NearbyCommune<CommuneGroup>[];
}

/** Enlaces a los municipios más cercanos del mismo departamento. */
export function CommuneNearby({ city, nearby }: CommuneNearbyProps) {
  if (nearby.length === 0) return null;
  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-6 shadow-sm space-y-4">
      <h2 className="text-lg font-extrabold text-[var(--text-main)] flex items-center gap-2">
        <Building2 className="w-5 h-5 text-[var(--orange-primary)]" />
        <span>Communes voisines {elideDe(city)}</span>
      </h2>
      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {nearby.map(({ commune, km }) => (
          <InternalLink
            key={commune.communeSlug}
            href={`/departement/${commune.departmentSlug}/${commune.communeSlug}`}
            className="flex flex-col justify-center min-h-12 min-w-0 p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] hover:bg-[var(--bg-card-hover)] transition-all text-xs font-semibold text-[var(--text-main)] hover:text-[var(--orange-primary)]"
          >
            <span className="truncate">{commune.city}</span>
            <span className="text-[11px] font-normal text-[var(--text-dim)]">à {formatKm(km)}</span>
          </InternalLink>
        ))}
      </div>
    </div>
  );
}
