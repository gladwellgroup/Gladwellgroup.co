import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { GUARD_COLUMNS, describeDbError } from '@/lib/parrilla/mutations'
import { INSPIRATION_URL_RE, isHttpUrl } from '@/lib/parrilla/rules'
import {
  QUOTE_AUTHOR_MAX,
  QUOTE_AUTHOR_MIN,
  QUOTE_COLUMNS,
  QUOTE_CONTEXT_MAX,
  QUOTE_SOURCE_MAX,
  QUOTE_TEXT_MAX,
  QUOTE_TEXT_MIN,
} from '@/lib/parrilla/quotes'
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

/** El CHECK vigente de parrilla_posts.category (20260913), anclado a su NOMBRE y
 *  no solo a `check (category in (…))`: la tabla de frases (20260920) también
 *  tiene un CHECK de `category`, y sin el ancla la última coincidencia entre todas
 *  las migraciones sería la suya — esta prueba compararía contra la tabla
 *  equivocada y dejaría de proteger a parrilla_posts sin avisar. El CHECK inline
 *  original de 20260906 no tiene nombre, así que no entra (20260913 lo reemplazó).
 *  También ignora los `where category in (…)` de las migraciones de datos. */
const POSTS_CATEGORY_CHECK =
  /add\s+constraint\s+parrilla_posts_category_check\s+check\s*\(\s*category\s+in\s*\(([^)]*)\)\s*\)/gi

