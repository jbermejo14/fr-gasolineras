import { departmentOfName } from '@/lib/geo';
import { Fuel } from 'lucide-react';
import { StationCard } from '@/components/StationCard';
import { FUEL_LABELS, type FuelType } from '@/lib/fuels';
import type { Station } from '@/lib/prixCarburants';
import { toLightStation } from '@/lib/stationPayload';
import { cheapestStations } from '@/lib/stationInsights';

/** Número de estaciones que se muestran por carburante. */
const DEPARTMENT_CHEAPEST_LIMIT = 6;

interface DepartmentCheapestProps {
  stations: readonly Station[];
  fuel: FuelType;
  departmentName: string;
}

/** Las estaciones más baratas del departamento para un carburante, como tarjetas. */
export function DepartmentCheapest({ stations, fuel, departmentName }: DepartmentCheapestProps) {
  const cheapest = cheapestStations(stations, fuel, DEPARTMENT_CHEAPEST_LIMIT);
  if (cheapest.length === 0) return null;
  return (
    <div className="space-y-4">
      <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
        <Fuel className="w-5 h-5 text-[var(--orange-primary)]" />
        <span>
          Les stations les moins chères pour le {FUEL_LABELS[fuel]} dans le département {departmentOfName(departmentName)}
        </span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cheapest.map((station, index) => (
          <StationCard key={station.id} station={toLightStation(station)} selectedFuel={fuel} isCheapest={index === 0} />
        ))}
      </div>
    </div>
  );
}
