import { describe, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import type { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPersonalizedBatch, type BatchRecipient } from '@/lib/deliverables/send-batch'
import { IDEMPOTENCY_WINDOW_MS, idempotencyKey, isDuplicateSend } from '@/lib/deliverables/idempotency'

// Aprobar un entregable podía mandar el correo dos veces: el chequeo de «ya enviado» no es atómico, el estado cambia
// DESPUÉS de enviar y nada impedía un doble toque o dos pestañas. Ahora cada envío lleva una clave de idempotencia de
// Resend y, si Resend dice «ya está hecho o en marcha», no se toca ningún estado.

const ROOT = process.cwd()
const SESSION = '33333333-3333-3333-3333-333333333333'
const NOW = Date.parse('2026-10-22T20:00:00.000Z')

const recipients = (n: number): BatchRecipient[] =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i}`, nombre: `Persona ${i}`, correo: `p${i}@example.com` }))

type SendOptions = { batchValidation?: string; idempotencyKey?: string }
type ResendReply = { data?: { data: { id: string }[]; errors?: { index: number; message: string }[] } | null; error?: { name: string; message: string } | null }

function fakeResend(replies: ResendReply[]) {
  const calls: Array<{ payload: Array<{ to: string[]; html: string }>; options: SendOptions }> = []
  let i = 0
  const resend = {
    batch: {
      send: async (payload: Array<{ to: string[]; html: string }>, options: SendOptions) => {
        calls.push({ payload, options })
        const reply = replies[Math.min(i++, replies.length - 1)]
        return { data: reply.data ?? { data: payload.map((_, k) => ({ id: `e${k}` })), errors: [] }, error: reply.error ?? null }
      },
    },
  }
  return { resend: resend as unknown as Resend, calls }
}

function fakeSupabase(failWrites = false) {
  const writes: Array<{ table: string; values: Record<string, unknown>; id: string }> = []
  const client = {
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => ({
        eq: async (_column: string, id: string) => {
          writes.push({ table, values, id })
          return { error: failWrites ? { message: 'write failed' } : null }
        },
      }),
    }),
  }
  return { client: client as unknown as SupabaseClient, writes }
}

const run = (resend: Resend, client: SupabaseClient, list: BatchRecipient[]) =>
  sendPersonalizedBatch({
    supabase: client,
    tableName: 'education_attendees',
    resend,
    fromEmail: 'Gladwell <noreply@example.com>',
    subject: 'Entregable',
    recipients: list,
    buildHtml: (r) => `<p>Hola ${r.nombre}</p>`,
    idempotencyScope: SESSION,
  })

describe('idempotencyKey', () => {
  test('mismo contenido y misma ventana → misma clave (el doble toque se deduplica)', () => {
    assert.equal(idempotencyKey('approve', SESSION, '<p>x</p>', NOW), idempotencyKey('approve', SESSION, '<p>x</p>', NOW + 1000))
  })

  test('otro contenido → otra clave (nunca «misma clave con otro cuerpo», que Resend responde con 409)', () => {
    assert.notEqual(idempotencyKey('approve', SESSION, '<p>x</p>', NOW), idempotencyKey('approve', SESSION, '<p>y</p>', NOW))
  })

  test('otra ventana → otra clave: un reintento deliberado tras un fallo no queda bloqueado más de unos minutos', () => {
    assert.notEqual(
      idempotencyKey('approve', SESSION, '<p>x</p>', NOW),
      idempotencyKey('approve', SESSION, '<p>x</p>', NOW + IDEMPOTENCY_WINDOW_MS)
    )
  })

  test('otro tipo u otra sesión → otra clave, y cabe en los 256 caracteres de Resend', () => {
    const base = idempotencyKey('approve', SESSION, 'x', NOW)
    assert.notEqual(base, idempotencyKey('batch', SESSION, 'x', NOW))
    assert.notEqual(base, idempotencyKey('approve', 'otra-sesion', 'x', NOW))
    assert.ok(base.length > 0 && base.length <= 256, String(base.length))
    assert.match(base, /^approve\/[\w-]+\/\d+\/[0-9a-f]{32}$/)
  })

  test('isDuplicateSend reconoce los dos errores de idempotencia de Resend y ninguno más', () => {
    assert.equal(isDuplicateSend({ name: 'concurrent_idempotent_requests' }), true)
    assert.equal(isDuplicateSend({ name: 'invalid_idempotent_request' }), true)
    for (const name of ['validation_error', 'rate_limit_exceeded', 'invalid_idempotency_key', 'internal_server_error']) {
      assert.equal(isDuplicateSend({ name }), false, name)
    }
    assert.equal(isDuplicateSend(null), false)
    assert.equal(isDuplicateSend(undefined), false)
  })
})

describe('sendPersonalizedBatch', () => {
  test('envía con batchValidation permisivo y una clave de idempotencia, y anota «enviado» a todos', async () => {
    const { resend, calls } = fakeResend([{}])
    const { client, writes } = fakeSupabase()
    const result = await run(resend, client, recipients(3))
    assert.deepEqual([result.sent, result.failed.length, result.skipped, result.unrecorded], [3, 0, 0, 0])
    assert.equal(calls.length, 1)
    assert.equal(calls[0].options.batchValidation, 'permissive')
    assert.match(String(calls[0].options.idempotencyKey), /^batch-education_attendees\/3333/)
    assert.deepEqual(writes.map((w) => w.values.email_status), ['enviado', 'enviado', 'enviado'])
  })

  test('el MISMO lote lleva la MISMA clave (dos pasadas seguidas = un solo envío en Resend)', async () => {
    const a = fakeResend([{}])
    const b = fakeResend([{}])
    await run(a.resend, fakeSupabase().client, recipients(2))
    await run(b.resend, fakeSupabase().client, recipients(2))
    assert.equal(a.calls[0].options.idempotencyKey, b.calls[0].options.idempotencyKey)
  })

  test('otros destinatarios (o con otro correo) → otra clave', async () => {
    const a = fakeResend([{}])
    const b = fakeResend([{}])
    await run(a.resend, fakeSupabase().client, recipients(2))
    await run(b.resend, fakeSupabase().client, recipients(3))
    assert.notEqual(a.calls[0].options.idempotencyKey, b.calls[0].options.idempotencyKey)
  })

  test('si Resend dice «ya está en marcha», NO se escribe ningún estado y se cuenta como saltado', async () => {
    const { resend } = fakeResend([{ error: { name: 'concurrent_idempotent_requests', message: 'in progress' } }])
    const { client, writes } = fakeSupabase()
    const result = await run(resend, client, recipients(4))
    assert.deepEqual([result.sent, result.failed.length, result.skipped], [0, 0, 4])
    assert.equal(writes.length, 0, 'antes el duplicado marcaba a todos como «error» y le pisaba el «enviado» al envío bueno')
  })

  test('«misma clave con otro cuerpo» también se trata como ya enviado, no como fallo', async () => {
    const { resend } = fakeResend([{ error: { name: 'invalid_idempotent_request', message: 'different payload' } }])
    const { client, writes } = fakeSupabase()
    const result = await run(resend, client, recipients(2))
    assert.deepEqual([result.skipped, result.failed.length, writes.length], [2, 0, 0])
  })

  test('otro error de Resend sí marca a todos como «error» (el envío no se hizo)', async () => {
    const { resend } = fakeResend([{ error: { name: 'rate_limit_exceeded', message: 'Too many requests' } }])
    const { client, writes } = fakeSupabase()
    const result = await run(resend, client, recipients(2))
    assert.deepEqual([result.sent, result.failed.length, result.skipped], [0, 2, 0])
    assert.deepEqual(writes.map((w) => [w.values.email_status, w.values.email_error]), [['error', 'Too many requests'], ['error', 'Too many requests']])
  })

  test('los fallos por correo (modo permisivo) se anotan por destinatario', async () => {
    const { resend } = fakeResend([{ data: { data: [{ id: 'e0' }], errors: [{ index: 1, message: 'correo inválido' }] } }])
    const { client, writes } = fakeSupabase()
    const result = await run(resend, client, recipients(2))
    assert.deepEqual([result.sent, result.failed], [1, [{ id: 'r1', error: 'correo inválido' }]])
    assert.deepEqual(writes.map((w) => w.values.email_status), ['enviado', 'error'])
  })

  test('si no se puede anotar el estado se cuenta como «sin anotar» (y queda en el registro, sin datos personales)', async () => {
    const spy = mock.method(console, 'error', () => {})
    try {
      const { resend } = fakeResend([{}])
      const { client } = fakeSupabase(true)
      const result = await run(resend, client, recipients(3))
      assert.equal(result.unrecorded, 3)
      assert.match(String(spy.mock.calls[0].arguments[0]), /3 correo\(s\) en education_attendees/)
      assert.ok(!spy.mock.calls.some((c) => c.arguments.join(' ').includes('@example.com')))
    } finally {
      spy.mock.restore()
    }
  })

  test('más de 100 destinatarios: un lote por cada 100, cada uno con SU clave', async () => {
    const { resend, calls } = fakeResend([{}, {}])
    const { client } = fakeSupabase()
    const result = await run(resend, client, recipients(101))
    assert.equal(result.sent, 101)
    assert.deepEqual(calls.map((c) => c.payload.length), [100, 1])
    assert.notEqual(calls[0].options.idempotencyKey, calls[1].options.idempotencyKey)
  })
})

describe('los envíos usan la idempotencia', () => {
  const code = (file: string) =>
    fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  test('los cuatro envíos por lotes pasan el ámbito (la sesión) y contestan 409 si ya estaba en marcha', () => {
    for (const file of [
      'app/api/therapy/deliverables/approve/route.ts',
      'app/api/therapy/deliverables/resend-attendees/route.ts',
      'app/api/education/deliverables/approve/route.ts',
      'app/api/education/deliverables/resend-attendees/route.ts',
    ]) {
      const source = code(file)
      assert.match(source, /idempotencyScope: session_id/, file)
      assert.match(source, /SEND_IN_PROGRESS_MESSAGE/, `${file}: falta el 409 «ya se está enviando»`)
    }
  })

  test('el correo grupal de Terapia lleva clave de idempotencia y trata el duplicado como 409, no como fallo', () => {
    const source = code('app/api/therapy/deliverables/approve/route.ts')
    assert.match(source, /resend\.emails\.send\(groupMail, \{\s*idempotencyKey: idempotencyKey\('approve-therapy'/)
    assert.match(source, /mailError && isDuplicateSend\(mailError\)\)\s*\{\s*return NextResponse\.json\(\{ error: SEND_IN_PROGRESS_MESSAGE \}, \{ status: 409 \}\)/)
  })

  test('send-batch no escribe estados cuando el envío fue un duplicado', () => {
    const source = code('lib/deliverables/send-batch.ts')
    assert.match(source, /if \(isDuplicateSend\(error\)\) \{\s*skipped \+= batch\.length\s*continue\s*\}/)
  })
})
