import type { Metadata } from 'next';
import { renderHistoriqueAreaPage } from '@/components/HistoriqueAreaPage';
import { buildHistoriqueMetadata } from '@/lib/historiquePageMeta';

export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return buildHistoriqueMetadata('france', 'france');
}

export default function HistoriquePage() {
  return renderHistoriqueAreaPage('france', 'france');
}
