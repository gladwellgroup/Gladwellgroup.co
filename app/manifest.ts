import { MetadataRoute } from 'next'
import { SITE_NAME, SITE_DESCRIPTION } from '@/lib/site'

// start_url: '/dashboard' — quien agrega el portal a inicio quiere entrar
// directo a su cuenta, no a la página pública de marketing. Si no tiene
// sesión, el middleware ya lo manda a /login por su cuenta.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Apasionados por la Estrategia`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    // Mismo tono que el fondo oscuro real de la marca (app/globals.css
    // --background), y el mismo valor que ya usa scripts/generate-favicons.mjs
    // para el relleno de los íconos — un solo color oscuro consistente en
    // toda la identidad instalada.
    background_color: '#0a0a14',
    theme_color: '#0a0a14',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
