import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_TIMEOUT_MS, SUPABASE_WRITE_TIMEOUT_MS, createFetchWithTimeout } from '@/lib/supabase/fetch'

// Una consulta que Supabase no contesta dejaba TODO el portal sin navegar (cada página pasa por el middleware y por
// la consulta del perfil) y recargar no ayudaba: ningún cliente de servidor tenía tope. `fetchWithTimeout` aborta las
// consultas y la sesión a los 8 s; Storage no lleva tope (las subidas de audio y fotos tardan). Las escrituras a la
// base tienen más margen (30 s): abortar una que el servidor ya aplicó dejaba un error y, al reintentar, una fila doble.

const ROOT = process.cwd()
const MS = 150

let server: http.Server
let base = ''
/** Cuántas veces llegó cada ruta al servidor (para ver si postgrest-js reintenta). */
const hits = new Map<string, number>()

before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url ?? ''
    hits.set(url.split('?')[0], (hits.get(url.split('?')[0]) ?? 0) + 1)
    // «lento» no contesta nunca (la conexión queda abierta); en Storage tarda, pero contesta.
    if (url.startsWith('/rest/v1/rapido') || url.startsWith('/auth/v1/rapido')) {
      res.end('ok')
    } else if (url.startsWith('/storage/v1/lento')) {
      setTimeout(() => res.end('subido'), MS * 3)
    } else if (url.startsWith('/rest/v1/corta-una-vez')) {
      // La primera vez corta la conexión; la segunda contesta (un corte transitorio de verdad).
      if (hits.get('/rest/v1/corta-una-vez') === 1) req.socket.destroy()
      else {
        res.setHeader('Content-Type', 'application/json')
        res.end('[{"ok":true}]')
      }
    } else if (url.startsWith('/rest/v1/tarda') || url.startsWith('/auth/v1/tarda')) {
      // Contesta, pero pasado el tope de una lectura (MS) y antes del de una escritura (MS * 4).
      setTimeout(() => res.end('aplicado'), MS * 2)
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

after(() => {
  server.closeAllConnections()
  server.close()
})

const fetchWithTimeout = createFetchWithTimeout(MS)
const fetchEscalonado = createFetchWithTimeout(MS, MS * 4)

/** Lo que tarda `fn` hasta fallar, y el error. */
async function failure(fn: () => Promise<unknown>) {
  const started = Date.now()
  try {
    await fn()
  } catch (error) {
    return { error: error as Error, ms: Date.now() - started }
  }
  throw new Error('no falló')
}

describe('fetchWithTimeout', () => {
  test('el tope por defecto es de 8 s para lecturas y 30 s para escrituras', () => {
    assert.equal(SUPABASE_TIMEOUT_MS, 8000)
    assert.equal(SUPABASE_WRITE_TIMEOUT_MS, 30000)
  })

  test('sin tope de escritura aparte, todo vale lo mismo', async () => {
    const { error } = await failure(() => fetchWithTimeout(`${base}/rest/v1/tarda`, { method: 'POST' }))
    assert.equal(error.name, 'AbortError')
  })

  test('una lectura lenta falla al tope corto, pero una escritura que tarda lo mismo llega', async () => {
    const { error } = await failure(() => fetchEscalonado(`${base}/rest/v1/tarda`))
    assert.equal(error.name, 'AbortError')
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      const res = await fetchEscalonado(`${base}/rest/v1/tarda`, { method })
      assert.equal(await res.text(), 'aplicado', method)
    }
  })

  test('HEAD (los conteos) cuenta como lectura, y el método también se lee de un Request', async () => {
    const head = await failure(() => fetchEscalonado(`${base}/rest/v1/tarda`, { method: 'HEAD' }))
    assert.equal(head.error.name, 'AbortError')
    const res = await fetchEscalonado(new Request(`${base}/rest/v1/tarda`, { method: 'POST' }))
    assert.equal(await res.text(), 'aplicado')
  })

  test('Auth siempre lleva el tope corto, también en un POST (renovar la sesión, entrar, salir)', async () => {
    const { error } = await failure(() => fetchEscalonado(`${base}/auth/v1/tarda`, { method: 'POST' }))
    assert.equal(error.name, 'AbortError')
  })

  test('una consulta REST que no contesta falla al cumplirse el tope', async () => {
    const { error, ms } = await failure(() => fetchWithTimeout(`${base}/rest/v1/lento`))
    assert.equal(error.name, 'AbortError')
    assert.ok(ms >= MS - 20 && ms < MS * 6, `${ms} ms`)
  })

  test('lo mismo con la sesión (Auth)', async () => {
    const { error } = await failure(() => fetchWithTimeout(`${base}/auth/v1/lento`))
    assert.equal(error.name, 'AbortError')
  })

  test('una consulta rápida pasa sin cambios', async () => {
    const res = await fetchWithTimeout(`${base}/rest/v1/rapido`)
    assert.equal(await res.text(), 'ok')
    assert.equal((await fetchWithTimeout(new URL(`${base}/auth/v1/rapido`))).status, 200)
  })

  test('Storage no lleva tope: una subida lenta llega', async () => {
    const res = await fetchWithTimeout(`${base}/storage/v1/lento`)
    assert.equal(await res.text(), 'subido')
  })

  test('la señal del llamador también aborta, antes del tope', async () => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(new Error('cancelado a mano')), 30)
    const { error, ms } = await failure(() => fetchWithTimeout(`${base}/rest/v1/lento`, { signal: controller.signal }))
    assert.match(String(error.message), /cancelado a mano|aborted/i)
    assert.ok(ms < MS, `${ms} ms`)
  })

  test('una señal ya abortada falla de inmediato', async () => {
    const { ms } = await failure(() => fetchWithTimeout(`${base}/rest/v1/lento`, { signal: AbortSignal.abort() }))
    assert.ok(ms < MS)
  })
})

