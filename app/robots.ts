import { MetadataRoute } from 'next'
import { PORTAL_PREFIXES } from '@/lib/data/portal-routes'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Lo que no es la landing: el portal (sin contenido público, pide sesión) y las API. Las páginas con
      // enlace secreto —login, invitación, asistencia, audio— llevan `noindex` en su layout: un buscador solo
      // lo respeta si puede rastrear la página, así que no se bloquean aquí.
      disallow: [...PORTAL_PREFIXES, '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
