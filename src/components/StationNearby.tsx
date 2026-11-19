import { MapPin } from 'lucide-react';
import { InternalLink } from '@/components/InternalLink';
import { StationBrandBadge } from '@/components/StationBrandBadge';
import { FUEL_LABELS, type FuelType } from '@/lib/fuels';
import { formatKm, formatPrice } from '@/lib/format';
import { stationPath, type Station } from '@/lib/prixCarburants';
import { stationCommercialTitle } from '@/lib/stationHeading';
import { elideDe, type NearbyStation } from '@/lib/stationInsights';

/** Carburantes que se muestran en cada estación cercana. */
const STATION_NEARBY_FUELS: readonly FuelType[] = ['gazole', 'e10'];

interface StationNearbyItemProps {
  current: Station;
  near: Station;
  km: number;
}

function StationNearbyItem({ current, near, km }: StationNearbyItemProps) {
  const commercialTitle = stationCommercialTitle(near);
  const pricedFuels = STATION_NEARBY_FUELS.filter((fuel) => near.prices[fuel] !== null);
  return (
    <li className="p-3.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] space-y-2 min-w-0">
      <StationBrandBadge name={near.name} brandSlug={near.brandSlug} size="sm" />
      <InternalLink
        href={stationPath(near)}
        className="block text-sm font-bold text-[var(--text-main)] hover:text-[var(--orange-primary)] break-words"
      >
        {commercialTitle ?? near.address}
        {near.communeSlug !== current.communeSlug && ` · ${near.city}`}
      </InternalLink>
      {commercialTitle && <p className="text-xs text-[var(--text-muted)] break-words">{near.address}</p>}
      <p className="text-xs text-[var(--text-muted)]">à {formatKm(km)}</p>
      {pricedFuels.length > 0 && (
        <ul className="space-y-1 text-xs text-[var(--text-main)]">
          {pricedFuels.map((fuel) => {
            const price = near.prices[fuel] as number;
            const currentPrice = current.prices[fuel];
            const isCheaper = currentPrice !== null && price < currentPrice;
            return (
              <li key={fuel} className="flex items-center justify-between gap-2 flex-wrap">
                <span>
                  {FUEL_LABELS[fuel]} : <span className="font-mono">{formatPrice(price)}</span>
                </span>
                {isCheaper && (
                  <span className="ml-auto px-2 py-0.5 rounded border border-[var(--orange-border)] text-[var(--orange-primary)] font-bold">
                    moins chère
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

interface StationNearbyProps {
  station: Station;
  nearby: readonly NearbyStation<Station>[];
}

/** Estaciones cercanas con su distancia y una marca donde salen más baratas que la actual. */
export function StationNearby({ station, nearby }: StationNearbyProps) {
  if (nearby.length === 0) return null;
  return (
    <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-6 shadow-sm space-y-4">
      <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
        <MapPin className="w-5 h-5 text-[var(--orange-primary)]" />
        <span>Stations-service à proximité</span>
      </h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {nearby.map(({ station: near, km }) => (
          <StationNearbyItem key={near.id} current={station} near={near} km={km} />
        ))}
      </ul>
      <InternalLink
        href={`/departement/${station.departmentSlug}/${station.communeSlug}`}
        className="inline-flex items-center min-h-11 text-sm font-bold text-[var(--orange-primary)] hover:underline"
      >
        Toutes les stations-service {elideDe(station.city)}
      </InternalLink>
    </section>
  );
}
