'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LightStation, StationsPayload } from '@/lib/stationPayload';
import { assetPath } from '@/lib/site';

const STATIONS_ENDPOINT = assetPath('/datos/stations.json');
const GENERIC_ERROR_MESSAGE =
  'Impossible de charger les stations-service. Vérifiez votre connexion et réessayez.';

export type GasFinderLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; stations: LightStation[] };

async function gasFinderFetchStations(signal: AbortSignal): Promise<LightStation[]> {
  const response = await fetch(STATIONS_ENDPOINT, { signal });
  if (!response.ok) {
    throw new Error(`${GENERIC_ERROR_MESSAGE} (HTTP ${response.status})`);
  }
  const payload = (await response.json()) as Partial<StationsPayload> | null;
  if (!Array.isArray(payload?.stations)) {
    throw new Error(`${GENERIC_ERROR_MESSAGE} (formato de datos no válido)`);
  }
  return payload.stations;
}

/** Descarga las estaciones ligeras al montar; `retry` repite la descarga tras un error. */
export function useGasFinderStations(): { state: GasFinderLoadState; retry: () => void } {
  const [state, setState] = useState<GasFinderLoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    gasFinderFetchStations(controller.signal)
      .then((stations) => {
        if (controller.signal.aborted) return;
        setState({ status: 'ready', stations });
      })
      .catch((err: unknown) => {
        // Abortar al desmontar o reintentar no es un fallo que mostrar.
        if (controller.signal.aborted) return;
        console.error('No se pudo cargar public/datos/stations.json', err);
        setState({ status: 'error', message: GENERIC_ERROR_MESSAGE });
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
