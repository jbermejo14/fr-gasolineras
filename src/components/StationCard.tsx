import React from 'react';
import { InternalLink } from '@/components/InternalLink';
import { FUEL_SHORT_LABELS, FUEL_TYPES, type FuelType } from '@/lib/fuels';
import { formatPrice } from '@/lib/format';
import { stationPath } from '@/lib/prixCarburants';
import type { LightStation } from '@/lib/stationPayload';
import { MapPin, Navigation } from 'lucide-react';

const SECONDARY_FUELS_SHOWN = 3;
const MISSING_PRICE = '--';

interface StationCardProps {
  station: LightStation;
  selectedFuel: FuelType;
  isCheapest?: boolean;
}

function secondaryFuelsOf(station: LightStation, selectedFuel: FuelType): FuelType[] {
  return FUEL_TYPES.filter((fuel) => fuel !== selectedFuel && station.prices[fuel] !== null).slice(0, SECONDARY_FUELS_SHOWN);
}

export function StationCard({ station, selectedFuel, isCheapest = false }: StationCardProps) {
  const currentPrice = station.prices[selectedFuel];
  const stationUrl = stationPath(station);
  const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`;

  return (
    <article
      className={`min-w-0 rounded-xl border p-4 flex flex-col justify-between gap-3 transition-all duration-200 bg-[var(--bg-card)] ${
        isCheapest
          ? 'border-[var(--orange-primary)] shadow-md shadow-[var(--orange-glow)]'
          : 'border-[var(--border-color)] hover:border-[var(--orange-border)] hover:bg-[var(--bg-card-hover)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <h3 className="min-w-0">
          <InternalLink
            href={stationUrl}
            className="inline-block min-w-0 max-w-full break-words px-2.5 py-1 rounded bg-[var(--bg-input)] border border-[var(--orange-border)] hover:border-[var(--orange-primary)] text-[var(--orange-primary)] text-xs font-bold uppercase tracking-tight transition-colors"
          >
            {station.city}
          </InternalLink>
        </h3>

        <div className="flex items-center gap-1.5 shrink-0">
          {station.roadType === 'autoroute' && (
            <span className="px-2 py-0.5 rounded bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)] text-[10px] font-extrabold uppercase">
              Autoroute
            </span>
          )}
          {isCheapest && (
            <span className="px-2 py-0.5 rounded bg-[var(--on-accent-bg)] text-[var(--on-accent-text)] text-[10px] font-extrabold uppercase">
              Moins chère
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)] flex items-start gap-1 min-w-0">
        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--text-dim)]" />
        <span className="min-w-0 break-words">
          {station.address}, {station.postalCode}
        </span>
      </p>

      {/* Bloque de precio principal y secundarios */}
      <div className="rounded-lg bg-[var(--bg-pricing-box)] border border-[var(--border-color)] p-3 flex items-center justify-between gap-3">
        <div className="shrink-0">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
            {FUEL_SHORT_LABELS[selectedFuel]}
          </span>
          <span className="font-mono text-2xl font-extrabold text-[var(--orange-primary)] leading-none">
            {currentPrice !== null ? formatPrice(currentPrice) : MISSING_PRICE}
            <span className="text-xs font-normal text-[var(--text-muted)] ml-0.5">/l</span>
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 justify-end min-w-0">
          {secondaryFuelsOf(station, selectedFuel).map((fuel) => (
            <span
              key={fuel}
              className="text-[10px] px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)]"
            >
              {FUEL_SHORT_LABELS[fuel]} : <strong className="text-[var(--text-main)] font-mono">{formatPrice(station.prices[fuel] as number)}</strong>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <InternalLink
          href={stationUrl}
          className="flex-1 min-h-10 flex items-center justify-center text-center py-2 px-3 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] text-xs font-semibold text-[var(--text-main)] hover:text-[var(--orange-primary)] transition-colors"
        >
          Voir la fiche complète
        </InternalLink>
        <a
          href={navigationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-10 min-w-10 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-[var(--on-accent-bg)] text-[var(--on-accent-text)] text-xs font-bold hover:bg-[var(--on-accent-hover)] transition-colors"
          title="Itinéraire dans Google Maps"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Itinéraire</span>
        </a>
      </div>
    </article>
  );
}
