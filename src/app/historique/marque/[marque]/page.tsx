import type { Metadata } from 'next';
import { getHistoriqueStaticParams, renderHistoriqueAreaPage } from '@/components/HistoriqueAreaPage';
import { buildHistoriqueMetadata } from '@/lib/historiquePageMeta';

export const dynamic = 'force-static';
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ marque: string }>;
}

export function generateStaticParams() {
  return getHistoriqueStaticParams('marque', 'marque');
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { marque } = await params;
  return buildHistoriqueMetadata('marque', marque);
}

export default async function HistoriqueMarquePage({ params }: PageProps) {
  const { marque } = await params;
  return renderHistoriqueAreaPage('marque', marque);
}
