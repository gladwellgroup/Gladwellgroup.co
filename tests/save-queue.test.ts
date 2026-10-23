import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createSaveQueue } from '@/lib/save-queue'
import { KEEPALIVE_MAX_BYTES, sendOnLeave, type KeepaliveRequest } from '@/lib/keepalive'

// Los cuatro formularios de Encuentros autoguardaban con un temporizador de 1,2–1,5 s que se cancelaba al desmontarse, y
// `await saveNow()` volvía al instante si ya había un guardado en marcha. Resultado: texto perdido al navegar, y
// «Aprobar»/«Crear entregable» corriendo con el texto anterior.

const ROOT = process.cwd()
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

/** Un guardado que se resuelve cuando se le ordena, y cuenta cuántas veces se ejecutó. */
function controllableSave() {
  const releases: Array<() => void> = []
  const state = { runs: 0, active: 0, maxActive: 0 }
  const saveOnce = () =>
    new Promise<void>((resolve) => {
      state.runs += 1
      state.active += 1
      state.maxActive = Math.max(state.maxActive, state.active)
      releases.push(() => {
        state.active -= 1
        resolve()
      })
    })
  return { state, saveOnce, releaseNext: () => releases.shift()?.() }
}

describe('createSaveQueue', () => {
  test('un guardado en marcha: lo lanza una vez', async () => {
    const { state, saveOnce, releaseNext } = controllableSave()
    const saveNow = createSaveQueue(saveOnce)
    const done = saveNow()
    await tick()
    releaseNext()
    await done
    assert.equal(state.runs, 1)
  })

  test('nunca hay dos guardados a la vez, y lo escrito mientras se guardaba se guarda DESPUÉS, una sola vez', async () => {
    const { state, saveOnce, releaseNext } = controllableSave()
    const saveNow = createSaveQueue(saveOnce)
    const first = saveNow()
    await tick()
    const second = saveNow()
    const third = saveNow()
    await tick()
    assert.equal(state.runs, 1, 'el segundo y el tercero esperan')
    releaseNext()
    await tick()
    assert.equal(state.runs, 2, 'repite una vez con lo último (no una por llamada)')
    releaseNext()
    await Promise.all([first, second, third])
    assert.equal(state.runs, 2)
    assert.equal(state.maxActive, 1)
  })

  test('la promesa de una llamada hecha MIENTRAS se guarda espera de verdad a que lo último quede guardado', async () => {
    const { saveOnce, releaseNext } = controllableSave()
    const saveNow = createSaveQueue(saveOnce)
    void saveNow()
    await tick()
    let resolved = false
    const waiting = saveNow().then(() => {
      resolved = true
    })
    await tick()
    releaseNext() // termina el primero; arranca la repetición
    await tick()
    assert.equal(resolved, false, 'antes volvía al instante, con el guardado anterior todavía a medias')
    releaseNext()
    await waiting
    assert.equal(resolved, true)
  })

  test('terminado todo, un guardado nuevo vuelve a lanzarse (la cola no queda trabada)', async () => {
    const { state, saveOnce, releaseNext } = controllableSave()
    const saveNow = createSaveQueue(saveOnce)
    const a = saveNow()
    await tick()
    releaseNext()
    await a
    const b = saveNow()
    await tick()
    releaseNext()
    await b
    assert.equal(state.runs, 2)
  })

  test('si un guardado lanza, la cola se libera y rechaza a quien la espera', async () => {
    let calls = 0
    const saveNow = createSaveQueue(async () => {
      calls += 1
      if (calls === 1) throw new Error('boom')
    })
    await assert.rejects(saveNow(), /boom/)
    await saveNow()
    assert.equal(calls, 2)
  })
})

describe('sendOnLeave (keepalive)', () => {
  type Call = { url: string; init: RequestInit }
  const record = () => {
    const calls: Call[] = []
    const doFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch
    return { calls, doFetch }
  }

  test('manda cada petición con keepalive, JSON y el mismo método', () => {
    const { calls, doFetch } = record()
    const requests: KeepaliveRequest[] = [
      { url: '/api/therapy/inputs', method: 'POST', body: { session_id: 's', reto_problema: 'texto' } },
      { url: '/api/therapy/invitados/i1', method: 'PATCH', body: { nombre: 'Acme' } },
    ]
    sendOnLeave(requests, doFetch)
    assert.equal(calls.length, 2)
    assert.deepEqual(
      calls.map((c) => [c.url, c.init.method, c.init.keepalive]),
      [['/api/therapy/inputs', 'POST', true], ['/api/therapy/invitados/i1', 'PATCH', true]]
    )
    assert.equal(calls[0].init.body, JSON.stringify(requests[0].body))
    assert.deepEqual(calls[0].init.headers, { 'Content-Type': 'application/json' })
    assert.equal(calls[0].init.credentials, 'same-origin')
  })

  test('un cuerpo mayor al tope de keepalive (64 KB compartidos) va como petición normal, no se pierde', () => {
    const { calls, doFetch } = record()
    sendOnLeave([{ url: '/api/x', method: 'POST', body: { texto: 'a'.repeat(KEEPALIVE_MAX_BYTES + 1) } }], doFetch)
    assert.equal(calls[0].init.keepalive, false)
    sendOnLeave([{ url: '/api/x', method: 'POST', body: { texto: 'á'.repeat(KEEPALIVE_MAX_BYTES / 2) } }], doFetch)
    assert.equal(calls[1].init.keepalive, false, 'se miden BYTES, no caracteres (la «á» pesa 2)')
  })

  test('un fallo de red al salir no lanza (la página ya se va)', async () => {
    const doFetch = (async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    assert.doesNotThrow(() => sendOnLeave([{ url: '/api/x', method: 'POST', body: {} }], doFetch))
    await tick()
  })
})

describe('los cuatro formularios guardan al salir', () => {
  const code = (file: string) =>
    fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  const FORMS = [
    'components/portal/deliverable-editor.tsx',
    'components/portal/education-deliverable-editor.tsx',
    'components/portal/session-detail-form.tsx',
    'components/portal/education-session-form.tsx',
  ]

  test('cada uno usa useFlushOnLeave y la cola de un vuelo, sin su copia de isSavingRef/pendingRef', () => {
    for (const file of FORMS) {
      const source = code(file)
      assert.match(source, /useFlushOnLeave\(\{/, `${file}: no guarda al salir`)
      assert.match(source, /useSaveQueue\(/, `${file}: no usa la cola compartida`)
      assert.doesNotMatch(source, /isSavingRef|pendingRef/, `${file}: sigue con su propia copia de la cola`)
    }
  })

  test('el gancho cubre desmontar, pagehide y visibilitychange (iPad)', () => {
    const hook = code('hooks/use-flush-on-leave.ts')
    assert.match(hook, /addEventListener\('pagehide', flush\)/)
    assert.match(hook, /addEventListener\('visibilitychange', onVisibility\)/)
    assert.match(hook, /visibilityState === 'hidden'/)
    assert.match(hook, /return \(\) => \{[\s\S]*?flush\(\)\s*\}/, 'el cleanup (desmontar) también guarda')
  })
})
