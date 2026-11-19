import { InternalLink } from '@/components/InternalLink';
import { FUEL_LABELS, FUEL_TYPES, type FuelType } from '@/lib/fuels';
import { directionsUrl } from '@/lib/directions';
import { stationPath, type Station } from '@/lib/prixCarburants';
import { formatPriceOrDash, stationCountLabel, elideA } from '@/lib/stationInsights';

/** Carburante por el que llega ordenada la tabla. */
const COMMUNE_TABLE_SORT_FUEL: FuelType = 'gazole';
/** Carburantes que se ven también en pantallas estrechas. */
const COMMUNE_TABLE_ALWAYS_SHOWN: readonly FuelType[] = ['gazole', 'e10'];

const CELL = 'py-2 px-2 sm:px-3';

function priceColumnClass(fuel: FuelType): string {
  const visibility = COMMUNE_TABLE_ALWAYS_SHOWN.includes(fuel) ? '' : 'hidden md:table-cell ';
  return `${visibility}${CELL} text-right`;
}

function CommuneTableRow({ station, isCheapest }: { station: Station; isCheapest: boolean }) {
  return (
    <tr className="hover:bg-[var(--bg-card-hover)] transition-colors">
      <td className={CELL}>
        <InternalLink
          href={stationPath(station)}
          className="font-bold text-[var(--text-main)] hover:text-[var(--orange-primary)] transition-colors block text-sm"
        >
          {station.address}
        </InternalLink>
        <span className="text-[11px] text-[var(--text-dim)]">{station.postalCode}</span>
        {station.roadType === 'autoroute' && (
          <span className="ml-1.5 px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-muted)] text-[9px] font-extrabold uppercase">
            Autoroute
          </span>
        )}
        {isCheapest && (
          <span className="ml-1.5 inline-block mt-0.5 px-1.5 py-0.5 rounded bg-[var(--on-accent-bg)] text-[var(--on-accent-text)] text-[9px] font-extrabold uppercase">
            Moins chère
          </span>
        )}
      </td>
      {FUEL_TYPES.map((fuel) => (
        <td
          key={fuel}
          className={`${priceColumnClass(fuel)} font-mono font-extrabold text-sm ${
            fuel === COMMUNE_TABLE_SORT_FUEL ? 'text-[var(--orange-primary)]' : 'text-[var(--text-main)]'
          }`}
        >
          {formatPriceOrDash(station.prices[fuel])}
        </td>
      ))}
      <td className={`${CELL} text-center`}>
        <div className="flex items-center justify-center gap-1.5">
          <InternalLink
            href={stationPath(station)}
            className="inline-flex items-center min-h-10 px-3 rounded bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] text-[var(--text-main)] text-[11px] font-semibold transition-colors"
          >
            Fiche
          </InternalLink>
          <a
            href={directionsUrl(station.lat, station.lon)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center min-h-10 px-3 rounded bg-[var(--on-accent-bg)] text-[var(--on-accent-text)] text-[11px] font-bold hover:bg-[var(--on-accent-hover)] transition-colors"
            title="Itinéraire dans Google Maps"
          >
            Itinéraire
          </a>
        </div>
      </td>
    </tr>
  );
}

interface CommuneTableProps {
  city: string;
  /** Estaciones ya ordenadas por precio del gazole. */
  stations: readonly Station[];
}

/** Tabla de las estaciones del municipio, legible sin JavaScript, con los 6 carburantes. */
export function CommuneTable({ city, stations }: CommuneTableProps) {
  const cheapestId = stations[0]?.prices[COMMUNE_TABLE_SORT_FUEL] !== null ? stations[0]?.id : undefined;
  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)]">
            Tableau comparatif des stations-service {elideA(city)}
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Classées par prix du gazole, du moins cher au plus cher. Cliquez sur l&apos;adresse d&apos;une station pour
            ouvrir sa fiche complète.
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-[var(--orange-primary)]">{stationCountLabel(stations.length)}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase tracking-wider font-extrabold">
              <th className={CELL}>Station</th>
              {FUEL_TYPES.map((fuel) => (
                <th key={fuel} className={priceColumnClass(fuel)}>
                  {FUEL_LABELS[fuel]}
                </th>
              ))}
              <th className={`${CELL} text-center`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {stations.map((station) => (
              <CommuneTableRow key={station.id} station={station} isCheapest={station.id === cheapestId} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
