import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { SessionLoadError, loadSessionUser, type ProfileClient } from '@/lib/auth/session-user'
import { decideRoute } from '@/lib/supabase/route-guard'
import { PORTAL_PREFIXES } from '@/lib/data/portal-routes'
import { isSessionCookie } from '@/lib/auth/session-cookies'
import { authQueryError } from '@/lib/data/auth-copy'

// Antes, un fallo de la consulta del perfil (Supabase lento, un 5xx) o una cuenta sin fila en `profiles` daban
// `null`: `requireAuth` mandaba a /login y el middleware devolvía de /login a /perfil a quien tiene sesión, en
// bucle. Ahora `loadSessionUser` distingue «no tiene perfil» de «la consulta falló», y el middleware no cierra
// sesiones cuando es Supabase Auth quien no contesta.

const ROOT = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const USER = '22222222-2222-2222-2222-222222222222'

/** Un cliente de Supabase mínimo: `.from().select().eq().maybeSingle()` resuelve `result`. Sin `.single()` a
 *  propósito: si el código volviera a usarlo (que da error con 0 filas), la prueba se rompería. */
function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const calls: { table?: string; select?: string; eq?: [string, string] } = {}
  const client = {
    from(table: string) {
      calls.table = table
      return {
        select(columns: string) {
          calls.select = columns
          return {
            eq(column: string, value: string) {
              calls.eq = [column, value]
              return { maybeSingle: async () => result }
            },
          }
        },
      }
    },
  }
  return { client: client as unknown as ProfileClient, calls }
}

describe('loadSessionUser', () => {
  test('con perfil: devuelve a la persona con sus permisos (rol + módulos otorgados)', async () => {
    const { client, calls } = fakeClient({
      data: { role: 'community_admin', nombre: 'Ana', correo: 'ana@x.co', profile_module_grants: [{ module_key: 'parrilla' }] },
      error: null,
    })
    const lookup = await loadSessionUser(client, USER)
    assert.equal(lookup.status, 'ok')
    if (lookup.status !== 'ok') return
    assert.deepEqual([lookup.user.id, lookup.user.email, lookup.user.role, lookup.user.nombre], [USER, 'ana@x.co', 'community_admin', 'Ana'])
    assert.ok(lookup.user.permissions.includes('parrilla:manage'), 'el módulo otorgado suma su permiso')
    assert.ok(!lookup.user.permissions.includes('leads:read_all'), 'y no suma lo que no se otorgó')
    assert.deepEqual([calls.table, calls.eq], ['profiles', ['id', USER]])
    assert.match(calls.select ?? '', /profile_module_grants!profile_module_grants_profile_id_fkey\(module_key\)/)
  })

  test('el super administrador tiene todos los permisos', async () => {
    const { client } = fakeClient({ data: { role: 'super_admin', nombre: 'S', correo: 's@x.co', profile_module_grants: [] }, error: null })
    const lookup = await loadSessionUser(client, USER)
    assert.equal(lookup.status, 'ok')
    if (lookup.status === 'ok') assert.ok(lookup.user.permissions.includes('users:delete'))
  })

  test('sin fila en profiles: «sin-perfil», no un error', async () => {
    const { client } = fakeClient({ data: null, error: null })
    assert.deepEqual(await loadSessionUser(client, USER), { status: 'sin-perfil' })
  })

  test('si la consulta falla es un ERROR, no «sin perfil» ni «sin sesión»', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'TimeoutError: The operation was aborted due to timeout' } })
    assert.deepEqual(await loadSessionUser(client, USER), {
      status: 'error',
      message: 'TimeoutError: The operation was aborted due to timeout',
    })
  })

  test('SessionLoadError conserva la causa', () => {
    const cause = new Error('x')
    const error = new SessionLoadError('No se pudo validar la sesión', { cause })
    assert.equal(error.name, 'SessionLoadError')
    assert.equal(error.cause, cause)
  })
})

describe('decideRoute (qué hace el middleware)', () => {
  const portal = PORTAL_PREFIXES.flatMap((prefix) => [prefix, `${prefix}/algo/mas`])

  test('sin sesión, una ruta del portal manda a /login', () => {
    for (const pathname of portal) {
      assert.equal(decideRoute({ pathname, userId: null, sessionUnknown: false }), 'to-login', pathname)
    }
  })

  test('si la sesión no se pudo VERIFICAR (Auth no contesta), no se cierra la sesión de nadie: la petición pasa', () => {
    for (const pathname of portal) {
      assert.equal(decideRoute({ pathname, userId: null, sessionUnknown: true }), 'continue', pathname)
    }
  })

  test('con sesión, el portal pasa y el login / la invitación mandan a /perfil', () => {
    for (const pathname of portal) assert.equal(decideRoute({ pathname, userId: USER, sessionUnknown: false }), 'continue', pathname)
    for (const pathname of ['/login', '/invite/abc123', '/login?error=perfil']) {
      assert.equal(decideRoute({ pathname, userId: USER, sessionUnknown: false }), 'to-perfil', pathname)
    }
  })

  test('lo público no cambia: la landing, la asistencia, el audio y la API pasan con o sin sesión', () => {
    for (const pathname of ['/', '/asistencia/abc', '/audio/x', '/api/walking-list', '/robots.txt']) {
      for (const userId of [null, USER]) {
        assert.equal(decideRoute({ pathname, userId, sessionUnknown: false }), 'continue', `${pathname} · ${userId}`)
      }
    }
  })

  test('sin sesión, /login y /invite pasan (se puede entrar)', () => {
    for (const pathname of ['/login', '/invite/abc123']) {
      assert.equal(decideRoute({ pathname, userId: null, sessionUnknown: false }), 'continue', pathname)
    }
  })
})

