import type { Metadata } from 'next';
import { getHistoriqueStaticParams, renderHistoriqueAreaPage } from '@/components/HistoriqueAreaPage';
import { buildHistoriqueMetadata } from '@/lib/historiquePageMeta';

export const dynamic = 'force-static';
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ departement: string }>;
}

export function generateStaticParams() {
  return getHistoriqueStaticParams('departement', 'departement');
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { departement } = await params;
  return buildHistoriqueMetadata('departement', departement);
}

export default async function HistoriqueDepartementPage({ params }: PageProps) {
  const { departement } = await params;
  return renderHistoriqueAreaPage('departement', departement);
}
