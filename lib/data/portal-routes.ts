/** Prefijos de URL del portal: cada carpeta de primer nivel de `app/(portal)/`. Todo lo que cuelga de
 *  ellos pide sesión, no se cachea en el service worker y no se indexa.
 *
 *  Esta lista alimenta el middleware (`lib/supabase/middleware.ts`) y `app/robots.ts`. El `matcher` de
 *  `proxy.ts` tiene que ser literal y `public/sw.js` es un archivo estático, así que esos dos no pueden
 *  importarla y se mantienen a mano: `tests/private-routes.test.ts` exige que las cuatro coincidan con las
 *  carpetas reales. */
export const PORTAL_PREFIXES = ['/dashboard', '/perfil', '/super', '/admin', '/comunidad'] as const
