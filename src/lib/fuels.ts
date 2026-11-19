export const FUEL_TYPES = ['gazole', 'e10', 'sp95', 'sp98', 'e85', 'gplc'] as const;
export type FuelType = (typeof FUEL_TYPES)[number];
/** Precio en €/l por carburante; null si la estación no lo vende. */
export type FuelPrices = Record<FuelType, number | null>;

export const DEFAULT_FUEL: FuelType = 'gazole';
/** Litros de un depósito de referencia para comparar costes. */
export const TANK_LITERS = 50;

export const FUEL_LABELS: Record<FuelType, string> = {
  gazole: 'Gazole',
  e10: 'SP95-E10',
  sp95: 'SP95',
  sp98: 'SP98',
  e85: 'Superéthanol E85',
  gplc: 'GPLc',
};

export const FUEL_SHORT_LABELS: Record<FuelType, string> = {
  gazole: 'Gazole',
  e10: 'E10',
  sp95: 'SP95',
  sp98: 'SP98',
  e85: 'E85',
  gplc: 'GPLc',
};

export const MIN_VALID_PRICE = 0.5; // €/l
export const MAX_VALID_PRICE = 4.0; // €/l
const PRICE_ROUNDING_FACTOR = 1000; // 3 decimales

/** Nombre del atributo `nom` de los XML anuales → FuelType ('Gazole' → 'gazole', 'GPLc' → 'gplc'). */
export function fuelFromSourceName(name: string): FuelType | null {
  const normalized = name.trim().toLowerCase();
  return FUEL_TYPES.find((fuel) => fuel === normalized) ?? null;
}

function fuelsToNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value.trim().replace(',', '.'));
  return NaN;
}

/** Número finito dentro de [MIN_VALID_PRICE, MAX_VALID_PRICE] redondeado a 3 decimales, o null (acepta number o string con punto o coma). */
export function parseValidPrice(value: unknown): number | null {
  const price = fuelsToNumber(value);
  if (!Number.isFinite(price) || price < MIN_VALID_PRICE || price > MAX_VALID_PRICE) return null;
  return Math.round(price * PRICE_ROUNDING_FACTOR) / PRICE_ROUNDING_FACTOR;
}

export function emptyFuelPrices(): FuelPrices {
  return { gazole: null, e10: null, sp95: null, sp98: null, e85: null, gplc: null };
}
