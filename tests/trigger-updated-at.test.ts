import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// `updated_at` de parrilla_posts es el token de concurrencia del modal y lo mueve un trigger que
// 20260921 volvió condicional (borrar una frase no cuenta como editar). Lo único que impide que una
// migración posterior lo deje otra vez incondicional, o que redefina `touch_updated_at()` (que
// comparte parrilla_quotes), es una prueba. Solo leen texto: no hay base de datos en CI, así que el
// comportamiento real se comprueba con la prueba de humo del pie de 20260921.

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations')
const FILES = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .sort()
const SQL = FILES.map((file) => fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'))

describe('el trigger de updated_at de parrilla_posts', () => {
  const TRIGGER = 'parrilla_posts_touch_updated_at'
  const NEW_FILE = '20260921_parrilla_updated_at_ignora_desvinculo_frase.sql'
  const GENERIC_FUNCTION_FILE = '20260914_parrilla_integridad.sql'

  // Sin los comentarios de línea completa: el encabezado, el bloque «REVERTIR» y la prueba de
  // humo repiten el trigger SIN condición, y una regex los encontraría (mismo método que
  // charlas.test.ts).
  const code = (sql: string) =>
    sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')

  function source(): string {
    const index = FILES.indexOf(NEW_FILE)
    assert.ok(
      index >= 0,
      `Falta supabase/migrations/${NEW_FILE}: sin ella, borrar una frase vuelve a mover updated_at de las piezas`
    )
    return SQL[index]
  }

  type TriggerEvent = { file: string; kind: 'drop' | 'create'; sql: string }

  /** Cada `drop trigger …` y `create trigger parrilla_posts_touch_updated_at …;` de las
   *  migraciones, en el orden en que se aplican. */
  function events(): TriggerEvent[] {
    const found: TriggerEvent[] = []
    FILES.forEach((file, index) => {
      const pattern = new RegExp(
        `(drop\\s+trigger\\s+(?:if\\s+exists\\s+)?${TRIGGER}\\b[^;]*;)|(create\\s+(?:or\\s+replace\\s+)?trigger\\s+${TRIGGER}\\b[^;]*;)`,
        'gi'
      )
      for (const match of code(SQL[index]).matchAll(pattern)) {
        found.push({ file, kind: match[1] ? 'drop' : 'create', sql: match[0] })
      }
    })
    assert.ok(
      found.filter((event) => event.kind === 'create').length >= 2,
      `Esperaba al menos dos definiciones de ${TRIGGER} (20260914 y 20260921) y encontré ${found.length} sentencias`
    )
    return found
  }

  /** El contenido de `when ( … )` de la definición vigente: la ÚLTIMA sentencia sobre el
   *  trigger, entre todas las migraciones, tiene que ser un `create` y llevar condición. */
  function currentCondition(): string {
    const all = events()
    const last = all[all.length - 1]
    assert.equal(
      last.kind,
      'create',
      `${last.file} suelta ${TRIGGER} y no lo recrea: parrilla_posts se quedaría sin token de concurrencia`
    )
    const match = /\bwhen\s*\(([\s\S]*)\)\s*execute\s+function\b/i.exec(last.sql)
    assert.ok(
      match,
      `${last.file} recrea ${TRIGGER} SIN condición: borrar una frase volvería a mover updated_at de las piezas (ver ${NEW_FILE})`
    )
    return match[1]
  }

  test('la definición vigente es la condicional: ninguna migración posterior la deshace', () => {
    assert.ok(currentCondition().trim().length > 0)
  })

  test('compara la fila entera con to_jsonb y solo nombra quote_id: sin lista de columnas que se desactualice', () => {
    const condition = currentCondition()
    assert.match(condition, /to_jsonb\(\s*new\s*\)/i)
    assert.match(condition, /to_jsonb\(\s*old\s*\)/i)
    const named = [
      ...new Set([...condition.matchAll(/\b(?:old|new)\.([a-z_][a-z0-9_]*)/gi)].map((m) => m[1].toLowerCase())),
    ]
    assert.deepEqual(
      named,
      ['quote_id'],
      'la condición solo puede nombrar quote_id: el resto de la fila lo compara to_jsonb, y una columna escrita a mano dejaría de vigilarse'
    )
  })

  test('la excepción es estrecha: solo lo que hace la FK, y solo si nada más cambió', () => {
    const condition = currentCondition()
    assert.match(condition, /^\s*not\s*\(/i, 'la condición debe ser «no mover SALVO que…»: ante la duda, se mueve')
    assert.match(
      condition,
      /pg_trigger_depth\(\)\s*>\s*0/i,
      'solo debe quedar exento lo que hace la FK, que Postgres ejecuta dentro de un trigger'
    )
    assert.match(condition, /old\.quote_id\s+is\s+not\s+null/i)
    assert.match(condition, /new\.quote_id\s+is\s+null/i)
    const ignored = [...new Set([...condition.matchAll(/-\s*'([a-z_]+)'/gi)].map((m) => m[1]))].sort()
    assert.deepEqual(ignored, ['quote_id', 'updated_at'], 'solo quote_id y updated_at quedan fuera de la comparación')
  })

  test('es atómica y no se queda esperando: begin → set local lock_timeout → drop → create → commit', () => {
    const sql = code(source())
    const at = (pattern: RegExp) => sql.search(pattern)
    const steps = [
      at(/^begin;/m),
      at(/^set local lock_timeout\s*=/m),
      at(new RegExp(`^drop trigger if exists ${TRIGGER} on public\\.parrilla_posts;`, 'm')),
      at(new RegExp(`^create trigger ${TRIGGER}\\b`, 'm')),
      at(/^commit;/m),
    ]
    assert.ok(steps.every((index) => index >= 0), `Faltan sentencias en ${NEW_FILE} (posiciones: ${steps.join(', ')})`)
    assert.deepEqual(steps, [...steps].sort((a, b) => a - b), 'el orden debe ser begin → lock_timeout → drop → create → commit')
    assert.equal((sql.match(/^begin;/gm) ?? []).length, 1)
    assert.equal((sql.match(/^commit;/gm) ?? []).length, 1)
  })

  test('la guarda de requisitos va antes del begin: si falla, no deja una transacción abortada', () => {
    const sql = code(source())
    const begin = sql.search(/^begin;/m)
    const guards = [...sql.matchAll(/raise\s+exception\s+'([^']*)'/gi)].map((m) => ({ at: m.index ?? -1, text: m[1] }))
    assert.ok(guards.some((guard) => guard.text.includes('20260914')), 'falta el aviso de 20260914')
    assert.ok(guards.some((guard) => guard.text.includes('20260920')), 'falta el aviso de 20260920')
    assert.ok(guards.every((guard) => guard.at >= 0 && guard.at < begin), 'la guarda va ANTES del begin')
  })

  test('touch_updated_at() se define solo en 20260914: es genérica y la comparte parrilla_quotes', () => {
    const definers = FILES.filter((_, index) =>
      /create\s+(?:or\s+replace\s+)?function\s+public\.touch_updated_at\s*\(/i.test(code(SQL[index]))
    )
    assert.deepEqual(definers, [GENERIC_FUNCTION_FILE])
  })

  test('el encabezado avisa de no re-ejecutar 20260914 y el REVERTIR no borra la función', () => {
    const raw = source()
    assert.match(raw, /NO vuelvas a ejecutar 20260914/)
    const from = raw.search(/^-- REVERTIR/m)
    const to = raw.indexOf('\n\n', from)
    assert.ok(from >= 0 && to > from, 'no encontré el bloque REVERTIR')
    const revert = raw.slice(from, to)
    assert.match(revert, new RegExp(`create trigger ${TRIGGER}`, 'i'))
    assert.doesNotMatch(revert, /\bwhen\s*\(/i, 'el REVERTIR debe dejar el trigger incondicional')
    assert.doesNotMatch(revert, /drop\s+function/i, 'el REVERTIR no debe borrar touch_updated_at(): la usa parrilla_quotes')
  })

  test('no secuestra las pruebas que toman la última coincidencia entre todas las migraciones', () => {
    const raw = source()
    const hijackers: Record<string, RegExp> = {
      categorías: /add\s+constraint\s+parrilla_posts_category_check/i,
      formatos: /check\s*\(\s*format\s+in\s*\(/i,
      plataformas: /platforms\s*<@\s*array\[/i,
      'secciones ocultas': /hidden_sections\s*<@\s*array\[/i,
      estados: /parrilla_status/i,
      columnas:
        /alter\s+table\s+public\.parrilla_posts\s+add\s+column|create\s+table\s+if\s+not\s+exists\s+public\.parrilla_posts\s*\(/i,
    }
    for (const [name, pattern] of Object.entries(hijackers)) {
      assert.doesNotMatch(raw, pattern, `${NEW_FILE} contiene el patrón de «${name}» que drift.test.ts busca en TODAS las migraciones`)
    }
  })
})
