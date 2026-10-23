// Frases de referentes históricos: la biblioteca que el equipo usa como materia
// prima para crear contenido (pestaña «Frases» de la parrilla). Tipos, límites y
// reglas puras en un solo lugar — las usan el formulario, la lista y el
// servidor — más el loader de la lista.
//
// Solo `import type` de la app (y `blankToNull` de rules.ts y `must` de supabase/must.ts, que son puros): el
// cliente incluye este módulo en su bundle y las pruebas lo cargan sin resolver
// nada del resto.
//
// Las frases NO llevan categoría: se elige al construir la publicación («Crear contenido» no
// la prellena). La columna `category` de `parrilla_quotes` (20260920) ya no se lee ni se
// escribe, pero sigue en la base —nullable y con su CHECK— para no perder lo que ya estaba
// guardado; una migración nueva puede quitarla (y con ella `parrilla_quotes_category_check`
// de CONSTRAINT_MESSAGES en mutations.ts).

import type { SupabaseClient } from '@supabase/supabase-js'
import { blankToNull, type PostDraft } from '@/lib/parrilla/rules'
import { must } from '@/lib/supabase/must'

// Los mismos números que los CHECK de supabase/migrations/20260920_parrilla_frases.sql:
// tests/drift.test.ts los compara con el SQL.
export const QUOTE_TEXT_MIN = 3
export const QUOTE_TEXT_MAX = 500
export const QUOTE_AUTHOR_MIN = 2
export const QUOTE_AUTHOR_MAX = 120
export const QUOTE_CONTEXT_MAX = 160
export const QUOTE_SOURCE_MAX = 300

/** Lo que la persona escribe en el formulario. Un test compara esta lista con
 *  las claves del schema de validación, para que un campo nuevo no se quede
 *  fuera de lo que se guarda. */
export const QUOTE_EDITABLE_KEYS = [
  'quote_text',
  'author',
  'author_context',
  'source',
] as const
export type QuoteEditableKey = (typeof QUOTE_EDITABLE_KEYS)[number]

/** Lo que pide la lista. Sin fechas ni `created_by`: no se dibujan, y el payload
 *  viaja con la página. */
export const QUOTE_COLUMNS = ['id', ...QUOTE_EDITABLE_KEYS] as const

export interface QuoteFields {
  /** La frase, sin comillas: la lista y la publicación le ponen las suyas. */
  quote_text: string
  /** El referente histórico que la dijo («Marco Aurelio»). */
  author: string
  /** Quién fue, en pocas palabras («Emperador y filósofo estoico, 121–180»). */
  author_context: string | null
  /** Obra, discurso o enlace de donde sale. Muchas frases famosas se atribuyen
   *  mal: conviene citar la fuente. */
  source: string | null
}

export interface ParrillaQuote extends QuoteFields {
  id: string
  /** Cuántas publicaciones nacieron de esta frase (incluye las archivadas en el
   *  Banco de contenido). 0 = sin usar. */
  used_count: number
}

// ───────────────────────────── Texto ─────────────────────────────

/** Largo como lo cuenta Postgres (`char_length`: puntos de código) y no como
 *  `String.length` (unidades UTF-16). Un emoji fuera del plano básico mide 2 en
 *  JS y 1 en SQL: con `.length` la validación y el CHECK de la base no coincidían
 *  en los extremos (un referente «😀» pasaba la validación y lo rechazaba la base
 *  con un «Recarga la página» que no ayudaba). */
export const charLength = (value: string): number => [...value].length

