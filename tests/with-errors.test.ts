import { describe, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { withApiErrors } from '@/lib/api/with-errors'
import { DB_UNAVAILABLE_MESSAGE, dbUnavailable } from '@/lib/api/responses'
import { QueryFailedError, must } from '@/lib/supabase/must'

// Las rutas de trabajo largo hacen muchas lecturas seguidas y no tenían `try/catch`: un fallo de la base se
// convertía en un 500 vacío (o en un dato a medias). `withApiErrors` + `must()` lo vuelven un 503 en JSON.

const ROOT = process.cwd()

/** console.error en silencio, devolviendo lo que se registró. */
function quiet<T>(run: () => Promise<T>) {
  const spy = mock.method(console, 'error', () => {})
  return run().then(
    (value) => ({ value, logged: spy.mock.calls.map((c) => c.arguments.join(' ')) }),
    (error) => { throw error }
  ).finally(() => spy.mock.restore())
}

describe('withApiErrors', () => {
  test('lo que el handler devuelve pasa tal cual (con sus argumentos)', async () => {
    const handler = withApiErrors(async (a: number, b: string) => NextResponse.json({ a, b }, { status: 201 }))
    const res = await handler(7, 'x')
    assert.equal(res.status, 201)
    assert.deepEqual(await res.json(), { a: 7, b: 'x' })
  })

  test('una consulta que falló (must lanza) es un 503 reintentable, no un 500', async () => {
    const handler = withApiErrors(async () => {
      must({ data: null, error: { message: 'TimeoutError: aborted', code: '' } }, 'Entregable')
      return NextResponse.json({ ok: true })
    })
    const { value, logged } = await quiet(() => handler())
    assert.equal(value.status, 503)
    assert.deepEqual(await value.json(), { error: DB_UNAVAILABLE_MESSAGE })
    assert.match(logged.join('\n'), /Entregable: TimeoutError: aborted/)
  })

  test('cualquier otro error es un 500 en JSON y solo se registra «nombre: mensaje», no el objeto', async () => {
    const secret = Object.assign(new Error('boom'), { details: 'Key (correo)=(ana@x.co) already exists' })
    const handler = withApiErrors(async () => {
      throw secret
    })
    const { value, logged } = await quiet(() => handler())
    assert.equal(value.status, 500)
    assert.deepEqual(await value.json(), { error: 'Ocurrió un error inesperado. Intenta de nuevo.' })
    assert.ok(logged.some((l) => l.includes('Error: boom')))
    assert.ok(!logged.join('\n').includes('ana@x.co'), 'el dato personal no debe llegar al registro')
  })

  test('un error que no es un Error (se lanzó un texto) también sale como JSON', async () => {
    const handler = withApiErrors(async () => {
      throw 'texto suelto'
    })
    const { value } = await quiet(() => handler())
    assert.equal(value.status, 500)
  })

  test('los redirect() y notFound() de Next no son fallos: se dejan pasar', async () => {
    const { redirect } = await import('next/navigation')
    const handler = withApiErrors(async () => redirect('/login'))
    await assert.rejects(() => quiet(() => handler()), (error: Error & { digest?: string }) => /NEXT_REDIRECT/.test(String(error.digest ?? error.message)))
  })
})

describe('dbUnavailable', () => {
  test('503 con el texto de siempre y registro de código + mensaje únicamente', async () => {
    const { value, logged } = await quiet(async () => dbUnavailable('moderador', { message: 'fetch failed', code: '57014' }))
    assert.equal(value.status, 503)
    assert.deepEqual(await value.json(), { error: DB_UNAVAILABLE_MESSAGE })
    assert.deepEqual(logged, ['[api] moderador: 57014 fetch failed'])
  })

  test('QueryFailedError es lo que lanza must()', () => {
    assert.throws(() => must({ data: null, error: { message: 'x' } }, 'Algo'), QueryFailedError)
  })
})

describe('las rutas de la API', () => {
  const code = (file: string) =>
    fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

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

  /** Los dos GET que solo redirigen (retorno de Google y cierre de una cuenta sin perfil): sus fallos ya llevan a /login. */
  const REDIRECT_ROUTES = ['app/api/auth/callback/route.ts', 'app/api/auth/signout/route.ts']

  test('cada handler exportado va envuelto en withApiErrors (un fallo sale como JSON, no como un 500 vacío)', () => {
    const offenders: string[] = []
    for (const file of routes().filter((r) => !REDIRECT_ROUTES.includes(r))) {
      const source = code(file)
      const declared = source.match(/export\s+(?:async\s+function|const)\s+(?:GET|POST|PUT|PATCH|DELETE)\b/g) ?? []
      const wrapped = source.match(/export const (?:GET|POST|PUT|PATCH|DELETE) = withApiErrors\(/g) ?? []
      if (declared.length === 0 || wrapped.length !== declared.length) offenders.push(`${file} (${declared.length} handlers, ${wrapped.length} envueltos)`)
    }
    assert.deepEqual(offenders, [])
  })

  test('ninguna ruta lee solo `{ data }` de una consulta: usa must() o lee también `error`', () => {
    const onlyData = /(?:const|let)\s*\{\s*data(?:\s*:\s*\w+)?\s*\}\s*=\s*await\b/
    const offenders = routes().filter((file) => onlyData.test(code(file)))
    assert.deepEqual(offenders, [])
  })
})
