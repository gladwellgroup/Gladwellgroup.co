import { describe, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  QUOTE_COLUMNS,
  QUOTE_EDITABLE_KEYS,
  charLength,
  diffQuote,
  distinctAuthors,
  loadParrillaQuotes,
  normalizeQuoteFields,
  normalizeSearch,
  quoteMatches,
  quoteToPostDraft,
  stripOuterQuotes,
  type ParrillaQuote,
  type QuoteFields,
} from '@/lib/parrilla/quotes'
import { parrillaQuoteShape } from '@/lib/validations/parrilla'

// Frases de referentes históricos (pestaña «Frases» de la parrilla): reglas
// puras, el loader de la lista y quién puede llamar a las rutas.

function quote(overrides: Partial<ParrillaQuote> = {}): ParrillaQuote {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    quote_text: 'La felicidad de tu vida depende de la calidad de tus pensamientos.',
    author: 'Marco Aurelio',
    author_context: 'Emperador y filósofo estoico',
    source: 'Meditaciones',
    used_count: 0,
    ...overrides,
  }
}

function fields(overrides: Partial<QuoteFields> = {}): QuoteFields {
  const q = quote()
  return {
    quote_text: q.quote_text,
    author: q.author,
    author_context: q.author_context,
    source: q.source,
    ...overrides,
  }
}

describe('normalizeSearch', () => {
  test('ignora tildes y mayúsculas: «Séneca» es «seneca»', () => {
    assert.equal(normalizeSearch('Séneca'), 'seneca')
    assert.equal(normalizeSearch('SENECA'), 'seneca')
    assert.equal(normalizeSearch('niño'), 'nino')
    assert.equal(normalizeSearch('Aristóteles'), 'aristoteles')
  })

  test('recorta los espacios de los extremos y respeta los del medio', () => {
    assert.equal(normalizeSearch('  Marco Aurelio  '), 'marco aurelio')
  })

  test('un texto vacío o en blanco queda vacío', () => {
    assert.equal(normalizeSearch(''), '')
    assert.equal(normalizeSearch('   '), '')
  })
})

describe('quoteMatches', () => {
  const seneca = quote({
    quote_text: 'No es que tengamos poco tiempo, sino que perdemos mucho.',
    author: 'Séneca',
    author_context: 'Filósofo estoico de Roma',
    source: 'Sobre la brevedad de la vida',
  })

  test('sin texto buscado coinciden todas', () => {
    assert.equal(quoteMatches(seneca, ''), true)
  })

  test('busca en la frase, el referente, quién fue y la fuente, sin tildes', () => {
    assert.equal(quoteMatches(seneca, normalizeSearch('tiempo')), true)
    assert.equal(quoteMatches(seneca, normalizeSearch('seneca')), true)
    assert.equal(quoteMatches(seneca, normalizeSearch('ROMA')), true)
    assert.equal(quoteMatches(seneca, normalizeSearch('brevedad')), true)
  })

  test('lo que no aparece en ningún campo no coincide', () => {
    assert.equal(quoteMatches(seneca, normalizeSearch('nietzsche')), false)
  })

  test('los opcionales vacíos no rompen la búsqueda', () => {
    const solo = quote({ author_context: null, source: null })
    assert.equal(quoteMatches(solo, normalizeSearch('meditaciones')), false)
    assert.equal(quoteMatches(solo, normalizeSearch('marco')), true)
  })
})

describe('distinctAuthors', () => {
  test('sin repetir y en orden alfabético en español', () => {
    const authors = distinctAuthors([
      { author: 'Séneca' },
      { author: 'Aristóteles' },
      { author: 'Marco Aurelio' },
      { author: 'Ñandú' },
    ])
    assert.deepEqual(authors, ['Aristóteles', 'Marco Aurelio', 'Ñandú', 'Séneca'])
  })

  test('dos grafías que solo difieren en tildes o mayúsculas son el mismo referente: gana la primera', () => {
    assert.deepEqual(
      distinctAuthors([{ author: 'Séneca' }, { author: 'seneca' }, { author: 'SÉNECA' }]),
      ['Séneca']
    )
    assert.deepEqual(distinctAuthors([{ author: 'seneca' }, { author: 'Séneca' }]), ['seneca'])
  })

  test('sin frases no hay sugerencias', () => {
    assert.deepEqual(distinctAuthors([]), [])
  })
})