describe('el código coincide con el esquema de SQL', () => {
  test('categorías ↔ CHECK de parrilla_posts.category', () => {
    const sql = lastList(POSTS_CATEGORY_CHECK, 'categorías de parrilla_posts')
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

describe('las frases del código coinciden con el esquema de SQL', () => {
  const QUOTES_FILE = '20260920_parrilla_frases.sql'

  // Sin los comentarios: la cabecera y el bloque «REVERTIR» mencionan tablas y
  // columnas que una regex encontraría antes que el DDL vigente (mismo método que
  // charlas.test.ts).
  const QUOTES_SQL = fs
    .readFileSync(path.join(MIGRATIONS_DIR, QUOTES_FILE), 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')

  /** Columnas de `create table if not exists public.parrilla_quotes (…)`: una por
   *  línea, con dos espacios de sangría (las restricciones van más adentro). */
  function quotesColumns(): string[] {
    const start = QUOTES_SQL.indexOf('create table if not exists public.parrilla_quotes (')
    assert.ok(start >= 0, `No encontré public.parrilla_quotes en ${QUOTES_FILE}`)
    const end = QUOTES_SQL.indexOf('\n);', start)
    return [
      ...QUOTES_SQL.slice(start, end).matchAll(/^ {2}([a-z_]+)\s+(?:uuid|text|date|timestamptz)\b/gm),
    ].map((match) => match[1])
  }

  test('el ancla de categorías de parrilla_posts no se deja secuestrar por la tabla de frases', () => {
    const raw = fs.readFileSync(path.join(MIGRATIONS_DIR, QUOTES_FILE), 'utf8')
    assert.doesNotMatch(raw, new RegExp(POSTS_CATEGORY_CHECK.source, 'i'))
    // …y sigue encontrando el CHECK de parrilla_posts en las migraciones de siempre.
    assert.ok(SQL.some((sql) => new RegExp(POSTS_CATEGORY_CHECK.source, 'i').test(sql)))
  })

  test('la columna `category` de parrilla_quotes sigue en la base pero el código ya no la usa', () => {
    // Las frases no llevan categoría (se elige al crear la publicación). La columna se dejó, nullable,
    // para no perder lo ya guardado. Cuando una migración la quite, este test falla: quitar entonces
    // `parrilla_quotes_category_check` de CONSTRAINT_MESSAGES (mutations.ts) y bajar a 4 el conteo de
    // CHECK de «cada CHECK de frases tiene mensaje propio».
    assert.ok(quotesColumns().includes('category'), 'la migración 20260920 ya no tiene la columna category')
    assert.ok(!(QUOTE_COLUMNS as readonly string[]).includes('category'))
  })

  test('las columnas que lee la lista existen en parrilla_quotes', () => {
    const columns = quotesColumns()
    for (const column of [...QUOTE_COLUMNS, 'created_by', 'created_at', 'updated_at']) {
      assert.ok(columns.includes(column), `public.parrilla_quotes no tiene la columna ${column}`)
    }
  })

  test('los topes del SQL son los que valida el servidor', () => {
    /** [mínimo, máximo] de `check (… char_length(btrim(<columna>)) between a and b)`. */
    function limits(constraint: string, column: string, optional: boolean): number[] {
      const nullable = optional ? `${column}\\s+is\\s+null\\s+or\\s+` : ''
      const match = new RegExp(
        `${constraint}\\s+check\\s*\\(\\s*${nullable}char_length\\(btrim\\(${column}\\)\\)\\s+between\\s+(\\d+)\\s+and\\s+(\\d+)\\s*\\)`,
        'i'
      ).exec(QUOTES_SQL)
      assert.ok(match, `No encontré el CHECK ${constraint}`)
      return [Number(match[1]), Number(match[2])]
    }

    assert.deepEqual(limits('parrilla_quotes_quote_text_check', 'quote_text', false), [QUOTE_TEXT_MIN, QUOTE_TEXT_MAX])
    assert.deepEqual(limits('parrilla_quotes_author_check', 'author', false), [QUOTE_AUTHOR_MIN, QUOTE_AUTHOR_MAX])
    assert.deepEqual(limits('parrilla_quotes_author_context_check', 'author_context', true), [1, QUOTE_CONTEXT_MAX])
    assert.deepEqual(limits('parrilla_quotes_source_check', 'source', true), [1, QUOTE_SOURCE_MAX])
  })

  test('cada CHECK de frases tiene mensaje propio: no cae en el genérico', () => {
    const names = [...QUOTES_SQL.matchAll(/constraint\s+(parrilla_quotes_[a-z_]+_check)\b/g)].map((m) => m[1])
    assert.equal(names.length, 5, `se esperaban 5 CHECK con nombre y hay ${names.length}: ¿cambió la migración?`)
    for (const name of names) {
      const message = describeDbError({ code: '23514', message: `violates check constraint "${name}"` }, 'No se pudo guardar')
      assert.doesNotMatch(message, /Alguno de los valores no está permitido/, `falta el mensaje de ${name} en CONSTRAINT_MESSAGES`)
    }
  })

  test('el vínculo de la pieza con su frase es ON DELETE SET NULL: borrar una frase no borra contenido', () => {
    assert.match(
      QUOTES_SQL,
      /constraint\s+parrilla_posts_quote_id_fkey\s+references\s+public\.parrilla_quotes\s*\(id\)\s+on\s+delete\s+set\s+null/i
    )
  })

  test('RLS activado, con la policy de la parrilla y el trigger de updated_at', () => {
    assert.match(QUOTES_SQL, /alter table public\.parrilla_quotes enable row level security/i)
    assert.match(
      QUOTES_SQL,
      /create policy "Parrilla admins manage quotes"\s+on public\.parrilla_quotes for all\s+using \(public\.is_parrilla_admin\(\)\)/i
    )
    assert.match(
      QUOTES_SQL,
      /create trigger parrilla_quotes_touch_updated_at\s+before update on public\.parrilla_quotes\s+for each row execute function public\.touch_updated_at\(\)/i
    )
  })

  test('quote_id no está en ninguna lista de lectura de publicaciones: sin la columna el calendario se vería vacío', () => {
    // Es el outage documentado: una columna nueva en PARRILLA_LIST_COLUMNS, con el
    // SQL aún sin aplicar, deja el calendario sin piezas. La lista de frases sí
    // consulta el vínculo, pero por su cuenta (embed), así que solo ella se ve afectada.
    const lists: Record<string, string> = {
      PARRILLA_LIST_COLUMNS,
      PARRILLA_DETAIL_COLUMNS,
      PARRILLA_PENDING_COLUMNS,
      GUARD_COLUMNS,
    }
    for (const [name, list] of Object.entries(lists)) {
      const columns = list.split(',').map((column) => column.trim())
      assert.ok(!columns.includes('quote_id'), `${name} no debe pedir quote_id`)
    }
  })
})

// El enlace de inspiración se valida en TRES sitios: el CHECK de SQL, el schema de zod y la
// interfaz (que decide si lo dibuja como un `<a href>`). Los dos de código comparten
// `INSPIRATION_URL_RE`; esta prueba lo ancla al CHECK de SQL, para que una regla no se afloje
// en un lado sin que falle aquí.
const ENLACES_BUENOS = [
  'https://example.com',
  'http://example.com/a?b=c#d',
  'HTTPS://EXAMPLE.COM/Reel',
  'https://x',
]
const ENLACES_MALOS = [
  '',
  'ftp://example.com',
  'javascript:alert(1)',
  'data:text/html,hi',
  'https://',
  'https://exa mple.com',
  'https://example.com ',
  ' https://example.com',
  'https://example.com\n',
  '//example.com',
  'example.com',
  'https:/example.com',
]

describe('el enlace de inspiración del código coincide con el CHECK de SQL', () => {
  /** El `inspiration_url ~* '…'` vigente (la última migración que lo define). */
  const sqlPattern = (() => {
    let found: string | null = null
    for (const sql of SQL) {
      for (const match of sql.matchAll(/inspiration_url\s*~\*\s*'([^']+)'/gi)) found = match[1]
    }
    assert.ok(found, 'No encontré el CHECK de inspiration_url en supabase/migrations')
    return found
  })()
  // POSIX → JavaScript: `[^[:space:]]` es `\S`.
  const sqlRe = new RegExp(sqlPattern.replaceAll('[^[:space:]]', '\\S'), 'i')

  test('el CHECK se tradujo bien (el patrón de la prueba no quedó con clases POSIX)', () => {
    assert.doesNotMatch(sqlRe.source, /\[:/)
  })

  test('INSPIRATION_URL_RE e isHttpUrl dan el mismo veredicto que el CHECK en cada caso', () => {
    for (const link of [...ENLACES_BUENOS, ...ENLACES_MALOS]) {
      assert.equal(INSPIRATION_URL_RE.test(link), sqlRe.test(link), `regla ↔ SQL: ${JSON.stringify(link)}`)
      assert.equal(isHttpUrl(link), sqlRe.test(link), `isHttpUrl ↔ SQL: ${JSON.stringify(link)}`)
    }
  })

  test('los casos buenos son buenos y los malos malos (la prueba no compara dos reglas rotas)', () => {
    for (const link of ENLACES_BUENOS) assert.equal(sqlRe.test(link), true, link)
    for (const link of ENLACES_MALOS) assert.equal(sqlRe.test(link), false, JSON.stringify(link))
  })
})
