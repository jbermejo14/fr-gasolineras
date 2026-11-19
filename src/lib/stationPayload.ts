import type { PrixSnapshot, Station } from './prixCarburants.ts';

/** Campos de una estación que necesitan el buscador, las tarjetas y el mapa. */
export type LightStation = Pick<
  Station,
  | 'id' | 'slug' | 'address' | 'name' | 'brandSlug' | 'postalCode' | 'city' | 'communeSlug' | 'department'
  | 'departmentSlug' | 'roadType' | 'lat' | 'lon' | 'prices'
>;

export interface StationsPayload {
  updatedAt: string;
  stations: LightStation[];
}

/** Copia explícita, campo a campo, de los campos de LightStation (nunca un spread). */
export function toLightStation(station: Station): LightStation {
  return {
    id: station.id,
    slug: station.slug,
    address: station.address,
    name: station.name,
    brandSlug: station.brandSlug,
    postalCode: station.postalCode,
    city: station.city,
    communeSlug: station.communeSlug,
    department: station.department,
    departmentSlug: station.departmentSlug,
    roadType: station.roadType,
    lat: station.lat,
    lon: station.lon,
    prices: station.prices,
  };
}

export function buildStationsPayload(snapshot: Pick<PrixSnapshot, 'updatedAt' | 'stations'>): StationsPayload {
  return {
    updatedAt: snapshot.updatedAt,
    stations: snapshot.stations.map(toLightStation),
  };
}
