import type { ReactNode } from 'react';
import Link from 'next/link';
import { getPrixData } from '@/lib/prixSnapshot';
import { summarizeStations, type DepartmentGroup, type FuelStats } from '@/lib/prixCarburants';
import { FUEL_LABELS, type FuelType } from '@/lib/fuels';
import { formatEuros, formatInteger, formatPrice } from '@/lib/format';
import { absoluteUrl } from '@/lib/site';
import { AdSlot } from '@/components/AdSlot';
import { InteractiveGasFinder } from '@/components/InteractiveGasFinder';
import { gasFinderTankSavings, GAS_FINDER_TANK_LITERS } from '@/components/GasFinderLogic';
import { getBreadcrumbSchema } from '@/lib/seo';
import { TrendingDown, Fuel, ShieldCheck } from 'lucide-react';

/** Carburantes de la cinta de estadísticas de la portada, en este orden. */
const HOME_STATS_FUELS: readonly FuelType[] = ['gazole', 'e10'];
const MISSING_VALUE = '--';

const STAT_CARD = 'p-3 sm:p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] min-w-0';
const STAT_LABEL = 'text-xs text-[var(--text-muted)] font-medium flex items-center justify-between gap-1';
const STAT_VALUE = 'font-mono text-lg sm:text-2xl font-extrabold mt-1 truncate';
const STAT_NOTE = 'text-[11px] sm:text-xs text-[var(--text-dim)] mt-1';

function formatPriceOrDash(price: number | null): string {
  return price === null ? MISSING_VALUE : formatPrice(price);
}

interface HomeStatCardProps {
  label: string;
  value: string;
  note: string;
  valueClass: string;
  icon: ReactNode;
}

function HomeStatCard({ label, value, note, valueClass, icon }: HomeStatCardProps) {
  return (
    <div className={STAT_CARD}>
      <div className={STAT_LABEL}>
        <span className="min-w-0">{label}</span>
        <span className="shrink-0">{icon}</span>
      </div>
      <div className={`${STAT_VALUE} ${valueClass}`}>{value}</div>
      <div className={STAT_NOTE}>{note}</div>
    </div>
  );
}

function HomeFuelStats({ fuel, stats }: { fuel: FuelType; stats: FuelStats }) {
  const savings = gasFinderTankSavings(stats.min, stats.avg);
  const label = FUEL_LABELS[fuel];
  const fuelIcon = <Fuel className="w-4 h-4 text-[var(--orange-primary)]" />;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <HomeStatCard
        label="Prix minimum"
        value={formatPriceOrDash(stats.min)}
        note={`${label}, par litre`}
        valueClass="text-[var(--orange-primary)]"
        icon={fuelIcon}
      />
      <HomeStatCard
        label="Prix moyen"
        value={formatPriceOrDash(stats.avg)}
        note={`${label}, France`}
        valueClass="text-[var(--text-main)]"
        icon={fuelIcon}
      />
      <HomeStatCard
        label="Prix maximum"
        value={formatPriceOrDash(stats.max)}
        note={`${label}, par litre`}
        valueClass="text-[var(--text-main)]"
        icon={fuelIcon}
      />
      <HomeStatCard
        label={`Économie (plein ${GAS_FINDER_TANK_LITERS} L)`}
        value={savings !== null ? `+${formatEuros(savings)}` : MISSING_VALUE}
        note={`${label}, face à la moyenne`}
        valueClass="text-emerald-500"
        icon={<TrendingDown className="w-4 h-4 text-emerald-500" />}
      />
    </div>
  );
}

function HomeDepartmentTile({ group }: { group: DepartmentGroup }) {
  const summary = summarizeStations(group.stations);
  return (
    <Link
      href={`/departement/${group.departmentSlug}`}
      className="p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] hover:border-[var(--orange-primary)] hover:bg-[var(--bg-card-hover)] transition-all flex flex-col justify-between group"
    >
      <span className="text-xs font-bold text-[var(--text-main)] group-hover:text-[var(--orange-primary)] transition-colors line-clamp-1">
        {group.code} – {group.department}
      </span>
      <span className="text-[11px] text-[var(--text-dim)] font-mono mt-1">
        {formatInteger(group.stations.length)} stations
      </span>
      <span className="text-[11px] text-[var(--text-dim)] font-mono">
        Gazole {formatPriceOrDash(summary.avg.gazole)}
      </span>
      <span className="text-[11px] text-[var(--text-dim)] font-mono">
        E10 {formatPriceOrDash(summary.avg.e10)}
      </span>
    </Link>
  );
}

