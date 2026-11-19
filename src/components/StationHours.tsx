import { Clock } from 'lucide-react';
import type { DayHours, Station } from '@/lib/prixCarburants';

const CLOSED_TEXT = 'Fermé';
const NOT_PROVIDED_TEXT = 'Non communiqué';
const AUTOMATE_TEXT = 'Automate 24/24';
const ALL_DAY_TEXT = '24 h/24';
const RANGES_SEPARATOR = ', ';

/** Un día abierto sin tramos en una estación con automate 24/24 está abierto todo el día. */
function dayText(day: DayHours, is24h: boolean): string {
  if (day.closed) return CLOSED_TEXT;
  if (day.ranges.length > 0) return day.ranges.join(RANGES_SEPARATOR);
  return is24h ? ALL_DAY_TEXT : NOT_PROVIDED_TEXT;
}

/** Horario por día (lunes a domingo) y mención del automate 24/24. */
export function StationHours({ station }: { station: Station }) {
  const hasDays = station.openingHours.length > 0;
  return (
    <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 md:p-6 shadow-sm space-y-4">
      <h2 className="text-lg md:text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
        <Clock className="w-5 h-5 text-[var(--orange-primary)]" />
        <span>Horaires d&apos;ouverture</span>
      </h2>
      {station.is24h && (
        <p className="text-sm font-bold text-[var(--orange-primary)]">
          {AUTOMATE_TEXT} : paiement et distribution possibles à toute heure.
        </p>
      )}
      {hasDays ? (
        <table className="w-full text-left text-sm border-collapse">
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {station.openingHours.map((day) => (
              <tr key={day.day}>
                <th scope="row" className="w-40 py-2 pr-4 font-semibold text-[var(--text-main)]">
                  {day.day}
                </th>
                <td className={`py-2 font-mono ${day.closed ? 'text-[var(--text-dim)]' : 'text-[var(--text-main)]'}`}>
                  {dayText(day, station.is24h)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        !station.is24h && <p className="text-sm text-[var(--text-muted)]">Les horaires de cette station ne sont pas communiqués.</p>
      )}
    </section>
  );
}
