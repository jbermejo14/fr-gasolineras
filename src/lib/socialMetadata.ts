import type { Metadata } from 'next';
import { SITE_NAME, absoluteUrl } from './site.ts';

/** Ruta de la imagen Open Graph dentro de public/, sin la ruta base. */
export const OG_IMAGE_PATH = '/brand/ododex-og.png';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_ALT = `Prix des carburants en France · ${SITE_NAME}`;

export type SocialMetadataInput = {
  title: string;
  description: string;
  /** Ruta de la página sin la ruta base ('/' para la portada). */
  path: string;
  /** Nombre del sitio de Open Graph; por defecto SITE_NAME. */
  siteName?: string;
};

/**
 * Open Graph y Twitter Card de una página, con la imagen de marca (URL absoluta bajo la ruta base).
 * Cada `generateMetadata` debe usarla: Next sustituye `openGraph` entero y no hereda `images` del layout.
 */
export function buildSocialMetadata(input: SocialMetadataInput): Pick<Metadata, 'openGraph' | 'twitter'> {
  const { title, description, path, siteName = SITE_NAME } = input;
  const imageUrl = absoluteUrl(OG_IMAGE_PATH);
  return {
    openGraph: {
      type: 'website',
      locale: 'fr_FR',
      url: absoluteUrl(path),
      siteName,
      title,
      description,
      images: [{ url: imageUrl, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: OG_IMAGE_ALT }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [imageUrl] },
  };
}