describe('quoteToPostDraft', () => {
  test('título y copy con la frase entre comillas y el referente', () => {
    assert.deepEqual(quoteToPostDraft(quote()), {
      title: 'Frase de Marco Aurelio',
      caption: '“La felicidad de tu vida depende de la calidad de tus pensamientos.”\n\n— Marco Aurelio',
    })
  })

  test('NO prellena la categoría: se elige al construir la publicación', () => {
    assert.equal('category' in quoteToPostDraft(quote()), false)
  })

  test('recorta los espacios de la frase y del referente', () => {
    const draft = quoteToPostDraft(quote({ quote_text: '  Una frase  ', author: '  Séneca ' }))
    assert.equal(draft.title, 'Frase de Séneca')
    assert.equal(draft.caption, '“Una frase”\n\n— Séneca')
  })

  test('solo prellena título y copy: nunca fechas, estado ni categoría', () => {
    assert.deepEqual(Object.keys(quoteToPostDraft(quote())).sort(), ['caption', 'title'])
  })

  test('el título cumple el mínimo de 3 caracteres de la publicación', () => {
    assert.ok((quoteToPostDraft(quote({ author: 'Yo' })).title ?? '').length >= 3)
  })
})

describe('normalizeQuoteFields', () => {
  test('recorta y deja un único NULL para «vacío» en los opcionales', () => {
    assert.deepEqual(
      normalizeQuoteFields(
        fields({ quote_text: '  Una frase  ', author: ' Séneca ', author_context: '   ', source: '' })
      ),
      { quote_text: 'Una frase', author: 'Séneca', author_context: null, source: null }
    )
  })

  test('conserva lo que tiene contenido', () => {
    const normalized = normalizeQuoteFields(fields({ author_context: ' Filósofo ', source: ' Cartas a Lucilio ' }))
    assert.equal(normalized.author_context, 'Filósofo')
    assert.equal(normalized.source, 'Cartas a Lucilio')
  })
})

describe('diffQuote', () => {
  test('sin cambios, un parche vacío', () => {
    assert.deepEqual(diffQuote(fields(), fields()), {})
  })

  test('solo trae lo que cambió, ya normalizado', () => {
    assert.deepEqual(diffQuote(fields(), fields({ author: '  Marco Aurelio (121–180) ' })), {
      author: 'Marco Aurelio (121–180)',
    })
  })

  test('agregar solo espacios no es un cambio', () => {
    assert.deepEqual(diffQuote(fields(), fields({ quote_text: `${fields().quote_text}   ` })), {})
    assert.deepEqual(diffQuote(fields({ source: null }), fields({ source: '   ' })), {})
  })

  test('vaciar un opcional se manda como null (limpia la columna)', () => {
    assert.deepEqual(diffQuote(fields(), fields({ source: '', author_context: '  ' })), {
      source: null,
      author_context: null,
    })
  })

  test('varios cambios a la vez', () => {
    const patch = diffQuote(fields(), fields({ author: 'Séneca', source: 'Cartas a Lucilio' }))
    assert.deepEqual(patch, { author: 'Séneca', source: 'Cartas a Lucilio' })
  })
})

test('las frases no llevan categoría: ni se edita ni la pide la lista (la columna sigue en la base, sin uso)', () => {
  // La categoría se elige al construir la publicación. Si alguien la vuelve a pedir aquí, que sea
  // una decisión: este test falla para que se note.
  assert.ok(!(QUOTE_EDITABLE_KEYS as readonly string[]).includes('category'))
  assert.ok(!(QUOTE_COLUMNS as readonly string[]).includes('category'))
})

test('QUOTE_EDITABLE_KEYS coincide con las columnas del schema de frases', () => {
  // Si falla: un campo se agregó (o quitó) en un lado y no en el otro, y el
  // formulario no lo incluiría en lo que se guarda.
  assert.deepEqual([...QUOTE_EDITABLE_KEYS].sort(), Object.keys(parrillaQuoteShape).sort())
})

// ───────────── Loader de la lista ─────────────
// El `fakeSupabase` de mutations.test.ts solo resuelve en `.single()` /
// `.maybeSingle()`: una lista termina en `.order(…)` y se espera tal cual, así
// que aquí la cadena es "thenable".

type Reply = { data: unknown; error?: { code?: string; message?: string } }

function listFake(reply: Reply) {
  const calls: { method: string; args: unknown[] }[] = []
  const chain: object = new Proxy(
    {},
    {
      get: (_target, method: string) => {
        if (method === 'then') {
          return (resolve: (value: unknown) => unknown) =>
            resolve({ data: reply.data, error: reply.error ?? null })
        }
        return (...args: unknown[]) => {
          calls.push({ method, args })
          return chain
        }
      },
    }
  )
  const client = {
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] })
      return chain
    },
  } as unknown as SupabaseClient
  return { client, calls }
}

