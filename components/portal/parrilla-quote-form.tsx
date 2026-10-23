'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { BrandButton } from '@/components/brand/brand-button'
import { BrandField, BrandTextarea } from '@/components/brand/brand-field'
import { ConfirmDialog } from '@/components/portal/confirm-dialog'
import {
  QUOTE_TEXT_MAX,
  charLength,
  diffQuote,
  normalizeQuoteFields,
  stripOuterQuotes,
  type ParrillaQuote,
  type QuoteEditableKey,
  type QuoteFields,
} from '@/lib/parrilla/quotes'

/** Desde cuántos caracteres de la frase se muestra el contador: a mitad del tope
 *  sería ruido, cerca del tope avisa antes de que el servidor lo rechace (el
 *  campo no lleva `maxLength`: truncaría en silencio un texto pegado). */
const COUNTER_FROM = Math.floor(QUOTE_TEXT_MAX * 0.8)

const AUTHORS_LIST_ID = 'parrilla-quote-authors'

function initialFields(quote: ParrillaQuote | null): QuoteFields {
  return {
    quote_text: quote?.quote_text ?? '',
    author: quote?.author ?? '',
    author_context: quote?.author_context ?? null,
    source: quote?.source ?? null,
  }
}

type SendResult = { kind: 'ok' } | { kind: 'missing' } | { kind: 'error'; message: string }

async function send(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body: unknown,
  fallback: string
): Promise<SendResult> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.ok) return { kind: 'ok' }
  if (res.status === 404) return { kind: 'missing' }

  const data = await res.json().catch(() => ({}))
  return { kind: 'error', message: data.error ?? fallback }
}

interface ParrillaQuoteFormProps {
  /** null = crear. */
  quote: ParrillaQuote | null
  authors: string[]
  onClose: () => void
}

/** Se monta una vez por apertura del modal (el diálogo lo renderiza dentro de su
 *  contenido, que Radix desmonta al cerrar): el estado inicial ya es el correcto.
 *
 *  Al editar manda solo lo que cambió (`diffQuote`), así no pisa lo que otra
 *  persona guardó en otros campos. No hay token de concurrencia ni fusión: son
 *  cuatro campos cortos y, si dos personas editan el MISMO a la vez, gana la última
 *  escritura (lib/parrilla/quote-mutations.ts). */
