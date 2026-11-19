import type { Metadata } from 'next';
import { FUEL_LABELS, FUEL_TYPES } from './fuels.ts';
import { formatPrice } from './format.ts';
import { departmentOfName, regionInName } from './geo.ts';
import { loadAreaHistory } from './historique.ts';
import type { AreaKind } from './historiqueFormat.ts';
import { yearOfIso } from './historiqueFormat.ts';
import { buildHistoriqueMetadata } from './historiquePageMeta.ts';
import type { Station } from './prixCarburants.ts';
import { SITE_NAME } from './site.ts';
import { elideA, stationCountLabel } from './stationInsights.ts';

/** Sufijo que el layout añade a cada título (`title.template`). */
export const TITLE_SUFFIX = ` | ${SITE_NAME}`;
/** Longitud máxima del título completo, con sufijo: los buscadores cortan a partir de ahí. */
export const TITLE_MAX_LENGTH = 65;
/** Longitud máxima del título sin el sufijo. */
export const TITLE_BODY_MAX_LENGTH = TITLE_MAX_LENGTH - TITLE_SUFFIX.length;
/** Rango de longitud de las meta descriptions. */
export const DESCRIPTION_MIN_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 160;

/** Mínimo de caracteres útiles de un nombre o dirección recortados; por debajo se descarta la parte. */
const TITLE_MIN_TRIMMED_LENGTH = 14;
const TITLE_ADDRESS_SEPARATOR = ', ';
const TITLE_STATION_PREFIX = 'Station-service';
const TITLE_STATION_PREFIX_SHORT = 'Station';
const TITLE_PRICES_SUFFIX = ' : prix carburants';
const TITLE_STATION_SUFFIXES = [' : prix gazole et SP95-E10', ' : prix des carburants', ' : prix carburants', ''];
/** Palabras de enlace que no pueden quedar al final de un texto recortado. */
const TITLE_TRAILING_CONNECTORS = /(?:\s+(?:de|du|des|la|le|les|à|au|aux|et|en|sur|sous|d'|l'))+$/i;
const TITLE_TRAILING_PUNCTUATION = /[\s,;:–-]+$/;

export const HOME_TITLE = "Prix des carburants aujourd'hui en France";
const HOME_DESCRIPTION_FUELS = 'gazole, SP95-E10, SP98, E85 et GPLc';
const DESCRIPTION_DAILY_UPDATE = 'Données officielles mises à jour chaque jour.';
const DESCRIPTION_SHORT_UPDATE = 'Prix officiels du jour.';
/** Variación anual entre paréntesis del histórico: « (+27,7 % sur un an) ». */
const DESCRIPTION_YEARLY_CHANGE = /\s\([^)]*sur un an\)/g;

/** Corta en el último límite de palabra que quepa en `max`, sin dejar puntuación ni conectores colgando. */
export function titleTrimToWords(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max + 1);
  const boundary = Math.max(head.lastIndexOf(' '), head.lastIndexOf('-'));
  const cut = boundary > 0 ? head.slice(0, boundary) : text.slice(0, max);
  return cut
    .replace(TITLE_TRAILING_PUNCTUATION, '')
    .replace(TITLE_TRAILING_CONNECTORS, '')
    .replace(TITLE_TRAILING_PUNCTUATION, '');
}

/** Primer candidato (de más a menos completo) que cabe en el presupuesto; si ninguno, el último recortado. */
function titlePick(candidates: readonly string[], max: number = TITLE_BODY_MAX_LENGTH): string {
  return candidates.find((candidate) => candidate.length <= max) ?? titleTrimToWords(candidates[candidates.length - 1], max);
}

function titleGazoleSuffix(averageGazole: number | null): string {
  return averageGazole === null ? '' : ` : gazole ${formatPrice(averageGazole)}`;
}

/** « Prix des carburants du Gers (32) : gazole 2,158 € », acortado en pasos si el nombre es largo. */
export function buildDepartmentTitle(input: { name: string; code: string; averageGazole: number | null }): string {
  const { name, code, averageGazole } = input;
  const gazole = titleGazoleSuffix(averageGazole);
  const of = departmentOfName(name);
  return titlePick([
    `Prix des carburants ${of} (${code})${gazole}`,
    `Prix carburants ${of} (${code})${gazole}`,
    `Prix carburants ${of} (${code})`,
    `Prix carburants ${name} (${code})`,
  ]);
}

/** « Stations les moins chères à Saint-Martin-de-Ré (17) ». */
export function buildCommuneTitle(input: { city: string; departmentCode: string }): string {
  const place = `${elideA(input.city)} (${input.departmentCode})`;
  return titlePick([
    `Prix carburants ${place} : stations les moins chères`,
    `Prix carburants ${place} : les moins chères`,
    `Stations les moins chères ${place}`,
    `Stations moins chères ${place}`,
    `Carburant pas cher ${place}`,
    `Prix carburants ${place}`,
    `Carburants ${place}`,
  ]);
}

