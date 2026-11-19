# ARCHITECTURE — Prix des carburants (Francia)

Web estática de precios de carburantes de Francia, en francés, publicada en `https://ododex.com/fr/prix-carburants`. Es un **port** de la web española `../gasolineras` (publicada en `/es/gasolineras`): misma estructura, mismo aspecto y mismo funcionamiento, con datos franceses.

Este documento es el contrato que recibe quien implementa cada módulo. Debe bastar junto con el código de referencia de `../gasolineras` que cita cada módulo.

## 1. Objetivo y alcance

### Qué hace

- **Buscador** en la portada: todas las estaciones de Francia en un mapa agrupado por zoom y en una lista filtrable (carburante, departamento, texto, radio GPS) y ordenable (precio, distancia, nombre). Cinta de estadísticas nacionales (mínimo, media, máximo, ahorro en un depósito de 50 L).
- **Páginas por departamento** (`/departement/[departement]`), **por municipio** (`/departement/[departement]/[commune]`) y **ficha de estación** (`/station/[id]-[slug]`), con el mismo contenido que sus equivalentes españolas (`/provincia/...`, `/provincia/.../...`, `/gasolinera/...`).
- **Histórico de precios** semanal desde el lunes 4 de enero de 2016: páginas `/historique` (Francia), `/historique/region/[region]` y `/historique/departement/[departement]`, y gráfica en cada ficha de estación.
- **Textos legales** en francés: `/mentions-legales`, `/confidentialite`, `/cookies`.
- `sitemap.xml`, canonical, Open Graph y JSON-LD como la web española. AdSense con los mismos bloques manuales (`AdSlot`).
- Todo el texto visible en **francés de Francia**, con *vouvoiement*, redactado con naturalidad (no traducción literal). Fechas y números con formato `fr-FR` (`2,109 €/l`, `19 novembre 2026`).
- Datos descargados en cada compilación (`npm run preparar-datos`) y un comando `npm run historique` que actualiza el histórico. Ambos se encadenan en la actualización diaria de `ododex-sitio`.

### Qué no hace

- **No hay marcas ni logos de estación**: los datos franceses no traen el rótulo. Desaparecen el filtro por marca, los logos, el histórico por marca y `brands.ts`. La estación se nombra por su dirección y municipio.
- No muestra rupturas de stock ni servicios de lavado como filtros; los servicios solo se listan en la ficha.
- No cubre los departamentos de ultramar (el flujo oficial no los trae).
- No hay servidor ni rutas API: exportación estática (`output: 'export'`), como el resto de webs de Ododex.
- No usa R2: las particiones del histórico por estación se publican como ficheros estáticos de la propia web.
- El histórico no hace medias semanales reales: cada punto es el precio vigente el lunes.
- No toca `../gasolineras`.

## 2. Fuentes de datos

### 2.1 Flujo instantáneo (precios de hoy)

- URL: `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/exports/json` (unos 29 MB, array JSON, unas 9 800 estaciones). Licencia Ouverte Etalab 2.0; atribución: « Ministère de l'Économie – prix-carburants.gouv.fr ».
- Muestra real reducida (24 registros variados): `tests/fixtures/prix-sample.json`. Campos que se usan de cada registro:

| Campo | Ejemplo | Uso |
|---|---|---|
| `id` | `56580001` (número) | Identificador; se pasa a `string` |
| `cp` | `"56580"` | Código postal |
| `pop` | `"R"` / `"A"` | `R` = route, `A` = autoroute |
| `adresse` | `"16 rue chateaubriand"`, `"ROUTE NATIONALE 7"` | Dirección |
| `ville` | `"Bréhan"` o `null` | Municipio. **Registro sin `ville` → se descarta** |
| `geom` | `{ "lon": -2.69, "lat": 48.061 }` | Coordenadas (fuera del rectángulo de Francia metropolitana → descarta) |
| `code_departement` | `"56"`, `"2A"` o `null` | Departamento; si es `null`, se deduce del código postal |
| `{carb}_prix`, `{carb}_maj` | `2.109`, `"2026-11-12T06:55:20+00:00"` | Precio y fecha de actualización (UTC) por carburante; `{carb}` ∈ `gazole, sp95, e10, sp98, e85, gplc` |
| `horaires_automate_24_24` | `"Oui"` / `"Non"` | Automate 24/24 |
| `horaires` | cadena JSON: `{"@automate-24-24":"1","jour":[{"@id":"1","@nom":"Lundi","@ferme":"","horaire":{"@ouverture":"06.30","@fermeture":"20.30"}}, ...]}` | Horario por día. `horaire` puede faltar o ser un array de tramos. Puede ser `null` |
| `services_service` | `["Lavage automatique", ...]` o `null` | Servicios |

- `region` y `code_region` del registro **no se usan**: la región sale de la tabla de departamentos (`geo.ts`), así es coherente con el histórico.

### 2.2 Ficheros anuales (histórico)

- URL: `https://donnees.roulez-eco.fr/opendata/annee/{yyyy}`. Devuelve un **zip** (22–33 MB) con un único XML `PrixCarburants_annuel_{yyyy}.xml` (275–375 MB) en **ISO-8859-1**, con entidades (`&#xE8;`). Existen al menos 2016–2026; el del año en curso se regenera cada día.
- Estructura (una línea por elemento):

```xml
<?xml version="1.0" encoding="ISO-8859-1" standalone="yes"?><pdv_liste>
<pdv id="1000001" latitude="4620114" longitude="519791" cp="01000" pop="R">
  <adresse>596 AVENUE DE TREVOUX</adresse>
  <ville>SAINT-DENIS-L&#xE8;S-BOURG</ville>
  ...
  <prix nom="Gazole" id="1" maj="2016-01-02T09:01:58" valeur="1026"/>
  <prix nom="Gazole" id="1" maj="2016-01-04T10:01:35" valeur="1026"/>
  ...
</pdv>
```

