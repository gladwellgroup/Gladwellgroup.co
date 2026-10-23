import { describe, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { replaceSessionRows } from '@/lib/supabase/replace-rows'
import { QueryFailedError } from '@/lib/supabase/must'

// Guardar los co-fundadores (Terapia) o las herramientas (Education) borraba TODAS las filas y luego insertaba las nuevas:
// si el insert fallaba la sesión se quedaba sin co-fundadores, y el error del borrado solo se registraba.

const ROOT = process.cwd()
const SESSION = '33333333-3333-3333-3333-333333333333'

type Step = { op: string; args: unknown[] }

function fakeClient(opts: { previous?: Array<{ id: string }>; readError?: boolean; insertError?: boolean; deleteError?: boolean }) {
  const steps: Step[] = []
  const client = {
    from: (table: string) => {
      steps.push({ op: 'from', args: [table] })
      return {
        select: (columns: string) => ({
          eq: async (column: string, value: string) => {
            steps.push({ op: 'select', args: [columns, column, value] })
            return opts.readError ? { data: null, error: { message: 'fetch failed' } } : { data: opts.previous ?? [], error: null }
          },
        }),
        insert: async (rows: unknown[]) => {
          steps.push({ op: 'insert', args: [rows] })
          return { error: opts.insertError ? { message: 'insert failed', code: '23514' } : null }
        },
        delete: () => ({
          in: async (column: string, ids: string[]) => {
            steps.push({ op: 'delete', args: [column, ids] })
            return { error: opts.deleteError ? { message: 'delete failed', code: '57014' } : null }
          },
        }),
      }
    },
  }
  return { client: client as unknown as SupabaseClient, steps }
}
const ops = (steps: Step[]) => steps.filter((s) => s.op !== 'from').map((s) => s.op)

describe('replaceSessionRows', () => {
  const rows = [{ session_id: SESSION, nombre: 'Ana', orden: 0 }]

  test('inserta lo nuevo PRIMERO y borra solo los ids de antes DESPUÉS', async () => {
    const { client, steps } = fakeClient({ previous: [{ id: 'a' }, { id: 'b' }] })
    assert.deepEqual(await replaceSessionRows(client, 'therapy_session_cofounders', SESSION, rows), { ok: true })
    assert.deepEqual(ops(steps), ['select', 'insert', 'delete'])
    assert.deepEqual(steps.find((s) => s.op === 'delete')?.args, ['id', ['a', 'b']], 'se borran los ids viejos, no por sesión (borraría también lo recién insertado)')
  })

  test('si el insert falla, lo anterior sigue intacto: ni se intenta borrar', async () => {
    const spy = mock.method(console, 'error', () => {})
    try {
      const { client, steps } = fakeClient({ previous: [{ id: 'a' }], insertError: true })
      assert.deepEqual(await replaceSessionRows(client, 'education_tools', SESSION, rows), { ok: false, step: 'insert' })
      assert.deepEqual(ops(steps), ['select', 'insert'])
      assert.match(String(spy.mock.calls[0].arguments[0]), /education_tools.*23514 insert failed/)
    } finally {
      spy.mock.restore()
    }
  })

  test('si el borrado falla, se avisa (quedan las dos listas, no se pierde nada)', async () => {
    const spy = mock.method(console, 'error', () => {})
    try {
      const { client } = fakeClient({ previous: [{ id: 'a' }], deleteError: true })
      assert.deepEqual(await replaceSessionRows(client, 'therapy_session_cofounders', SESSION, rows), { ok: false, step: 'delete' })
    } finally {
      spy.mock.restore()
    }
  })

  test('una lista vacía (el formulario quitó todo) solo borra lo de antes; sin nada de antes no borra', async () => {
    const withPrev = fakeClient({ previous: [{ id: 'a' }] })
    assert.deepEqual(await replaceSessionRows(withPrev.client, 'education_tools', SESSION, []), { ok: true })
    assert.deepEqual(ops(withPrev.steps), ['select', 'delete'])

    const empty = fakeClient({ previous: [] })
    assert.deepEqual(await replaceSessionRows(empty.client, 'education_tools', SESSION, rows), { ok: true })
    assert.deepEqual(ops(empty.steps), ['select', 'insert'])
  })

  test('si no se pudo LEER la lista actual, lanza (no se inserta a ciegas)', async () => {
    const { client, steps } = fakeClient({ readError: true })
    await assert.rejects(replaceSessionRows(client, 'education_tools', SESSION, rows), QueryFailedError)
    assert.deepEqual(ops(steps), ['select'])
  })
})

describe('las rutas guardan con replaceSessionRows', () => {
  const code = (file: string) =>
    fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  test('co-fundadores y herramientas ya no se borran enteros antes de insertar', () => {
    for (const [file, table] of [
      ['app/api/therapy/inputs/route.ts', 'therapy_session_cofounders'],
      ['app/api/education/inputs/route.ts', 'education_tools'],
    ]) {
      const source = code(file)
      assert.match(source, new RegExp(`replaceSessionRows\\(\\s*supabase,\\s*'${table}'`), file)
      assert.doesNotMatch(source, /\.delete\(\)/, `${file}: volvió el borrar-todo-y-luego-insertar`)
    }
  })

  test('editar un usuario valida los módulos ANTES de actualizar el cargo (no queda a medias)', () => {
    const source = code('app/api/admin/usuarios/[id]/route.ts')
    const validation = source.indexOf("target.role !== 'community_admin'")
    const cargoUpdate = source.indexOf('.update({ cargo')
    assert.ok(validation !== -1 && cargoUpdate !== -1 && validation < cargoUpdate)
  })
})