describe('el middleware: lo que no se puede olvidar', () => {
  const src = read('lib/supabase/middleware.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  test('descarta el header x-gladwell-user-id que llega del navegador ANTES de crear la respuesta, y solo lo pone con la sesión verificada', () => {
    const deleted = src.indexOf('request.headers.delete(USER_ID_HEADER)')
    const firstNext = src.indexOf('NextResponse.next(')
    assert.ok(deleted !== -1 && firstNext !== -1 && deleted < firstNext, 'el header inventado se borra antes de crear la respuesta')
    const setAt = src.indexOf('request.headers.set(USER_ID_HEADER, userId)')
    assert.ok(setAt !== -1)
    assert.ok(src.lastIndexOf('if (userId) {', setAt) > src.indexOf('decideRoute('), 'solo dentro de `if (userId)`, después de decidir')
    assert.match(src, /const USER_ID_HEADER = 'x-gladwell-user-id'/)
  })

  test('verifica con getClaims (local con llave asimétrica), no con getUser (un viaje a Supabase en cada navegación)', () => {
    assert.match(src, /supabase\.auth\.getClaims\(\)/)
    assert.doesNotMatch(src, /auth\.getUser\(\)/)
  })

  test('las redirecciones llevan las cookies que Supabase renovó o borró', () => {
    assert.match(src, /redirect\.cookies\.set\(cookie\)/)
  })

  test('la página lee el mismo header que pone el middleware', () => {
    assert.match(read('lib/auth/session.ts'), /headers\(\)\)\.get\('x-gladwell-user-id'\)/)
  })
})

describe('isSessionCookie', () => {
  test('reconoce las cookies donde @supabase/ssr guarda la sesión, también partidas en trozos', () => {
    for (const name of [
      'sb-abcdefgh-auth-token',
      'sb-abcdefgh-auth-token.0',
      'sb-abcdefgh-auth-token.12',
      'sb-abcdefgh-auth-token-code-verifier',
      'sb-abcdefgh-auth-token-code-verifier.0',
    ]) {
      assert.equal(isSessionCookie(name), true, name)
    }
  })

  test('no toca ninguna otra cookie (el tema, el menú, el cookie de otro sitio)', () => {
    for (const name of ['theme', 'sidebar_state', 'auth-token', 'xsb-a-auth-token', 'sb-a-auth-token.x', 'sb-a-auth-tokens', 'sb-a-other', '']) {
      assert.equal(isSessionCookie(name), false, name)
    }
  })
})

describe('el aviso del login (?error=)', () => {
  test('cada código que el sitio deja en la URL tiene su texto', () => {
    assert.match(authQueryError('auth') ?? '', /enlace|acceso/i)
    assert.match(authQueryError('perfil') ?? '', /perfil/i)
  })

  test('cualquier otro valor se ignora (también los nombres de propiedades de un objeto)', () => {
    for (const code of [null, '', 'x', 'AUTH', 'constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      assert.equal(authQueryError(code), null, String(code))
    }
  })

  test('los códigos que usan las redirecciones son los que el login entiende', () => {
    const codes = new Set<string>()
    for (const file of ['app/api/auth/callback/route.ts', 'app/api/auth/signout/route.ts']) {
      for (const match of read(file).matchAll(/\/login\?error=(\w+)/g)) codes.add(match[1])
    }
    assert.deepEqual([...codes].sort(), ['auth', 'perfil'])
    for (const code of codes) assert.notEqual(authQueryError(code), null, code)
    assert.match(read('app/(auth)/login/page.tsx'), /authQueryError\(searchParams\.get\('error'\)\)/)
  })
})

describe('una cuenta con sesión pero sin perfil', () => {
  const strip = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  test('requireAuth la manda a cerrar sesión y no a /login (el middleware la devolvería a /perfil: bucle)', () => {
    assert.match(strip('lib/auth/session.ts'), /state\.kind === 'sin-perfil'\)\s*redirect\('\/api\/auth\/signout'\)/)
  })

  test('la ruta de cierre solo actúa si de verdad no hay perfil, y no se fía del header del middleware', () => {
    const route = strip('app/api/auth/signout/route.ts')
    const guard = route.indexOf("lookup.status !== 'sin-perfil'")
    const signOut = route.indexOf('auth.signOut(')
    assert.ok(guard !== -1 && signOut !== -1 && guard < signOut, 'la guarda va antes de cerrar la sesión')
    assert.match(route, /lookup\.status !== 'sin-perfil'\)\s*return NextResponse\.redirect\(`\$\{origin\}\/dashboard`\)/)
    assert.doesNotMatch(route, /x-gladwell-user-id/)
    assert.match(route, /auth\.getClaims\(\)/)
  })

  test('borra las cookies de sesión aunque Auth no conteste (si no, el bucle seguiría)', () => {
    const route = strip('app/api/auth/signout/route.ts')
    assert.match(route, /isSessionCookie\(name\)\)\s*cookieStore\.delete\(name\)/)
    assert.match(route, /signOut\(\{ scope: 'local' \}\)\.catch\(/)
  })

  test('el botón de salir hace lo mismo desde el navegador: si Auth no revocó, borra las cookies y recarga entera', () => {
    const hook = strip('hooks/use-sign-out.ts')
    assert.match(hook, /revoked = !error/)
    assert.match(hook, /if \(!revoked\) \{\s*clearSessionCookies\(\)\s*window\.location\.href = '\/login'/)
    for (const file of ['components/portal/portal-navbar.tsx', 'components/portal/portal-sidebar.tsx', 'components/portal/sign-out-button.tsx']) {
      assert.match(strip(file), /useSignOut\(\)/, file)
      assert.doesNotMatch(strip(file), /auth\.signOut\(/, `${file}: cada botón tenía su copia del cierre de sesión`)
    }
  })
})
