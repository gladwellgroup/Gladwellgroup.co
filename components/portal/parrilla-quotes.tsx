'use client'

import { useMemo, useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import { BrandButton } from '@/components/brand/brand-button'
import { BrandCard } from '@/components/brand/brand-card'
import { ParrillaPostDialog } from '@/components/portal/parrilla-post-dialog'
import { ParrillaQuoteDialog } from '@/components/portal/parrilla-quote-dialog'
import { ListViewToggle } from '@/components/portal/parrilla-shared'
import { ParrillaTable, type ParrillaTableColumn } from '@/components/portal/parrilla-table'
import { PARRILLA_CATEGORY_LABELS, type ParrillaEditor } from '@/lib/parrilla/posts'
import type { ParrillaListView } from '@/lib/parrilla/table'
import {
  normalizeSearch,
  quoteMatches,
  quoteToPostDraft,
  type ParrillaQuote,
} from '@/lib/parrilla/quotes'

interface ParrillaQuotesProps {
  /** Las frases que pasaron el filtro de categoría del tablero, en el orden del
   *  servidor (más recientes primero). */
  quotes: ParrillaQuote[]
  /** Cuántas hay en total, sin filtros: distingue "la biblioteca está vacía" de
   *  "ninguna coincide con el filtro". */
  total: number
  /** Si alguna frase de la biblioteca ya se usó. Sin ninguna usada, «Sin usar»
   *  sería lo mismo que «todas» y el filtro solo estorbaría. */
  anyUsed: boolean
  /** Los referentes que ya existen, para sugerirlos al escribir uno nuevo. */
  authors: string[]
  editors: ParrillaEditor[]
  /** Cómo se ven las frases: tarjetas o tabla. La elige y recuerda el tablero. */
  view: ParrillaListView
  onViewChange: (view: ParrillaListView) => void
}

/** Biblioteca de frases de referentes históricos: la materia prima de las
 *  publicaciones. Cada tarjeta se abre para editar la frase y trae su propio
 *  «Crear contenido», que abre «Nueva publicación» ya prellenada (título, copy y
 *  categoría) y guarda de qué frase nació, para poder marcarla «Usada».
 *
 *  Mismo criterio que el Banco: una sola superficie, tarjetas de la MISMA altura
 *  (la frase ocupa un bloque fijo de 4 líneas, el resto de las líneas tiene alto
 *  fijo aunque falte el dato) y objetivos de 44 px al tacto. Todo centrado.
 *
 *  La tarjeta es un `div` con dos botones HERMANOS —editar y «Crear contenido»—:
 *  un botón dentro de otro no es HTML válido y en Safari el toque se va al
 *  equivocado. Sin cursiva (Geist solo tiene romana: el navegador la
 *  sintetizaría) y sin fechas (Node y Safari las formatean distinto).
 *
 *  Tiene dos vistas de la misma lista: tarjetas y tabla. La tabla recibe lo que el
 *  buscador, «Sin usar» y la categoría dejaron, y trae su propio «Crear contenido» en
 *  cada fila, así que hace lo mismo que las tarjetas. */
export function ParrillaQuotes({
  quotes,
  total,
  anyUsed,
  authors,
  editors,
  view,
  onViewChange,
}: ParrillaQuotesProps) {
  const [query, setQuery] = useState('')
  const [onlyUnused, setOnlyUnused] = useState(false)
  const [editingQuote, setEditingQuote] = useState<ParrillaQuote | null>(null)
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false)
  const [sourceQuote, setSourceQuote] = useState<ParrillaQuote | null>(null)
  const [postDialogOpen, setPostDialogOpen] = useState(false)

  const normalizedQuery = normalizeSearch(query)

  const visible = useMemo(
    () =>
      quotes.filter(
        (quote) => (!onlyUnused || quote.used_count === 0) && quoteMatches(quote, normalizedQuery)
      ),
    [quotes, onlyUnused, normalizedQuery]
  )
  const unusedCount = useMemo(() => quotes.filter((quote) => quote.used_count === 0).length, [quotes])

  // Las propiedades de una frase, una columna cada una. La frase abre la edición; el
  // botón de la última columna crea la publicación (por eso la fila lo ignora al
  // hacer clic: ver `opensRow`).
  const columns: ParrillaTableColumn<ParrillaQuote>[] = [
    {
      key: 'frase',
      label: 'Frase',
      primary: true,
      sortValue: (quote) => quote.quote_text,
      cell: (quote) => (
        <span className="line-clamp-2 w-72 whitespace-pre-line break-words font-medium text-foreground">
          “{quote.quote_text}”
        </span>
      ),
    },
    {
      key: 'referente',
      label: 'Referente',
      sortValue: (quote) => quote.author,
      // El referente permite hasta 120 caracteres: con tope y dos líneas (+657 px sin él).
      cell: (quote) => (
        <span
          className="line-clamp-2 max-w-32 whitespace-normal break-words font-semibold text-foreground"
          title={quote.author}
        >
          {quote.author}
        </span>
      ),
    },
    {
      key: 'quien-fue',
      label: 'Quién fue',
      sortValue: (quote) => quote.author_context,
      // Dos líneas de ancho fijo y no `truncate`: «quién fue» se sigue leyendo casi entero.
      cell: (quote) => (
        <span
          className="line-clamp-2 w-32 whitespace-normal break-words"
          title={quote.author_context ?? undefined}
        >
          {quote.author_context || '—'}
        </span>
      ),
    },
    {
      key: 'fuente',
      label: 'Fuente',
      // La menos importante: se oculta cuando la tabla no tiene ~1180 px, para que «Crear
      // contenido» (la última columna) no quede fuera de pantalla en un iPad horizontal. El
      // umbral sale de los anchos tope de las columnas; medido en WebKit con datos de peor caso:
      // 976 px sin Fuente (caben en los 1016 de un iPad Air horizontal) y 1128 con ella. Si se
      // añade o ensancha una columna, volver a medir (AGENTS.md → «Tablas»).
      className: 'hidden @min-[1180px]:table-cell',
      sortValue: (quote) => quote.source,
      cell: (quote) => (
        <span className="line-clamp-2 w-32 whitespace-normal break-words" title={quote.source ?? undefined}>
          {quote.source || '—'}
        </span>
      ),
    },
    {
      key: 'categoria',
      label: 'Categoría',
      sortValue: (quote) => (quote.category ? PARRILLA_CATEGORY_LABELS[quote.category] : null),
      cell: (quote) =>
        quote.category ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] leading-none">
            {PARRILLA_CATEGORY_LABELS[quote.category]}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'uso',
      label: 'Uso',
      sortValue: (quote) => quote.used_count,
      cell: (quote) =>
        quote.used_count > 0 ? (
          // Chip neutro, como en la tarjeta: el cian y el violeta a 11 px no pasan AA en
          // tema claro.
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] leading-none">
            <Check className="size-3" aria-hidden="true" />
            Usada ×{quote.used_count}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'crear',
      label: 'Acciones',
      hideLabel: true,
      cell: (quote) => (
        <BrandButton
          type="button"
          variant="secondary"
          size="sm"
          // `hover:` no existe al tacto: el feedback al pulsar va en `active:`.
          className="w-auto active:bg-accent active:text-accent-foreground"
          aria-label={`Crear contenido con la frase de ${quote.author}`}
          onClick={() => openCreateContent(quote)}
        >
          Crear contenido
        </BrandButton>
      ),
    },
  ]

  function openCreate() {
    setEditingQuote(null)
    setQuoteDialogOpen(true)
  }

  function openEdit(quote: ParrillaQuote) {
    setEditingQuote(quote)
    setQuoteDialogOpen(true)
  }

  function openCreateContent(quote: ParrillaQuote) {
    setSourceQuote(quote)
    setPostDialogOpen(true)
  }

  return (
    <>
      <BrandCard padding="sm" border="solid" className="touch-manipulation space-y-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-2 sm:flex-row">
          {total > 0 && (
            <div className="relative w-full sm:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por frase, referente o fuente..."
                aria-label="Buscar una frase"
                className="modal-field w-full pl-9"
              />
            </div>
          )}
          {/* En un teléfono el buscador ocupa su fila y el interruptor comparte la de
              abajo con «Nueva frase»; desde `sm` todo va en una sola fila. */}
          <div className="flex shrink-0 items-center gap-2">
            {total > 0 && <ListViewToggle value={view} onChange={onViewChange} />}
            <BrandButton type="button" size="sm" className="w-auto shrink-0" onClick={openCreate}>
              <Plus className="size-4" />
              Nueva frase
            </BrandButton>
          </div>
        </div>

        {anyUsed && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setOnlyUnused((current) => !current)}
              aria-pressed={onlyUnused}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors pointer-coarse:min-h-11 pointer-coarse:px-4 pointer-coarse:text-sm ${
                onlyUnused
                  ? 'border-[#7C3AED] bg-[#7C3AED]/15 text-[#A78BFA]'
                  : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground active:bg-muted/60'
              }`}
            >
              Sin usar
              <span className="tabular-nums opacity-70">{unusedCount}</span>
            </button>
          </div>
        )}

        {visible.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">
            {total === 0
              ? 'Aún no hay frases. Guarda una con «Nueva frase»: queda aquí como materia prima para tus publicaciones.'
              : query.trim()
                ? `Ninguna frase coincide con "${query.trim()}".`
                : 'Ninguna frase coincide con los filtros.'}
          </p>
        ) : view === 'tabla' ? (
          <ParrillaTable
            columns={columns}
            rows={visible}
            getRowId={(quote) => quote.id}
            onOpen={openEdit}
            caption="Frases de referentes"
          />
        ) : (
          // `flex` en cada `li` y `w-full` en la tarjeta: se estira a la altura de
          // la fila de la cuadrícula. Y como cada bloque de la tarjeta tiene alto
          // fijo, también todas las filas miden lo mismo.
          //
          // `grid-cols-1` es `minmax(0, 1fr)`: sin él la única columna es implícita
          // (`auto`) y crece hasta el texto sin cortar más largo —el `truncate` del
          // referente y de «quién fue» es `nowrap`—, así que en un iPhone SE un
          // «quién fue» largo ensanchaba la tarjeta a 569 px dentro de un contenedor
          // de 293 y se salía de la pantalla. `min-w-0` en la cadena, por lo mismo.
          <ul aria-label="Frases" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {visible.map((quote) => (
              <li key={quote.id} className="flex min-w-0">
                <div className="flex w-full min-w-0 flex-col overflow-hidden rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => openEdit(quote)}
                    aria-haspopup="dialog"
                    className="flex min-w-0 flex-1 flex-col items-center gap-1 p-3 text-center transition-colors hover:bg-muted/40 active:bg-muted/60"
                  >
                    {/* 4 líneas de `leading-6` = 96 px: un bloque fijo, así una frase
                        corta y una larga dejan tarjetas del mismo alto. */}
                    <span className="flex h-24 w-full items-center justify-center">
                      <span className="line-clamp-4 whitespace-pre-line break-words text-sm font-medium leading-6">
                        “{quote.quote_text}”
                      </span>
                    </span>
                    <span className="w-full truncate text-sm font-semibold">{quote.author}</span>
                    {/* Alto fijo aunque falte «quién fue»: las tarjetas con y sin el
                        dato no quedan de alturas dispares. */}
                    <span className="h-4 w-full truncate text-xs leading-4 text-muted-foreground">
                      {quote.author_context}
                    </span>
                    <span className="flex h-6 items-center justify-center gap-1.5 text-[11px] leading-none text-muted-foreground">
                      {quote.category && (
                        <span className="rounded-full border border-border px-2 py-0.5">
                          {PARRILLA_CATEGORY_LABELS[quote.category]}
                        </span>
                      )}
                      {quote.used_count > 0 && (
                        // Chip neutro: el cian y el violeta a 11 px no pasan AA en
                        // tema claro; el color queda para los estados activos.
                        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
                          <Check className="size-3" aria-hidden="true" />
                          Usada ×{quote.used_count}
                        </span>
                      )}
                    </span>
                  </button>
                  <div className="border-t border-border p-2">
                    {/* `secondary`: repetido en cada tarjeta, el degradado del botón
                        principal le quitaría el énfasis a «Nueva frase». */}
                    <BrandButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      // `hover:` no existe al tacto: el feedback al pulsar va en `active:`.
                      className="w-full active:bg-accent active:text-accent-foreground"
                      aria-label={`Crear contenido con la frase de ${quote.author}`}
                      onClick={() => openCreateContent(quote)}
                    >
                      Crear contenido
                    </BrandButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </BrandCard>

      <ParrillaQuoteDialog
        open={quoteDialogOpen}
        onOpenChange={setQuoteDialogOpen}
        quote={editingQuote}
        authors={authors}
      />

      {/* Una publicación NUEVA (post null) con el borrador de la frase y su id: la
          pieza queda vinculada y la tarjeta pasa a «Usada» al refrescar. El estado
          arranca en Idea con las fechas de hoy, como cualquier publicación nueva; si
          se quiere para el Banco, se cambia el Estado a Archivado en el modal. */}
      <ParrillaPostDialog
        open={postDialogOpen}
        onOpenChange={setPostDialogOpen}
        post={null}
        draft={sourceQuote ? quoteToPostDraft(sourceQuote) : undefined}
        sourceQuoteId={sourceQuote?.id}
        editors={editors}
      />
    </>
  )
}
