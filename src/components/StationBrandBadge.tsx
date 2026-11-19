import { brandBadgeSpec } from '@/lib/stationHeading';

export type StationBrandBadgeSize = 'sm' | 'md';

/** Alto del logo en píxeles por tamaño; el ancho se calcula con la proporción máxima. */
const LOGO_HEIGHT_PX: Record<StationBrandBadgeSize, number> = { sm: 20, md: 32 };
/** Ancho máximo del logo en píxeles (6 rem). */
const LOGO_MAX_WIDTH_PX = 96;

const TEXT_SIZE_CLASS: Record<StationBrandBadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2.5 py-1',
};

interface StationBrandBadgeProps {
  /** Nombre comercial de la estación; sin nombre no se pinta nada. */
  name: string | null;
  /** Slug de la red (BRAND_GROUPS) o null si la estación no pertenece a ninguna. */
  brandSlug: string | null;
  size: StationBrandBadgeSize;
}

/** Logo de la red de la estación o, sin logo, un distintivo de texto con el nombre de la red (o el nombre comercial). */
export function StationBrandBadge({ name, brandSlug, size }: StationBrandBadgeProps) {
  const spec = brandBadgeSpec(name, brandSlug);
  if (!spec) return null;

  if (spec.kind === 'logo') {
    return (
      <img
        src={spec.src}
        alt={spec.alt}
        height={LOGO_HEIGHT_PX[size]}
        width={LOGO_MAX_WIDTH_PX}
        style={{ height: LOGO_HEIGHT_PX[size], maxWidth: LOGO_MAX_WIDTH_PX }}
        // Fondo blanco: varios logos tienen letras negras que no se leen en el tema oscuro.
        className="w-auto object-contain shrink-0 rounded bg-white px-1 py-0.5"
      />
    );
  }

  return (
    <span
      className={`${TEXT_SIZE_CLASS[size]} inline-block max-w-full truncate rounded bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)] font-extrabold uppercase tracking-tight`}
    >
      {spec.label}
    </span>
  );
}
