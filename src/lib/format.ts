const LOCALE = 'fr-FR';
const PARIS_TIME_ZONE = 'Europe/Paris';
const PRICE_DECIMALS = 3;
const EURO_DECIMALS = 2;
const KM_DECIMALS = 1;
const MIN_KM_SHOWN = 0.1;
// Espacio no separable entre cifra y unidad: en francés la unidad no debe quedar sola en otra línea.
const UNIT_SPACE = " ";
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function formatFixedDecimals(decimals: number): Intl.NumberFormat {
  return new Intl.NumberFormat(LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const priceFormat = formatFixedDecimals(PRICE_DECIMALS);
const eurosFormat = formatFixedDecimals(EURO_DECIMALS);
const kmFormat = formatFixedDecimals(KM_DECIMALS);
const integerFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const parisDateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: PARIS_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
// La fecha civil se construye en UTC para que la zona horaria local no la desplace.
const civilDateFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** 2.109 → '2,109 €' (siempre 3 decimales). */
export function formatPrice(price: number): string {
  return `${priceFormat.format(price)}${UNIT_SPACE}€`;
}

/** 2.109 → '2,109 €/l'. */
export function formatPricePerLiter(price: number): string {
  return `${formatPrice(price)}/l`;
}

/** Importe en euros con 2 decimales: 4.5 → '4,50 €'. */
export function formatEuros(value: number): string {
  return `${eurosFormat.format(value)}${UNIT_SPACE}€`;
}

/** Distancia: < 0,1 km → 'moins de 100 m'; si no, 1 decimal: '3,4 km'. */
export function formatKm(km: number): string {
  if (km < MIN_KM_SHOWN) return `moins de 100${UNIT_SPACE}m`;
  return `${kmFormat.format(km)}${UNIT_SPACE}km`;
}

/** ISO con zona → fecha y hora en Europe/Paris: '2026-11-19T10:09:48+00:00' → '19/11/2026 à 11:09'. */
export function formatDateTimeParis(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Fecha ISO no válida: "${iso}". Se esperaba un formato como 2026-11-19T10:09:48+00:00.`);
  }
  const parts = Object.fromEntries(
    parisDateTimeFormat.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} à ${parts.hour}:${parts.minute}`;
}

/** ISO 'yyyy-mm-dd' → '4 juillet 2022' (sin zona: fecha civil). */
export function formatIsoDateFr(iso: string): string {
  const match = ISO_DATE_PATTERN.exec(iso);
  if (!match) {
    throw new Error(`Fecha no válida: "${iso}". Se esperaba el formato yyyy-mm-dd.`);
  }
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Fecha inexistente: "${iso}". Revisa el día y el mes.`);
  }
  return civilDateFormat.format(date);
}

/** Número con separador de miles francés: 9825 → '9 825' (espacio fino U+202F, el de Intl fr-FR). */
export function formatInteger(value: number): string {
  return integerFormat.format(value);
}
