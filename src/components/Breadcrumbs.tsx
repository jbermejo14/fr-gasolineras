import React from 'react';
import { InternalLink } from './InternalLink';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  name: string;
  href: string;
}

/** Migas de pan tras « Accueil »; el último elemento es la página actual y no es un enlace. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="mb-4 min-w-0">
      <ol className="flex items-center gap-x-1.5 gap-y-0.5 text-xs text-[var(--text-muted)] flex-wrap">
        <li>
          <InternalLink href="/" className="inline-flex items-center min-h-10 hover:text-[var(--orange-primary)] transition-colors">
            Accueil
          </InternalLink>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <React.Fragment key={`${index}-${item.href}`}>
              <li aria-hidden="true">
                <ChevronRight className="w-3.5 h-3.5 text-[var(--text-dim)]" />
              </li>
              <li className="min-w-0 max-w-full">
                {isLast ? (
                  <span className="font-semibold text-[var(--text-main)] break-words" aria-current="page">
                    {item.name}
                  </span>
                ) : (
                  <InternalLink href={item.href} className="inline-flex items-center min-h-10 break-words hover:text-[var(--orange-primary)] transition-colors">
                    {item.name}
                  </InternalLink>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
