import { InternalLink } from '@/components/InternalLink';
import type { AreaIndexEntry, AreaKind } from '@/lib/historiqueFormat';
import { departmentOfName } from '@/lib/geo';
import { getAreasByKind } from '@/lib/historique';
import { buildHistoriquePath } from '@/lib/historiquePageMeta';

interface HistoriqueAreaLinksProps {
  kind: AreaKind;
  slug: string;
  name: string;
  parentSlug?: string;
}

interface HistoriqueLink {
  label: string;
  href: string;
}

interface HistoriqueLinkGroup {
  title: string;
  links: HistoriqueLink[];
}

const HISTORIQUE_LINKS_FRANCE_GROUP: HistoriqueLinkGroup = {
  title: 'Ensemble de la France',
  links: [{ label: 'France', href: buildHistoriquePath('france', 'france') }],
};

function historiqueLinksOf(entries: AreaIndexEntry[]): HistoriqueLink[] {
  return entries.map((entry) => ({ label: entry.name, href: buildHistoriquePath(entry.kind, entry.slug) }));
}

function historiqueLinksDepartementGroups(props: HistoriqueAreaLinksProps): HistoriqueLinkGroup[] {
  const region = getAreasByKind('region').filter((area) => area.slug === props.parentSlug);
  return [
    { title: 'Région', links: historiqueLinksOf(region) },
    HISTORIQUE_LINKS_FRANCE_GROUP,
    {
      title: "Prix d'aujourd'hui",
      links: [{ label: `Stations-service du département ${departmentOfName(props.name)}`, href: `/departement/${props.slug}` }],
    },
  ];
}

/** Grupos de enlaces relacionados según el tipo de zona. */
function historiqueLinksGroups(props: HistoriqueAreaLinksProps): HistoriqueLinkGroup[] {
  switch (props.kind) {
    case 'france':
      return [{ title: 'Par région', links: historiqueLinksOf(getAreasByKind('region')) }];
    case 'region':
      return [
        {
          title: `Départements de la région ${props.name}`,
          links: historiqueLinksOf(getAreasByKind('departement').filter((area) => area.parentSlug === props.slug)),
        },
        HISTORIQUE_LINKS_FRANCE_GROUP,
      ];
    case 'departement':
      return historiqueLinksDepartementGroups(props);
  }
}

/** Sección H2 de enlaces internos relacionados; los grupos vacíos no se pintan. */
export function HistoriqueAreaLinks(props: HistoriqueAreaLinksProps) {
  const groups = historiqueLinksGroups(props).filter((group) => group.links.length > 0);
  if (groups.length === 0) return null;

  return (
    <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-sm space-y-4">
      <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)]">Historique des prix : pages liées</h2>
      {groups.map((group) => (
        <div key={group.title} className="space-y-2">
          <h3 className="text-sm font-bold text-[var(--text-muted)]">{group.title}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {group.links.map((link) => (
              <InternalLink
                key={link.href}
                href={link.href}
                className="min-h-10 min-w-0 p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] hover:bg-[var(--bg-card-hover)] transition-all flex items-center text-xs font-bold text-[var(--text-main)] hover:text-[var(--orange-primary)] break-words"
              >
                {link.label}
              </InternalLink>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