- **Formato de `valeur`**: en 2016 es un entero en milésimas (`"1026"` = 1,026 €); en 2026 un decimal en euros (`"1.638"`, `"1.67"`). Regla: si contiene `.`, euros decimales; si no, entero, y si es ≥ 100 son milésimas, si es < 100 son euros.
- **Los `<prix>` no vienen ordenados por fecha** dentro de una estación (hay casos como `2016-01-09T09:01:47` seguido de `2016-01-09T09:01:02`). Hay que ordenar.
- `maj` puede venir como `yyyy-mm-ddThh:mm:ss` o `yyyy-mm-dd hh:mm:ss`: se normaliza a la forma con `T`. Es hora local francesa; se compara como texto.
- Nombres de carburante en `nom`: `Gazole`, `SP95`, `E10`, `SP98`, `E85`, `GPLc`.
- Para inspeccionar ficheros reales ya descargados (datos no confiables, solo lectura): `C:\Users\Usuario\AppData\Local\Temp\claude\da7903b362a7821f\7d41cbb1-568e-4318-bb9f-108626452b3f\scratchpad\dl-hist\` (`2016.zip`, `2026.zip` y sus XML extraídos en `x16/` y `x26/`). Para leer el principio de un XML usa `head -c`, nunca lo cargues entero.

## 3. Convenciones del proyecto

- Stack igual que `../gasolineras`: Next.js 16.4.6 (App Router, `output: 'export'`, `basePath: '/fr/prix-carburants'`, `images.unoptimized`), React 19.3.0, Tailwind 4.3.3 por PostCSS, Leaflet 1.9.4, lucide-react. **Sin dependencias nuevas.** El build usa `next build --webpack` (ver `../gasolineras/ARCHITECTURE.md`, E.4).
- **Identificadores en inglés** (`Station`, `departmentSlug`, `communeSlug`). Comentarios y documentación en español. Texto visible en francés. Los mensajes de error de scripts y de consola, en español (los lee el titular).
- Los módulos de `src/lib` que se prueban con `node --test` **no pueden usar el alias `@/`** en importaciones de valores: usan rutas relativas **con extensión `.ts`** y `import type` para tipos. Los componentes `.tsx` sí usan `@/`.
- Pruebas: `node --experimental-strip-types --no-warnings --test tests/<fichero>.test.ts`, sin red. `npm test` las ejecuta todas.
- Rutas dinámicas: `generateStaticParams`, `export const dynamicParams = false`, sin `revalidate`. `sitemap.ts` con `export const dynamic = 'force-static'`.
- Enlaces: a las páginas solo HTML (`/station/*` y `/departement/*/*`) **siempre** con `InternalLink` (`src/components/InternalLink.tsx`), nunca con `next/link` (lo comprueba `tests/links.test.ts`). Ningún `<a href="/...">` interno sin `assetPath`.
- Ya existen y no se cambian salvo que un módulo lo diga: `src/lib/site.ts` (`SITE_NAME`, `SECTION_NAME = 'Prix des carburants'`, `BASE_PATH`, `getSiteUrl`, `absoluteUrl`, `assetPath`, `isHtmlOnlyRoute`), `src/lib/stationClustering.ts`, `src/lib/adsense.ts`, `src/lib/legal.ts`, `src/components/AdSenseScript.tsx`, `AdSlot.tsx`, `InternalLink.tsx`, `BrandLogo.tsx`, `src/app/globals.css`, `src/app/icon.svg`, `public/brand/`.
- Sin números mágicos: constantes con nombre. Funciones cortas. Errores explícitos que digan qué falló y cómo corregirlo.
- Ningún texto promete tiempo real: la web se regenera una vez al día (prohibido « temps réel », « en direct », « toutes les 30 minutes »; lo comprueba `tests/texts.test.ts`, módulo F4).

## 4. Rutas públicas

Todas bajo `https://ododex.com/fr/prix-carburants`.

| Ruta | Equivalente español | Solo HTML |
|---|---|---|
| `/` | `/` | no |
| `/departement/[departement]` | `/provincia/[provincia]` | no |
| `/departement/[departement]/[commune]` | `/provincia/[provincia]/[municipio]` | **sí** |
| `/station/[id]-[slug]` | `/gasolinera/[id]-[slug]` | **sí** |
| `/historique` | `/historico` | no |
| `/historique/region/[region]` | `/historico/comunidad/[comunidad]` | no |
| `/historique/departement/[departement]` | `/historico/provincia/[provincia]` | no |
| `/mentions-legales`, `/confidentialite`, `/cookies` | `/aviso-legal`, `/privacidad`, `/cookies` | no |
| `/sitemap.xml` | `/sitemap.xml` | — |
| `/datos/stations.json` | `/datos/estaciones.json` | fichero |
| `/historique-stations/{codeDepartement}/{yyyy}.json` | R2 `estaciones/{idProvincia}/{yyyy}.json` | fichero |

## 5. Módulos

Orden y dependencias en la sección 6. Cada módulo lista los ficheros que crea; **solo puede crear o modificar esos**.

---

### F1 — Geografía, carburantes y formato (`src/lib/geo.ts`, `src/lib/fuels.ts`, `src/lib/format.ts`)

**Responsabilidad:** tablas fijas de Francia (regiones y departamentos), carburantes y funciones puras de texto y formato en francés.

**Dependencias:** ninguna.

**Ficheros:** `src/lib/geo.ts`, `src/lib/fuels.ts`, `src/lib/format.ts`, `tests/geo.test.ts`, `tests/fuels.test.ts`, `tests/format.test.ts`.

#### `src/lib/geo.ts`

```ts
export interface Region { code: string; name: string; slug: string }
export interface Department { code: string; name: string; slug: string; regionCode: string }

/** Las 13 regiones de Francia metropolitana (códigos INSEE), en este orden. */
export const REGIONS: readonly Region[];
/** Los 96 departamentos metropolitanos (01–95 con 2A y 2B, sin 20), ordenados por código. */
export const DEPARTMENTS: readonly Department[];

export function findRegionByCode(code: string): Region | null;
export function findRegionBySlug(slug: string): Region | null;
export function findDepartmentByCode(code: string): Department | null;
export function findDepartmentBySlug(slug: string): Department | null;

/**
 * Departamento a partir del código postal: '20000'–'20199' → '2A', '20200'–'20999' → '2B';
 * el resto, los dos primeros dígitos ('01000' → '01', '75012' → '75').
 * Devuelve null si el código no tiene 5 dígitos o el departamento no existe en DEPARTMENTS.
 */
export function departmentCodeFromPostalCode(postalCode: string): string | null;

/** Slug ASCII: minúsculas, sin tildes, '&' → 'et', todo lo que no sea [a-z0-9] → '-', sin guiones repetidos ni en los extremos. */
export function slugify(text: string): string;

/**
 * Normaliza un nombre de municipio o una dirección: recorta, colapsa espacios y, si está entero
 * en mayúsculas, lo pasa a "tipo título" en francés ('SAINT-DENIS-LÈS-BOURG' → 'Saint-Denis-lès-Bourg',
 * 'ROUTE NATIONALE 7' → 'Route Nationale 7'). Las palabras de/du/des/la/le/les/lès/sur/sous/en/et/aux/au/l'/d'
 * van en minúscula salvo al principio. Lo mismo si está entero en minúsculas ('16 rue chateaubriand' → '16 Rue Chateaubriand'). Si mezcla mayúsculas y minúsculas, lo devuelve sin cambiar las letras.
 */
export function normalizePlaceText(text: string): string;
```

Regiones (código, nombre, slug):

