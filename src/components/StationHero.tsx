import { ArrowLeft, MapPin, Navigation } from 'lucide-react';
import { InternalLink } from '@/components/InternalLink';
import { directionsUrl } from '@/lib/directions';
import type { RoadType, Station } from '@/lib/prixCarburants';
import { elideDe, elideA } from '@/lib/stationInsights';

const ROAD_TYPE_LABELS: Record<RoadType, string> = {
  route: 'Sur route',
  autoroute: 'Sur autoroute',
};

const BADGE = 'text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-input)] px-2.5 py-1 rounded border border-[var(--border-color)]';

interface StationHeroProps {
  station: Station;
  /** Párrafo calculado por stationSummary. */
  summary: string;
}

/** Cabecera de la ficha: título, resumen, dirección y accesos al itinerario y al municipio. */
export function StationHero({ station, summary }: StationHeroProps) {
  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-md">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="space-y-3 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="px-3 py-1.5 rounded bg-[var(--bg-input)] border border-[var(--orange-border)] text-[var(--orange-primary)] text-sm font-extrabold uppercase tracking-tight">
              {ROAD_TYPE_LABELS[station.roadType]}
            </span>
            {station.is24h && <span className={BADGE}>Automate 24/24</span>}
            <span className={BADGE}>Identifiant : {station.id}</span>
          </div>

          <h1 className="text-xl md:text-3xl font-extrabold text-[var(--text-main)] break-words">
            Station-service {station.address} {elideA(station.city)}
          </h1>

          <p className="text-sm text-[var(--text-main)]">{summary}</p>

          <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] break-words">
            <MapPin className="w-4 h-4 text-[var(--orange-primary)] shrink-0" />
            <span>
              <strong>Adresse :</strong> {station.address}, {station.postalCode} {station.city} ({station.department})
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-3 md:min-w-[200px]">
          <a
            href={directionsUrl(station.lat, station.lon)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 min-h-12 px-4 rounded-xl bg-[var(--on-accent-bg)] text-[var(--on-accent-text)] font-extrabold text-sm hover:bg-[var(--on-accent-hover)] transition-all shadow-md shadow-[var(--orange-glow)]"
          >
            <Navigation className="w-4 h-4" />
            <span>Itinéraire (GPS)</span>
          </a>
          <InternalLink
            href={`/departement/${station.departmentSlug}/${station.communeSlug}`}
            className="flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] text-xs font-bold text-[var(--text-main)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Toutes les stations {elideDe(station.city)}</span>
          </InternalLink>
        </div>
      </div>
    </div>
  );
}
