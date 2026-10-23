import { describe, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isStale, isWorking, isWorkingStatus, STALE_PROCESSING_MS } from '@/lib/deliverables/processing'
import { claimProcessing, runClaimed, startGeneration } from '@/lib/deliverables/claim'
import { QueryFailedError } from '@/lib/supabase/must'

// Terapia no reclamaba el trabajo de síntesis: cada apertura del editor en «generando» relanzaba la transcripción y la
// llamada al modelo, y los dos `/generate` hacían un upsert incondicional que pisaba una generación en curso. Education sí
// reclamaba (UPDATE condicional), pero con su propia copia del código. Ahora es un solo claim para los dos.

const ROOT = process.cwd()
const SESSION = '33333333-3333-3333-3333-333333333333'
const NOW = Date.parse('2026-10-22T20:00:00.000Z')
const iso = (ms: number) => new Date(NOW + ms).toISOString()

type Result = { data: unknown; error: { message: string; code?: string } | null }

/** Un cliente de Supabase que apunta cada llamada (método + argumentos) y contesta los resultados en orden. */
function fakeClient(...results: Result[]) {
  const calls: Array<[string, ...unknown[]]> = []
  let i = 0
  const next = (): Result => results[i++] ?? { data: null, error: null }
  const builder: Record<string, unknown> = {}
  for (const method of ['update', 'insert', 'select', 'eq', 'or']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args])
      return builder
    }
  }
  builder.maybeSingle = async () => (calls.push(['maybeSingle']), next())
  builder.single = async () => (calls.push(['single']), next())
  // `await builder` (update/select sin single) también consume el siguiente resultado
  builder.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(next()).then(resolve, reject)
  const client = { from: (table: string) => (calls.push(['from', table]), builder) }
  return { client: client as unknown as SupabaseClient, calls }
}
const callsOf = (calls: Array<[string, ...unknown[]]>, method: string) => calls.filter((c) => c[0] === method).map((c) => c.slice(1))

describe('isWorking / isStale (qué síntesis está viva)', () => {
  test('solo «generando» y «procesando» son estados de trabajo', () => {
    assert.equal(isWorkingStatus('generando'), true)
    assert.equal(isWorkingStatus('procesando'), true)
    for (const status of ['listo', 'error', '', null, undefined, 'enviando']) assert.equal(isWorkingStatus(status), false, String(status))
  })

  test('viva = estado de trabajo con un inicio de hace menos de 6 minutos', () => {
    assert.equal(STALE_PROCESSING_MS, 6 * 60 * 1000)
    assert.equal(isWorking('procesando', iso(-60_000), NOW), true)
    assert.equal(isWorking('generando', iso(-(STALE_PROCESSING_MS - 1)), NOW), true)
    assert.equal(isWorking('procesando', iso(-STALE_PROCESSING_MS), NOW), false, 'justo a los 6 min ya se considera muerta')
    assert.equal(isWorking('listo', iso(-1000), NOW), false)
    assert.equal(isWorking('error', iso(-1000), NOW), false)
  })

  test('sin fecha de inicio (o con una inválida) no se puede saber: se da por muerta, no por bloqueada para siempre', () => {
    assert.equal(isWorking('procesando', null, NOW), false)
    assert.equal(isWorking('generando', undefined, NOW), false)
    assert.equal(isWorking('procesando', 'no-es-una-fecha', NOW), false)
  })

  test('vencida = en estado de trabajo pero muerta (es lo que ofrece «Reintentar»)', () => {
    assert.equal(isStale('procesando', iso(-STALE_PROCESSING_MS - 1), NOW), true)
    assert.equal(isStale('generando', null, NOW), true)
    assert.equal(isStale('procesando', iso(-1000), NOW), false)
    assert.equal(isStale('listo', iso(-STALE_PROCESSING_MS * 5), NOW), false)
  })
})

describe('claimProcessing', () => {
  test('pide pasar a «procesando» solo si está en «generando» o en un «procesando» vencido (o sin fecha)', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 'd1' }], error: null })
    assert.equal(await claimProcessing(client, 'therapy_deliverables', SESSION, NOW), true)
    assert.deepEqual(callsOf(calls, 'from'), [['therapy_deliverables']])
    assert.deepEqual(callsOf(calls, 'update'), [[{ processing_status: 'procesando', generated_at: iso(0) }]])
    assert.deepEqual(callsOf(calls, 'eq'), [['session_id', SESSION]])
    const filter = String(callsOf(calls, 'or')[0][0])
    assert.match(filter, /^processing_status\.eq\.generando,/)
    assert.ok(filter.includes(`generated_at.lt.${iso(-STALE_PROCESSING_MS)}`), filter)
    assert.ok(filter.includes('generated_at.is.null'), 'un «procesando» sin fecha también se puede retomar')
  })

  test('false si nadie ganó (ya está en curso o ya terminó)', async () => {
    const { client } = fakeClient({ data: [], error: null })
    assert.equal(await claimProcessing(client, 'education_deliverables', SESSION, NOW), false)
  })

  test('un fallo de la base NO es «ya está en curso»: lanza', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'fetch failed', code: '' } })
    await assert.rejects(claimProcessing(client, 'therapy_deliverables', SESSION, NOW), QueryFailedError)
  })
})

