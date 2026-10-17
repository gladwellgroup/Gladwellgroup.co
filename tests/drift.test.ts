import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { GUARD_COLUMNS } from '@/lib/parrilla/mutations'
import {
  PARRILLA_CATEGORIES,
  PARRILLA_DETAIL_COLUMNS,
  PARRILLA_FORMATS,
  PARRILLA_LIST_COLUMNS,
  PARRILLA_PENDING_COLUMNS,
  PARRILLA_SECTIONS,
  PARRILLA_STATUSES,
  PLATFORMS,
} from '@/lib/parrilla/posts'

// Las listas del código (UI y zod) y las del esquema de SQL se mantienen a mano
// en dos lugares. Estas pruebas leen las migraciones y las comparan: si una
// lista cambia en un lado y no en el otro, falla aquí en vez de aparecer como
// un "No se pudo guardar" genérico en producción.

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations')
const FILES = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .sort()
const SQL = FILES.map((file) => fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'))

const quoted = (list: string): string[] => [...list.matchAll(/'([^']+)'/g)].map((m) => m[1])

/** La última coincidencia, recorriendo las migraciones en orden: la más
 *  reciente es la que define el esquema vigente. Falla fuerte si no hay
 *  ninguna, para que un cambio de redacción en el SQL no deje la prueba
 *  comparando contra nada. */
function lastList(pattern: RegExp, what: string): string[] {
  let found: string[] | null = null
  for (const sql of SQL) {
    for (const match of sql.matchAll(pattern)) found = quoted(match[1])
  }
  assert.ok(found && found.length > 0, `No encontré la lista de ${what} en supabase/migrations`)
  return found
}

const sorted = (list: readonly string[]) => [...list].sort()

describe('el código coincide con el esquema de SQL', () => {
  test('categorías ↔ CHECK de parrilla_posts.category', () => {
    // Anclado a `check (category in (…))`: ignora los `where category in (…)`
    // de las migraciones de datos.
    const sql = lastList(/check\s*\(\s*category\s+in\s*\(([^)]*)\)\s*\)/gi, 'categorías')
    assert.deepEqual(
      sorted(PARRILLA_CATEGORIES),
      sorted(sql),
      'Cambió PARRILLA_CATEGORIES o el CHECK de SQL, pero no el otro: falta una migración (o actualizar lib/parrilla/posts.ts)'
    )
  })

  test('formatos ↔ CHECK de parrilla_posts.format', () => {
    const sql = lastList(/check\s*\(\s*format\s+in\s*\(([^)]*)\)\s*\)/gi, 'formatos')
    assert.deepEqual(sorted(PARRILLA_FORMATS), sorted(sql))
  })

  test('plataformas ↔ CHECK de parrilla_posts.platforms', () => {
    const sql = lastList(/platforms\s*<@\s*array\[([^\]]*)\]/gi, 'plataformas')
    assert.deepEqual(sorted(PLATFORMS), sorted(sql))
  })

  test('secciones ocultas ↔ CHECK de parrilla_posts.hidden_sections', () => {
    const sql = lastList(/hidden_sections\s*<@\s*array\[([^\]]*)\]/gi, 'secciones ocultas')
    assert.deepEqual(sorted(PARRILLA_SECTIONS), sorted(sql))
  })

  test('estados ↔ enum parrilla_status (incluye ALTER TYPE … ADD VALUE)', () => {
    const base = lastList(/create\s+type\s+public\.parrilla_status\s+as\s+enum\s*\(([^)]*)\)/gi, 'estados')
    const extra = SQL.flatMap((sql) =>
      [...sql.matchAll(/alter\s+type\s+public\.parrilla_status\s+add\s+value\s+(?:if\s+not\s+exists\s+)?'([^']+)'/gi)].map(
        (m) => m[1]
      )
    )
    assert.deepEqual(sorted(PARRILLA_STATUSES), sorted([...new Set([...base, ...extra])]))
  })
})

describe('las columnas que el código lee existen en el esquema de SQL', () => {
  /** Columnas de parrilla_posts según las migraciones: las del `create table`
   *  (una por línea, con dos espacios de sangría — la continuación de un CHECK
   *  va más adentro y los comentarios empiezan por `--`) más cada
   *  `alter table … add column`. Falla fuerte si no encuentra ninguna, para que
   *  un cambio de formato del SQL no deje la prueba comparando contra nada. */
  function parrillaColumns(): Set<string> {
    const columns = new Set<string>()

    for (const sql of SQL) {
      const table = /create\s+table\s+if\s+not\s+exists\s+public\.parrilla_posts\s*\(([\s\S]*?)\n\);/i.exec(sql)
      for (const line of table?.[1].split('\n') ?? []) {
        const name = /^ {2}([a-z_][a-z0-9_]*)\s+\S/i.exec(line)?.[1]
        if (name && !['primary', 'constraint', 'unique', 'check', 'foreign'].includes(name)) {
          columns.add(name)
        }
      }

      for (const match of sql.matchAll(
        /alter\s+table\s+public\.parrilla_posts\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi
      )) {
        columns.add(match[1])
      }
    }

    assert.ok(
      columns.has('title') && columns.has('caption'),
      'No encontré las columnas de parrilla_posts en supabase/migrations'
    )
    return columns
  }

  const selects: Record<string, string> = {
    PARRILLA_LIST_COLUMNS,
    PARRILLA_DETAIL_COLUMNS,
    PARRILLA_PENDING_COLUMNS,
    GUARD_COLUMNS,
  }

  for (const [name, list] of Object.entries(selects)) {
    test(`${name} ↔ columnas de parrilla_posts`, () => {
      const known = parrillaColumns()
      const missing = list
        .split(',')
        .map((column) => column.trim())
        .filter((column) => !known.has(column))

      // Sin la columna, el select falla y el calendario se ve vacío: el SQL va
      // ANTES del deploy (ver el encabezado de cada migración).
      assert.deepEqual(
        missing,
        [],
        `${name} pide columnas que ninguna migración crea: falta el SQL (supabase/migrations)`
      )
    })
  }
})
