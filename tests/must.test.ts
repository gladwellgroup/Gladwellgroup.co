import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { QueryFailedError, isQueryFailure, must } from '@/lib/supabase/must'

// Un error de la base se leía como «no hay nada»: `const { data } = await supabase…` descartaba el `error` y la
// pantalla mostraba «No hay leads registrados», una lista vacía o un 404 ante un tope de tiempo. `must` lo convierte
// en un fallo que llega a la pantalla de error (con «Reintentar»), y deja pasar lo que NO es un fallo: una fila que
// no existe (`.single()` sin filas, un id que no es UUID).

const ROOT = process.cwd()

describe('must', () => {
  test('devuelve los datos de una consulta que salió bien', () => {
    assert.deepEqual(must({ data: [{ id: 1 }], error: null }, 'Leads'), [{ id: 1 }])
    assert.equal(must({ data: 0, error: null }, 'Conteo'), 0)
  })

  test('una lista vacía es un resultado válido, no un fallo', () => {
    assert.deepEqual(must({ data: [], error: null }, 'Leads'), [])
  })

  test('un fallo real lanza, con el nombre de lo que se cargaba', () => {
    const timeout = { message: 'TimeoutError: The operation was aborted due to timeout', code: '' }
    assert.throws(
      () => must({ data: null, error: timeout }, 'Leads'),
      (error: Error) => {
        assert.ok(error instanceof QueryFailedError)
        assert.equal(error.name, 'QueryFailedError')
        assert.equal(error.message, 'Leads: TimeoutError: The operation was aborted due to timeout')
        return true
      }
    )
  })

  test('también lanzan los errores de Postgres que no son «no existe» (columna inexistente, permiso, sintaxis)', () => {
    for (const code of ['42703', '42501', '42P01', 'PGRST200', 'PGRST301', '57014']) {
      assert.throws(() => must({ data: null, error: { message: 'x', code } }, 'Algo'), QueryFailedError, code)
    }
  })

  test('«no hay tal fila» no es un fallo: devuelve null para que la página responda 404', () => {
    // PGRST116: `.single()` sin filas · 22P02: un id que no es UUID (escrito a mano en la URL)
    assert.equal(must({ data: null, error: { message: 'Cannot coerce the result to a single JSON object', code: 'PGRST116' } }, 'Sesión'), null)
    assert.equal(must({ data: null, error: { message: 'invalid input syntax for type uuid: "abc"', code: '22P02' } }, 'Sesión'), null)
  })

  test('isQueryFailure: sin error no hay fallo; sin código tampoco se confunde con «no existe»', () => {
    assert.equal(isQueryFailure(null), false)
    assert.equal(isQueryFailure(undefined), false)
    assert.equal(isQueryFailure({ message: 'x', code: 'PGRST116' }), false)
    assert.equal(isQueryFailure({ message: 'x', code: '22P02' }), false)
    assert.equal(isQueryFailure({ message: 'x', code: '' }), true)
    assert.equal(isQueryFailure({ message: 'x' }), true)
  })
})

describe('las páginas y cargadores no descartan el error de la consulta', () => {
  /** Los archivos .ts/.tsx bajo `dir` cuyo nombre cumple `match`. */
  function files(dir: string, match: (name: string) => boolean): string[] {
    const out: string[] = []
    const walk = (current: string) => {
      for (const entry of fs.readdirSync(path.join(ROOT, current), { withFileTypes: true })) {
        const rel = path.join(current, entry.name)
        if (entry.isDirectory()) walk(rel)
        else if (match(entry.name)) out.push(rel)
      }
    }
    walk(dir)
    return out
  }

  const pages = [
    ...files('app/(portal)', (n) => n === 'page.tsx'),
    ...files('app/(auth)', (n) => n === 'page.tsx'),
  ]
  const loaders = files('lib', (n) => /\.tsx?$/.test(n))
  // Las rutas de la API leen igual que las páginas: un fallo no puede verse como «no existe» (lo comprueba además with-errors.test.ts).

  /** Quita comentarios, para no leer ejemplos en el texto. */
  const code = (file: string) =>
    fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  test('se encuentran las páginas y los cargadores (no se queda vacío)', () => {
    assert.ok(pages.length >= 30, `${pages.length} páginas`)
    assert.ok(loaders.length >= 30, `${loaders.length} archivos en lib`)
  })

  test('ninguna página ni cargador lee solo `{ data }` de una consulta a la base', () => {
    // `const { data } = await …`, `const { data: leads } = await …` y `[{ data }, …] = await Promise.all`
    const onlyData = /(?:const|let)\s*\{\s*data(?:\s*:\s*\w+)?\s*\}\s*=\s*await\b|\[\s*\{\s*data(?:\s*:\s*\w+)?\s*\}/
    const offenders: string[] = []
    for (const file of [...pages, ...loaders]) {
      const source = code(file)
      // `storage.getPublicUrl` devuelve `{ data }` sin error posible: no es una consulta.
      const withoutPublicUrl = source.replace(/const\s*\{\s*data(?:\s*:\s*\w+)?\s*\}\s*=\s*[\w.]*\.getPublicUrl\([^)]*\)/g, '')
      if (onlyData.test(withoutPublicUrl)) offenders.push(file)
    }
    assert.deepEqual(offenders, [], 'usa `must(await …, "qué se cargaba")` o lee también `error`')
  })
})
