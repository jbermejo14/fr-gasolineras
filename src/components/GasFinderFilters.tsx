import type { ReactNode } from 'react';
import type { BrandGroup } from '@/lib/brands';
import { Search, MapPin, List, Map as MapIcon, X } from 'lucide-react';
import { GAS_FINDER_ALL_BRANDS, GAS_FINDER_ALL_DEPARTMENTS, type GasFinderSort } from '@/components/GasFinderLogic';

const RADIUS_OPTIONS_KM = [5, 15, 30, 50];
// text-base en móvil evita el zoom automático de iOS; md:text-xs mantiene el diseño de escritorio.
const FIELD =
  'w-full min-h-11 md:min-h-0 py-2 px-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-base md:text-xs text-[var(--text-main)] focus:outline-hidden focus:border-[var(--orange-primary)] transition-colors';

export type GasFinderView = 'list' | 'map';

export interface GasFinderDepartmentOption {
  code: string;
  slug: string;
  name: string;
}

interface GasFinderFiltersProps {
  search: string;
  department: string;
  departments: GasFinderDepartmentOption[];
  brand: string;
  /** Redes presentes en los datos cargados. */
  brands: readonly BrandGroup[];
  sortBy: GasFinderSort;
  hasLocation: boolean;
  geoLoading: boolean;
  radius: number;
  view: GasFinderView;
  onSearchChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onBrandChange: (value: string) => void;
  onSortChange: (value: GasFinderSort) => void;
  onToggleGeo: () => void;
  onRadiusChange: (value: number) => void;
  onViewChange: (value: GasFinderView) => void;
}

function GasFinderViewToggle({ view, onViewChange }: Pick<GasFinderFiltersProps, 'view' | 'onViewChange'>) {
  const option = (value: GasFinderView, label: string, icon: ReactNode) => (
    <button
      onClick={() => onViewChange(value)}
      className={`flex-1 sm:flex-none min-h-10 flex items-center justify-center gap-1.5 px-3 py-1 rounded-md font-bold transition-all ${
        view === value
          ? 'bg-[var(--on-accent-bg)] text-[var(--on-accent-text)] shadow-xs'
          : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <div className="flex w-full sm:w-auto items-center bg-[var(--bg-input)] border border-[var(--border-color)] p-1 rounded-lg">
      {option('list', 'Liste', <List className="w-3.5 h-3.5" />)}
      {option('map', 'Carte', <MapIcon className="w-3.5 h-3.5" />)}
    </div>
  );
}

function GasFinderSearchField({ search, onSearchChange }: Pick<GasFinderFiltersProps, 'search' | 'onSearchChange'>) {
  return (
    <div className="relative md:col-span-3">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Rechercher une commune, une rue ou un code postal…"
        aria-label="Rechercher une station-service"
        className={`${FIELD} pl-9 pr-10`}
      />
      {search && (
        <button
          onClick={() => onSearchChange('')}
          aria-label="Effacer la recherche"
          className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-main)]"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function GasFinderRadiusPicker({ radius, onRadiusChange }: Pick<GasFinderFiltersProps, 'radius' | 'onRadiusChange'>) {
  return (
    <div className="flex items-center gap-1 bg-[var(--bg-input)] p-1 rounded-md border border-[var(--border-color)]">
      <span className="text-[11px] text-[var(--text-muted)] px-1">Rayon :</span>
      {RADIUS_OPTIONS_KM.map((km) => (
        <button
          key={km}
          onClick={() => onRadiusChange(km)}
          className={`min-h-9 px-2.5 rounded text-[11px] font-semibold transition-colors ${
            radius === km
              ? 'bg-[var(--on-accent-bg)] text-[var(--on-accent-text)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          {km} km
        </button>
      ))}
    </div>
  );
}

export function GasFinderFilters(props: GasFinderFiltersProps) {
  const { search, department, departments, brand, brands, sortBy, hasLocation, geoLoading, radius, view } = props;
  const geoLabel = hasLocation ? '📍 Position active' : geoLoading ? 'Localisation…' : 'Autour de moi';

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-sm space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <GasFinderSearchField search={search} onSearchChange={props.onSearchChange} />

        <select
          value={department}
          onChange={(e) => props.onDepartmentChange(e.target.value)}
          aria-label="Département"
          className={FIELD}
        >
          <option value={GAS_FINDER_ALL_DEPARTMENTS}>Toute la France</option>
          {departments.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.code} – {item.name}
            </option>
          ))}
        </select>

        <select
          value={brand}
          onChange={(e) => props.onBrandChange(e.target.value)}
          aria-label="Enseigne"
          className={FIELD}
        >
          <option value={GAS_FINDER_ALL_BRANDS}>Toutes les enseignes</option>
          {brands.map((group) => (
            <option key={group.slug} value={group.slug}>
              {group.name}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => props.onSortChange(e.target.value as GasFinderSort)}
          aria-label="Trier par"
          className={FIELD}
        >
          <option value="price_asc">Prix : les moins chères</option>
          <option value="price_desc">Prix : les plus chères</option>
          {hasLocation && <option value="distance_asc">Distance : les plus proches</option>}
          <option value="name_asc">Nom : A - Z</option>
        </select>
      </div>

      <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3 flex-wrap text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={props.onToggleGeo}
            disabled={geoLoading}
            className={`min-h-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold border transition-all ${
              hasLocation
                ? 'bg-[var(--on-accent-bg)] text-[var(--on-accent-text)] border-[var(--on-accent-bg)]'
                : 'bg-[var(--bg-input)] text-[var(--orange-primary)] border-[var(--orange-border)] hover:bg-[var(--on-accent-bg)] hover:text-[var(--on-accent-text)]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{geoLabel}</span>
          </button>

          {hasLocation && <GasFinderRadiusPicker radius={radius} onRadiusChange={props.onRadiusChange} />}
        </div>

        <GasFinderViewToggle view={view} onViewChange={props.onViewChange} />
      </div>
    </div>
  );
}