describe('loadParrillaQuotes', () => {
  const row = (over: Record<string, unknown> = {}) => {
    const { id, quote_text, author, author_context, source } = quote()
    return { id, quote_text, author, author_context, source, used: [{ count: 0 }], ...over }
  }

  test('pide la tabla de frases con las columnas de la lista y el conteo de usos, de la más reciente a la más antigua', async () => {
    const fake = listFake({ data: [] })
    await loadParrillaQuotes(fake.client)

    assert.deepEqual(fake.calls[0], { method: 'from', args: ['parrilla_quotes'] })
    const select = fake.calls.find((call) => call.method === 'select')?.args[0] as string
    assert.equal(select, `${QUOTE_COLUMNS.join(', ')}, used:parrilla_posts(count)`)
    assert.deepEqual(
      fake.calls.filter((call) => call.method === 'order').map((call) => call.args),
      [['created_at', { ascending: false }], ['id']],
      'el id desempata: sin él, el orden salta al editar'
    )
  })

  test('el listado no trae fechas ni created_by', () => {
    for (const column of ['created_at', 'updated_at', 'created_by']) {
      assert.ok(!(QUOTE_COLUMNS as readonly string[]).includes(column), column)
    }
  })

  test('convierte el embed en `used_count` y no deja `used` en el resultado', async () => {
    const fake = listFake({
      data: [
        row({ used: [{ count: 3 }] }),
        row({ id: 'b', used: { count: 2 } }),
        row({ id: 'c', used: [] }),
        row({ id: 'd', used: null }),
        row({ id: 'e', used: undefined }),
      ],
    })
    const quotes = await loadParrillaQuotes(fake.client)

    assert.deepEqual(
      quotes.map((q) => q.used_count),
      [3, 2, 0, 0, 0]
    )
    for (const q of quotes) assert.ok(!('used' in q), 'el embed crudo no debe llegar al cliente')
  })

  test('conserva los campos de la frase tal cual', async () => {
    const fake = listFake({ data: [row({ used: [{ count: 1 }] })] })
    assert.deepEqual(await loadParrillaQuotes(fake.client), [{ ...quote(), used_count: 1 }])
  })

  test('ante un error de la base devuelve [] y lo registra (no rompe la página)', async () => {
    const spy = mock.method(console, 'error', () => {})
    try {
      const fake = listFake({ data: null, error: { code: 'PGRST205', message: 'Could not find the table' } })
      assert.deepEqual(await loadParrillaQuotes(fake.client), [])
      assert.equal(spy.mock.calls.length, 1)
      assert.match(String(spy.mock.calls[0].arguments[0]), /^\[parrilla\] No se pudieron cargar las frases/)
    } finally {
      spy.mock.restore()
    }
  })

  test('con data null y sin error también devuelve []', async () => {
    assert.deepEqual(await loadParrillaQuotes(listFake({ data: null }).client), [])
  })
})

// ───────────── Quién puede llamar ─────────────
// Quién puede qué no puede depender de que alguien se acuerde: se detecta por lo
// que el código HACE (mismo método que charlas.test.ts).