const DOUBLE_OPEN = /^[“"«„]/
const DOUBLE_CLOSE = /[”"»“]$/
const DOUBLE_ANY = /[“”"«»„]/

/** Una frase pegada de la web suele traer sus comillas («…», “…”, „…“ o "…"), y la
 *  tarjeta y el copy de la publicación ya le ponen las suyas: sin quitarlas salía
 *  ““así””. Quita UN par de comillas dobles que envuelve todo el texto, y solo si
 *  por dentro no hay más comillas dobles: `"A" y "B"` no es una frase entre
 *  comillas, son dos citas. Los apóstrofos no cuentan (`“Don't stop”`). También
 *  recorta los espacios de los extremos. */
export function stripOuterQuotes(text: string): string {
  const value = text.trim()
  if (value.length < 2 || !DOUBLE_OPEN.test(value) || !DOUBLE_CLOSE.test(value)) return value
  const inner = value.slice(1, -1)
  return DOUBLE_ANY.test(inner) ? value : inner.trim()
}

// ───────────────────────────── Búsqueda ─────────────────────────────

/** Minúsculas, sin tildes y con los espacios normalizados: «Séneca» y «seneca» son
 *  la misma búsqueda, «niño» y «nino» también, y un salto de línea dentro de una
 *  frase (un poema) cuenta como un espacio. `\p{Diacritic}` es el mismo criterio
 *  de lib/deliverables/slugify.ts y csv.ts (que no se importan: slugify trae
 *  `crypto`, que no debe llegar al cliente); se escribe así y no con un rango de
 *  caracteres combinantes, que es invisible en una revisión. */
export function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
}

/** Si la frase coincide con lo buscado (ya normalizado con `normalizeSearch`):
 *  se busca en la frase, el referente, quién fue y la fuente. Sin texto, todas. */
export function quoteMatches(quote: ParrillaQuote, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true
  return [quote.quote_text, quote.author, quote.author_context, quote.source].some(
    (field) => field != null && normalizeSearch(field).includes(normalizedQuery)
  )
}

/** Los referentes que ya existen, sin repetir y en orden alfabético: alimentan
 *  las sugerencias del formulario para que «Marco Aurelio» no se escriba de tres
 *  maneras. Dos grafías que solo difieren en tildes o mayúsculas son el mismo
 *  referente; se conserva la primera que aparezca. */
export function distinctAuthors(quotes: readonly Pick<ParrillaQuote, 'author'>[]): string[] {
  const seen = new Map<string, string>()
  for (const { author } of quotes) {
    const key = normalizeSearch(author)
    if (key && !seen.has(key)) seen.set(key, author)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'es'))
}

// ─────────────────────── De la frase a la publicación ───────────────────────

/** Lo que «Crear contenido» prellena en la publicación nueva: el título y el copy del
 *  post (la frase entre comillas y el referente en su línea). La categoría NO se prellena:
 *  se elige al construir la publicación. Las comillas son las de `quoteBlock`
 *  (lib/deliverables/html-blocks.ts). */
export function quoteToPostDraft(quote: Pick<ParrillaQuote, 'quote_text' | 'author'>): PostDraft {
  const author = quote.author.trim()
  return {
    title: `Frase de ${author}`,
    caption: `“${quote.quote_text.trim()}”\n\n— ${author}`,
  }
}

// ─────────────────────── Qué guardar y qué cambió ───────────────────────

/** Estado listo para guardar: sin espacios en los extremos, sin las comillas que
 *  envuelven la frase y un único NULL para «vacío» en los opcionales. */
export function normalizeQuoteFields(fields: QuoteFields): QuoteFields {
  return {
    quote_text: stripOuterQuotes(fields.quote_text),
    author: fields.author.trim(),
    author_context: blankToNull(fields.author_context),
    source: blankToNull(fields.source),
  }
}

function copyField<K extends QuoteEditableKey>(
  to: Partial<QuoteFields>,
  from: QuoteFields,
  key: K
): void {
  to[key] = from[key]
}

/** Solo lo que la persona cambió respecto a la foto de partida, ya normalizado.
 *  Mandar solo eso evita pisar lo que otra persona guardó en otros campos
 *  (las frases no llevan token de concurrencia: gana la última escritura de
 *  cada campo). Un cambio que solo agrega espacios no cuenta. */
export function diffQuote(base: QuoteFields, mine: QuoteFields): Partial<QuoteFields> {
  const before = normalizeQuoteFields(base)
  const after = normalizeQuoteFields(mine)
  const patch: Partial<QuoteFields> = {}
  for (const key of QUOTE_EDITABLE_KEYS) {
    if (before[key] !== after[key]) copyField(patch, after, key)
  }
  return patch
}

// ───────────────────────────── Lectura ─────────────────────────────

type QuoteRow = QuoteFields & { id: string; used?: unknown }

/** El `count` de un embed `tabla(count)`, que PostgREST devuelve como `[{ count }]`
 *  (como objeto si la relación fuera 1 a 1). */
function embeddedCount(value: unknown): number {
  const row = Array.isArray(value) ? value[0] : value
  return Number((row as { count?: number } | null | undefined)?.count ?? 0)
}

/** Todas las frases, de la más reciente a la más antigua (el `id` desempata, para
 *  que el orden no salte al editar). Sin scoping por dueño: quien tiene el módulo
 *  "parrilla" ve y edita todas.
 *
 *  `used` cuenta las publicaciones que nacieron de cada frase, con un embed sobre
 *  la FK `parrilla_posts.quote_id`: solo esta consulta la necesita, así que el
 *  listado de publicaciones (PARRILLA_LIST_COLUMNS) no se toca — con una columna
 *  sin migrar el calendario se vería vacío. */
export async function loadParrillaQuotes(supabase: SupabaseClient): Promise<ParrillaQuote[]> {
  // Igual que con las publicaciones: sin `must`, una migración sin aplicar o un tope de tiempo se veía como una
  // biblioteca vacía, sin rastro de por qué.
  const data = must(
    await supabase
      .from('parrilla_quotes')
      .select(`${QUOTE_COLUMNS.join(', ')}, used:parrilla_posts(count)`)
      .order('created_at', { ascending: false })
      .order('id'),
    'Frases de la parrilla'
  )

  // `unknown` en medio: el tipo del `select` con plantilla no se resuelve en
  // tiempo de compilación (el cliente no tiene tipos generados).
  return ((data ?? []) as unknown as QuoteRow[]).map(({ used, ...quote }) => ({
    ...quote,
    used_count: embeddedCount(used),
  }))
}
