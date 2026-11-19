'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { FuelType } from '@/lib/fuels';
import type { LightStation } from '@/lib/stationPayload';
import { MAP_SIZE_CLASSES } from '@/components/leafletMapTiles';

const LeafletMap = dynamic(
  () => import('@/components/LeafletMap').then((mod) => mod.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className={`w-full ${MAP_SIZE_CLASSES} rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-xs text-[var(--text-muted)] animate-pulse`}>
        Chargement de la carte interactive…
      </div>
    ),
  }
);

interface ClientMapWrapperProps {
  stations: LightStation[];
  selectedFuel?: FuelType;
  initialCenter?: [number, number];
  initialZoom?: number;
  highlightStationId?: string;
}

export function ClientMapWrapper(props: ClientMapWrapperProps) {
  return <LeafletMap {...props} />;
}
