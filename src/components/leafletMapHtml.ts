import type { FuelType } from '../lib/fuels.ts';
import type { LightStation } from '../lib/stationPayload.ts';
import { DEFAULT_FUEL } from '../lib/fuels.ts';
import { formatInteger, formatPrice, formatPricePerLiter } from '../lib/format.ts';
import { stationPath } from '../lib/prixCarburants.ts';
import { assetPath } from '../lib/site.ts';

interface ClusterSizeTier {
  /** El grupo usa este nivel si su número de miembros es menor que este umbral. */
  maxCountExclusive: number;
  modifier: string;
  sizePx: number;
}

/** Niveles de tamaño de burbuja, de menor a mayor; el último no tiene tope. */
const CLUSTER_SIZE_TIERS: readonly ClusterSizeTier[] = [
  { maxCountExclusive: 10, modifier: 'small', sizePx: 34 },
  { maxCountExclusive: 100, modifier: 'medium', sizePx: 46 },
  { maxCountExclusive: Infinity, modifier: 'large', sizePx: 56 },
];

const PIN_ICON_SIZE: [number, number] = [112, 38];
const WHITESPACE_PATTERN = /\s+/g;
const NO_PRICE_PIN_LABEL = '⛽';
const MOTORWAY_LABEL = 'Autoroute';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapa texto de datos externos antes de insertarlo en HTML. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** Precio mostrado: el del carburante elegido, o gazole y luego E10 como alternativa. */
export function resolveStationPrice(station: LightStation, fuel: FuelType): number | null {
  return station.prices[fuel] ?? station.prices[DEFAULT_FUEL] ?? station.prices.e10 ?? null;
}

/** Precio compacto para pines y burbujas, sin espacio antes del euro: '1,859€'. */
function compactPrice(price: number): string {
  return formatPrice(price).replace(WHITESPACE_PATTERN, '');
}

function findClusterSizeTier(count: number): ClusterSizeTier {
  return CLUSTER_SIZE_TIERS.find((tier) => count < tier.maxCountExclusive) ?? CLUSTER_SIZE_TIERS[CLUSTER_SIZE_TIERS.length - 1];
}

export interface ClusterIconSpec {
  className: string;
  sizePx: number;
  html: string;
  /** Texto accesible de la burbuja. */
  title: string;
}

/** Contenido, clase y tamaño de la burbuja de un grupo de estaciones. */
export function buildClusterIconSpec(count: number, minPrice: number | null): ClusterIconSpec {
  const tier = findClusterSizeTier(count);
  const priceLine =
    minPrice === null ? '' : `<span class="station-cluster__price">${compactPrice(minPrice)}</span>`;
  return {
    className: `station-cluster station-cluster--${tier.modifier}`,
    sizePx: tier.sizePx,
    html: `<span class="station-cluster__count">${formatInteger(count)}</span>${priceLine}`,
    title: `${formatInteger(count)} stations-service`,
  };
}

export interface PinIconSpec {
  html: string;
  iconSize: [number, number];
}

/** Contenido del pin de una estación suelta: municipio y precio. */
export function buildPinIconSpec(station: LightStation, price: number | null, isHighlight: boolean): PinIconSpec {
  const highlightClass = isHighlight ? ' custom-station-pin--highlight' : '';
  const label = price === null ? NO_PRICE_PIN_LABEL : compactPrice(price);
  return {
    html:
      `<div class="custom-station-pin${highlightClass}">` +
      `<span class="custom-station-pin__head"><span class="custom-station-pin__name">${escapeHtml(station.city)}</span></span>` +
      `<span class="custom-station-pin__price">${label}</span>` +
      `</div>`,
    iconSize: PIN_ICON_SIZE,
  };
}

function buildPopupAddress(station: LightStation): string {
  const roadBadge = station.roadType === 'autoroute' ? `<strong>${MOTORWAY_LABEL}</strong> · ` : '';
  return `${roadBadge}${escapeHtml(station.address)}, ${escapeHtml(station.postalCode)}`;
}

/** HTML del popup de una estación; se genera solo al abrirlo. */
export function buildStationPopupHtml(station: LightStation, price: number | null): string {
  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`;
  const stationUrl = assetPath(stationPath(station));
  const priceText = price === null ? 'Prix indisponible' : formatPricePerLiter(price);
  return `
    <div class="station-popup">
      <div class="station-popup__name">${escapeHtml(station.city)}</div>
      <div class="station-popup__address">${buildPopupAddress(station)}</div>
      <div class="station-popup__price">${priceText}</div>
      <div class="station-popup__actions">
        <a href="${escapeHtml(stationUrl)}" class="station-popup__link station-popup__link--primary">Voir la fiche</a>
        <a href="${navUrl}" target="_blank" rel="noopener noreferrer" class="station-popup__link station-popup__link--secondary">Itinéraire</a>
      </div>
    </div>
  `;
}