describe('las rutas de frases verifican quién llama', () => {
  const ROOT = process.cwd()
  const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')

  function routes(dir: string): string[] {
    const out: string[] = []
    const walk = (current: string) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.name === 'route.ts') out.push(path.relative(ROOT, full))
      }
    }
    walk(path.join(ROOT, dir))
    return out.sort()
  }

  const files = routes('app/api/parrilla/frases')

  test('la detección encuentra las dos rutas (no se queda vacía)', () => {
    assert.deepEqual(files, ['app/api/parrilla/frases/[id]/route.ts', 'app/api/parrilla/frases/route.ts'])
  })

  for (const file of files) {
    test(`${file} exige el permiso parrilla:manage antes de tocar nada`, () => {
      const source = read(file)
      assert.ok(source.includes("requireApiPermission('parrilla:manage')"), `${file} no verifica parrilla:manage`)
      // Cada manejador (POST / PATCH / DELETE) lo pide; ninguno escribe sin pasar por ahí.
      const handlers = (source.match(/export async function (POST|PATCH|DELETE)\b/g) ?? []).length
      const checks = (source.match(/requireApiPermission\('parrilla:manage'\)/g) ?? []).length
      assert.equal(checks, handlers, `${file}: ${handlers} manejadores y ${checks} verificaciones de permiso`)
    })
  }

  test('el POST guarda con el usuario de la sesión, no con uno del cuerpo', () => {
    const source = read('app/api/parrilla/frases/route.ts')
    assert.match(source, /createQuote\(\s*getSupabaseServer\(\),\s*result\.data,\s*auth\.user\.id\s*\)/)
  })

  test('el PATCH y el DELETE usan la respuesta compartida (mismo 404 y mismos mensajes)', () => {
    const source = read('app/api/parrilla/frases/[id]/route.ts')
    assert.match(source, /respond\(await updateQuote\(/)
    assert.match(source, /respond\(await deleteQuote\(/)
  })
})

describe('las páginas de la parrilla cargan las frases y las pasan al tablero', () => {
  const ROOT = process.cwd()
  const pages = ['app/(portal)/admin/parrilla/page.tsx', 'app/(portal)/super/parrilla/page.tsx']

  for (const page of pages) {
    test(`${page} pide el permiso, carga las frases con el cliente del servidor y las pasa`, () => {
      const source = fs.readFileSync(path.join(ROOT, page), 'utf8')
      assert.ok(source.includes("requirePermission('parrilla:manage')"), `${page} no verifica parrilla:manage`)
      assert.match(source, /loadParrillaQuotes\(supabase\)/)
      assert.match(source, /<ParrillaBoard posts=\{posts\} editors=\{editors\} quotes=\{quotes\} \/>/)
    })
  }
})

// ───────────── Texto: largo como la base, comillas y espacios ─────────────

describe('charLength', () => {
  test('cuenta puntos de código, como `char_length` de Postgres, y no unidades UTF-16', () => {
    assert.equal('😀'.length, 2, 'en JS un emoji fuera del plano básico mide 2…')
    assert.equal(charLength('😀'), 1, '…y en la base mide 1: el largo debe ser el de la base')
    assert.equal(charLength('😀😀'), 2)
    assert.equal(charLength('Séneca'), 6)
    assert.equal(charLength(''), 0)
  })
})

describe('stripOuterQuotes', () => {
  test('quita un par de comillas dobles que envuelve todo el texto («», “”, „“ y "")', () => {
    const cases: [string, string][] = [
      ['“Hola mundo”', 'Hola mundo'],
      ['"Hola mundo"', 'Hola mundo'],
      ['«Hola mundo»', 'Hola mundo'],
      ['„Hola mundo“', 'Hola mundo'],
      ['« Hola mundo »', 'Hola mundo'],
      ['  “Hola mundo”  ', 'Hola mundo'],
    ]
    for (const [input, expected] of cases) assert.equal(stripOuterQuotes(input), expected, input)
  })

  test('no toca lo que no es una frase entre comillas', () => {
    const untouched = [
      'Hola mundo',
      '"A" y "B"', // son dos citas, no una frase entre comillas
      '“Hola', // sin cierre
      'Hola”', // sin apertura
      '"',
      '',
      '‘Hola’', // comillas simples: no se tocan
      '““Hola””', // duplicadas: no se adivina
    ]
    for (const input of untouched) assert.equal(stripOuterQuotes(input), input.trim(), input)
  })

  test('los apóstrofos de dentro no cuentan como comillas', () => {
    assert.equal(stripOuterQuotes("“Don't stop believing”"), "Don't stop believing")
    assert.equal(stripOuterQuotes('“L’amour est aveugle”'), 'L’amour est aveugle')
  })

  test('es idempotente y recorta aunque no haya comillas', () => {
    assert.equal(stripOuterQuotes(stripOuterQuotes('“Hola mundo”')), 'Hola mundo')
    assert.equal(stripOuterQuotes('  Hola  '), 'Hola')
  })
})

describe('normalizeSearch: espacios y escritura de la regex', () => {
  test('un salto de línea, un tabulador o varios espacios cuentan como un espacio', () => {
    assert.equal(normalizeSearch('Primera  línea\nsegunda\tlínea'), 'primera linea segunda linea')
  })

  test('una frase con un salto de línea (un poema) se encuentra con un espacio', () => {
    const poema = quote({ quote_text: 'Primera línea del poema\nsegunda línea del poema' })
    assert.equal(quoteMatches(poema, normalizeSearch('del poema segunda')), true)
  })

  test('lib/parrilla/quotes.ts no esconde caracteres combinantes literales: la regex de tildes es `\\p{Diacritic}`', () => {
    // Un rango de combinantes escrito con los caracteres reales es invisible en una
    // revisión y un formateador que normalice Unicode lo puede romper sin que falle nada.
    const source = fs.readFileSync(path.join(process.cwd(), 'lib/parrilla/quotes.ts'), 'utf8')
    assert.doesNotMatch(source, /\p{M}/u)
    assert.match(source, /\\p\{Diacritic\}/)
  })
})

describe('las comillas que envuelven la frase no se guardan', () => {
  test('normalizeQuoteFields las quita', () => {
    assert.equal(normalizeQuoteFields(fields({ quote_text: '“Quien no arriesga no gana”' })).quote_text, 'Quien no arriesga no gana')
  })

  test('pegar la misma frase con sus comillas no es un cambio al editar', () => {
    assert.deepEqual(diffQuote(fields(), fields({ quote_text: `“${fields().quote_text}”` })), {})
  })
})