| code | name | slug |
|---|---|---|
| 11 | Île-de-France | ile-de-france |
| 24 | Centre-Val de Loire | centre-val-de-loire |
| 27 | Bourgogne-Franche-Comté | bourgogne-franche-comte |
| 28 | Normandie | normandie |
| 32 | Hauts-de-France | hauts-de-france |
| 44 | Grand Est | grand-est |
| 52 | Pays de la Loire | pays-de-la-loire |
| 53 | Bretagne | bretagne |
| 75 | Nouvelle-Aquitaine | nouvelle-aquitaine |
| 76 | Occitanie | occitanie |
| 84 | Auvergne-Rhône-Alpes | auvergne-rhone-alpes |
| 93 | Provence-Alpes-Côte d'Azur | provence-alpes-cote-d-azur |
| 94 | Corse | corse |

Departamentos: los 96 oficiales con su nombre con tildes y guiones (`Ain`, `Aisne`, …, `Côtes-d'Armor`, `Corse-du-Sud`, `Haute-Corse`, …, `Val-d'Oise`), su región según la división de 2016, y `slug = slugify(name)` (`cotes-d-armor`). Contrasta los nombres con los campos `departement`/`code_departement` del fichero real `C:\Users\Usuario\Downloads\prix-des-carburants-en-france-flux-instantane-v2.json` (lectura con un script de Node que solo extraiga los pares distintos; no lo cargues en tu contexto).

#### `src/lib/fuels.ts`

```ts
export const FUEL_TYPES = ['gazole', 'e10', 'sp95', 'sp98', 'e85', 'gplc'] as const;
export type FuelType = (typeof FUEL_TYPES)[number];
export type FuelPrices = Record<FuelType, number | null>;   // €/l

export const DEFAULT_FUEL: FuelType = 'gazole';
export const FUEL_LABELS: Record<FuelType, string>;        // 'Gazole', 'SP95-E10', 'SP95', 'SP98', 'Superéthanol E85', 'GPLc'
export const FUEL_SHORT_LABELS: Record<FuelType, string>;  // 'Gazole', 'E10', 'SP95', 'SP98', 'E85', 'GPLc'
/** Nombre del atributo `nom` de los XML anuales → FuelType ('Gazole' → 'gazole', 'GPLc' → 'gplc'). */
export function fuelFromSourceName(name: string): FuelType | null;

export const MIN_VALID_PRICE = 0.5;   // €/l
export const MAX_VALID_PRICE = 4.0;   // €/l
/** Número finito dentro de [MIN_VALID_PRICE, MAX_VALID_PRICE] redondeado a 3 decimales, o null (acepta number o string con punto o coma). */
export function parseValidPrice(value: unknown): number | null;
export function emptyFuelPrices(): FuelPrices; // todos null
```

#### `src/lib/format.ts` (francés, `Intl` con `fr-FR`)

```ts
/** 2.109 → '2,109 €' (siempre 3 decimales). */
export function formatPrice(price: number): string;
/** 2.109 → '2,109 €/l'. */
export function formatPricePerLiter(price: number): string;
/** Importe en euros con 2 decimales: 4.5 → '4,50 €'. */
export function formatEuros(value: number): string;
/** Distancia: < 0,1 km → 'moins de 100 m'; si no, 1 decimal: '3,4 km'. */
export function formatKm(km: number): string;
/** ISO con zona → fecha y hora en Europe/Paris: '2026-11-19T10:09:48+00:00' → '19/11/2026 à 11:09'. */
export function formatDateTimeParis(iso: string): string;
/** ISO 'yyyy-mm-dd' → '4 juillet 2022' (sin zona: fecha civil). */
export function formatIsoDateFr(iso: string): string;
/** Número con separador de miles francés: 9825 → '9 825' (espacio fino U+202F, el de Intl fr-FR). */
export function formatInteger(value: number): string;
```

**Aceptación:** 13 regiones y 96 departamentos con códigos y slugs únicos, todo `regionCode` existe; `findDepartmentByCode('2A').name === 'Corse-du-Sud'`; `departmentCodeFromPostalCode` con '20137' → '2A', '20200' → '2B', '75012' → '75', '01000' → '01', '9700' → null, '97100' → null; `slugify("Côtes-d'Armor") === 'cotes-d-armor'`, `slugify('Évry-Grégy-sur-Yerre') === 'evry-gregy-sur-yerre'`; `normalizePlaceText` con los dos ejemplos de la firma y con un texto mixto que no cambia; `parseValidPrice` con '1.638', 1.638, '2,1', 0.3, 5, NaN, null, ''; `fuelFromSourceName` con los 6 nombres y uno desconocido; formatos con los ejemplos de las firmas (en `formatDateTimeParis` prueba también una fecha de verano: `'2026-07-01T10:00:00+00:00'` → `'01/07/2026 à 12:00'`).

---

### F2 — Datos de hoy (`src/lib/prixCarburants.ts`, `src/lib/prixSnapshot.ts`, `src/lib/stationPayload.ts`, `scripts/preparar-datos.ts`)

**Responsabilidad:** descargar el flujo instantáneo, normalizarlo y agregarlo por departamento, municipio y país; generar el JSON ligero del buscador.

**Dependencias:** F1.

**Referencia:** `../gasolineras/src/lib/miteco.ts`, `mitecoSnapshot.ts`, `stationPayload.ts`, `scripts/preparar-datos.ts` y sus pruebas (`tests/miteco.test.js`, `mitecoSnapshot.test.ts`, `stationPayload.test.ts`).

**Ficheros:** los cuatro del título, `tests/prixCarburants.test.ts`, `tests/prixSnapshot.test.ts`, `tests/stationPayload.test.ts`.

#### `src/lib/prixCarburants.ts`

