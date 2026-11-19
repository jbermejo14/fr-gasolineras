import type { Metadata } from 'next';
import { renderHistoriqueAreaPage } from '@/components/HistoriqueAreaPage';
import { buildHistoriqueSeoMetadata } from '@/lib/pageTitles';

export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return buildHistoriqueSeoMetadata('france', 'france');
}

export default function HistoriquePage() {
  return renderHistoriqueAreaPage('france', 'france');
}