/** « Prix des carburants chez TotalEnergies : gazole 1,859 € ». */
export function buildBrandTitle(input: { name: string; averageGazole: number | null }): string {
  const gazole = titleGazoleSuffix(input.averageGazole);
  return titlePick([
    `Prix des carburants chez ${input.name}${gazole}`,
    `Prix carburants chez ${input.name}${gazole}`,
    `Prix carburants chez ${input.name}`,
  ]);
}

/** Candidatos « {nom} {adresse}, {ville} » con la dirección completa y, si no cabe, recortada. */
function titleNamedAddressCandidates(name: string, address: string, city: string): string[] {
  if (!address) return [];
  const cityPart = name.toLowerCase().includes(city.toLowerCase()) ? '' : `${TITLE_ADDRESS_SEPARATOR}${city}`;
  const room = TITLE_BODY_MAX_LENGTH - name.length - 1 - cityPart.length;
  const candidates = [`${name} ${address}${cityPart}`];
  if (room >= TITLE_MIN_TRIMMED_LENGTH) candidates.push(`${name} ${titleTrimToWords(address, room)}${cityPart}`);
  return candidates;
}

/** Con la calle primero para que los títulos de una misma red y ciudad no se repitan; el sufijo genérico es el último recurso. */
function titleNamedStation(name: string, address: string, city: string): string {
  const place = name.toLowerCase().includes(city.toLowerCase()) ? name : `${name} ${city}`;
  const generic = TITLE_STATION_SUFFIXES.map((suffix) => `${place}${suffix}`);
  const nameRoom = TITLE_BODY_MAX_LENGTH - city.length - 1;
  const lastResort =
    nameRoom >= TITLE_MIN_TRIMMED_LENGTH
      ? `${titleTrimToWords(name, nameRoom)} ${city}`
      : `${TITLE_STATION_PREFIX_SHORT} ${city}`;
  return titlePick([...titleNamedAddressCandidates(name, address, city), ...generic, lastResort]);
}

/** Candidatos con la dirección completa y, después, recortada: primero se prueba el prefijo corto antes que recortar. */
function titleUnnamedCandidates(address: string, city: string): string[] {
  if (!address) return [];
  const prefixes = [TITLE_STATION_PREFIX, TITLE_STATION_PREFIX_SHORT];
  const full = prefixes.map((prefix) => `${prefix} ${address}${TITLE_ADDRESS_SEPARATOR}${city}`);
  const trimmed = prefixes.flatMap((prefix) => {
    const room = TITLE_BODY_MAX_LENGTH - prefix.length - 1 - TITLE_ADDRESS_SEPARATOR.length - city.length;
    if (room < TITLE_MIN_TRIMMED_LENGTH) return [];
    return [`${prefix} ${titleTrimToWords(address, room)}${TITLE_ADDRESS_SEPARATOR}${city}`];
  });
  const withKeyword = full.map((candidate) => `${candidate}${TITLE_PRICES_SUFFIX}`);
  return [...withKeyword, ...full, ...trimmed];
}

function titleUnnamedStation(address: string, city: string): string {
  return titlePick([
    ...titleUnnamedCandidates(address, city),
    `${TITLE_STATION_PREFIX} ${city}`,
    `${TITLE_STATION_PREFIX_SHORT} ${city}`,
  ]);
}

/**
 * Título de la ficha de una estación: « {nom} {ville} : prix gazole et SP95-E10 » o, sin nombre,
 * « Station-service {adresse}, {ville} » con la dirección recortada si hace falta.
 */
export function buildStationTitle(station: Pick<Station, 'name' | 'address' | 'city'>): string {
  const city = station.city.trim();
  const name = station.name?.trim();
  const address = station.address.trim();
  return name ? titleNamedStation(name, address, city) : titleUnnamedStation(address, city);
}

/** Localización del histórico dentro de una frase: « en France », « en Bretagne », « du Gers », « chez TotalEnergies ». */
function titleHistoryPlace(kind: AreaKind, name: string): string {
  switch (kind) {
    case 'france':
      return 'en France';
    case 'region':
      return regionInName(name);
    case 'departement':
      return departmentOfName(name);
    case 'marque':
      return `chez ${name}`;
  }
}

/** « Prix des carburants en Bretagne depuis 2016 », acortado en pasos para zonas de nombre largo. */
export function buildHistoriqueSeoTitle(kind: AreaKind, name: string, firstYear: number): string {
  const place = titleHistoryPlace(kind, name);
  return titlePick([
    `Prix des carburants ${place} depuis ${firstYear}`,
    `Prix carburants ${place} depuis ${firstYear}`,
    `Historique prix carburants ${place}`,
    `Prix carburants ${place}`,
  ]);
}

/** Frases opcionales añadidas por orden mientras la descripción no pase de DESCRIPTION_MAX_LENGTH. */
function descriptionFit(base: string, optionals: readonly string[]): string {
  return optionals.reduce((text, part) => {
    const candidate = part ? `${text} ${part}` : text;
    return candidate.length <= DESCRIPTION_MAX_LENGTH ? candidate : text;
  }, base);
}

function descriptionMinPrice(label: string, price: number | null): string {
  return price === null ? '' : `${label} dès ${formatPrice(price)}.`;
}

