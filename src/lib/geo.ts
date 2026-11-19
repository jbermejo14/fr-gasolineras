export interface Region {
  code: string;
  name: string;
  slug: string;
}

export interface Department {
  code: string;
  name: string;
  slug: string;
  regionCode: string;
}

const POSTAL_CODE_PATTERN = /^\d{5}$/;
const CORSICA_POSTAL_PREFIX = '20';
const CORSICA_SOUTH_LAST_POSTAL_CODE = 20199;
const DEPARTMENT_CODE_LENGTH = 2;
/** Palabras que van en minúscula en un nombre de lugar, salvo al principio. */
const LOWERCASE_PLACE_WORDS: ReadonlySet<string> = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'lès', 'sur', 'sous', 'en', 'et', 'aux', 'au', 'l', 'd',
]);
const PLACE_TOKEN_PATTERN = /[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu;
const WORD_START_PATTERN = /^[\p{L}\p{N}]/u;
const COMBINING_MARKS_PATTERN = /\p{M}/gu;
const NON_ALPHANUMERIC_PATTERN = /[^a-z0-9]+/g;
const EDGE_DASHES_PATTERN = /^-+|-+$/g;

/** Slug ASCII: minúsculas, sin tildes, '&' → 'et', todo lo que no sea [a-z0-9] → '-', sin guiones repetidos ni en los extremos. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(COMBINING_MARKS_PATTERN, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/&/g, ' et ')
    .replace(NON_ALPHANUMERIC_PATTERN, '-')
    .replace(EDGE_DASHES_PATTERN, '');
}

const REGION_ROWS: readonly (readonly [string, string])[] = [
  ['11', 'Île-de-France'],
  ['24', 'Centre-Val de Loire'],
  ['27', 'Bourgogne-Franche-Comté'],
  ['28', 'Normandie'],
  ['32', 'Hauts-de-France'],
  ['44', 'Grand Est'],
  ['52', 'Pays de la Loire'],
  ['53', 'Bretagne'],
  ['75', 'Nouvelle-Aquitaine'],
  ['76', 'Occitanie'],
  ['84', 'Auvergne-Rhône-Alpes'],
  ['93', "Provence-Alpes-Côte d'Azur"],
  ['94', 'Corse'],
];

/** Las 13 regiones de Francia metropolitana (códigos INSEE), en este orden. */
export const REGIONS: readonly Region[] = REGION_ROWS.map(([code, name]) => ({
  code,
  name,
  slug: slugify(name),
}));

// Código, nombre oficial y región (división de 2016, la que usa el flujo de datos).
const DEPARTMENT_ROWS: readonly (readonly [string, string, string])[] = [
  ['01', 'Ain', '84'], ['02', 'Aisne', '32'], ['03', 'Allier', '84'],
  ['04', 'Alpes-de-Haute-Provence', '93'], ['05', 'Hautes-Alpes', '93'],
  ['06', 'Alpes-Maritimes', '93'], ['07', 'Ardèche', '84'], ['08', 'Ardennes', '44'],
  ['09', 'Ariège', '76'], ['10', 'Aube', '44'], ['11', 'Aude', '76'], ['12', 'Aveyron', '76'],
  ['13', 'Bouches-du-Rhône', '93'], ['14', 'Calvados', '28'], ['15', 'Cantal', '84'],
  ['16', 'Charente', '75'], ['17', 'Charente-Maritime', '75'], ['18', 'Cher', '24'],
  ['19', 'Corrèze', '75'], ['21', "Côte-d'Or", '27'], ['22', "Côtes-d'Armor", '53'],
  ['23', 'Creuse', '75'], ['24', 'Dordogne', '75'], ['25', 'Doubs', '27'],
  ['26', 'Drôme', '84'], ['27', 'Eure', '28'], ['28', 'Eure-et-Loir', '24'],
  ['29', 'Finistère', '53'], ['2A', 'Corse-du-Sud', '94'], ['2B', 'Haute-Corse', '94'],
  ['30', 'Gard', '76'], ['31', 'Haute-Garonne', '76'], ['32', 'Gers', '76'],
  ['33', 'Gironde', '75'], ['34', 'Hérault', '76'], ['35', 'Ille-et-Vilaine', '53'],
  ['36', 'Indre', '24'], ['37', 'Indre-et-Loire', '24'], ['38', 'Isère', '84'],
  ['39', 'Jura', '27'], ['40', 'Landes', '75'], ['41', 'Loir-et-Cher', '24'],
  ['42', 'Loire', '84'], ['43', 'Haute-Loire', '84'], ['44', 'Loire-Atlantique', '52'],
  ['45', 'Loiret', '24'], ['46', 'Lot', '76'], ['47', 'Lot-et-Garonne', '75'],
  ['48', 'Lozère', '76'], ['49', 'Maine-et-Loire', '52'], ['50', 'Manche', '28'],
  ['51', 'Marne', '44'], ['52', 'Haute-Marne', '44'], ['53', 'Mayenne', '52'],
  ['54', 'Meurthe-et-Moselle', '44'], ['55', 'Meuse', '44'], ['56', 'Morbihan', '53'],
  ['57', 'Moselle', '44'], ['58', 'Nièvre', '27'], ['59', 'Nord', '32'], ['60', 'Oise', '32'],
  ['61', 'Orne', '28'], ['62', 'Pas-de-Calais', '32'], ['63', 'Puy-de-Dôme', '84'],
  ['64', 'Pyrénées-Atlantiques', '75'], ['65', 'Hautes-Pyrénées', '76'],
  ['66', 'Pyrénées-Orientales', '76'], ['67', 'Bas-Rhin', '44'], ['68', 'Haut-Rhin', '44'],
  ['69', 'Rhône', '84'], ['70', 'Haute-Saône', '27'], ['71', 'Saône-et-Loire', '27'],
  ['72', 'Sarthe', '52'], ['73', 'Savoie', '84'], ['74', 'Haute-Savoie', '84'],
  ['75', 'Paris', '11'], ['76', 'Seine-Maritime', '28'], ['77', 'Seine-et-Marne', '11'],
  ['78', 'Yvelines', '11'], ['79', 'Deux-Sèvres', '75'], ['80', 'Somme', '32'],
  ['81', 'Tarn', '76'], ['82', 'Tarn-et-Garonne', '76'], ['83', 'Var', '93'],
  ['84', 'Vaucluse', '93'], ['85', 'Vendée', '52'], ['86', 'Vienne', '75'],
  ['87', 'Haute-Vienne', '75'], ['88', 'Vosges', '44'], ['89', 'Yonne', '27'],
  ['90', 'Territoire de Belfort', '27'], ['91', 'Essonne', '11'], ['92', 'Hauts-de-Seine', '11'],
  ['93', 'Seine-Saint-Denis', '11'], ['94', 'Val-de-Marne', '11'], ['95', "Val-d'Oise", '11'],
];

/** Los 96 departamentos metropolitanos (01–95 con 2A y 2B, sin 20), ordenados por código. */
export const DEPARTMENTS: readonly Department[] = DEPARTMENT_ROWS.map(
  ([code, name, regionCode]) => ({ code, name, slug: slugify(name), regionCode }),
);

export function findRegionByCode(code: string): Region | null {
  return REGIONS.find((region) => region.code === code) ?? null;
}

export function findRegionBySlug(slug: string): Region | null {
  return REGIONS.find((region) => region.slug === slug) ?? null;
}

export function findDepartmentByCode(code: string): Department | null {
  return DEPARTMENTS.find((department) => department.code === code) ?? null;
}

export function findDepartmentBySlug(slug: string): Department | null {
  return DEPARTMENTS.find((department) => department.slug === slug) ?? null;
}

/**
 * Departamento a partir del código postal: '20000'–'20199' → '2A', '20200'–'20999' → '2B';
 * el resto, los dos primeros dígitos ('01000' → '01', '75012' → '75').
 * Devuelve null si el código no tiene 5 dígitos o el departamento no existe en DEPARTMENTS.
 */
export function departmentCodeFromPostalCode(postalCode: string): string | null {
  if (!POSTAL_CODE_PATTERN.test(postalCode)) return null;
  let code = postalCode.slice(0, DEPARTMENT_CODE_LENGTH);
  if (code === CORSICA_POSTAL_PREFIX) {
    code = Number(postalCode) <= CORSICA_SOUTH_LAST_POSTAL_CODE ? '2A' : '2B';
  }
  return findDepartmentByCode(code) ? code : null;
}

function geoCapitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function geoToTitleCase(text: string): string {
  let isFirstWord = true;
  return text.replace(PLACE_TOKEN_PATTERN, (token) => {
    if (!WORD_START_PATTERN.test(token)) return token;
    const lower = token.toLowerCase();
    const keepLower = !isFirstWord && LOWERCASE_PLACE_WORDS.has(lower);
    isFirstWord = false;
    return keepLower ? lower : geoCapitalize(lower);
  });
}

/**
 * Normaliza un nombre de municipio o una dirección: recorta, colapsa espacios y, si está entero
 * en mayúsculas, lo pasa a "tipo título" en francés ('SAINT-DENIS-LÈS-BOURG' → 'Saint-Denis-lès-Bourg',
 * 'ROUTE NATIONALE 7' → 'Route Nationale 7'). Las palabras de/du/des/la/le/les/lès/sur/sous/en/et/aux/au/l'/d'
 * van en minúscula salvo al principio. Si ya tiene minúsculas, lo devuelve sin cambiar las letras.
 */
export function normalizePlaceText(text: string): string {
  const collapsed = text.trim().replace(/\s+/g, ' ');
  const hasLetters = collapsed !== collapsed.toLowerCase() || collapsed !== collapsed.toUpperCase();
  // Los textos escritos enteros en mayúsculas o enteros en minúsculas no tienen mayúsculas fiables.
  const isSingleCase = collapsed === collapsed.toUpperCase() || collapsed === collapsed.toLowerCase();
  return hasLetters && isSingleCase ? geoToTitleCase(collapsed) : collapsed;
}
