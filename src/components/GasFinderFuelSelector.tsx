import { FUEL_TYPES, FUEL_LABELS, type FuelType } from '@/lib/fuels';

const ACTIVE = 'bg-[var(--on-accent-bg)] text-[var(--on-accent-text)]';
const INACTIVE =
  'bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--orange-border)]';
// Una sola línea desplazable en móvil; en pantallas anchas se reparte en varias.
const ROW = 'flex gap-2 overflow-x-auto scrollbar-none sm:flex-wrap sm:overflow-visible';

interface GasFinderFuelSelectorProps {
  fuel: FuelType;
  onFuelChange: (fuel: FuelType) => void;
}

export function GasFinderFuelSelector({ fuel, onFuelChange }: GasFinderFuelSelectorProps) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-sm">
      <span className="text-xs uppercase tracking-wider font-extrabold text-[var(--text-muted)] block mb-3">
        Choisissez votre carburant
      </span>
      <div className={ROW}>
        {FUEL_TYPES.map((option) => (
          <button
            key={option}
            onClick={() => onFuelChange(option)}
            className={`shrink-0 whitespace-nowrap min-h-10 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              fuel === option ? `${ACTIVE} shadow-md shadow-[var(--orange-glow)]` : INACTIVE
            }`}
          >
            {FUEL_LABELS[option]}
          </button>
        ))}
      </div>
    </div>
  );
}
