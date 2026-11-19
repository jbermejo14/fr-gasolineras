import { notFound } from 'next/navigation';
import { HistoriqueArea } from '@/components/HistoriqueArea';
import { InternalLink } from '@/components/InternalLink';
import { getAreasByKind, loadAreaHistory } from '@/lib/historique';
import type { AreaKind } from '@/lib/historiqueFormat';

const HISTORIQUE_PAGE_FRANCE_SLUG = 'france';
const HISTORIQUE_PAGE_EMPTY_CLASS =
  'rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-md space-y-3';

/** Parámetros estáticos de una ruta dinámica de histórico: un objeto `{ [paramName]: slug }` por zona del índice. */
export function getHistoriqueStaticParams<K extends string>(kind: AreaKind, paramName: K): Record<K, string>[] {
  return getAreasByKind(kind).map((area) => ({ [paramName]: area.slug }) as Record<K, string>);
}

function HistoriqueAreaPageEmpty() {
  return (
    <div className={HISTORIQUE_PAGE_EMPTY_CLASS}>
      <h1 className="text-xl md:text-3xl font-extrabold text-[var(--text-main)]">Historique des prix</h1>
      <p className="text-sm md:text-base text-[var(--text-muted)]">L&apos;historique n&apos;a pas encore été généré.</p>
      <InternalLink href="/" className="inline-flex items-center min-h-10 text-sm font-bold text-[var(--orange-primary)]">
        Retour à l&apos;accueil
      </InternalLink>
    </div>
  );
}

/** Página de histórico de una zona: 404 si no existe (salvo Francia, que muestra el aviso de datos sin generar). */
export function renderHistoriqueAreaPage(kind: AreaKind, slug: string) {
  const areaFile = loadAreaHistory(kind, slug);
  if (!areaFile) {
    if (kind === 'france') return <HistoriqueAreaPageEmpty />;
    notFound();
  }
  const national =
    kind === 'france' ? areaFile.area : (loadAreaHistory('france', HISTORIQUE_PAGE_FRANCE_SLUG)?.area ?? null);
  return <HistoriqueArea areaFile={areaFile} national={national} />;
}