describe('con supabase-js de verdad (postgrest-js reintenta los GET que fallan)', () => {
  // postgrest-js reintenta (1, 2 y 4 s de espera) todo GET cuyo `fetch` falla, salvo que el error sea un AbortError. Si
  // el tope venciera con un TimeoutError, una consulta colgada tardaría 8 + 1 + 8 + 2 + 8 + 4 + 8 = 39 s en fallar en
  // vez de 8: justo lo que midió el laboratorio. Esta prueba usa el cliente real para que lo vea si una versión nueva
  // cambia el criterio.
  const client = () =>
    createClient(base, 'anon', { auth: { persistSession: false }, global: { fetch: fetchWithTimeout } })

  test('una consulta colgada falla al primer tope, sin reintentos', async () => {
    const started = Date.now()
    const { data, error } = await client().from('colgado-contado').select('*')
    assert.equal(data, null)
    assert.match(String(error?.message), /AbortError/)
    assert.ok(Date.now() - started < MS * 3, `${Date.now() - started} ms`)
    assert.equal(hits.get('/rest/v1/colgado-contado'), 1, 'llegó más de una vez: se reintentó')
  })

  test('un corte de conexión SÍ se reintenta (eso es lo que se quiere conservar)', async () => {
    const { data, error } = await client().from('corta-una-vez').select('*')
    assert.equal(error, null)
    assert.deepEqual(data, [{ ok: true }])
    assert.equal(hits.get('/rest/v1/corta-una-vez'), 2)
  })
})

describe('todo cliente de Supabase lleva el tope', () => {
  test('cada archivo que crea uno (servidor o navegador) usa fetchWithTimeout', () => {
    const offenders: string[] = []
    let found = 0
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(rel)
        else if (/\.tsx?$/.test(entry.name)) {
          const source = fs.readFileSync(path.join(ROOT, rel), 'utf8')
          const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
          if (/\b(?:createServerClient|createBrowserClient|createClient)\s*\(/.test(code)) {
            found++
            if (!/global:\s*\{\s*fetch:\s*fetchWithTimeout\s*\}/.test(code)) offenders.push(rel)
          }
        }
      }
    }
    for (const dir of ['app', 'lib']) walk(dir)
    assert.ok(found >= 6, `solo se encontraron ${found} clientes`)
    assert.deepEqual(offenders, [], 'sin `global: { fetch: fetchWithTimeout }` una consulta colgada deja al portal sin navegar')
  })
})
