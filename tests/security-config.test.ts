import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import nextConfig from '../next.config.mjs'

// Ni cabeceras de seguridad, ni X-Frame-Options, ni Referrer-Policy: el portal se podía enmarcar en otro sitio y el
// servidor anunciaba `X-Powered-By: Next.js`. Y el CI le daba la llave de servicio de PRODUCCIÓN a todos los pasos.

const ROOT = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')

describe('cabeceras de seguridad (next.config.mjs)', () => {
  test('todas las rutas llevan las cabeceras', async () => {
    const rules = await nextConfig.headers!()
    assert.equal(rules.length, 1)
    assert.equal(rules[0].source, '/:path*')
    const headers = Object.fromEntries(rules[0].headers.map((h: { key: string; value: string }) => [h.key, h.value]))
    assert.equal(headers['X-Frame-Options'], 'DENY')
    assert.equal(headers['X-Content-Type-Options'], 'nosniff')
    assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin')
  })

  test('el micrófono solo para el propio sitio (la grabadora lo usa); geolocalización, pagos y USB, nunca', async () => {
    const [rule] = await nextConfig.headers!()
    const policy = rule.headers.find((h: { key: string }) => h.key === 'Permissions-Policy')!.value
    assert.match(policy, /microphone=\(self\)/)
    for (const feature of ['geolocation', 'payment', 'usb']) assert.match(policy, new RegExp(`${feature}=\\(\\)`))
    assert.doesNotMatch(policy, /camera/, 'la subida de fotos puede abrir la cámara desde el selector de archivos')
  })

  test('no anuncia el framework', () => {
    assert.equal(nextConfig.poweredByHeader, false)
  })

  test('el sitio no se enmarca a sí mismo: ningún iframe propio (el de YouTube es de otro origen)', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(rel)
        else if (/\.tsx$/.test(entry.name)) {
          for (const match of read(rel).matchAll(/<iframe[\s\S]*?>/g)) {
            if (!/src=\{?["'`]?https:\/\/www\.youtube/.test(match[0]) && !/youtube/i.test(match[0])) offenders.push(`${rel}: ${match[0].slice(0, 60)}`)
          }
        }
      }
    }
    for (const dir of ['app', 'components']) walk(dir)
    assert.deepEqual(offenders, [], 'un iframe propio chocaría con X-Frame-Options: DENY')
  })
})

describe('CI y versión de Node', () => {
  const ci = read('.github/workflows/ci.yml')

  test('el job solo lee el repositorio', () => {
    assert.match(ci, /^permissions:\s*\n\s+contents: read/m)
  })

  test('ninguna llave real de producción: valores ficticios para el build', () => {
    assert.doesNotMatch(ci, /secrets\./, 'el build no necesita las llaves reales (y el job las exponía a todos los pasos)')
    assert.match(ci, /NEXT_PUBLIC_SUPABASE_URL: https:\/\/ci\./)
    assert.match(ci, /SUPABASE_SERVICE_ROLE_KEY: ci-service-role-key/)
  })

  test('corre en Node 22 y 24 y revisa las vulnerabilidades de producción antes del lint', () => {
    assert.match(ci, /node: \[22, 24\]/)
    assert.match(ci, /node-version: \$\{\{ matrix\.node \}\}/)
    const audit = ci.indexOf('npm audit --omit=dev --audit-level=high')
    assert.ok(audit !== -1 && audit < ci.indexOf('npm run lint'))
  })

  test('package.json declara Node ≥ 22 (el runtime de despliegue)', () => {
    assert.equal(JSON.parse(read('package.json')).engines.node, '>=22')
  })
})
