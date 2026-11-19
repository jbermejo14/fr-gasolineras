import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { AdSenseScript } from '@/components/AdSenseScript';
import { SITE_NAME, absoluteUrl, getSiteUrl } from '@/lib/site';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getPrixData } from '@/lib/prixSnapshot';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

/**
 * Fija el tema antes de pintar para evitar el parpadeo: primero la elección guardada
 * y, si no hay, la preferencia del sistema. El try/catch cubre un localStorage no disponible.
 * Además de data-theme pone la clase dark/light, que es la que usa Tailwind.
 */
const THEME_SCRIPT = `
  (function() {
    var theme = null;
    try {
      var saved = localStorage.getItem('ododex-theme');
      if (saved === 'light' || saved === 'dark') theme = saved;
      if (!theme) {
        var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = prefersDark ? 'dark' : 'light';
      }
    } catch (e) {
      theme = 'light';
    }
    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
  })();
`;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const homeUrl = absoluteUrl('/');

  return {
    metadataBase: new URL(getSiteUrl()),
    title: {
      default: `Prix des carburants aujourd'hui en France : stations-service les moins chères | ${SITE_NAME}`,
      template: `%s | ${SITE_NAME}`,
    },
    description:
      "Comparez le prix du gazole, du SP95-E10, du SP98, de l'E85 et du GPLc dans toutes les stations-service de France, avec les données officielles du Ministère de l'Économie mises à jour chaque jour.",
    alternates: {
      canonical: homeUrl,
    },
    openGraph: {
      type: 'website',
      locale: 'fr_FR',
      url: homeUrl,
      siteName: SITE_NAME,
      title: "Prix des carburants en France aujourd'hui",
      description:
        'Trouvez les stations-service les moins chères par département, commune et code postal, à partir des données officielles de prix-carburants.gouv.fr.',
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { updatedAt } = await getPrixData();

  return (
    <html lang="fr" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen flex flex-col bg-[var(--bg-main)] text-[var(--text-main)] antialiased">
        <Header updatedAt={updatedAt} />
        <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-4 py-4 md:py-8">{children}</main>
        <Footer updatedAt={updatedAt} />
        <AdSenseScript />
      </body>
    </html>
  );
}