function HomeDepartmentDirectory({ departments }: { departments: DepartmentGroup[] }) {
  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--text-main)]">
            Prix des carburants par département
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Choisissez un département pour voir les stations les moins chères, les prix moyens et la liste de ses communes.
            Les prix moyens indiqués sont ceux du gazole et du SP95-E10.
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--orange-primary)]">
          {departments.length} départements
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-2">
        {departments.map((group) => (
          <HomeDepartmentTile key={group.departmentSlug} group={group} />
        ))}
      </div>
    </div>
  );
}

function HomeSeoText() {
  return (
    <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-sm space-y-3 text-sm text-[var(--text-muted)] leading-relaxed">
      <h2 className="text-xl font-extrabold text-[var(--text-main)]">
        Comment payer son carburant moins cher ?
      </h2>
      <p>
        D&apos;une station à l&apos;autre, le prix du litre de gazole ou de SP95-E10 peut varier de plusieurs
        centimes, y compris entre deux communes voisines. Sur un plein de {GAS_FINDER_TANK_LITERS} litres, l&apos;écart
        se chiffre vite en euros : consulter les prix avant de partir est le moyen le plus simple d&apos;économiser.
      </p>
      <p>
        Les stations situées sur autoroute sont en général plus chères que celles des routes ordinaires.
        Notre comparateur les signale par la mention « Autoroute » pour que vous puissiez les repérer d&apos;un coup d&apos;œil.
      </p>
      <p>
        Les prix proviennent du service officiel prix-carburants.gouv.fr, alimenté par les stations elles-mêmes
        et publié par le Ministère de l&apos;Économie. Ils sont récupérés une fois par jour : avant de vous déplacer,
        gardez à l&apos;esprit qu&apos;un tarif a pu changer depuis la dernière mise à jour.
      </p>
    </section>
  );
}

export default async function HomePage() {
  const data = await getPrixData();
  const departments = Array.from(data.departments.values());
  const departmentOptions = departments.map((group) => ({
    code: group.code,
    slug: group.departmentSlug,
    name: group.department,
  }));
  const breadcrumbSchema = getBreadcrumbSchema([{ name: 'Accueil', url: absoluteUrl('/') }]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="space-y-8">
        {/* Hero Section */}
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-8 shadow-md">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--orange-subtle)] border border-[var(--orange-border)] text-xs font-bold text-[var(--orange-primary)] mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Données officielles du Ministère de l&apos;Économie</span>
            </span>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight break-words text-[var(--text-main)] leading-tight">
              Prix des carburants <span className="text-[var(--orange-primary)]">aujourd&apos;hui</span> en France
            </h1>
            <p className="mt-3 text-sm md:text-base text-[var(--text-muted)] leading-relaxed">
              Retrouvez les prix officiels de <strong>{formatInteger(data.stations.length)} stations-service</strong> de
              France métropolitaine, mis à jour chaque jour, dans les {departments.length} départements.
              Comparez par département et par commune pour faire le plein au meilleur prix.
            </p>
          </div>

          <div className="space-y-4 mt-6 pt-6 border-t border-[var(--border-subtle)]">
            {HOME_STATS_FUELS.map((fuel) => (
              <HomeFuelStats key={fuel} fuel={fuel} stats={data.nationalStats[fuel]} />
            ))}
          </div>

          <Link
            href="/historique"
            className="mt-4 inline-flex items-center gap-1.5 min-h-10 text-sm font-bold text-[var(--orange-primary)] hover:underline"
          >
            <TrendingDown className="w-4 h-4" />
            <span>Voir l&apos;évolution historique</span>
          </Link>
        </div>

        <InteractiveGasFinder departments={departmentOptions} />

        <AdSlot />

        <HomeDepartmentDirectory departments={departments} />

        <HomeSeoText />

        <AdSlot />
      </div>
    </>
  );
}
