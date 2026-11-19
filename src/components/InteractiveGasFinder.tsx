'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { DEFAULT_FUEL, type FuelType } from '@/lib/fuels';
import { ClientMapWrapper } from '@/components/ClientMapWrapper';
import { GasFinderFuelSelector } from '@/components/GasFinderFuelSelector';
import { GasFinderFilters, type GasFinderDepartmentOption, type GasFinderView } from '@/components/GasFinderFilters';
import { GasFinderStatsStrip } from '@/components/GasFinderStats';
import { GasFinderEmpty, GasFinderError, GasFinderList, GasFinderLoading } from '@/components/GasFinderResults';
import { useGasFinderStations } from '@/components/GasFinderLoader';
import {
  GAS_FINDER_ALL_BRANDS,
  GAS_FINDER_ALL_DEPARTMENTS,
  GAS_FINDER_PAGE_SIZE,
  type GasFinderSort,
  gasFinderBrandOptions,
  gasFinderComputeStats,
  gasFinderFilterStations,
  gasFinderSortStations,
} from '@/components/GasFinderLogic';

const GEOLOCATION_TIMEOUT_MS = 10000;
const DEFAULT_RADIUS_KM = 15;
const DEFAULT_SORT: GasFinderSort = 'price_asc';

type UserCoords = { lat: number; lon: number };

interface InteractiveGasFinderProps {
  departments: GasFinderDepartmentOption[];
}

/** Posición del usuario: pide el permiso al navegador y la quita al pulsar de nuevo. */
function useGasFinderGeolocation(onLocated: () => void, onCleared: () => void) {
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const toggle = () => {
    if (userCoords) {
      setUserCoords(null);
      onCleared();
      return;
    }
    if (!navigator.geolocation) {
      alert('Votre navigateur ne prend pas en charge la géolocalisation.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({ lat: position.coords.latitude, lon: position.coords.longitude });
        onLocated();
        setGeoLoading(false);
      },
      (error) => {
        console.warn('Error de geolocalización:', error.message);
        alert("Impossible d'accéder à votre position. Vérifiez les autorisations de votre navigateur.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: GEOLOCATION_TIMEOUT_MS }
    );
  };

  return { userCoords, geoLoading, toggle, clear: () => setUserCoords(null) };
}

export function InteractiveGasFinder({ departments }: InteractiveGasFinderProps) {
  const { state, retry } = useGasFinderStations();

  const [fuel, setFuel] = useState<FuelType>(DEFAULT_FUEL);
  const [department, setDepartment] = useState<string>(GAS_FINDER_ALL_DEPARTMENTS);
  const [brand, setBrand] = useState<string>(GAS_FINDER_ALL_BRANDS);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<GasFinderSort>(DEFAULT_SORT);
  const [view, setView] = useState<GasFinderView>('list');
  const [radius, setRadius] = useState(DEFAULT_RADIUS_KM);
  const [visibleCount, setVisibleCount] = useState(GAS_FINDER_PAGE_SIZE);

  const resetSortIfByDistance = () => setSortBy((current) => (current === 'distance_asc' ? DEFAULT_SORT : current));
  const geolocation = useGasFinderGeolocation(() => setSortBy('distance_asc'), resetSortIfByDistance);
  const { userCoords } = geolocation;

  const stations = state.status === 'ready' ? state.stations : null;
  const brands = useMemo(() => (stations ? gasFinderBrandOptions(stations) : []), [stations]);

  // El filtrado usa la búsqueda diferida para no recalcular ni reencuadrar el mapa en cada pulsación.
  const deferredSearch = useDeferredValue(search);

  // Sin ordenar: es lo que recibe el mapa, así cambiar el orden no lo reencuadra.
  const filteredStations = useMemo(
    () =>
      stations
        ? gasFinderFilterStations(stations, { fuel, department, brand, search: deferredSearch, userCoords, radius })
        : [],
    [stations, fuel, department, brand, deferredSearch, userCoords, radius]
  );

  const sortedStations = useMemo(
    () => gasFinderSortStations(filteredStations, { fuel, sortBy, userCoords }),
    [filteredStations, fuel, sortBy, userCoords]
  );

  // Ajuste de estado durante el render: cualquier cambio de filtro u orden vuelve a la primera página.
  const [previousSorted, setPreviousSorted] = useState(sortedStations);
  if (previousSorted !== sortedStations) {
    setPreviousSorted(sortedStations);
    setVisibleCount(GAS_FINDER_PAGE_SIZE);
  }

  const currentStats = useMemo(() => gasFinderComputeStats(filteredStations, fuel), [filteredStations, fuel]);

  const handleResetFilters = () => {
    setSearch('');
    setDepartment(GAS_FINDER_ALL_DEPARTMENTS);
    setBrand(GAS_FINDER_ALL_BRANDS);
    geolocation.clear();
    resetSortIfByDistance();
  };

  const renderContent = () => {
    if (state.status === 'loading') return <GasFinderLoading />;
    if (state.status === 'error') return <GasFinderError message={state.message} onRetry={retry} />;
    if (view === 'map') return <ClientMapWrapper stations={filteredStations} selectedFuel={fuel} />;
    if (sortedStations.length === 0) return <GasFinderEmpty onReset={handleResetFilters} />;
    return (
      <GasFinderList
        stations={sortedStations.slice(0, visibleCount)}
        totalCount={sortedStations.length}
        fuel={fuel}
        cheapestPrice={currentStats.min}
        onLoadMore={() => setVisibleCount((previous) => previous + GAS_FINDER_PAGE_SIZE)}
      />
    );
  };

  return (
    <section className="space-y-6">
      <GasFinderFuelSelector fuel={fuel} onFuelChange={setFuel} />

      <GasFinderFilters
        search={search}
        department={department}
        departments={departments}
        brand={brand}
        brands={brands}
        sortBy={sortBy}
        hasLocation={userCoords !== null}
        geoLoading={geolocation.geoLoading}
        radius={radius}
        view={view}
        onSearchChange={setSearch}
        onDepartmentChange={setDepartment}
        onBrandChange={setBrand}
        onSortChange={setSortBy}
        onToggleGeo={geolocation.toggle}
        onRadiusChange={setRadius}
        onViewChange={setView}
      />

      <GasFinderStatsStrip stats={currentStats} />

      {renderContent()}
    </section>
  );
}
