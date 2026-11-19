import { AdSlot } from '@/components/AdSlot';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { PriceHistoryChart } from '@/components/PriceHistoryChart';
import { HistoriqueAreaCards } from '@/components/HistoriqueAreaCards';
import { HistoriqueAreaLinks } from '@/components/HistoriqueAreaLinks';
import { HistoriqueAreaTable } from '@/components/HistoriqueAreaTable';
import { HISTORY_FUELS } from '@/lib/historiqueFormat';
import type { AreaHistory, AreaHistoryFile, FuelSeries, HistoryFuel } from '@/lib/historiqueFormat';
import { buildHistoriqueDescription, buildHistoriquePath, buildHistoriqueTitle } from '@/lib/historiquePageMeta';
import { buildAreaIntro } from '@/lib/historiqueStats';
import { formatIsoDateFr } from '@/lib/format';
import { absoluteUrl } from '@/lib/site';
import { getBreadcrumbSchema, getDatasetSchema } from '@/lib/seo';

interface HistoriqueAreaProps {
  areaFile: AreaHistoryFile;
  national: AreaHistory | null;
}

const HISTORIQUE_AREA_LESS_THAN_PATTERN = /</g;
const HISTORIQUE_AREA_LESS_THAN_ESCAPED = '\\u003c';
const HISTORIQUE_AREA_HOME_LABEL = 'Historique des prix';
const HISTORIQUE_AREA_NOTE_ZONE = 'de la zone';
const HISTORIQUE_AREA_NOTE_BRAND = "de l'enseigne";
const HISTORIQUE_AREA_BRAND_NOTE = 'Les stations sont rattachées à leur enseigne actuelle pour toute la période.';
const HISTORIQUE_AREA_FRANCE_NAME = 'France';
const HISTORIQUE_AREA_CARD_CLASS = 'rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-sm';

/** Serializa el JSON-LD escapando `<` para que un nombre con `</script>` no cierre la etiqueta. */
function historiqueAreaSchemaJson(schema: unknown): string {
  return JSON.stringify(schema).replace(HISTORIQUE_AREA_LESS_THAN_PATTERN, HISTORIQUE_AREA_LESS_THAN_ESCAPED);
}

function historiqueAreaChartSeries(area: AreaHistory): Partial<Record<HistoryFuel, FuelSeries>> {
  return Object.fromEntries(HISTORY_FUELS.map((fuel) => [fuel, area.series[fuel].avg]));
}

function historiqueAreaBreadcrumbs(area: AreaHistory) {
  const home = { name: HISTORIQUE_AREA_HOME_LABEL, href: buildHistoriquePath('france', 'france') };
  if (area.kind === 'france') return [home];
  return [home, { name: area.name, href: buildHistoriquePath(area.kind, area.slug) }];
}

/** « de la zone » en general; en una marca el conjunto es la red, no un lugar. */
function historiqueAreaNoteScope(area: AreaHistory): string {
  return area.kind === 'marque' ? HISTORIQUE_AREA_NOTE_BRAND : HISTORIQUE_AREA_NOTE_ZONE;
}

function historiqueAreaSchemas(area: AreaHistory, weeks: readonly string[]) {
  const url = absoluteUrl(buildHistoriquePath(area.kind, area.slug));
  const crumbs = [
    { name: 'Accueil', url: absoluteUrl('/') },
    { name: HISTORIQUE_AREA_HOME_LABEL, url: absoluteUrl(buildHistoriquePath('france', 'france')) },
  ];
  if (area.kind !== 'france') crumbs.push({ name: area.name, url });
  return [
    getBreadcrumbSchema(crumbs),
    getDatasetSchema({
      name: buildHistoriqueTitle(area.kind, area.name, weeks),
      description: buildHistoriqueDescription(area, weeks),
      url,
      firstDate: weeks[0],
      lastDate: weeks[weeks.length - 1],
      placeName: area.kind === 'marque' ? HISTORIQUE_AREA_FRANCE_NAME : area.name,
    }),
  ];
}

/** Plantilla compartida de las páginas de histórico (Francia, región, departamento y marca). */
export function HistoriqueArea({ areaFile, national }: HistoriqueAreaProps) {
  const { area, weeks } = areaFile;

  return (
    <>
      {historiqueAreaSchemas(area, weeks).map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: historiqueAreaSchemaJson(schema) }} />
      ))}

      <div className="space-y-6 md:space-y-8 min-w-0">
        <Breadcrumbs items={historiqueAreaBreadcrumbs(area)} />

        <div className={`${HISTORIQUE_AREA_CARD_CLASS} shadow-md space-y-4 md:space-y-6`}>
          <div className="max-w-3xl">
            <h1 className="text-xl md:text-4xl font-extrabold tracking-tight break-words text-[var(--text-main)]">
              {buildHistoriqueTitle(area.kind, area.name, weeks)}
            </h1>
            <p className="mt-3 text-sm md:text-base text-[var(--text-muted)] leading-relaxed">
              {buildAreaIntro(area, weeks, national)}
            </p>
          </div>
          <HistoriqueAreaCards area={area} weeks={weeks} />
        </div>

        <div className={`${HISTORIQUE_AREA_CARD_CLASS} min-w-0`}>
          <PriceHistoryChart
            weeks={weeks}
            series={historiqueAreaChartSeries(area)}
            title={`Évolution du prix des carburants : ${area.name}`}
            defaultRange="all"
          />
        </div>

        <AdSlot />

        <section className={`${HISTORIQUE_AREA_CARD_CLASS} space-y-4 min-w-0`}>
          <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)]">Prix moyen par an</h2>
          <HistoriqueAreaTable area={area} weeks={weeks} />
        </section>

        <HistoriqueAreaLinks kind={area.kind} slug={area.slug} name={area.name} parentSlug={area.parentSlug} />

        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Chaque point correspond au prix moyen de toutes les stations {historiqueAreaNoteScope(area)} le lundi de la semaine. Source :
          prix-carburants.gouv.fr. Dernière donnée : {formatIsoDateFr(weeks[weeks.length - 1])}.
          {area.kind === 'marque' ? ` ${HISTORIQUE_AREA_BRAND_NOTE}` : ''}
        </p>

        <AdSlot />
      </div>
    </>
  );
}
