import { BRAND_GROUPS } from './brands.ts';
import type { BrandGroup } from './brands.ts';
import { formatEuros } from './format.ts';
import { TANK_LITERS } from './fuels.ts';
import { summarizeStations } from './prixCarburants.ts';
import type { Station } from './prixCarburants.ts';
import { cheapestStations, tankDifference } from './stationInsights.ts';

/** Mínimo de departamentos con precio para poder señalar el más barato. */
const BRAND_MIN_DEPARTMENTS_TO_COMPARE = 2;

export interface BrandSummary {
  group: BrandGroup;
  stationCount: number;
  avgGazole: number | null;
  avgE10: number | null;
}

export interface BrandDepartmentRow {
  departmentCode: string;
  department: string;
  departmentSlug: string;
  stationCount: number;
  avgGazole: number | null;
  /** Estación más barata de gazole del departamento (null si ninguna lo publica). */
  cheapestGazole: Station | null;
}

/** Resumen de cada red con estaciones, de más a menos estaciones (en empate, el orden de BRAND_GROUPS). */
export function summarizeBrands(brands: ReadonlyMap<string, readonly Station[]>): BrandSummary[] {
  const summaries: BrandSummary[] = [];
  for (const group of BRAND_GROUPS) {
    const stations = brands.get(group.slug);
    if (!stations || stations.length === 0) continue;
    const summary = summarizeStations(stations);
    summaries.push({ group, stationCount: stations.length, avgGazole: summary.avg.gazole, avgE10: summary.avg.e10 });
  }
  return summaries.sort((a, b) => b.stationCount - a.stationCount);
}

function brandCompareCodes(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function brandGroupByDepartment(stations: readonly Station[]): Map<string, Station[]> {
  const byDepartment = new Map<string, Station[]>();
  for (const station of stations) {
    const group = byDepartment.get(station.departmentSlug);
    if (group) group.push(station);
    else byDepartment.set(station.departmentSlug, [station]);
  }
  return byDepartment;
}

/** Filas por departamento de las estaciones de una red: más estaciones primero, en empate por código. */
export function summarizeBrandDepartments(stations: readonly Station[]): BrandDepartmentRow[] {
  const rows = [...brandGroupByDepartment(stations).values()].map((group): BrandDepartmentRow => {
    const [first] = group;
    return {
      departmentCode: first.departmentCode,
      department: first.department,
      departmentSlug: first.departmentSlug,
      stationCount: group.length,
      avgGazole: summarizeStations(group).avg.gazole,
      cheapestGazole: cheapestStations(group, 'gazole', 1)[0] ?? null,
    };
  });
  return rows.sort((a, b) => b.stationCount - a.stationCount || brandCompareCodes(a.departmentCode, b.departmentCode));
}

/**
 * Departamento con la media de gazole más baja. Solo hay comparación si al menos dos
 * departamentos tienen precio; en empate gana el primero de `rows` (más estaciones, luego menor código).
 */
export function cheapestBrandDepartment(rows: readonly BrandDepartmentRow[]): BrandDepartmentRow | null {
  let best: BrandDepartmentRow | null = null;
  let bestAverage = Infinity;
  let pricedCount = 0;
  for (const row of rows) {
    if (row.avgGazole === null) continue;
    pricedCount += 1;
    if (row.avgGazole < bestAverage) {
      best = row;
      bestAverage = row.avgGazole;
    }
  }
  return pricedCount >= BRAND_MIN_DEPARTMENTS_TO_COMPARE ? best : null;
}

/**
 * Frase sobre el coste de un depósito de TANK_LITERS litros con el precio medio de la red
 * frente a la media nacional. Null si falta alguna de las dos medias.
 */
export function brandTankSentence(
  brandName: string,
  fuelName: string,
  brandAvg: number | null,
  nationalAvg: number | null,
): string | null {
  const diff = tankDifference(brandAvg, nationalAvg);
  if (diff === null) return null;
  const head = `Chez ${brandName}, un plein de ${TANK_LITERS} litres de ${fuelName} coûte en moyenne`;
  if (diff === 0) return `${head} le même prix que la moyenne nationale.`;
  const direction = diff > 0 ? 'de plus' : 'de moins';
  return `${head} ${formatEuros(Math.abs(diff))} ${direction} que la moyenne nationale.`;
}
