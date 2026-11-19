'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { HISTORY_FIRST_YEAR, mergeStationPartitions } from '@/lib/historiqueFormat';
import type { StationPartitionFile } from '@/lib/historiqueFormat';
import {
  createPartitionFetcher,
  hasAnyPrice,
  listMissingYears,
  listRecentYears,
  loadPartitions,
} from '@/lib/stationHistoryLoader';
import type { StationHistoryMerged } from '@/lib/stationHistoryLoader';
import { InternalLink } from '@/components/InternalLink';
import { PriceHistoryChart } from '@/components/PriceHistoryChart';
import { departmentOfName } from '@/lib/geo';
import { assetPath } from '@/lib/site';

interface StationHistoryProps {
  stationId: string;
  departmentCode: string;
  departmentSlug: string;
  departmentName: string;
  stationName: string;
}

type StationHistoryStatus = 'loading' | 'error' | 'ready';
type StationHistoryScope = 'recent' | 'all';

const STATION_HISTORY_BASE_URL = assetPath('/historique-stations');
const STATION_HISTORY_EMPTY_TEXT = 'Aucun historique pour cette station';
const STATION_HISTORY_ERROR_TEXT = "Impossible de charger l'historique de cette station.";
const STATION_HISTORY_PARTIAL_ERROR_TEXT = "Toutes les années n'ont pas pu être chargées.";
const STATION_HISTORY_SKELETON_CLASS = 'h-[260px] sm:h-[320px]';
const STATION_HISTORY_BUTTON_CLASS =
  'min-h-11 px-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] text-xs font-bold text-[var(--text-main)] transition-colors disabled:opacity-60';

/** Sección de la ficha con la evolución semanal del precio de una estación. */
export function StationHistory({
  stationId,
  departmentCode,
  departmentSlug,
  departmentName,
  stationName,
}: StationHistoryProps) {
  const [status, setStatus] = useState<StationHistoryStatus>('loading');
  const [merged, setMerged] = useState<StationHistoryMerged | null>(null);
  const [scope, setScope] = useState<StationHistoryScope>('recent');
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [partialError, setPartialError] = useState(false);
  const filesByYear = useRef(new Map<number, StationPartitionFile>());
  const requestedYears = useRef(new Set<number>());

  useEffect(() => {
    filesByYear.current = new Map();
    requestedYears.current = new Set();
    setScope('recent');
  }, [stationId, departmentCode]);

  useEffect(() => {
    const controller = new AbortController();
    // El año actual se lee aquí y no en el render para no romper la hidratación.
    const currentYear = new Date().getFullYear();
    const wanted =
      scope === 'all'
        ? listMissingYears(currentYear, Array.from(requestedYears.current))
        : listRecentYears(currentYear).filter((year) => !requestedYears.current.has(year));

    async function stationHistoryLoad(): Promise<void> {
      try {
        const fetcher = createPartitionFetcher(STATION_HISTORY_BASE_URL, departmentCode, fetch, controller.signal);
        const files = await loadPartitions(wanted, fetcher);
        if (controller.signal.aborted) return;
        files.forEach((file) => filesByYear.current.set(file.year, file));
        wanted.forEach((year) => requestedYears.current.add(year));
        setMerged(mergeStationPartitions(Array.from(filesByYear.current.values()), stationId));
        setPartialError(false);
        setStatus('ready');
      } catch (error) {
        // Una petición fallida o una partición corrupta se muestra como error con « Réessayer ».
        if (controller.signal.aborted) return;
        console.error("Error al cargar el histórico de la estación", error);
        // Con años ya cargados se conserva la gráfica y solo se avisa del fallo.
        if (requestedYears.current.size > 0) setPartialError(true);
        else setStatus('error');
      } finally {
        if (!controller.signal.aborted) setLoadingMore(false);
      }
    }

    stationHistoryLoad();
    return () => controller.abort();
  }, [stationId, departmentCode, scope, attempt]);

  function stationHistoryRetry(): void {
    if (status === 'error') setStatus('loading');
    setPartialError(false);
    setLoadingMore(scope === 'all');
    setAttempt((value) => value + 1);
  }

  function stationHistoryShowAll(): void {
    setLoadingMore(true);
    setScope('all');
  }

  const hasData = useMemo(() => merged !== null && hasAnyPrice(merged), [merged]);
  const canShowAll = status === 'ready' && (scope === 'recent' || loadingMore);

  return (
    <div className="space-y-4">
      {status === 'loading' && (
        <div
          role="status"
          aria-label="Chargement de l'historique"
          className={`${STATION_HISTORY_SKELETON_CLASS} w-full rounded-xl bg-[var(--bg-input)] animate-pulse`}
        />
      )}

      {status === 'error' && (
        <div role="alert" className="space-y-3 text-sm text-[var(--text-muted)]">
          <p>{STATION_HISTORY_ERROR_TEXT}</p>
          <button type="button" onClick={stationHistoryRetry} className={STATION_HISTORY_BUTTON_CLASS}>
            Réessayer
          </button>
        </div>
      )}

      {status === 'ready' && !hasData && (
        <p className="text-sm text-[var(--text-muted)]">{STATION_HISTORY_EMPTY_TEXT}</p>
      )}

      {status === 'ready' && hasData && merged && (
        <PriceHistoryChart
          weeks={merged.weeks}
          series={merged.series}
          title={`Évolution du prix des carburants : ${stationName}`}
          defaultRange="all"
        />
      )}

      {partialError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
          <span>{STATION_HISTORY_PARTIAL_ERROR_TEXT}</span>
          <button type="button" onClick={stationHistoryRetry} className={STATION_HISTORY_BUTTON_CLASS}>
            Réessayer
          </button>
        </div>
      )}

      {canShowAll && (
        <button
          type="button"
          onClick={stationHistoryShowAll}
          disabled={loadingMore}
          className={STATION_HISTORY_BUTTON_CLASS}
        >
          {loadingMore ? 'Chargement…' : `Afficher depuis ${HISTORY_FIRST_YEAR}`}
        </button>
      )}

      <InternalLink
        href={`/historique/departement/${departmentSlug}`}
        className="inline-block text-xs font-bold text-[var(--orange-primary)] hover:underline"
      >
        Voir l&apos;évolution dans le département {departmentOfName(departmentName)}
      </InternalLink>
    </div>
  );
}
