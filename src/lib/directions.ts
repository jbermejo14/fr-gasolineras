const DIRECTIONS_BASE_URL = 'https://www.google.com/maps/dir/?api=1&destination=';

/** Enlace de Google Maps con el itinerario hacia unas coordenadas. */
export function directionsUrl(lat: number, lon: number): string {
  return `${DIRECTIONS_BASE_URL}${lat},${lon}`;
}