```ts
import type { FuelPrices, FuelType } from './fuels.ts';

export type RoadType = 'route' | 'autoroute';
export interface DayHours {
  day: string;              // 'Lundi' … 'Dimanche' (orden lunes→domingo)
  closed: boolean;          // '@ferme' === '1'
  ranges: string[];         // tramos 'hh:mm–hh:mm' ('06.30'/'20.30' → '06:30–20:30'); vacío si no hay
}
export interface Station {
  id: string;
  slug: string;             // slugify(`${city} ${address}`) recortado a 80 caracteres sin cortar palabra
  address: string;          // normalizePlaceText(adresse)
  postalCode: string;
  city: string;             // normalizePlaceText(ville)
  communeSlug: string;      // slugify(city)
  departmentCode: string;
  department: string;
  departmentSlug: string;
  regionCode: string;
  region: string;
  regionSlug: string;
  roadType: RoadType;
  lat: number;
  lon: number;
  is24h: boolean;           // horaires_automate_24_24 === 'Oui'
  openingHours: DayHours[]; // [] si horaires es null o no se puede leer
  services: string[];       // services_service o []
  prices: FuelPrices;       // null si falta, no es válido o tiene más de STALE_PRICE_DAYS
  priceUpdatedAt: Record<FuelType, string | null>; // ISO del flujo; null si el precio es null
}
export interface FuelStats { min: number | null; max: number | null; avg: number | null; count: number; minStationId: string | null }
export type FuelStatsByType = Record<FuelType, FuelStats>;
export interface CommuneGroup { communeSlug: string; city: string; departmentSlug: string; department: string; stations: Station[] }
export interface DepartmentGroup { code: string; department: string; departmentSlug: string; regionSlug: string; stations: Station[]; communes: CommuneGroup[] }
export interface PrixSnapshot {
  updatedAt: string;                          // ISO: el {carb}_maj más reciente de todo el flujo
  stations: Station[];                        // orden de entrada
  stationsById: Map<string, Station>;
  departments: Map<string, DepartmentGroup>;  // clave departmentSlug; orden por código
  communes: Map<string, CommuneGroup>;        // clave `${departmentSlug}/${communeSlug}`
  nationalStats: FuelStatsByType;
}

/** Días máximos de antigüedad de un precio respecto a updatedAt; más antiguo → null. */
export const STALE_PRICE_DAYS = 30;
/** Rectángulo que contiene Francia metropolitana y Córcega. */
export const FRANCE_BOUNDS = { south: 41.2, north: 51.2, west: -5.3, east: 9.7 };

export function normalizeStation(raw: Record<string, unknown>, updatedAt: string): Station | null;
export function computeFuelStats(stations: readonly Station[]): FuelStatsByType;
/** Media redondeada a 3 decimales, mínimo y máximo; minStationId = id del mínimo (primero en empate). */
export function processRawPrixData(raw: readonly Record<string, unknown>[]): PrixSnapshot;
/** Resúmenes para listados: por cada carburante, mínimo y media. */
export interface AreaSummary { stationCount: number; min: Record<FuelType, number | null>; avg: Record<FuelType, number | null> }
export function summarizeStations(stations: readonly Station[]): AreaSummary;
export function stationPath(station: Pick<Station, 'id' | 'slug'>): string;    // '/station/56580001-brehan-16-rue-chateaubriand'
export function parseStationPathSlug(slug: string): string | null;              // '56580001-brehan-…' → '56580001'
```

Reglas de `normalizeStation` (devuelve `null` = descartada):
- sin `id`, sin `ville`, sin `geom` numérico o fuera de `FRANCE_BOUNDS` → null;
- departamento: `code_departement` si existe en `DEPARTMENTS`; si no, `departmentCodeFromPostalCode(cp)`; si tampoco → null;
- precio de cada carburante con `parseValidPrice({carb}_prix)`; se anula si `{carb}_maj` falta o es más antiguo que `updatedAt − STALE_PRICE_DAYS`;
- `horaires` es una cadena JSON; si no se puede parsear → `openingHours: []` (nunca lanza). `horaire` puede ser objeto o array.
- `updatedAt` de `processRawPrixData` es el máximo de todos los `{carb}_maj` válidos del flujo (antes de normalizar). Si no hay ninguno, lanza `Error('El flujo de precios no tiene ninguna fecha de actualización: revisa la descarga.')`.
- Municipios: se agrupan por `${departmentSlug}/${communeSlug}`; `city` del grupo = la grafía más frecuente entre sus estaciones (empate: orden alfabético). Departamentos sin estaciones no aparecen.

#### `src/lib/prixSnapshot.ts`

Mismo papel que `../gasolineras/src/lib/mitecoSnapshot.ts`:

```ts
export const PRIX_SOURCE_URL = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/exports/json';
export const PRIX_SNAPSHOT_FILE: string;   // data/cache/prix-snapshot.json
/** Descarga el flujo y escribe { downloadedAt, records }. Timeout 120 s y 3 reintentos (espera 5/15/45 s). Lanza Error con estado HTTP y URL. */
export async function downloadPrixSnapshot(file?: string): Promise<void>;
/** Lee el fichero y lo procesa con processRawPrixData. Errores que dicen "ejecuta npm run preparar-datos". */
export function loadPrixSnapshot(file?: string): PrixSnapshot;
/** Instantánea en memoria, leída una vez por proceso; nunca descarga. */
export async function getPrixData(): Promise<PrixSnapshot>;
```

Cabeceras de la descarga: `Accept: application/json`, `User-Agent: OdodexPrixCarburants/1.0`.

#### `src/lib/stationPayload.ts` y `scripts/preparar-datos.ts`

```ts
export type LightStation = Pick<Station,
  'id' | 'slug' | 'address' | 'postalCode' | 'city' | 'communeSlug' | 'department' | 'departmentSlug' | 'roadType' | 'lat' | 'lon' | 'prices'>;
export interface StationsPayload { updatedAt: string; stations: LightStation[] }
export function toLightStation(station: Station): LightStation;   // copia campo a campo, nunca spread
export function buildStationsPayload(snapshot: Pick<PrixSnapshot, 'updatedAt' | 'stations'>): StationsPayload;
```

`scripts/preparar-datos.ts`: descarga, procesa y escribe `public/datos/stations.json`; imprime en español un resumen (fecha, estaciones, departamentos, municipios, tamaño en MB). Código de salida 1 con mensaje claro si falla.

**Aceptación** (con `tests/fixtures/prix-sample.json`, sin red): descarta los registros sin `ville` y conserva el resto con el número esperado; departamento deducido del CP cuando `code_departement` es null; Córcega 2A/2B; `roadType` autoroute; precio más antiguo de 30 días anulado (la muestra tiene uno con `gazole_maj` anterior a septiembre); horarios con tramos, día cerrado y `horaires` null; servicios; `updatedAt` máximo; agrupación por municipio y departamento; estadísticas (min, max, avg redondeada, count, minStationId); `stationPath`/`parseStationPathSlug` ida y vuelta; `toLightStation` devuelve exactamente las 12 claves; `buildStationsPayload` conserva orden y fecha; `loadPrixSnapshot` con fichero ausente o JSON roto lanza el error esperado (fichero temporal en `os.tmpdir()`).

---

### F3 — Histórico: formato, lectura de ficheros anuales, agregación y script

**Responsabilidad:** convertir los ficheros anuales en series semanales por zona (Francia, región, departamento) y por estación, con caché por año.

**Dependencias:** F1.

**Referencia:** `../gasolineras/src/lib/historicoFormat.ts`, `historicoBuild.ts`, `scripts/historico.ts` y sus pruebas; diseño en `../gasolineras/ARCHITECTURE.md`, Parte 2 (H.3, H.4: H1–H3).

