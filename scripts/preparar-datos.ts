import fs from 'node:fs';
import path from 'node:path';
import { formatDateTimeParis } from '../src/lib/format.ts';
import { downloadPrixSnapshot, loadPrixSnapshot } from '../src/lib/prixSnapshot.ts';
import { STATION_NAMES_FILE, downloadStationNames } from '../src/lib/stationNames.ts';
import { buildStationsPayload } from '../src/lib/stationPayload.ts';

const STATIONS_JSON_FILE = path.join(process.cwd(), 'public', 'datos', 'stations.json');
const BYTES_PER_MEGABYTE = 1024 * 1024;
const MEGABYTE_DECIMALS = 2;
const EXIT_CODE_ERROR = 1;

function prepareDataWriteStations(): string {
  const snapshot = loadPrixSnapshot();
  const json = JSON.stringify(buildStationsPayload(snapshot));
  fs.mkdirSync(path.dirname(STATIONS_JSON_FILE), { recursive: true });
  fs.writeFileSync(STATIONS_JSON_FILE, json);
  const megabytes = (Buffer.byteLength(json) / BYTES_PER_MEGABYTE).toFixed(MEGABYTE_DECIMALS);
  const withName = snapshot.stations.filter((station) => station.name !== null).length;
  const withBrand = snapshot.stations.filter((station) => station.brandSlug !== null).length;
  return [
    'Datos preparados:',
    `última actualización ${formatDateTimeParis(snapshot.updatedAt)},`,
    `${snapshot.stations.length} estaciones (${withName} con nombre, ${withBrand} con red en ${snapshot.brands.size} redes),`,
    `${snapshot.departments.size} departamentos,`,
    `${snapshot.communes.size} municipios,`,
    `${STATIONS_JSON_FILE} (${megabytes} MB).`,
  ].join(' ');
}

/** Los nombres son opcionales: si la descarga falla se conserva la copia anterior o se publica sin marcas. */
async function prepareDataDownloadNames(): Promise<void> {
  try {
    await downloadStationNames();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const consequence = fs.existsSync(STATION_NAMES_FILE)
      ? 'se usa la copia anterior'
      : 'la web se publica sin marcas';
    console.warn(`No se pudieron descargar los nombres de las estaciones: ${consequence} (${reason}).`);
  }
}

async function prepareDataMain(): Promise<void> {
  await downloadPrixSnapshot();
  await prepareDataDownloadNames();
  console.log(prepareDataWriteStations());
}

prepareDataMain().catch((err) => {
  console.error(`No se pudieron preparar los datos de precios: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(EXIT_CODE_ERROR);
});