describe('startGeneration', () => {
  const values = { generated_by: 'u1', content_html: null }

  test('si hay una fila que NO está viva, la reinicia con un UPDATE condicional (sin upsert a ciegas)', async () => {
    const { client, calls } = fakeClient({ data: [{ id: 'd1' }], error: null })
    assert.deepEqual(await startGeneration(client, 'therapy_deliverables', SESSION, values, NOW), { status: 'started', id: 'd1' })
    const [fields] = callsOf(calls, 'update')[0] as [Record<string, unknown>]
    assert.deepEqual(fields, { generated_by: 'u1', content_html: null, processing_status: 'generando', generated_at: iso(0) })
    const filter = String(callsOf(calls, 'or')[0][0])
    assert.equal(filter, `processing_status.not.in.(generando,procesando),generated_at.is.null,generated_at.lt.${iso(-STALE_PROCESSING_MS)}`)
    assert.equal(callsOf(calls, 'insert').length, 0)
  })

  test('si la fila existe y no se pudo reiniciar es porque está VIVA: ocupada, y no se escribe nada más', async () => {
    const { client, calls } = fakeClient({ data: [], error: null }, { data: { id: 'd1' }, error: null })
    assert.deepEqual(await startGeneration(client, 'education_deliverables', SESSION, values, NOW), { status: 'busy' })
    assert.equal(callsOf(calls, 'insert').length, 0)
  })

  test('si no hay fila, la inserta con session_id y los campos de arranque', async () => {
    const { client, calls } = fakeClient({ data: [], error: null }, { data: null, error: null }, { data: { id: 'nuevo' }, error: null })
    assert.deepEqual(await startGeneration(client, 'education_deliverables', SESSION, values, NOW), { status: 'started', id: 'nuevo' })
    assert.deepEqual(callsOf(calls, 'insert')[0], [
      { session_id: SESSION, generated_by: 'u1', content_html: null, processing_status: 'generando', generated_at: iso(0) },
    ])
  })

  test('si otra petición la creó justo antes (23505) está ocupada; cualquier otro error al insertar es «error»', async () => {
    const dup = fakeClient({ data: [], error: null }, { data: null, error: null }, { data: null, error: { message: 'duplicate', code: '23505' } })
    assert.deepEqual(await startGeneration(dup.client, 'therapy_deliverables', SESSION, values, NOW), { status: 'busy' })

    const spy = mock.method(console, 'error', () => {})
    try {
      const boom = fakeClient({ data: [], error: null }, { data: null, error: null }, { data: null, error: { message: 'disk full', code: '53100' } })
      assert.deepEqual(await startGeneration(boom.client, 'therapy_deliverables', SESSION, values, NOW), { status: 'error' })
      assert.match(String(spy.mock.calls[0].arguments[0]), /therapy_deliverables.*53100 disk full/)
    } finally {
      spy.mock.restore()
    }
  })

  test('un fallo de lectura lanza (no se confunde con «no hay fila»)', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'fetch failed', code: '' } })
    await assert.rejects(startGeneration(client, 'therapy_deliverables', SESSION, values, NOW), QueryFailedError)
  })
})

describe('runClaimed', () => {
  test('si el trabajo sale bien, devuelve su resultado y no toca el estado', async () => {
    const { client, calls } = fakeClient()
    assert.equal(await runClaimed(client, 'therapy_deliverables', SESSION, async () => 'ok'), 'ok')
    assert.equal(calls.length, 0)
  })

  test('si el trabajo lanza, deja el entregable en «error» SOLO si sigue en «procesando», y relanza', async () => {
    const { client, calls } = fakeClient()
    const failure = new Error('se cayó la base')
    await assert.rejects(runClaimed(client, 'education_deliverables', SESSION, async () => Promise.reject(failure)), (e) => e === failure)
    assert.deepEqual(callsOf(calls, 'update'), [[{ processing_status: 'error' }]])
    assert.deepEqual(callsOf(calls, 'eq'), [['session_id', SESSION], ['processing_status', 'procesando']])
  })
})

describe('las rutas usan el claim compartido', () => {
  const code = (file: string) =>
    fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  test('los dos /process reclaman ANTES de leer nada y envuelven el resto en runClaimed', () => {
    for (const [file, table] of [
      ['app/api/therapy/deliverables/process/route.ts', 'therapy_deliverables'],
      ['app/api/education/deliverables/process/route.ts', 'education_deliverables'],
    ]) {
      const source = code(file)
      const claim = source.indexOf(`claimProcessing(supabase, '${table}'`)
      const wrapped = source.indexOf(`runClaimed(supabase, '${table}'`)
      assert.ok(claim !== -1 && wrapped !== -1, `${file}: falta el claim o runClaimed`)
      assert.ok(claim < wrapped, `${file}: el claim va antes del trabajo`)
      assert.ok(source.indexOf("from('therapy_session_inputs')") === -1 || source.indexOf("from('therapy_session_inputs')") > claim, file)
      assert.ok(source.indexOf("from('education_session_inputs')") === -1 || source.indexOf("from('education_session_inputs')") > claim, file)
    }
  })

  test('los dos /generate usan startGeneration y ya no hacen upsert', () => {
    for (const file of ['app/api/therapy/generate/route.ts', 'app/api/education/generate/route.ts']) {
      const source = code(file)
      assert.match(source, /startGeneration\(supabase,/, file)
      assert.doesNotMatch(source, /\.upsert\(/, `${file}: el upsert incondicional pisaba una generación en curso`)
      assert.match(source, /started\.status === 'busy'[\s\S]*?status: 409/, `${file}: ocupada debe ser 409`)
    }
  })

  test('el plazo de 6 minutos vive en un solo sitio', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(rel)
        else if (/\.tsx?$/.test(entry.name) && rel !== path.join('lib', 'deliverables', 'processing.ts') && /6\s*\*\s*60\s*\*\s*1000/.test(code(rel))) offenders.push(rel)
      }
    }
    for (const dir of ['app', 'lib', 'components', 'hooks']) walk(dir)
    assert.deepEqual(offenders, [], 'usa STALE_PROCESSING_MS de lib/deliverables/processing.ts')
  })
})
