import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { getTitular, type Titular } from '@/lib/legal';
import { legalHolderValue } from '@/lib/legalText';
import { buildSocialMetadata } from '@/lib/socialMetadata';
import { SITE_NAME, absoluteUrl } from '@/lib/site';

const PATH = '/mentions-legales';
const META_TITLE = 'Mentions légales';
const META_DESCRIPTION = `Mentions légales de ${SITE_NAME} : éditeur, hébergeur, source des données et limites de responsabilité.`;
const URL_PRIX_CARBURANTS = 'https://www.prix-carburants.gouv.fr';
const URL_CLOUDFLARE = 'https://www.cloudflare.com';
const URL_ENSEIGNES_DATASET = 'https://www.data.gouv.fr/datasets/referentiel-des-noms-et-enseignes-de-stations-service-enrichi-par-openstreetmap';
const URL_CHIFFREX = 'https://chiffrex.fr';
const URL_ODBL = 'https://opendatacommons.org/licenses/odbl/1-0/';
const URL_LICENCE_ETALAB = 'https://www.etalab.gouv.fr/licence-ouverte-open-licence/';

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESCRIPTION,
  robots: { index: false, follow: true },
  alternates: { canonical: absoluteUrl(PATH) },
  ...buildSocialMetadata({ title: META_TITLE, description: META_DESCRIPTION, path: PATH })
};

export default function MentionsLegalesPage() {
  const holder = getTitular();
  const field = (name: keyof Titular) => legalHolderValue(holder, name);

  return (
    <LegalPage title="Mentions légales" path={PATH}>
      <h2>Éditeur du site</h2>
      <p>
        Conformément à l&apos;article 6 III de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique (LCEN), ce site est édité par :
      </p>
      <ul>
        <li>Nom : {field('nombre')}</li>
        <li>Numéro d&apos;identification fiscale (NIF, Espagne) : {field('nif')}</li>
        <li>Adresse : {field('domicilio')}</li>
        <li>Adresse e-mail de contact : {field('email')}</li>
        {holder.tipo === 'empresa' && <li>Immatriculation au RCS : {field('registroMercantil')}</li>}
      </ul>

      <h2>Directeur de la publication</h2>
      <p>Le directeur de la publication est l&apos;éditeur du site : {field('nombre')}.</p>

      <h2>Hébergeur</h2>
      <p>
        Le site est hébergé par Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis (<a href={URL_CLOUDFLARE} target="_blank" rel="noopener noreferrer">cloudflare.com</a>).
      </p>

      <h2>Objet du site</h2>
      <p>
        {SITE_NAME} propose un comparateur des prix des carburants dans les stations-service de France métropolitaine, ainsi que l&apos;historique de leur évolution.
      </p>

      <h2>Source des données</h2>
      <p>
        Les prix proviennent du service{' '}
        <a href={URL_PRIX_CARBURANTS} target="_blank" rel="noopener noreferrer">prix-carburants.gouv.fr</a>{' '}
        et sont réutilisés sous{' '}
        <a href={URL_LICENCE_ETALAB} target="_blank" rel="noopener noreferrer">Licence Ouverte Etalab 2.0</a>, avec mention de la source et de la date des données.
      </p>
      <p>
        {SITE_NAME} est un site indépendant : il n&apos;est pas affilié au ministère de l&apos;Économie et ne bénéficie d&apos;aucun soutien de sa part.
      </p>

      <h2>Noms et enseignes des stations</h2>
      <p>
        Noms et enseignes des stations : Chiffrex (
        <a href={URL_CHIFFREX} target="_blank" rel="noopener noreferrer">chiffrex.fr</a>
        ), d&apos;après OpenStreetMap – © les contributeurs d&apos;OpenStreetMap,{' '}
        <a href={URL_ODBL} target="_blank" rel="noopener noreferrer">ODbL</a>. Jeu de données :{' '}
        <a href={URL_ENSEIGNES_DATASET} target="_blank" rel="noopener noreferrer">Référentiel des noms et enseignes de stations-service (enrichi par OpenStreetMap)</a>, sur data.gouv.fr.
      </p>
      <p>
        Le fichier <code>stations.json</code> publié par le site, qui reprend ces noms, constitue une base de données dérivée : il est publié sous licence ODbL 1.0.
      </p>
      <p>
        Les noms et logos des enseignes appartiennent à leurs titulaires et ne servent qu&apos;à identifier les stations.
      </p>

      <h2>Exactitude des prix et responsabilité</h2>
      <p>
        Les prix sont ceux que les stations déclarent et peuvent différer de ceux affichés à la pompe. Ils sont donnés à titre indicatif : vérifiez le prix sur place avant de faire le plein. Le site est mis à jour une fois par jour, et l&apos;historique reprend le prix en vigueur chaque lundi, non la variation quotidienne.
      </p>
      <p>
        Dans la limite permise par la loi, l&apos;éditeur s&apos;efforce de reproduire fidèlement les données publiées, mais ne garantit ni leur exactitude ni leur actualité. Il ne saurait être tenu responsable des décisions prises ni des préjudices résultant de l&apos;utilisation du site.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Les textes, la conception graphique, le code et les autres contenus propres au site sont la propriété de l&apos;éditeur et protégés par le Code de la propriété intellectuelle. Toute reproduction, représentation ou adaptation, totale ou partielle, sans autorisation écrite préalable est interdite, sauf pour un usage strictement personnel et avec mention de la source.
      </p>

      <h2>Cartographie</h2>
      <p>
        Les cartes affichent des données © les contributeurs d&apos;OpenStreetMap et des images Esri, soumises à leurs licences et conditions d&apos;utilisation respectives.
      </p>

      <h2>Droit applicable</h2>
      <p>
        Le site est édité depuis l&apos;Espagne. Les présentes mentions légales sont régies par le droit espagnol, sans préjudice des dispositions impératives de protection des consommateurs de votre pays de résidence.
      </p>
    </LegalPage>
  );
}
