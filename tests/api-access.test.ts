import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js'
import { ACCESS_UNAVAILABLE_MESSAGE, isAuthUnavailable } from '@/lib/auth/unavailable'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'
import { resolveEducationAccess } from '@/lib/education/session-access'
import { resolveCharlaAccess } from '@/lib/charlas/access'

// Una caída de Auth o de la base se contestaba como «No autenticado» (401), «Sin permisos» (403) o «no encontrada»
// (404): quien sigue con su sesión creía haberla perdido, o que la sesión se había borrado. Ahora es un 503, que
// invita a reintentar, y los 403/404 quedan para cuando de verdad no tiene permiso o no existe.

const ROOT = process.cwd()
const USER = { id: '11111111-1111-1111-1111-111111111111' } as User
const OTHER = '22222222-2222-2222-2222-222222222222'
const SESSION_ID = '33333333-3333-3333-3333-333333333333'

type Result = { data: unknown; error: { message: string; code?: string } | null }

/** Un cliente de Supabase mínimo: cada tabla contesta con su resultado. Sin `.single()` a propósito: da error con 0
 *  filas (y con un id que no es UUID), justo lo que se confundía con «no existe». */
function fakeSupabase(tables: Record<string, Result>) {
  const queried: string[] = []
  const client = {
    from(table: string) {
      queried.push(table)
      const result = tables[table] ?? { data: null, error: null }
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => result,
        single: async () => {
          throw new Error('single() no debe usarse: con 0 filas devuelve un error, no null')
        },
      }
      return builder
    },
  }
  return { client: client as unknown as SupabaseClient, queried }
}

const profile = (role: string, modules: string[] = []): Result => ({
  data: {
    role,
    nombre: 'Ana',
    correo: 'ana@x.co',
    profile_module_grants: modules.map((module_key) => ({ module_key })),
  },
  error: null,
})

const TIMEOUT = { message: 'TimeoutError: The operation was aborted due to timeout', code: '' }
const INVALID_UUID = { message: 'invalid input syntax for type uuid: "abc"', code: '22P02' }

describe('isAuthUnavailable', () => {
  test('una red caída, un tope de tiempo o un 5xx de Auth NO son «sin sesión»', () => {
    for (const status of [0, 502, 503, 504]) {
      assert.equal(isAuthUnavailable(new AuthRetryableFetchError('fetch failed', status)), true, `retryable ${status}`)
    }
    for (const status of [500, 502, 503]) {
      assert.equal(isAuthUnavailable(new AuthApiError('unexpected failure', status, 'unexpected_failure')), true, `api ${status}`)
    }
  })

  test('una sesión que falta, vencida o revocada sí es «sin sesión»', () => {
    assert.equal(isAuthUnavailable(new AuthSessionMissingError()), false)
    for (const status of [400, 401, 403, 404, 422]) {
      assert.equal(isAuthUnavailable(new AuthApiError('invalid JWT', status, 'bad_jwt')), false, `api ${status}`)
    }
  })

  test('sin error, o con algo que no es de Auth, no hay caída', () => {
    assert.equal(isAuthUnavailable(null), false)
    assert.equal(isAuthUnavailable(undefined), false)
    assert.equal(isAuthUnavailable(new Error('x')), false)
    assert.equal(isAuthUnavailable({ name: 'AuthRetryableFetchError', status: 0 }), false, 'un objeto cualquiera no vale')
  })
})

const RESOLVERS = [
  {
    nombre: 'Terapia',
    modulo: 'entregables_terapia',
    tabla: 'therapy_sessions',
    fila: {
      id: SESSION_ID,
      title: 'Sesión',
      session_date: '2026-10-22',
      moderator_id: USER.id,
      status: 'borrador',
      created_by: OTHER,
      co_admin_ids: [],
      invitados: { nombre: 'Empresa' },
    },
    resolver: (client: SupabaseClient) => resolveDeliverableAccess(client, USER, SESSION_ID),
  },
  {
    nombre: 'Education',
    modulo: 'entregables_educacion',
    tabla: 'education_sessions',
    fila: {
      id: SESSION_ID,
      title: 'Sesión',
      session_date: '2026-10-22',
      admin_id: USER.id,
      status: 'borrador',
      created_by: OTHER,
      co_admin_ids: [],
    },
    resolver: (client: SupabaseClient) => resolveEducationAccess(client, USER, SESSION_ID),
  },
  {
    nombre: 'Charlas',
    modulo: 'charlas',
    tabla: 'charlas',
    fila: { id: SESSION_ID, title: 'Charla', session_date: '2026-10-22', photo_url: null },
    resolver: (client: SupabaseClient) => resolveCharlaAccess(client, USER, SESSION_ID),
  },
] as const

