import { describe, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describeError, logError } from '@/lib/log'

// `console.error('[x] …:', error)` volcaba el objeto de error de PostgREST, cuyo `details` trae la fila que falló
// («Key (correo)=(ana@x.co) already exists»): datos personales en los registros del servidor.

const ROOT = process.cwd()

describe('describeError', () => {
  test('un error de Supabase: código y mensaje, sin `details` ni `hint`', () => {
    const postgrest = { code: '23505', message: 'duplicate key value', details: 'Key (correo)=(ana@x.co) already exists.', hint: 'secreto' }
    const line = describeError(postgrest)
    assert.equal(line, '23505 duplicate key value')
    assert.doesNotMatch(line, /ana@x\.co|secreto/)
  })

  test('una excepción: su traza (mensaje + marcos), sin propiedades extra', () => {
    const error = Object.assign(new Error('boom'), { details: 'dato personal' })
    const line = describeError(error)
    assert.match(line, /^Error: boom/)
    assert.doesNotMatch(line, /dato personal/)
  })

  test('un texto, nulo o algo raro', () => {
    assert.equal(describeError('ya viene en texto'), 'ya viene en texto')
    assert.equal(describeError(null), 'sin detalle')
    assert.equal(describeError(undefined), 'sin detalle')
    assert.equal(describeError(42), '42')
    assert.equal(describeError({}), '[object Object]')
    assert.equal(describeError({ code: 57014 }), '57014')
  })
})

describe('logError', () => {
  test('escribe «contexto: detalle» en una sola línea', () => {
    const spy = mock.method(console, 'error', () => {})
    try {
      logError('[education/inputs] Supabase error', { code: '42703', message: 'column x does not exist', details: 'fila privada' })
      assert.equal(spy.mock.calls.length, 1)
      assert.deepEqual(spy.mock.calls[0].arguments, ['[education/inputs] Supabase error: 42703 column x does not exist'])
    } finally {
      spy.mock.restore()
    }
  })
})

describe('nadie vuelca un objeto de error entero', () => {
  test('ningún console.error(texto, error) en app, lib, components ni hooks', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(rel)
        else if (/\.tsx?$/.test(entry.name) && rel !== path.join('lib', 'log.ts')) {
          const source = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
          if (/console\.error\(\s*(['"`])[^'"`]*\1\s*,\s*[A-Za-z_][\w.]*\s*\)/.test(source)) offenders.push(rel)
        }
      }
    }
    for (const dir of ['app', 'lib', 'components', 'hooks']) walk(dir)
    assert.deepEqual(offenders, [], 'usa logError(contexto, error) de lib/log.ts')
  })
})
