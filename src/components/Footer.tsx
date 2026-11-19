import React from 'react';
import Link from 'next/link';
import { ConsentSettingsButton } from '@/components/ConsentSettingsButton';
import { getAdSenseClient } from '@/lib/adsense';
import { formatDateTimeParis } from '@/lib/format';
import { SITE_NAME } from '@/lib/site';

interface FooterProps {
  /** Fecha ISO de la última actualización de los precios. */
  updatedAt?: string;
}

const FOOTER_LINK_CLASS = 'inline-flex items-center min-h-10 hover:text-[var(--orange-primary)] transition-colors';

const URL_ENSEIGNES_DATASET = 'https://www.data.gouv.fr/datasets/referentiel-des-noms-et-enseignes-de-stations-service-enrichi-par-openstreetmap';
const URL_ODBL = 'https://opendatacommons.org/licenses/odbl/1-0/';
const EXTERNAL_LINK_CLASS = 'underline hover:text-[var(--orange-primary)]';

const FOOTER_LINKS = [
  { href: '/', label: 'Accueil' },
  { href: '/historique', label: 'Historique des prix' },
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/confidentialite', label: 'Confidentialité' },
  { href: '/cookies', label: 'Cookies' },
];

function FooterSeparator() {
  return <span className="text-[var(--border-color)]">&bull;</span>;
}

export function Footer({ updatedAt }: FooterProps) {
  const showConsentButton = getAdSenseClient() !== null;

  return (
    <footer className="mt-auto border-t border-[var(--border-color)] bg-[var(--bg-header)] py-6 md:py-8 transition-colors">
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs break-words text-[var(--text-muted)]">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text-main)]">
            Prix des carburants &bull; Tarifs mis à jour chaque jour
          </p>
          <p className="mt-1">
            Données : prix-carburants.gouv.fr (Ministère de l&apos;Économie), Licence Ouverte Etalab 2.0. {SITE_NAME} n&apos;est pas affilié au Ministère.
            {updatedAt && <span> Dernière mise à jour : <strong>{formatDateTimeParis(updatedAt)}</strong>.</span>}
          </p>
          <p className="mt-1">
            Noms et enseignes des stations :{' '}
            <a href={URL_ENSEIGNES_DATASET} target="_blank" rel="noopener noreferrer" className={EXTERNAL_LINK_CLASS}>
              Chiffrex (chiffrex.fr)
            </a>
            , d&apos;après OpenStreetMap – © les contributeurs d&apos;OpenStreetMap,{' '}
            <a href={URL_ODBL} target="_blank" rel="noopener noreferrer" className={EXTERNAL_LINK_CLASS}>
              ODbL
            </a>
            .
          </p>
          <p className="mt-1">Les prix peuvent différer de ceux affichés à la pompe.</p>
        </div>

        <div className="flex items-center gap-x-4 flex-wrap">
          {FOOTER_LINKS.map((link) => (
            <React.Fragment key={link.href}>
              <Link href={link.href} className={FOOTER_LINK_CLASS}>
                {link.label}
              </Link>
              <FooterSeparator />
            </React.Fragment>
          ))}
          {showConsentButton && (
            <>
              <ConsentSettingsButton />
              <FooterSeparator />
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