for (const { nombre, modulo, tabla, fila, resolver } of RESOLVERS) {
  describe(`acceso a ${nombre}`, () => {
    const status = async (tables: Record<string, Result>) => {
      const { client, queried } = fakeSupabase(tables)
      const access = (await resolver(client)) as { allowed: boolean; statusCode?: number; error?: string }
      return { access, queried }
    }

    test('con el módulo y la fila: entra', async () => {
      const { access } = await status({ profiles: profile('community_admin', [modulo]), [tabla]: { data: fila, error: null } })
      assert.equal(access.allowed, true)
      assert.equal(access.statusCode, undefined)
    })

    test('si la consulta del perfil falla: 503, no «Sin permisos», y ni mira la sesión', async () => {
      const { access, queried } = await status({ profiles: { data: null, error: TIMEOUT }, [tabla]: { data: fila, error: null } })
      assert.equal(access.allowed, false)
      assert.equal(access.statusCode, 503)
      assert.equal(access.error, ACCESS_UNAVAILABLE_MESSAGE)
      assert.deepEqual(queried, ['profiles'])
    })

    test('sin perfil, o sin el módulo: 403 «Sin permisos»', async () => {
      for (const profiles of [{ data: null, error: null }, profile('community_admin', [])]) {
        const { access } = await status({ profiles, [tabla]: { data: fila, error: null } })
        assert.equal(access.statusCode, 403)
        assert.equal(access.error, 'Sin permisos')
      }
    })

    test('si la consulta de la sesión falla: 503, no «no encontrada»', async () => {
      const { access } = await status({ profiles: profile('community_admin', [modulo]), [tabla]: { data: null, error: TIMEOUT } })
      assert.equal(access.allowed, false)
      assert.equal(access.statusCode, 503)
      assert.equal(access.error, ACCESS_UNAVAILABLE_MESSAGE)
    })

    test('una sesión que no existe, o un id que no es UUID: 404', async () => {
      for (const sesion of [{ data: null, error: null }, { data: null, error: INVALID_UUID }]) {
        const { access } = await status({ profiles: profile('community_admin', [modulo]), [tabla]: sesion })
        assert.equal(access.statusCode, 404)
      }
    })
  })
}

describe('las API: quién llama', () => {
  const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')
  const code = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  function routes(): string[] {
    const out: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(rel)
        else if (entry.name === 'route.ts') out.push(rel)
      }
    }
    walk('app/api')
    return out.sort()
  }

  /** Las únicas rutas que se pueden llamar sin sesión: el registro público de la Walking List, el de asistencia por
   *  QR (protegido por su token), y el retorno de Google / el cierre de una cuenta sin perfil. */
  const PUBLIC_ROUTES = [
    'app/api/attendance/[token]/route.ts',
    'app/api/auth/callback/route.ts',
    'app/api/auth/signout/route.ts',
    'app/api/walking-list/route.ts',
  ]

  test('las rutas públicas son solo las de la lista, y existen', () => {
    const all = routes()
    assert.ok(all.length >= 40, `${all.length} rutas`)
    for (const route of PUBLIC_ROUTES) assert.ok(all.includes(route), `${route} ya no existe: quítala de la lista`)
  })

  test('toda otra ruta autentica CADA método que exporta', () => {
    const offenders: string[] = []
    for (const route of routes().filter((r) => !PUBLIC_ROUTES.includes(r))) {
      const source = code(route)
      const methods = source.match(/export\s+(?:async\s+function|const)\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g) ?? []
      const checks = source.match(/\b(?:requireApiUser|requireApiPermission)\(/g) ?? []
      if (methods.length === 0 || checks.length < methods.length) offenders.push(`${route} (${methods.length} métodos, ${checks.length} comprobaciones)`)
    }
    assert.deepEqual(offenders, [])
  })

  test('nadie usa ya `getAuthUser` (un fallo de Auth se leía como 401)', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(rel)
        else if (/\.tsx?$/.test(entry.name) && /\bgetAuthUser\b/.test(code(rel))) offenders.push(rel)
      }
    }
    for (const dir of ['app', 'lib', 'components']) walk(dir)
    assert.deepEqual(offenders, [])
  })

  test('requireApiUser contesta 503 si Auth no contestó y 401 si no hay sesión; requireApiPermission 503 si falló el perfil', () => {
    const api = code('lib/auth/api.ts')
    assert.match(api, /isAuthUnavailable\(error\)\)\s*return\s*\{\s*ok:\s*false,\s*response:\s*accessUnavailable\(\)/)
    assert.match(api, /'No autenticado'\s*\}\s*,\s*\{\s*status:\s*401/)
    assert.match(api, /lookup\.status\s*===\s*'error'[\s\S]*?accessUnavailable\(\)/)
    assert.match(api, /status:\s*503/)
  })

  test('los módulos de acceso no usan `.single()` (con 0 filas da error: «no existe» y «falló» se confundían)', () => {
    for (const file of ['lib/therapy/deliverable-access.ts', 'lib/education/session-access.ts', 'lib/charlas/access.ts', 'lib/auth/session-user.ts']) {
      assert.doesNotMatch(code(file), /\.single\(\)/, file)
    }
  })
})

describe('las API: conflictos de estado', () => {
  const ROOT_DIR = process.cwd()
  const routeFiles: string[] = []
  const walkRoutes = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(ROOT_DIR, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name)
      if (entry.isDirectory()) walkRoutes(rel)
      else if (entry.name === 'route.ts') routeFiles.push(rel)
    }
  }
  walkRoutes('app/api')
  const source = (file: string) => fs.readFileSync(path.join(ROOT_DIR, file), 'utf8')

  test('«ya fue enviado», «ya no está en borrador» y «archivada» son 409 (el estado no lo permite), no 403 (la persona no puede)', () => {
    const stateConflict = /NextResponse\.json\(\s*\{\s*error:\s*(?:\n\s*)?['"][^'"]*?(?:ya fue enviado|ya no está en borrador)[^'"]*['"],?\s*\},\s*\{ status: 403 \}/
    const archived403 = /\{ error: archived \},\s*\{ status: 403 \}/
    const offenders = routeFiles.filter((file) => stateConflict.test(source(file)) || archived403.test(source(file)))
    assert.deepEqual(offenders, [])
  })

  test('y sigue habiendo 403 donde de verdad es un permiso (sin permisos, sin ser moderador…)', () => {
    const withForbidden = routeFiles.filter((file) => /status: 403/.test(source(file)))
    assert.ok(withForbidden.length >= 8, `${withForbidden.length}`)
  })
})
