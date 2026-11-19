import { MapPin } from 'lucide-react';
import { InternalLink } from '@/components/InternalLink';
import { stationPath } from '@/lib/prixCarburants';
import type { BrandDepartmentRow } from '@/lib/brandInsights';
import { formatPriceOrDash } from '@/lib/stationInsights';
import { formatInteger } from '@/lib/format';

const CELL = 'py-2 px-2 sm:px-3';

function BrandDepartmentTableRow({ row }: { row: BrandDepartmentRow }) {
  return (
    <tr className="hover:bg-[var(--bg-card-hover)] transition-colors">
      <td className={CELL}>
        <InternalLink
          href={`/departement/${row.departmentSlug}`}
          className="inline-flex items-center min-h-10 font-bold text-sm text-[var(--text-main)] hover:text-[var(--orange-primary)] transition-colors"
        >
          {row.departmentCode} – {row.department}
        </InternalLink>
      </td>
      <td className={`${CELL} text-right font-mono text-sm text-[var(--text-main)]`}>{formatInteger(row.stationCount)}</td>
      <td className={`${CELL} text-right font-mono text-sm text-[var(--text-main)]`}>{formatPriceOrDash(row.avgGazole)}</td>
      <td className={`${CELL} text-right`}>
        {row.cheapestGazole ? (
          <InternalLink
            href={stationPath(row.cheapestGazole)}
            className="inline-flex items-center min-h-10 font-mono font-extrabold text-sm text-[var(--orange-primary)] hover:underline"
          >
            {formatPriceOrDash(row.cheapestGazole.prices.gazole)}
          </InternalLink>
        ) : (
          <span className="font-mono text-sm text-[var(--text-dim)]">{formatPriceOrDash(null)}</span>
        )}
      </td>
    </tr>
  );
}

/** Tabla por departamento: estaciones de la red, media de gazole y estación más barata (con enlace a su ficha). */
export function BrandDepartments({ rows, brandName }: { rows: readonly BrandDepartmentRow[]; brandName: string }) {
  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-sm space-y-4">
      <div>
        <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[var(--orange-primary)]" />
          <span>Prix du gazole chez {brandName} par département</span>
        </h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Les départements sont classés par nombre de stations. Cliquez sur le prix minimum pour ouvrir la fiche de la station.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--border-color)]">
              <th className={CELL}>Département</th>
              <th className={`${CELL} text-right`}>Stations</th>
              <th className={`${CELL} text-right`}>Gazole moyen</th>
              <th className={`${CELL} text-right`}>Gazole minimum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {rows.map((row) => (
              <BrandDepartmentTableRow key={row.departmentSlug} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