export function ParrillaQuoteForm({ quote, authors, onClose }: ParrillaQuoteFormProps) {
  const router = useRouter()
  // Foto de partida: contra ella se calcula qué cambió.
  const [base] = useState(() => initialFields(quote))
  const [form, setForm] = useState<QuoteFields>(base)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setField<K extends QuoteEditableKey>(key: K, value: QuoteFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Tras guardar o eliminar bien, el diálogo tarda ≈200 ms en cerrarse (su animación de salida): durante ese rato el
  // botón NO se reactiva. Antes el `finally` lo reactivaba al instante y un segundo toque volvía a crear la frase.
  const closingRef = useRef(false)

  function finish() {
    closingRef.current = true
    onClose()
    router.refresh()
  }

  function reportMissing() {
    setError('Esta frase fue eliminada por otra persona.')
    router.refresh()
  }

  async function submitCreate() {
    const outcome = await send(
      '/api/parrilla/frases',
      'POST',
      normalizeQuoteFields(form),
      'No se pudo guardar la frase'
    )
    if (outcome.kind === 'ok') return finish()
    setError(outcome.kind === 'error' ? outcome.message : 'No se pudo guardar la frase')
  }

  async function submitEdit(id: string) {
    const patch = diffQuote(base, form)
    // Nada cambió: no hay nada que mandar.
    if (Object.keys(patch).length === 0) return onClose()

    const outcome = await send(`/api/parrilla/frases/${id}`, 'PATCH', patch, 'No se pudo guardar la frase')
    if (outcome.kind === 'ok') return finish()
    if (outcome.kind === 'missing') return reportMissing()
    setError(outcome.message)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting || closingRef.current) return
    setSubmitting(true)
    setError(null)

    try {
      if (quote) await submitEdit(quote.id)
      else await submitCreate()
    } catch {
      setError('Error de red al guardar la frase')
    } finally {
      if (!closingRef.current) setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!quote || deleting || closingRef.current) return
    setDeleting(true)
    setError(null)

    try {
      const outcome = await send(
        `/api/parrilla/frases/${quote.id}`,
        'DELETE',
        undefined,
        'No se pudo eliminar la frase'
      )
      // 404: otra persona ya la había borrado — el resultado que se buscaba.
      if (outcome.kind === 'error') {
        // El aviso vive en el pie del formulario, que la confirmación tapa: se
        // cierra para que se vea.
        setConfirmDelete(false)
        setError(outcome.message)
        return
      }
      setConfirmDelete(false)
      finish()
    } catch {
      setConfirmDelete(false)
      setError('Error de red al eliminar la frase')
    } finally {
      if (!closingRef.current) setDeleting(false)
    }
  }

  // Lo que se va a guardar: sin comillas envolventes y contado como la base.
  const length = charLength(stripOuterQuotes(form.quote_text))

  return (
    <>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        {/* Solo esta zona hace scroll: la X, el título y el pie con Guardar quedan
            siempre a la vista. */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-6 py-4">
          <div className="space-y-1">
            <BrandTextarea
              id="quote-text"
              label="Frase"
              value={form.quote_text}
              onChange={(e) => setField('quote_text', e.target.value)}
              placeholder="Escribe la frase, sin comillas…"
              wrapperClassName="text-center"
              className="text-left"
              required
            />
            {length >= COUNTER_FROM && (
              <p
                className={`text-center text-xs tabular-nums ${
                  length > QUOTE_TEXT_MAX ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'
                }`}
              >
                {length}/{QUOTE_TEXT_MAX}
              </p>
            )}
          </div>

          <BrandField
            id="quote-author"
            label="Referente"
            value={form.author}
            onChange={(e) => setField('author', e.target.value)}
            placeholder="Ej. Marco Aurelio"
            // Las sugerencias son los referentes ya guardados: así «Marco Aurelio» no
            // se escribe de tres maneras. Sin el autocompletado del navegador encima.
            list={AUTHORS_LIST_ID}
            autoComplete="off"
            autoCapitalize="words"
            wrapperClassName="text-center"
            className="text-left"
            required
          />
          {authors.length > 0 && (
            <datalist id={AUTHORS_LIST_ID}>
              {authors.map((author) => (
                <option key={author} value={author} />
              ))}
            </datalist>
          )}

          <BrandField
            id="quote-context"
            label="Quién fue (opcional)"
            value={form.author_context ?? ''}
            onChange={(e) => setField('author_context', e.target.value)}
            placeholder="Ej. Emperador y filósofo estoico"
            wrapperClassName="text-center"
            className="text-left"
          />

          <div className="space-y-1">
            {/* BrandField dibuja el atajo «Abrir enlace» solo si la fuente es una URL. */}
            <BrandField
              id="quote-source"
              label="Fuente (opcional)"
              value={form.source ?? ''}
              onChange={(e) => setField('source', e.target.value)}
              placeholder="Obra, discurso o enlace"
              wrapperClassName="text-center"
              className="text-left"
            />
            <p className="text-center text-xs text-muted-foreground">
              Muchas frases famosas se atribuyen mal. Cita la fuente cuando la tengas.
            </p>
          </div>
        </div>

        {/* Pie fijo. El error vive aquí, junto al botón que lo provoca: dentro del
            área con scroll quedaría fuera de vista justo al pulsar Guardar. */}
        <div className="shrink-0 space-y-2 border-t border-border/60 px-6 pb-4 pt-3">
          {error && (
            <p role="alert" className="text-center text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            {quote && (
              // En el extremo opuesto a «Guardar» para que no se preste a un toque
              // accidental junto al botón principal, y con 44 px de alto al tacto
              // (mínimo recomendado por Apple HIG). Rojo 700 en claro y 400 en oscuro:
              // el `red-500` de «Eliminar publicación» da 3,5:1 sobre el fondo claro del
              // modal y el mínimo AA para texto de 12 px es 4,5:1.
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg px-1 py-1 text-xs font-medium text-red-700 transition-colors hover:text-red-800 active:text-red-900 dark:text-red-400 dark:hover:text-red-300 dark:active:text-red-200 pointer-coarse:min-h-11 pointer-coarse:px-3"
              >
                <Trash2 className="size-3.5" />
                Eliminar frase
              </button>
            )}
            <BrandButton type="submit" size="sm" className="ml-auto w-auto" disabled={submitting}>
              {submitting ? 'Guardando…' : quote ? 'Guardar cambios' : 'Guardar frase'}
            </BrandButton>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="¿Eliminar esta frase?"
        message="Las publicaciones creadas a partir de ella se conservan. Esta acción no se puede deshacer."
        confirmLabel={deleting ? 'Eliminando…' : 'Eliminar'}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
