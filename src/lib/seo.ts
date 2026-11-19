import { SITE_NAME } from './site.ts';
import { FUEL_LABELS, FUEL_TYPES } from './fuels.ts';
import type { HistoryFuel } from './historiqueFormat.ts';
import { HISTORY_FUELS } from './historiqueFormat.ts';
import type { Station } from './prixCarburants.ts';

const PRICE_CURRENCY = 'EUR';
const LITER_UNIT_CODE = 'LTR';
const PRICE_RANGE = '€€';
const COUNTRY_CODE = 'FR';
const RANGE_SEPARATOR = '–';
const ALL_DAY_OPENS = '00:00';
const ALL_DAY_CLOSES = '23:59';
const DATASET_PRICE_UNIT = '€/l';
const DATASET_SOURCE_URL = 'https://www.prix-carburants.gouv.fr/';
const DATASET_LICENSE_URL = 'https://www.etalab.gouv.fr/licence-ouverte-open-licence/';

/** Días de la semana en el orden de `Station.openingHours` → nombre de schema.org. */
const SCHEMA_DAY_NAMES: Record<string, string> = {
  Lundi: 'Monday',
  Mardi: 'Tuesday',
  Mercredi: 'Wednesday',
  Jeudi: 'Thursday',
  Vendredi: 'Friday',
  Samedi: 'Saturday',
  Dimanche: 'Sunday',
};

/** Nombre del carburante dentro de una frase: « gazole » en minúscula; los demás, el rótulo tal cual. */
function fuelNameInSentence(fuel: HistoryFuel): string {
  return fuel === 'gazole' ? FUEL_LABELS[fuel].toLowerCase() : FUEL_LABELS[fuel];
}

export function getBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** Campos de la estación que usa el JSON-LD de la ficha. */
export type GasStationSchemaInput = Pick<
  Station,
  'id' | 'address' | 'postalCode' | 'city' | 'lat' | 'lon' | 'is24h' | 'openingHours' | 'prices'
>;

interface OpeningHoursSpecification {
  '@type': 'OpeningHoursSpecification';
  dayOfWeek: string;
  opens: string;
  closes: string;
}

function buildOpeningHoursSpecifications(station: GasStationSchemaInput): OpeningHoursSpecification[] {
  const fromRanges = station.openingHours.flatMap((day) =>
    day.closed || !(day.day in SCHEMA_DAY_NAMES)
      ? []
      : day.ranges.map((range): OpeningHoursSpecification => {
          const [opens, closes] = range.split(RANGE_SEPARATOR);
          return { '@type': 'OpeningHoursSpecification', dayOfWeek: SCHEMA_DAY_NAMES[day.day], opens, closes };
        })
  );
  if (fromRanges.length > 0 || !station.is24h) return fromRanges;
  return Object.values(SCHEMA_DAY_NAMES).map((dayOfWeek) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek,
    opens: ALL_DAY_OPENS,
    closes: ALL_DAY_CLOSES,
  }));
}

function buildFuelOffers(prices: GasStationSchemaInput['prices']) {
  return FUEL_TYPES.flatMap((fuel) => {
    const price = prices[fuel];
    if (price === null || price <= 0) return [];
    return [
      {
        '@type': 'Offer',
        name: FUEL_LABELS[fuel],
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price,
          priceCurrency: PRICE_CURRENCY,
          unitCode: LITER_UNIT_CODE,
        },
      },
    ];
  });
}

/** Schema.org GasStation de la ficha. Sin marca: los datos franceses no traen el rótulo. */
export function getGasStationSchema(station: GasStationSchemaInput, url: string) {
  const openingHours = buildOpeningHoursSpecifications(station);
  return {
    '@context': 'https://schema.org',
    '@type': 'GasStation',
    name: `Station-service ${station.address} - ${station.city}`,
    identifier: station.id,
    address: {
      '@type': 'PostalAddress',
      streetAddress: station.address,
      addressLocality: station.city,
      postalCode: station.postalCode,
      addressCountry: COUNTRY_CODE,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: station.lat,
      longitude: station.lon,
    },
    ...(openingHours.length > 0 ? { openingHoursSpecification: openingHours } : {}),
    url,
    priceRange: PRICE_RANGE,
    makesOffer: buildFuelOffers(station.prices),
  };
}

/** Schema.org Dataset de la serie semanal de precios de un área (temporalCoverage = '{primera}/{última}'). */
export function getDatasetSchema(dataset: {
  name: string;
  description: string;
  url: string;
  firstDate: string;
  lastDate: string;
  placeName: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: dataset.name,
    description: dataset.description,
    url: dataset.url,
    temporalCoverage: `${dataset.firstDate}/${dataset.lastDate}`,
    spatialCoverage: { '@type': 'Place', name: dataset.placeName },
    variableMeasured: HISTORY_FUELS.map((fuel) => ({
      '@type': 'PropertyValue',
      name: `Prix du ${fuelNameInSentence(fuel)}`,
      unitText: DATASET_PRICE_UNIT,
    })),
    isBasedOn: DATASET_SOURCE_URL,
    license: DATASET_LICENSE_URL,
    creator: { '@type': 'Organization', name: SITE_NAME },
    dateModified: dataset.lastDate,
  };
}