**Ficheros:** `src/lib/historiqueFormat.ts`, `src/lib/annualArchive.ts`, `src/lib/historiqueBuild.ts`, `scripts/historique.ts`, `tests/historiqueFormat.test.ts`, `tests/annualArchive.test.ts`, `tests/historiqueBuild.test.ts`, `tests/historiqueScript.test.ts`, `tests/fixtures/annuel-*.xml` (pequeños, hechos a mano o recortados de los reales, en ISO-8859-1).

#### `src/lib/historiqueFormat.ts`

Port de `historicoFormat.ts` con estos cambios:

```ts
export const HISTORY_FUELS = ['gazole', 'e10', 'sp95', 'sp98'] as const;  // subconjunto de FuelType
export type HistoryFuel = (typeof HISTORY_FUELS)[number];
export const HISTORY_START_DATE = '2016-01-04';
export const HISTORY_FIRST_YEAR = 2016;
export type PriceMilli = number;
export type FuelSeries = (PriceMilli | null)[];
export type AreaKind = 'france' | 'region' | 'departement';
export interface AreaFuelSeries { avg: FuelSeries; min: FuelSeries; count: number[] }
export interface AreaHistory { kind: AreaKind; slug: string; name: string; parentSlug?: string; series: Record<HistoryFuel, AreaFuelSeries> }
// slug: 'france' | slug de región | slug de departamento. parentSlug: solo departamento, slug de su región.
export interface AreaIndexEntry { kind: AreaKind; slug: string; name: string; parentSlug?: string }
export interface HistoryIndexFile { version: 1; generatedAt: string; weeks: string[]; areas: AreaIndexEntry[] }
export interface AreaHistoryFile { version: 1; weeks: string[]; area: AreaHistory }
export interface StationPartitionFile {
  version: 1;
  departmentCode: string;
  year: number;
  weeks: string[];
  stations: Record<string, Partial<Record<HistoryFuel, (number | null)[]>>>; // series delta; carburante omitido si todo null
}
export function priceToMilli(price: number): PriceMilli;
export function milliToPrice(value: PriceMilli): number;
export function listMondays(fromIso: string, toDate: Date): string[];
export function yearOfIso(iso: string): number;
export function encodeDeltaSeries(values: FuelSeries): (number | null)[];
export function decodeDeltaSeries(encoded: readonly (number | null)[]): FuelSeries;
export function mergeStationPartitions(files: readonly StationPartitionFile[], stationId: string): { weeks: string[]; series: Record<HistoryFuel, FuelSeries> };
```

(Se elimina `isoToMitecoDate`.)

#### `src/lib/annualArchive.ts` (lectura del zip y del XML; sin dependencias externas)

```ts
export interface ZipEntry { fileName: string; method: number; compressedSize: number; uncompressedSize: number; dataOffset: number }
/** Lee el directorio central (EOCD → central directory → local header) de un zip en memoria. Lanza Error si no es un zip válido o usa zip64. */
export function readZipEntries(zip: Buffer): ZipEntry[];
/** Stream de los bytes descomprimidos de una entrada (método 8 → zlib.createInflateRaw; método 0 → tal cual). Otro método → Error. */
export function openZipEntry(zip: Buffer, entry: ZipEntry): NodeJS.ReadableStream;

export interface PriceRecord { fuel: HistoryFuel; maj: string; priceMilli: PriceMilli }  // maj 'yyyy-mm-ddThh:mm:ss'
export interface AnnualStation { id: string; postalCode: string; records: PriceRecord[] }  // records en orden de fichero
/** Convierte `valeur` a milésimas según la regla de 2.2 y valida con MIN/MAX_VALID_PRICE; null si no es válido. */
export function parseAnnualValue(valeur: string): PriceMilli | null;
/**
 * Recorre las líneas del XML (ya decodificadas como latin1) y llama a onStation al cerrar cada <pdv>.
 * Solo extrae id y cp del <pdv> y los <prix> de HISTORY_FUELS con valeur y maj válidos; ignora el resto.
 * Tolerante: un <prix> mal formado se salta, no lanza.
 */
export async function parseAnnualXml(lines: AsyncIterable<string> | Iterable<string>, onStation: (station: AnnualStation) => void): Promise<void>;
/** Abre el zip de un año y pasa cada estación a onStation (readline sobre openZipEntry con encoding 'latin1'). */
export async function readAnnualZip(zipFile: string, onStation: (station: AnnualStation) => void): Promise<void>;
```

#### `src/lib/historiqueBuild.ts` (puro salvo tipos)

```ts
/** Último precio conocido de cada carburante de una estación al terminar un año. */
export type CarryState = Partial<Record<HistoryFuel, { maj: string; priceMilli: PriceMilli }>>;
export const HISTORY_STALE_DAYS = 30;

/**
 * Valor de cada lunes: el registro con mayor maj que sea <= `${lunes}T23:59:59` (empate de maj: el último del fichero),
 * contando carryIn como anterior a todos; null si no hay o si su fecha es más de HISTORY_STALE_DAYS días anterior al lunes.
 * Devuelve las series (una posición por lunes de `mondays`) y el estado al final (último registro del año por carburante).
 */
export function weeklyStationSeries(
  records: readonly PriceRecord[], mondays: readonly string[], carryIn: CarryState | undefined
): { series: Record<HistoryFuel, FuelSeries>; carryOut: CarryState };

/** Resultado de un año, cacheado en data/historique/annees/{year}.json.gz. */
export interface YearResult {
  version: 1;
  year: number;
  weeks: string[];                         // lunes de ese año (recortados por --hasta en el año final)
  zipSize: number;                         // tamaño del zip con el que se calculó
  zipMtimeMs: number;
  areas: Record<string, Record<HistoryFuel, { sum: number[]; count: number[]; min: (PriceMilli | null)[] }>>; // clave `${kind}:${slug}`
  carryOut: Record<string, CarryState>;    // estación → estado al final del año
  partitionFiles: string[];                // rutas relativas escritas: `${departmentCode}/${year}.json`
}

/** Procesa un año entero. Área de cada estación: 'france' siempre; departamento por departmentCodeFromPostalCode(cp) y su región. Desconocido → solo France. */
export class YearAccumulator {
  constructor(year: number, weeks: readonly string[], carryIn: Readonly<Record<string, CarryState>>);
  addStation(station: AnnualStation): void;
  /** Particiones por departamento (estaciones con algún valor no nulo ese año; series en delta) y el YearResult sin zipSize/zipMtimeMs/partitionFiles. */
  build(): { partitions: StationPartitionFile[]; result: Omit<YearResult, 'zipSize' | 'zipMtimeMs' | 'partitionFiles'> };
}

/** Une los años (en orden) en el índice y los ficheros de zona. avg = Math.round(sum/count); count 0 → avg y min null. Zonas sin ningún dato se omiten.
 * Orden: France, regiones (orden de REGIONS), departamentos (orden de DEPARTMENTS). Nombres de geo.ts. */
export function mergeYearResults(results: readonly YearResult[], generatedAt: string): { index: HistoryIndexFile; areas: AreaHistoryFile[] };
```

