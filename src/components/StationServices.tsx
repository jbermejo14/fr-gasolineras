import { ShieldCheck } from 'lucide-react';

/** Lista de servicios de la estación; no se muestra nada si no declara ninguno. */
export function StationServices({ services }: { services: readonly string[] }) {
  if (services.length === 0) return null;
  return (
    <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-6 shadow-sm space-y-4">
      <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-[var(--orange-primary)]" />
        <span>Services disponibles</span>
      </h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-[var(--text-main)]">
        {services.map((service) => (
          <li key={service} className="px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)]">
            {service}
          </li>
        ))}
      </ul>
    </section>
  );
}
