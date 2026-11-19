import { Fuel } from 'lucide-react';
import { FUEL_LABELS, FUEL_TYPES, TANK_LITERS, type FuelType } from '@/lib/fuels';
import { formatDateTimeParis, formatEuros, formatPrice } from '@/lib/format';
import type { Station } from '@/lib/prixCarburants';

const UNAVAILABLE_TEXT = 'Non disponible';

function StationPriceTile({ station, fuel }: { station: Station; fuel: FuelType }) {
  const price = station.prices[fuel];
  const updatedAt = station.priceUpdatedAt[fuel];
  return (
    <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="text-xs font-semibold text-[var(--text-muted)] block">{FUEL_LABELS[fuel]}</span>
        {price !== null ? (
          <>
            <span className="font-mono text-xl md:text-2xl font-extrabold text-[var(--orange-primary)] mt-1 block">
              {formatPrice(price)}/l
            </span>
            {updatedAt !== null && (
              <span className="text-[11px] text-[var(--text-dim)] block mt-1">
                Mis à jour le {formatDateTimeParis(updatedAt)}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm font-semibold text-[var(--text-dim)] mt-1 block">{UNAVAILABLE_TEXT}</span>
        )}
      </div>
      {price !== null && (
        <div className="text-right text-[11px] text-[var(--text-dim)] font-mono shrink-0">
          {TANK_LITERS} L = {formatEuros(price * TANK_LITERS)}
        </div>
      )}
    </div>
  );
}

/** Los precios de los 6 carburantes con su fecha de actualización; los que no se venden, « Non disponible ». */
export function StationPrices({ station }: { station: Station }) {
  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
          <Fuel className="w-5 h-5 text-[var(--orange-primary)]" />
          <span>Prix officiels des carburants</span>
        </h2>
        <span className="text-xs text-[var(--text-muted)]">Données prix-carburants.gouv.fr</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FUEL_TYPES.map((fuel) => (
          <StationPriceTile key={fuel} station={station} fuel={fuel} />
        ))}
      </div>
    </div>
  );
}
