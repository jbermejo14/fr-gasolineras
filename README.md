# Prix des carburants — France

Web estática, en francés, con el precio de los carburantes en cada estación de servicio de Francia metropolitana y su evolución semanal desde 2016. Se publica en `https://ododex.com/fr/prix-carburants` como parte de la red Ododex.

Es un port de la web española `../gasolineras` (`/es/gasolineras`). El diseño técnico completo, módulo a módulo, está en [ARCHITECTURE.md](ARCHITECTURE.md).

## Qué contiene

| Ruta | Contenido |
|---|---|
| `/` | Buscador con mapa agrupado por zoom, filtros (carburante, departamento, texto, radio GPS) y estadísticas nacionales |
| `/departement/[departement]` | Las estaciones más baratas, medias frente a Francia y directorio de municipios |
| `/departement/[departement]/[commune]` | Tabla de precios del municipio, mapa y municipios cercanos (solo HTML) |
| `/station/[id]-[slug]` | Ficha: precios con fecha, ahorro en un depósito de 50 L, horario, servicios, cercanas, histórico y mapa (solo HTML) |
| `/marque`, `/marque/[marque]` | Precios de hoy por red (TotalEnergies, Intermarché, Carrefour… 19 redes) |
| `/historique`, `/historique/region/[region]`, `/historique/departement/[departement]`, `/historique/marque/[marque]` | Evolución semanal de gazole, SP95-E10, SP95 y SP98 desde el 4 de enero de 2016 |
| `/mentions-legales`, `/confidentialite`, `/cookies` | Textos legales |

Unas 15 500 páginas y 1 056 ficheros de histórico por estación.

## Fuentes de datos

- **Precios de hoy:** flujo instantáneo de `data.economie.gouv.fr` (`prix-des-carburants-en-france-flux-instantane-v2`), Licence Ouverte Etalab 2.0. Lo descarga `npm run preparar-datos` en cada compilación.
- **Histórico:** ficheros anuales de `donnees.roulez-eco.fr/opendata/annee/{año}` (zip con un XML por año). Los procesa `npm run historique`.
- **Nombres y marcas:** referencial de Chiffrex en data.gouv.fr (a partir de OpenStreetMap, licencia ODbL, actualizado cada domingo). Lo descarga `preparar-datos` a `data/cache/enseignes.csv`; si falla, se usa la copia anterior. Cubre el 98 % de las estaciones. La atribución ODbL es obligatoria (pie y mentions légales) y `public/datos/stations.json` se publica bajo ODbL.
- **Logos:** `public/logos/`, 16 de las 19 redes (Wikimedia Commons, dominio público; Carrefour, BP y Shell copiados de la web española). Système U, Aire C y DATS 24 salen con distintivo de texto. Para añadir uno: fichero en `public/logos/` y su ruta en `src/lib/brands.ts`.

## Instalación

Requisitos: Node.js 22.6 o superior y npm 10.

```bash
npm install
cp config/titular.example.json config/titular.json   # y rellénalo (datos del editor para las páginas legales)
```

`config/titular.json` no está en git porque contiene datos personales.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas unitarias (sin red) |
| `npx tsc --noEmit` | Comprobación de tipos |
| `npm run preparar-datos` | Descarga el flujo instantáneo y escribe `data/cache/prix-snapshot.json` y `public/datos/stations.json` |
| `npm run historique` | Descarga los ficheros anuales que falten o no sean definitivos y regenera el histórico |
| `npm run build` | `preparar-datos` y exportación estática a `out/` |
| `npm run dev -- --webpack` | Servidor de desarrollo |

En producción no se compila desde aquí: se usa `ododex-sitio` (ver abajo).

### Histórico

`npm run historique -- [--hasta=yyyy-mm-dd] [--rehacer]`

- La primera vez descarga 11 ficheros anuales (unos 300 MB) y tarda un par de minutos. Después solo vuelve a descargar y procesar el año en curso (y el anterior hasta el 3 de enero).
- Cada punto es el precio vigente al final del lunes de esa semana; un precio sin cambios en más de 30 días se descarta.
- Si falla un año, no se reescriben el índice ni las zonas: se conservan los de la última ejecución buena. El comando termina con código 1; basta con repetirlo.

| Ruta | Contenido | ¿En git? |
|---|---|---|
| `data/historique/zip/` | Ficheros anuales descargados | No |
| `data/historique/annees/` | Resultado de cada año (caché) | No |
| `data/historique/indice.json`, `data/historique/zones/` | Series por Francia, región y departamento (las leen las páginas) | No |
| `public/historique-stations/{departamento}/{año}.json` | Histórico por estación (lo pide el navegador) | No |

Todo el histórico se puede regenerar desde la fuente pública, por eso no está en git.

## Publicación (ododex-sitio)

La sección está en `../ododex-sitio/config/secciones.json` con su propio Worker (`ododex-prix-carburants`, `wrangler.prix-carburants.jsonc`) y la route `ododex.com/fr/prix-carburants*`. Las páginas `station/*` y `departement/*/*` se publican solo como HTML.

```bash
# desde ../ododex-sitio (en Git Bash, antes: export MSYS_NO_PATHCONV=1)
npm run historique:fr
npm run build -- --solo /fr/prix-carburants
npm run deploy -- --solo /fr/prix-carburants
```

La actualización diaria (`npm run actualizar:gasolineras`, acceso "Actualizar gasolineras" del escritorio) ya incluye estos tres pasos después de las secciones españolas.

## Configuración

| Variable | Uso | Por defecto |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Origen para canonical, Open Graph y sitemap | `http://localhost:3000` |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | Editor de AdSense (`ca-pub-` y 16 dígitos) | vacío: sin AdSense |
| `NEXT_PUBLIC_ADSENSE_SLOT` | Unidad de anuncio (10 dígitos) | vacío: sin bloques |

`ododex-sitio` pasa las tres en la compilación de producción.

## Nota sobre el desarrollo en Windows

Tailwind se compila con `postcss-tailwind-windows.cjs`, que recorre `src/` una sola vez por cada procesado de `globals.css`. En `npm run dev`, si una clase nueva no aparece, guarda `src/app/globals.css` (o reinicia el servidor) para que se regenere el CSS. La compilación de producción no tiene este problema.

## Límites conocidos

- Las marcas vienen de OpenStreetMap: puede haber errores puntuales. El histórico por marca usa la marca actual de cada estación para todo el periodo.
- Solo Francia metropolitana y Córcega.
- Las primeras semanas de 2016 no tienen dato para las estaciones que no cambiaron de precio desde finales de 2015.
- Las estaciones sin municipio en el flujo (unas 4) no se publican.
- Unos 17 850 ficheros por despliegue, con un límite de 20 000 por Worker en el plan gratuito.