/** Descripción de la ficha: dirección, precios de todos los carburantes que vende y servicios, hasta 160 caracteres. */
export function buildStationDescription(
  station: Pick<Station, 'address' | 'postalCode' | 'city' | 'prices' | 'is24h'>,
): string {
  const full = `Prix des carburants à la station-service ${station.address}, ${station.postalCode} ${station.city}.`;
  const base =
    full.length <= DESCRIPTION_MAX_LENGTH
      ? full
      : `Prix des carburants à la station-service de ${station.city} (${station.postalCode}).`;
  const prices = FUEL_TYPES.map((fuel) => {
    const price = station.prices[fuel];
    return price === null ? '' : `${FUEL_LABELS[fuel]} : ${formatPrice(price)}.`;
  });
  return descriptionFit(base, [
    ...prices,
    station.is24h ? 'Automate 24/24.' : '',
    'Horaires, services et itinéraire.',
    DESCRIPTION_DAILY_UPDATE,
    DESCRIPTION_SHORT_UPDATE,
  ]);
}

/** Descripción del departamento, con número de estaciones y precios mínimos. */
export function buildDepartmentDescription(input: {
  name: string;
  code: string;
  stationCount: number;
  minGazole: number | null;
  minE10: number | null;
}): string {
  const base = `Comparez les prix de ${stationCountLabel(input.stationCount)}-service dans le département ${departmentOfName(input.name)} (${input.code}).`;
  return descriptionFit(base, [
    descriptionMinPrice('Gazole', input.minGazole),
    descriptionMinPrice('SP95-E10', input.minE10),
    'Détail par commune.',
    DESCRIPTION_DAILY_UPDATE,
    DESCRIPTION_SHORT_UPDATE,
  ]);
}

/** Descripción del municipio, con número de estaciones y precios mínimos. */
export function buildCommuneDescription(input: {
  city: string;
  department: string;
  stationCount: number;
  minGazole: number | null;
  minE10: number | null;
}): string {
  const base = `Comparez ${stationCountLabel(input.stationCount)}-service ${elideA(input.city)} (${input.department}) avec les prix officiels.`;
  return descriptionFit(base, [
    descriptionMinPrice('Gazole', input.minGazole),
    descriptionMinPrice('SP95-E10', input.minE10),
    'Classement par prix, carte et horaires.',
    DESCRIPTION_DAILY_UPDATE,
    DESCRIPTION_SHORT_UPDATE,
  ]);
}

/** Descripción de una red, con número de estaciones y precios mínimos. */
export function buildBrandDescription(input: {
  name: string;
  stationCount: number;
  minGazole: number | null;
  minE10: number | null;
}): string {
  const base = `Comparez les prix de ${stationCountLabel(input.stationCount)} ${input.name} en France.`;
  return descriptionFit(base, [
    descriptionMinPrice('Gazole', input.minGazole),
    descriptionMinPrice('SP95-E10', input.minE10),
    'Détail par département.',
    DESCRIPTION_DAILY_UPDATE,
    DESCRIPTION_SHORT_UPDATE,
  ]);
}

/** Título completo de la portada (`title.default` no pasa por la plantilla, así que lleva el sufijo). */
export function buildHomeTitle(): string {
  return `${HOME_TITLE}${TITLE_SUFFIX}`;
}

/** Descripción de la portada con el número de estaciones y el gazole medio nacional. */
export function buildHomeDescription(input: { stationCount: number; averageGazole: number | null }): string {
  const base = `Comparez les prix du ${HOME_DESCRIPTION_FUELS} dans ${stationCountLabel(input.stationCount)}-service de France.`;
  const average = input.averageGazole === null ? '' : `Gazole à ${formatPrice(input.averageGazole)} en moyenne.`;
  return descriptionFit(base, [average, DESCRIPTION_DAILY_UPDATE, 'Stations les moins chères par département et commune.']);
}

/** Acorta una descripción larga: primero quita las variaciones anuales y, si no basta, recorta por palabras. */
export function descriptionShorten(description: string): string {
  if (description.length <= DESCRIPTION_MAX_LENGTH) return description;
  const withoutChanges = description.replace(DESCRIPTION_YEARLY_CHANGE, '');
  if (withoutChanges.length <= DESCRIPTION_MAX_LENGTH) return withoutChanges;
  return `${titleTrimToWords(withoutChanges, DESCRIPTION_MAX_LENGTH - 1)}.`;
}

/**
 * Metadatos de la página de histórico de una zona: los de `buildHistoriqueMetadata` con el título
 * acortado a la regla de TITLE_MAX_LENGTH y la descripción a DESCRIPTION_MAX_LENGTH (también en Open Graph). Sin histórico, se dejan tal cual.
 */
export function buildHistoriqueSeoMetadata(kind: AreaKind, slug: string): Metadata {
  const metadata = buildHistoriqueMetadata(kind, slug);
  const file = loadAreaHistory(kind, slug);
  if (!file) return metadata;
  const title = buildHistoriqueSeoTitle(kind, file.area.name, yearOfIso(file.weeks[0]));
  const description = descriptionShorten(metadata.description ?? '');
  return { ...metadata, title, description, openGraph: { ...metadata.openGraph, title, description } };
}
