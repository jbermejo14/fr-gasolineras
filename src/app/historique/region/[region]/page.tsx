import type { Metadata } from 'next';
import { getHistoriqueStaticParams, renderHistoriqueAreaPage } from '@/components/HistoriqueAreaPage';
import { buildHistoriqueMetadata } from '@/lib/historiquePageMeta';

export const dynamic = 'force-static';
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ region: string }>;
}

export function generateStaticParams() {
  return getHistoriqueStaticParams('region', 'region');
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { region } = await params;
  return buildHistoriqueMetadata('region', region);
}

export default async function HistoriqueRegionPage({ params }: PageProps) {
  const { region } = await params;
  return renderHistoriqueAreaPage('region', region);
}