#### `scripts/historique.ts`

`npm run historique -- [--hasta=yyyy-mm-dd] [--rehacer]`

1. `years = HISTORY_FIRST_YEAR .. yearOf(hasta ?? hoy)`; semanas de cada año = `listMondays(HISTORY_START_DATE, hasta ?? hoy)` filtradas por año.
2. Zip de cada año en `data/historique/zip/{yyyy}.zip`. Se descarga si falta o si **no es definitivo**: `isZipFinal(year, mtime)` = `mtime >= 3 de enero de year+1` (hora local). Timeout 300 s, 3 reintentos (5/15/45 s). Progreso: `[2026] descargado (33,1 MB)`.
3. Años en orden ascendente. Un año se reutiliza de la caché (`data/historique/annees/{yyyy}.json.gz`) si existe, tiene `version` 1, sus `weeks` coinciden, `zipSize`/`zipMtimeMs` coinciden con el zip actual, existen todos sus `partitionFiles` y no se pasó `--rehacer`, **y** el año anterior también se reutilizó. Si no, se procesa con `YearAccumulator` (carryIn = `carryOut` del año anterior, `{}` para 2016) y `readAnnualZip`, se escriben sus particiones en `public/historique-stations/{departmentCode}/{yyyy}.json` y su caché. Progreso: `[2019] 10 812 estaciones, 52 semanas, 95 particiones (48 s)`.
4. `mergeYearResults` → `data/historique/indice.json` y `data/historique/zones/{kind}/{slug}.json` (JSON sin sangría).
5. Resumen final. Código de salida 1 si algún año falló (descarga o lectura), tras procesar todo lo posible; los años posteriores a uno fallido no se procesan (les falta el carryIn) y se dice así. Si algún año falla, **no se reescriben** `indice.json` ni las zonas: se conservan los de la última ejecución buena en vez de publicar agregados parciales.

Funciones puras exportadas y probadas: `parseHistoriqueArgs(argv)` (error claro con opción desconocida o fecha inválida), `isZipFinal(year, mtime)`, `yearsToProcess(hasta)`.

Rendimiento esperado: un año se lee en 1–2 min; la primera vez (11 años) unos 15–25 min; después, cada día, solo el año en curso.

**Aceptación:** formato (lunes, delta, merge) como en España; `readZipEntries`/`openZipEntry` con un zip creado en la prueba (cabeceras escritas a mano + `zlib.deflateRawSync`); `parseAnnualValue` ('1026' → 1026, '1.638' → 1638, '1.67' → 1670, '2' → 2000, '0.2' → null, 'abc' → null); `parseAnnualXml` con fixtures de 2016 (enteros, desordenados) y 2026 (decimales, `&#xE8;`), `<prix>` sin `valeur` saltado, carburantes ajenos ignorados; `weeklyStationSeries` (registro el mismo lunes por la tarde cuenta, desorden, empate de maj, carryIn, caducidad de 30 días, carryOut); `YearAccumulator` (sum/count/min por zona, CP de Córcega, CP desconocido solo en France, particiones delta); `mergeYearResults` (concatenación de años, avg redondeada, zonas vacías omitidas, orden); funciones del script.

---

### F4 — Estructura común, buscador y portada

**Responsabilidad:** layout, cabecera, pie, migas, mapa, buscador y portada en francés, sobre los datos de F2.

**Dependencias:** F1, F2.

**Referencia:** en `../gasolineras/src`: `app/layout.tsx`, `app/not-found.tsx`, `app/page.tsx`, `components/Header.tsx`, `Footer.tsx`, `Breadcrumbs.tsx`, `ConsentSettingsButton.tsx`, `ClientMapWrapper.tsx`, `LeafletMap.tsx`, `LeafletMapToolbar.tsx`, `leafletMapHtml.ts`, `leafletMapLayers.ts`, `leafletMapTiles.ts`, `InteractiveGasFinder.tsx`, `GasFinderLogic.ts`, `GasFinderLoader.ts`, `GasFinderFilters.tsx`, `GasFinderFuelBrand.tsx`, `GasFinderResults.tsx`, `GasFinderStats.tsx`, `StationCard.tsx`, `lib/seo.ts`; pruebas `tests/gasFinderLogic.test.ts`, `tests/texts.test.ts`. Diseño en `../gasolineras/ARCHITECTURE.md`, Parte 1.

**Ficheros:** `src/app/layout.tsx`, `src/app/not-found.tsx`, `src/app/page.tsx`, `src/lib/seo.ts`, en `src/components/`: `Header.tsx`, `Footer.tsx`, `Breadcrumbs.tsx`, `ConsentSettingsButton.tsx`, `ClientMapWrapper.tsx`, `LeafletMap.tsx`, `LeafletMapToolbar.tsx`, `leafletMapHtml.ts`, `leafletMapLayers.ts`, `leafletMapTiles.ts`, `InteractiveGasFinder.tsx`, `GasFinderLogic.ts`, `GasFinderLoader.ts`, `GasFinderFilters.tsx`, `GasFinderFuelSelector.tsx` (sustituye a `GasFinderFuelBrand.tsx`, solo carburante), `GasFinderResults.tsx`, `GasFinderStats.tsx`, `StationCard.tsx`; `tests/gasFinderLogic.test.ts`, `tests/texts.test.ts`, `tests/seo.test.ts`.

Cambios respecto a la referencia:

- `layout.tsx`: `<html lang="fr">`; metadatos por defecto en francés (`title.template: '%s | Ododex'`); el mismo script de tema; `AdSenseScript`. Fuente igual.
- Cabecera: logo y nombre de sección « Prix des carburants » enlazando a la portada de la sección; fecha de actualización con `formatDateTimeParis(updatedAt)` (la prop se llama `updatedAt`); textos y `aria-label` en francés. Sin enlaces a las secciones españolas.
- Pie: enlaces « Accueil » (`/`), « Historique des prix » (`/historique`), « Mentions légales », « Confidentialité », « Cookies »; « Gérer les cookies » (`ConsentSettingsButton`, mismo comportamiento); fuente: « Données : prix-carburants.gouv.fr (Ministère de l'Économie), Licence Ouverte Etalab 2.0. Ododex n'est pas affilié au Ministère. » y « Les prix peuvent différer de ceux affichés à la pompe. » con la fecha de actualización.
- Buscador: filtro por carburante (los 6, por defecto `DEFAULT_FUEL`), por departamento (desplegable con los 96, por nombre « 56 – Morbihan »), texto (dirección, municipio, código postal; sin tildes ni mayúsculas) y radio GPS; orden `price_asc | price_desc | distance_asc | name_asc` (nombre = municipio y dirección). **Sin filtro de marca.** Datos de `assetPath('/datos/stations.json')` (`StationsPayload`).
- Tarjeta de estación y ventana del mapa: sin logo. Título = municipio; subtítulo = dirección y CP; distintivo « Autoroute » si `roadType === 'autoroute'`; precio del carburante elegido; enlace a la ficha con `InternalLink` y `stationPath`.
- Mapa: igual (agrupación por zoom con `stationClustering.ts`, móvil, teselas OSM/Esri), centrado en Francia (`[46.6, 2.4]`, zoom 6), textos en francés (« Ma position », « Itinéraire », etc.).
- Portada (`page.tsx`): H1 « Prix des carburants aujourd'hui en France », introducción, cinta de estadísticas (« Prix minimum », « Prix moyen », « Prix maximum », « Économie sur un plein de 50 L »), buscador, enlace « Voir l'évolution historique » a `/historique`, listado de los 96 departamentos con número de estaciones y precio medio del gazole y del E10, texto SEO propio, `AdSlot` (2 en la página, como en España). JSON-LD `BreadcrumbList` y `WebSite`/`Dataset` como la referencia.
- `seo.ts`: `getBreadcrumbSchema`, `getGasStationSchema` (sin `brand`; `address` con `addressCountry: 'FR'`, `postalCode`, `addressLocality`; `priceSpecification` por carburante con `priceCurrency: 'EUR'` y unidad litro; `openingHoursSpecification` cuando haya horarios), `getDatasetSchema` (igual que España; `isBasedOn` = `https://www.prix-carburants.gouv.fr/`, `license` = `https://www.etalab.gouv.fr/licence-ouverte-open-licence/`).
- 404 en francés (« Page introuvable ») con enlace a la portada.
- `tests/texts.test.ts`: prohíbe `/temps réel|en direct|30 minutes/i` en `src`.
- `GasFinderLogic.ts` se prueba igual que en España, sin marca.

Los enlaces de las tarjetas y el listado apuntan a rutas que crea F5 (`/departement/...`, `/station/...`): no hace falta que existan para las pruebas.

**Aceptación:** `npm test` (los suyos), `npx tsc --noEmit` sin errores **en sus ficheros** (los de F5–F7 aún no existen; no importes nada de ellos). La verificación en pantalla la hace la sesión principal.

---

### F5 — Páginas de departamento, municipio y estación

**Responsabilidad:** las tres páginas de datos y el sitemap.

**Dependencias:** F1, F2, F4.

**Referencia:** `../gasolineras/src/app/provincia/[provincia]/page.tsx`, `provincia/[provincia]/[municipio]/page.tsx`, `gasolinera/[slug]/page.tsx`, `app/sitemap.ts`, `lib/stationInsights.ts` y sus pruebas (`tests/stationInsights.test.ts`, `tests/gasolineraPage.test.ts`); diseño de la ficha en `../gasolineras/ARCHITECTURE.md`, sección S.

**Ficheros:** `src/app/departement/[departement]/page.tsx`, `src/app/departement/[departement]/[commune]/page.tsx`, `src/app/station/[slug]/page.tsx`, `src/app/sitemap.ts`, `src/lib/stationInsights.ts`, `tests/stationInsights.test.ts`, `tests/stationPage.test.ts`.

- **Departamento:** H1 « Prix des carburants dans le département {nom} ({code}) », las más baratas por carburante, medias del departamento frente a las nacionales, enlace a su página de histórico (`/historique/departement/{slug}`), directorio de municipios (con `InternalLink`) con número de estaciones y precio mínimo del gazole y el E10, enlaces a los otros departamentos de su región. Metadatos únicos (título con nombre y precio medio del gazole).
- **Municipio:** H1 « Stations-service les moins chères à {ville} ({code}) », tabla ordenada por precio legible sin JavaScript (carburante por defecto gazole, con columnas de los 6), comparativa frente al departamento, mapa del municipio, municipios cercanos (por distancia entre centroides, 6 como en España).
- **Ficha de estación:** H1 « Station-service {adresse} à {ville} »; precios de los 6 carburantes con su fecha de actualización (`formatDateTimeParis`) y los que no vende marcados « Non disponible »; comparativa de ahorro frente a la media del municipio, del departamento y nacional (depósito de 50 L); horario por día (tabla lunes→domingo, « Fermé », « Automate 24/24 » si `is24h`); servicios (lista); tipo de vía (« Sur route » / « Sur autoroute »); mapa « Itinéraire » con GPS; estaciones cercanas; resumen calculado (`stationSummary`); migas; JSON-LD `GasStation`. **Deja un comentario `{/* Historique: lo inserta F6 */}`** donde irá la sección de histórico (después de la comparativa), sin importar nada de F6.
- `stationInsights.ts`: port de la española con `Station`; sin marca; textos del resumen en francés; usa `formatEuros`/`formatKm` de `format.ts` (no los redefine).
- `slug` inexistente → `notFound()`. `generateStaticParams` desde `getPrixData()`.
- `sitemap.ts`: portada, departamentos, municipios, estaciones y legales (`/mentions-legales`, `/confidentialite`, `/cookies`), con `lastModified = updatedAt`. Deja una función `historiqueSitemapEntries()` que devuelve `[]` con un comentario « la completa F6 ».

**Aceptación:** pruebas de `stationInsights` (cercanas con distancia y límite, rango en el municipio, resumen sin marca y en francés) y de la ficha (`parseStationPathSlug` desde el parámetro); `npx tsc --noEmit` sin errores salvo en ficheros de F6/F7 si existieran.

---

### F6 — Histórico: lectura, gráfica, páginas e histórico en la ficha

**Responsabilidad:** mostrar el histórico generado por F3.

**Dependencias:** F3, F4, F5.

**Referencia:** `../gasolineras/src/lib/historicoStats.ts`, `historico.ts`, `historicoPageMeta.ts`, `priceChartGeometry.ts`, `stationHistoryLoader.ts`, `components/PriceHistoryChart.tsx`, `HistoricoArea*.tsx`, `StationHistory.tsx`, `app/historico/**`; pruebas `historicoStats.test.ts`, `priceChartGeometry.test.ts`, `stationHistoryLoader.test.ts`. Diseño en `../gasolineras/ARCHITECTURE.md`, H4–H7.

**Ficheros:** `src/lib/historiqueStats.ts`, `src/lib/historique.ts`, `src/lib/historiquePageMeta.ts`, `src/lib/priceChartGeometry.ts`, `src/lib/stationHistoryLoader.ts`, `src/components/PriceHistoryChart.tsx`, `src/components/HistoriqueArea.tsx`, `HistoriqueAreaCards.tsx`, `HistoriqueAreaLinks.tsx`, `HistoriqueAreaPage.tsx`, `HistoriqueAreaTable.tsx`, `StationHistory.tsx`, `src/app/historique/page.tsx`, `src/app/historique/region/[region]/page.tsx`, `src/app/historique/departement/[departement]/page.tsx`; modifica `src/app/station/[slug]/page.tsx` (solo para insertar `StationHistory` en el comentario de F5) y `src/app/sitemap.ts` (solo `historiqueSitemapEntries`); pruebas `tests/historiqueStats.test.ts`, `tests/priceChartGeometry.test.ts`, `tests/stationHistoryLoader.test.ts`.

- Lectura de `data/historique/indice.json` y `data/historique/zones/{kind}/{slug}.json` (`historique.ts`, mismo papel que `historico.ts`).
- Particiones por estación: `${assetPath('/historique-stations')}/{departmentCode}/{yyyy}.json` (sin variable de entorno). `StationHistory` recibe `{ stationId, departmentCode, departmentSlug, departmentName, stationName }`.
- Textos en francés: títulos « Prix historique du gazole et de l'essence en France (2016-2026) », « Évolution du prix des carburants en {Région} depuis 2016 », « Prix historique des carburants dans le département {nom} depuis 2016 »; descripción con gazole y E10 (precio actual, variación anual, máximo histórico con fecha); nota de metodología « Chaque point correspond au prix moyen de toutes les stations de la zone le lundi de la semaine. Source : prix-carburants.gouv.fr. »; estado vacío « L'historique n'a pas encore été généré ».
- Carburantes de la gráfica: gazole `#3b82f6`, e10 `#ff6600`, sp95 `#22c55e`, sp98 `#a855f7`; por defecto gazole y E10. Fechas con `formatIsoDateFr`, precios `formatPricePerLiter` (o `formatMilliEuro` en `historiqueStats`, '1,459 €/l'). Ejes en meses usan nombres franceses.
- Enlaces: Francia → 13 regiones; región → sus departamentos y Francia; departamento → su región, Francia y `/departement/{slug}` (prix d'aujourd'hui).
- JSON-LD `Dataset` con `getDatasetSchema`. Sitemap: las URLs de histórico con `lastModified` = última semana.

**Aceptación:** pruebas portadas (resúmenes, formatos franceses, geometría, cargador con 404 de un año = sin datos); `npx tsc --noEmit` sin errores.

---

### F7 — Textos legales en francés

**Responsabilidad:** las tres páginas legales.

**Dependencias:** F4 (`Header`, `Footer`, `Breadcrumbs`).

**Referencia:** `../gasolineras/src/app/aviso-legal/page.tsx`, `privacidad/page.tsx`, `cookies/page.tsx`, `components/LegalPage.tsx`, `lib/legal.ts` (ya copiado), diseño en `../gasolineras/ARCHITECTURE.md`, Parte 3.

**Ficheros:** `src/components/LegalPage.tsx`, `src/app/mentions-legales/page.tsx`, `src/app/confidentialite/page.tsx`, `src/app/cookies/page.tsx`, `tests/legalPages.test.ts`.

- Redactadas para un público francés: *mentions légales* conforme a la LCEN (art. 6 III: éditeur con los datos de `getTitular()`, directeur de la publication = el titular, hébergeur: Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis), *politique de confidentialité* conforme al RGPD (responsable, datos tratados: ninguno propio salvo los de AdSense y la geolocalización que no sale del navegador; derechos; reclamación ante la CNIL), *politique cookies* (AdSense, mensaje de consentimiento de Google IAB TCF v2.2, cómo retirarlo con « Gérer les cookies », `localStorage` solo para el tema). Fecha `FECHA_TEXTOS_LEGALES` de `legal.ts`.
- Campos vacíos del titular: `[à compléter : campo]` en vez de `[pendiente: campo]` (función local en `LegalPage.tsx` o en la página; **no modifiques `legal.ts`**).
- Sin `AdSlot` en las páginas legales.

**Aceptación:** prueba de que las tres páginas exportan `metadata` con título y canonical, y de que el texto de marcador es el francés; `npx tsc --noEmit` sin errores en sus ficheros.

---

### F8 — Integración en `ododex-sitio` (sesión principal)

- `config/secciones.json`: sección `/fr/prix-carburants`, proyecto `../prix-carburants-fr`, worker `ododex-prix-carburants`, `paginasSoloHtml: ["station/*", "departement/*/*"]`, `enPortada: false` (la portada está en español).
- `wrangler.prix-carburants.jsonc` igual que el de gasolineras con la route `ododex.com/fr/prix-carburants*`.
- `actualizar:gasolineras` añade, tras lo español: `npm run historique` en el proyecto francés, compilación y despliegue de `/fr/prix-carburants`.
- Documentación de `ododex-sitio/docs/` y `pruebas/README.md`.

## 6. Orden de implementación

1. **F1.**
2. **F2** y **F3** en paralelo (ficheros disjuntos; cada uno ejecuta solo sus pruebas).
3. **F4** y **F7** en paralelo (F7 solo usa los componentes de F4 por su ruta; si F4 aún no ha escrito `Header`/`Footer`, F7 espera y reintenta la comprobación de tipos).
4. **F5.**
5. Sesión principal: `npm run historique` con datos reales (15–25 min).
6. **F6.**
7. Integración: `npm run build`, verificación en pantalla (escritorio y móvil), F8, README.

## 7. Diseño de interfaz

Idéntico a `../gasolineras`: paleta negro/naranja con modo claro y oscuro (`globals.css`), tarjetas `--bg-card` con borde `--border-color`, naranja `--orange-primary`, controles táctiles de 40 px, filas de botones desplazables en horizontal, campos de 16 px en móvil, mapa al 70 % del alto en móvil. Mismas posiciones de `AdSlot`. Solo cambian los textos, la ausencia de logos de marca y los datos propios de Francia (horarios por día, servicios, distintivo « Autoroute »).

## 8. Configuración

| Variable | Uso | Por defecto |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Origen para canonical, Open Graph y sitemap | `http://localhost:3000` |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | Editor de AdSense | vacío: sin AdSense |
| `NEXT_PUBLIC_ADSENSE_SLOT` | Unidad de anuncio | vacío: sin bloques |

`ododex-sitio` pasa las tres en la compilación de producción. `config/titular.json` (no está en git) tiene los datos del titular para las páginas legales.

## 9. Límites conocidos

- Unas 15 500 páginas más ~1 060 particiones de histórico: unos 17 500 ficheros en el Worker (límite del plan gratuito: 20 000). `comprobarLimitesPages` de `ododex-sitio` avisa si se supera.
- Primeras semanas de 2016: las estaciones sin cambio de precio desde finales de 2015 salen sin dato hasta su primer cambio (no se lee 2015).
- Las estaciones sin municipio en el flujo (4 de 9 825 hoy) no se publican.
