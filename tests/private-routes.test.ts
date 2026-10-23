import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import robots from '@/app/robots'
import { PORTAL_PREFIXES } from '@/lib/data/portal-routes'

// Las rutas privadas del portal están escritas en cuatro sitios que no pueden importarse entre sí (el `matcher`
// de `proxy.ts` tiene que ser literal, `public/sw.js` es un archivo estático y robots.txt es otra ruta) más la
// lista `PORTAL_PREFIXES`. Si alguien añade una carpeta a `app/(portal)/` y se olvida de uno, esa ruta queda sin la
// comprobación de sesión del middleware, cacheada por el service worker o indexable. Estas pruebas leen el código
// y comparan todo con las carpetas reales.

const ROOT = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const PORTAL_DIR = path.join(ROOT, 'app', '(portal)')

/** Carpetas de primer nivel de app/(portal)/: cada una es un prefijo de URL. */
const portalFolders = fs
  .readdirSync(PORTAL_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `/${entry.name}`)
  .sort()

/** ¿Tiene páginas anidadas (carpetas propias) además de la suya? Entonces el matcher necesita `/:path*`. */
const hasNestedRoutes = (prefix: string) =>
  fs.readdirSync(path.join(PORTAL_DIR, prefix), { withFileTypes: true }).some((entry) => entry.isDirectory())

/** El archivo donde Next 16 busca el «middleware» (antes `middleware.ts`). */
const proxyFile = 'proxy.ts'

describe('rutas privadas del portal', () => {
  test('hay carpetas que revisar (si no, las pruebas de abajo no vigilan nada)', () => {
    assert.ok(portalFolders.length >= 5, portalFolders.join(', '))
  })

  test('PORTAL_PREFIXES es exactamente la lista de carpetas de app/(portal)/', () => {
    assert.deepEqual([...PORTAL_PREFIXES].sort(), portalFolders)
  })

  test('el matcher de proxy.ts cubre cada carpeta (con /:path* si tiene páginas anidadas)', () => {
    const block = /matcher:\s*\[([\s\S]*?)\]/.exec(read(proxyFile))?.[1] ?? ''
    const matcher = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1])
    for (const prefix of portalFolders) {
      const expected = hasNestedRoutes(prefix) ? `${prefix}/:path*` : prefix
      assert.ok(matcher.includes(expected), `${proxyFile}: falta «${expected}» en el matcher (${matcher.join(', ')})`)
    }
  })

  test('el service worker no cachea nunca una ruta del portal ni la API', () => {
    const body = /function isAuthenticatedRoute\(pathname\) \{([\s\S]*?)\n\}/.exec(read('public/sw.js'))?.[1] ?? ''
    for (const prefix of [...portalFolders, '/api']) {
      const covers = body.includes(`startsWith('${prefix}')`) || body.includes(`startsWith('${prefix}/')`)
      assert.ok(covers, `public/sw.js: isAuthenticatedRoute no cubre ${prefix}`)
    }
  })

  test('robots.txt bloquea el portal y la API, y deja la landing', () => {
    const rules = robots().rules
    const rule = Array.isArray(rules) ? rules[0] : rules
    const disallow = ([] as string[]).concat(rule.disallow ?? [])
    for (const prefix of portalFolders) assert.ok(disallow.includes(prefix), `robots: falta ${prefix}`)
    assert.ok(disallow.includes('/api/'))
    assert.equal(rule.allow, '/')
  })

  test('el portal y las páginas de acceso (login, invitación, asistencia, audio) llevan noindex', () => {
    for (const layout of ['app/(portal)/layout.tsx', 'app/(auth)/layout.tsx']) {
      assert.match(read(layout), /robots:\s*\{\s*index:\s*false/, layout)
    }
  })
})
