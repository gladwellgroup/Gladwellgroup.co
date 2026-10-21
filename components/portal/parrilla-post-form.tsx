'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { BrandButton } from '@/components/brand/brand-button'
import { BrandField } from '@/components/brand/brand-field'
import { CollapsibleTextarea } from '@/components/portal/collapsible-textarea'
import { ConfirmDialog } from '@/components/portal/confirm-dialog'
import { ParrillaMediaUpload } from '@/components/portal/parrilla-media-upload'
import { ToggleableSection } from '@/components/portal/parrilla-section'
import { TeamPicker } from '@/components/portal/team-picker'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PARRILLA_CATEGORIES,
  PARRILLA_CATEGORY_LABELS,
  PARRILLA_FORMATS,
  PARRILLA_FORMAT_LABELS,
  PARRILLA_SECTION_LABELS,
  PARRILLA_STATUSES,
  PARRILLA_STATUS_LABELS,
  PLATFORMS,
  PLATFORM_LABELS,
  type ParrillaCategory,
  type ParrillaEditor,
  type ParrillaFormat,
  type ParrillaPost,
  type ParrillaPostSummary,
  type ParrillaSection,
  type ParrillaStatus,
  type Platform,
} from '@/lib/parrilla/posts'
import {
  diffPost,
  isArchived,
  mergeLatest,
  normalizeFields,
  sectionHasContent,
  showsFilmmaker,
  showsInspiration,
  showsTalent,
  type EditableFields,
  type EditableKey,
  type PostDraft,
} from '@/lib/parrilla/rules'

/** Nombres con los que el modal muestra cada campo — para avisar cuál cambió
 *  cuando dos personas editan lo mismo. */
const FIELD_LABELS: Record<EditableKey, string> = {
  title: 'Título',
  copy_text: 'Guion',
  caption: 'Copy del post',
  platforms: 'Plataformas',
  production_date: 'Fecha de producción',
  publish_date: 'Fecha de publicación',
  status: 'Estado',
  format: 'Formato',
  cover_image_url: 'Foto de portada',
  talent: 'Responsable en cámara',
  inspiration_url: 'Inspiración',
  hidden_sections: 'Secciones ocultas',
  filmmaker_ids: 'Filmmaker(es)',
  editor_ids: 'Editor/Diseñador(es)',
  category: 'Categoría',
}

function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Punto de partida del formulario. En edición solo se conoce el resumen del
 *  calendario: Guion, Copy y portada llegan con el detalle. Al crear, `draft` (p.
 *  ej. una frase de la pestaña «Frases») prellena título y copy, y nada
 *  más: las fechas y el estado siguen saliendo de `defaultDate` / `defaultStatus`.
 *  Exportada para probarla sin dibujar el formulario. */
export function initialFields(
  post: ParrillaPostSummary | null,
  defaultDate?: string,
  defaultStatus?: ParrillaStatus,
  draft?: PostDraft
): EditableFields {
  if (post) {
    return {
      title: post.title,
      platforms: post.platforms,
      production_date: post.production_date,
      publish_date: post.publish_date,
      status: post.status,
      format: post.format,
      category: post.category,
      talent: post.talent,
      inspiration_url: post.inspiration_url,
      hidden_sections: post.hidden_sections,
      filmmaker_ids: post.filmmaker_ids,
      editor_ids: post.editor_ids,
      copy_text: null,
      caption: null,
      cover_image_url: null,
    }
  }

  // Al crear desde un día del calendario, las dos fechas arrancan iguales — lo
  // normal es producir y publicar el mismo día salvo que se ajuste a mano. Una
  // idea nueva del Banco (estado inicial archivado) nace sin fecha de
  // publicación, como cualquier pieza archivada.
  const day = defaultDate ?? todayIso()
  const status = defaultStatus ?? 'idea'
  return {
    title: draft?.title ?? '',
    platforms: [],
    production_date: day,
    publish_date: isArchived(status) ? null : day,
    status,
    format: null,
    category: null,
    talent: null,
    inspiration_url: null,
    hidden_sections: [],
    filmmaker_ids: [],
    editor_ids: [],
    copy_text: null,
    caption: draft?.caption ?? null,
    cover_image_url: null,
  }
}

function toEditable(post: ParrillaPost): EditableFields {
  return {
    title: post.title,
    copy_text: post.copy_text,
    caption: post.caption,
    platforms: post.platforms,
    production_date: post.production_date,
    publish_date: post.publish_date,
    status: post.status,
    format: post.format,
    cover_image_url: post.cover_image_url,
    talent: post.talent,
    inspiration_url: post.inspiration_url,
    hidden_sections: post.hidden_sections,
    filmmaker_ids: post.filmmaker_ids,
    editor_ids: post.editor_ids,
    category: post.category,
  }
}

class DetailError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function fetchDetail(id: string, signal?: AbortSignal): Promise<ParrillaPost> {
  const res = await fetch(`/api/parrilla/${id}`, { cache: 'no-store', signal })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new DetailError(res.status, data.error ?? 'No se pudo cargar la publicación')
  return data as ParrillaPost
}

type SendResult =
  | { kind: 'ok' }
  | { kind: 'conflict' }
  | { kind: 'missing' }
  | { kind: 'error'; message: string }

async function send(url: string, method: 'POST' | 'PATCH', body: unknown): Promise<SendResult> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.ok) return { kind: 'ok' }
  if (res.status === 409) return { kind: 'conflict' }
  if (res.status === 404) return { kind: 'missing' }

  const data = await res.json().catch(() => ({}))
  return { kind: 'error', message: data.error ?? 'No se pudo guardar la publicación' }
}

/** Mantiene el alto del campo mientras llega el detalle, para que el modal no
 *  salte cuando aparece el contenido real. Solo el cuerpo: el título y el ojo
 *  los dibuja la cabecera de la sección, que no espera al detalle. */
function FieldSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton
      aria-busy="true"
      className={className ?? 'h-[42px] w-full rounded-lg pointer-coarse:h-[46px]'}
    />
  )
}

interface FormState {
  /** Lo que la persona ve y edita. */
  form: EditableFields
  /** Foto de partida: contra ella se calcula qué cambió. Se reemplaza solo
   *  junto con `form` (mergeLatest) — si no, un campo viejo en el formulario
   *  aparecería como "cambiado" y pisaría lo que otra persona guardó. */
  base: EditableFields
  /** Versión de la publicación que se tiene abierta (updated_at tal cual). */
  token: string | null
  detail: 'loading' | 'ready' | 'error'
  loadError: string | null
}

interface ParrillaPostFormProps {
  /** null = crear. En edición llega el resumen del calendario: con eso el modal
   *  abre al instante y el detalle se pide aparte. */
  post: ParrillaPostSummary | null
  defaultDate?: string
  /** Estado con el que arranca una pieza nueva; sin él, 'idea'. El Banco de
   *  contenido crea sus ideas ya archivadas. */
  defaultStatus?: ParrillaStatus
  /** Prellenado de una pieza NUEVA (título, copy y categoría); se ignora al editar. */
  draft?: PostDraft
  /** La frase de la que nace la pieza nueva. Se manda al crear, una sola vez. */
  sourceQuoteId?: string
  editors: ParrillaEditor[]
  onClose: () => void
}

/** Se monta una vez por apertura del modal (el diálogo lo renderiza dentro de
 *  su contenido, que Radix desmonta al cerrar) — por eso no hay un efecto que
 *  "resetee" el estado al abrir: el estado inicial ya es el correcto. */
export function ParrillaPostForm({
  post,
  defaultDate,
  defaultStatus,
  draft,
  sourceQuoteId,
  editors,
  onClose,
}: ParrillaPostFormProps) {
  const router = useRouter()
  const [state, setState] = useState<FormState>(() => {
    const start = initialFields(post, defaultDate, defaultStatus, draft)
    return {
      form: start,
      base: start,
      token: null,
      detail: post ? 'loading' : 'ready',
      loadError: null,
    }
  })
  const [reloadKey, setReloadKey] = useState(0)
  // Colapsados por defecto: un guion o un copy largo no debe dominar el modal.
  // Si ya tenía texto (edición), arranca abierto para que no parezca que se
  // perdió — se decide cuando llega el detalle. Un copy prellenado desde una
  // frase también arranca abierto: colapsado se vería como un botón con el texto
  // truncado, y es justo lo que se quiere revisar.
  const [guionExpanded, setGuionExpanded] = useState(false)
  const [captionExpanded, setCaptionExpanded] = useState(() => !post && Boolean(draft?.caption))
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<EditableKey[]>([])
  // La fecha de publicación que tenía la pieza antes de archivarla: si se
  // arrepiente y la saca del archivo, vuelve esa y no una inventada.
  const stashedPublishDate = useRef<string | null>(null)

  const { form } = state
  const archived = isArchived(form.status)
  const isHidden = (section: ParrillaSection) => form.hidden_sections.includes(section)
  const ready = !post || state.detail === 'ready'

  useEffect(() => {
    if (!post) return
    const controller = new AbortController()

    fetchDetail(post.id, controller.signal)
      .then((latest) => {
        const latestFields = toEditable(latest)
        // Lo que la persona alcanzó a tocar mientras cargaba se conserva; lo
        // demás adopta lo guardado.
        setState((prev) => ({
          form: mergeLatest(prev.base, prev.form, latestFields).merged,
          base: latestFields,
          token: latest.updated_at,
          detail: 'ready',
          loadError: null,
        }))
        setGuionExpanded(!!latest.copy_text)
        setCaptionExpanded(!!latest.caption)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        const message =
          err instanceof DetailError ? err.message : 'Error de red al cargar la publicación'
        setState((prev) => ({ ...prev, detail: 'error', loadError: message }))
      })

    return () => controller.abort()
  }, [post, reloadKey])

  function retryDetail() {
    setState((prev) => ({ ...prev, detail: 'loading', loadError: null }))
    setReloadKey((key) => key + 1)
  }

  function setField<K extends EditableKey>(key: K, value: EditableFields[K]) {
    setState((prev) => ({ ...prev, form: { ...prev.form, [key]: value } }))
  }

  /** Archivar borra la fecha de publicación (el Banco de contenido no tiene
   *  fechas); sacarla del archivo la restaura — la anterior si la hay, si no la
   *  de producción, igual que al crear — porque sin fecha no puede salir. */
  function changeStatus(next: ParrillaStatus) {
    if (isArchived(next)) {
      if (form.publish_date) stashedPublishDate.current = form.publish_date
      setState((prev) => ({
        ...prev,
        form: { ...prev.form, status: next, publish_date: null },
      }))
      return
    }

    const restored = stashedPublishDate.current ?? form.production_date
    setState((prev) => ({
      ...prev,
      form: { ...prev.form, status: next, publish_date: prev.form.publish_date ?? restored },
    }))
  }

  function togglePlatform(platform: Platform) {
    setState((prev) => {
      const list = prev.form.platforms
      const next = list.includes(platform) ? list.filter((p) => p !== platform) : [...list, platform]
      return { ...prev, form: { ...prev.form, platforms: next } }
    })
  }

  /** El ojo de una sección. Cambia el formulario como cualquier otro campo:
   *  se guarda con «Guardar cambios». Ocultar no toca el contenido. */
  function toggleSection(section: ParrillaSection) {
    setState((prev) => {
      const list = prev.form.hidden_sections
      const next = list.includes(section) ? list.filter((s) => s !== section) : [...list, section]
      return { ...prev, form: { ...prev.form, hidden_sections: next } }
    })
  }

  function toggleTeam(key: 'filmmaker_ids' | 'editor_ids', id: string) {
    setState((prev) => {
      const list = prev.form[key]
      const next = list.includes(id) ? list.filter((e) => e !== id) : [...list, id]
      return { ...prev, form: { ...prev.form, [key]: next } }
    })
  }

  function finish() {
    onClose()
    router.refresh()
  }

  function reportMissing() {
    setError('Esta publicación fue eliminada por otra persona.')
    router.refresh()
  }

  async function submitCreate() {
    // `quote_id` solo viaja si la pieza nace de una frase: una alta normal manda
    // exactamente lo mismo de siempre.
    const outcome = await send('/api/parrilla', 'POST', {
      ...normalizeFields(form),
      ...(sourceQuoteId ? { quote_id: sourceQuoteId } : {}),
    })
    if (outcome.kind === 'ok') return finish()
    setError(outcome.kind === 'error' ? outcome.message : 'No se pudo crear la publicación')
  }

  async function submitEdit(postId: string) {
    const mine = normalizeFields(form)
    // Solo lo que cambió: lo demás no se manda, así que no puede pisar lo que
    // otra persona guardó en otros campos.
    const patch = diffPost(state.base, mine)
    if (Object.keys(patch).length === 0) return onClose()

    const url = `/api/parrilla/${postId}`
    const first = await send(url, 'PATCH', {
      ...patch,
      expected_updated_at: state.token ?? undefined,
    })
    if (first.kind === 'ok') return finish()
    if (first.kind === 'missing') return reportMissing()
    if (first.kind === 'error') return setError(first.message)

    // Conflicto: alguien guardó mientras editabas. Se trae lo último y se mezcla.
    let latestPost: ParrillaPost
    try {
      latestPost = await fetchDetail(postId)
    } catch (err) {
      if (err instanceof DetailError && err.status === 404) return reportMissing()
      return setError(
        'Otra persona guardó cambios y no se pudo cargar la versión actual. Inténtalo de nuevo.'
      )
    }

    const latest = toEditable(latestPost)
    const { merged, conflicts: clashing } = mergeLatest(state.base, mine, latest)
    const adopt = () =>
      setState((prev) => ({ ...prev, form: merged, base: latest, token: latestPost.updated_at }))

    if (clashing.length > 0) {
      // La misma cosa cambiada por las dos personas: decide quien está guardando.
      // Se conserva su versión y se avisa; al volver a pulsar Guardar se aplica.
      adopt()
      setConflicts(clashing)
      return
    }

    // Campos distintos: no hay nada que decidir, se reintenta una vez con lo último.
    const retryPatch = diffPost(latest, merged)
    if (Object.keys(retryPatch).length === 0) return finish()

    const retry = await send(url, 'PATCH', {
      ...retryPatch,
      expected_updated_at: latestPost.updated_at,
    })
    if (retry.kind === 'ok') return finish()
    if (retry.kind === 'missing') return reportMissing()

    adopt()
    setError(
      retry.kind === 'error'
        ? retry.message
        : 'La publicación volvió a cambiar mientras guardabas. Inténtalo de nuevo.'
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!ready) return

    setSubmitting(true)
    setError(null)
    setConflicts([])

    try {
      if (post) await submitEdit(post.id)
      else await submitCreate()
    } catch {
      setError('Error de red al guardar la publicación')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!post) return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/parrilla/${post.id}`, { method: 'DELETE' })
      // 404: otra persona ya la había borrado — el resultado que se buscaba.
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'No se pudo eliminar la publicación')
        return
      }
      setConfirmDelete(false)
      finish()
    } catch {
      setError('Error de red al eliminar la publicación')
    } finally {
      setDeleting(false)
    }
  }

  const conflictNames = conflicts.map((key) => `«${FIELD_LABELS[key]}»`)
  const conflictMessage =
    conflicts.length === 0
      ? null
      : `${
          conflictNames.length === 1
            ? conflictNames[0]
            : `${conflictNames.slice(0, -1).join(', ')} y ${conflictNames[conflictNames.length - 1]}`
        } ${conflicts.length === 1 ? 'cambió' : 'cambiaron'} mientras editabas. Al volver a pulsar Guardar se conserva tu versión.`

  return (
    <>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        {/* Solo esta zona hace scroll: la X, el título y el pie con Guardar
            quedan siempre a la vista (en iPad el formulario es más largo que la
            pantalla). */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-6 py-4">
          <BrandField
            id="parrilla-title"
            label="Título"
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            wrapperClassName="text-center"
            className="text-left"
            required
          />
          <div className="space-y-1.5 text-center">
            <span className="modal-label">Plataformas</span>
            <div className="flex flex-wrap justify-center gap-2">
              {PLATFORMS.map((platform) => {
                const active = form.platforms.includes(platform)
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => togglePlatform(platform)}
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:items-center pointer-coarse:px-4 pointer-coarse:text-sm ${
                      active
                        ? 'border-[#7C3AED] bg-[#7C3AED]/15 text-[#A78BFA]'
                        : 'border-border text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    {PLATFORM_LABELS[platform]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <BrandField
              id="parrilla-production-date"
              label="Fecha de producción"
              type="date"
              value={form.production_date}
              onChange={(e) => setField('production_date', e.target.value)}
              wrapperClassName={archived ? 'col-span-2 text-center' : 'text-center'}
              className="text-left"
              required
            />
            {!archived && (
              <BrandField
                id="parrilla-publish-date"
                label="Fecha de publicación"
                type="date"
                value={form.publish_date ?? ''}
                onChange={(e) => setField('publish_date', e.target.value)}
                // Publicar antes de producir no tiene sentido: el navegador lo marca
                // al instante (el servidor valida igual).
                min={form.production_date}
                wrapperClassName="text-center"
                className="text-left"
                required
              />
            )}
          </div>
          {archived && (
            <p className="text-center text-xs text-muted-foreground">
              Al archivar se quita la fecha de publicación. La idea queda guardada en el Banco de
              contenido.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <label htmlFor="parrilla-status" className="modal-label">
                Estado
              </label>
              <select
                id="parrilla-status"
                value={form.status}
                onChange={(e) => changeStatus(e.target.value as ParrillaStatus)}
                className="modal-field"
              >
                {PARRILLA_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PARRILLA_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <label htmlFor="parrilla-format" className="modal-label">
                Formato
              </label>
              <select
                id="parrilla-format"
                value={form.format ?? ''}
                onChange={(e) => setField('format', (e.target.value || null) as ParrillaFormat | null)}
                className="modal-field"
              >
                <option value="">Sin definir</option>
                {PARRILLA_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {PARRILLA_FORMAT_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center sm:col-span-2">
              <label htmlFor="parrilla-category" className="modal-label">
                Categoría
              </label>
              <select
                id="parrilla-category"
                value={form.category ?? ''}
                onChange={(e) =>
                  setField('category', (e.target.value || null) as ParrillaCategory | null)
                }
                className="modal-field"
              >
                <option value="">Sin categoría</option>
                {PARRILLA_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {PARRILLA_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {showsTalent(form.format) && (
            <BrandField
              id="parrilla-talent"
              label="Responsable en cámara"
              value={form.talent ?? ''}
              onChange={(e) => setField('talent', e.target.value)}
              placeholder="Nombre(s)…"
              wrapperClassName="text-center"
              className="text-left"
            />
          )}

          {showsInspiration(form.format) && (
            <ToggleableSection
              id="parrilla-inspiration"
              label={PARRILLA_SECTION_LABELS.inspiracion}
              hidden={isHidden('inspiracion')}
              hasContent={sectionHasContent(form, 'inspiracion')}
              onToggle={() => toggleSection('inspiracion')}
            >
              <BrandField
                id="parrilla-inspiration"
                label={PARRILLA_SECTION_LABELS.inspiracion}
                hideLabel
                type="url"
                value={form.inspiration_url ?? ''}
                onChange={(e) => setField('inspiration_url', e.target.value)}
                placeholder="https://… enlace de referencia"
                // Un enlace no es prosa: sin mayúscula inicial ni autocorrección
                // en iPad. BrandField dibuja el atajo "Abrir enlace" por sí solo.
                autoCapitalize="none"
                spellCheck={false}
                wrapperClassName="text-center"
                className="text-left"
              />
            </ToggleableSection>
          )}

          {showsFilmmaker(form.format, form.category) && (
            <TeamPicker
              label="Filmmaker(es)"
              options={editors}
              selected={form.filmmaker_ids}
              onToggle={(id) => toggleTeam('filmmaker_ids', id)}
            />
          )}

          <TeamPicker
            label="Editor/Diseñador(es)"
            options={editors}
            selected={form.editor_ids}
            onToggle={(id) => toggleTeam('editor_ids', id)}
          />

          {state.detail === 'error' ? (
            <div className="space-y-2 text-center">
              <p role="alert" className="text-sm text-red-500">
                {state.loadError}
              </p>
              <button
                type="button"
                onClick={retryDetail}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                Reintentar
              </button>
            </div>
          ) : (
            // Las cabeceras (título + ojo) no esperan al detalle: el estado de
            // «oculta» viaja en el listado, así que una sección oculta no
            // parpadea abierta. Solo el cuerpo muestra esqueleto mientras carga.
            <>
              <ToggleableSection
                id="parrilla-guion"
                label={PARRILLA_SECTION_LABELS.guion}
                hidden={isHidden('guion')}
                hasContent={ready && sectionHasContent(form, 'guion')}
                onToggle={() => toggleSection('guion')}
              >
                {ready ? (
                  <CollapsibleTextarea
                    id="parrilla-guion"
                    label={PARRILLA_SECTION_LABELS.guion}
                    hideLabel
                    value={form.copy_text ?? ''}
                    onChange={(value) => setField('copy_text', value)}
                    expanded={guionExpanded}
                    onExpandedChange={setGuionExpanded}
                    placeholder="Hook, cuerpo, tiempos y dirección — todo el guion cabe acá…"
                    emptyLabel="Agregar guion…"
                  />
                ) : (
                  <FieldSkeleton />
                )}
              </ToggleableSection>

              <ToggleableSection
                id="parrilla-caption"
                label={PARRILLA_SECTION_LABELS.copy}
                hidden={isHidden('copy')}
                hasContent={ready && sectionHasContent(form, 'copy')}
                onToggle={() => toggleSection('copy')}
              >
                {ready ? (
                  <CollapsibleTextarea
                    id="parrilla-caption"
                    label={PARRILLA_SECTION_LABELS.copy}
                    hideLabel
                    value={form.caption ?? ''}
                    onChange={(value) => setField('caption', value)}
                    expanded={captionExpanded}
                    onExpandedChange={setCaptionExpanded}
                    placeholder="Texto, hashtags y llamado a la acción que acompañan la publicación…"
                    emptyLabel="Agregar copy…"
                  />
                ) : (
                  <FieldSkeleton />
                )}
              </ToggleableSection>

              <ToggleableSection
                id="parrilla-portada"
                label={PARRILLA_SECTION_LABELS.portada}
                hidden={isHidden('portada')}
                hasContent={ready && sectionHasContent(form, 'portada')}
                onToggle={() => toggleSection('portada')}
              >
                {ready ? (
                  <ParrillaMediaUpload
                    coverImageUrl={form.cover_image_url ?? ''}
                    onUploaded={(url) => setField('cover_image_url', url)}
                    onCleared={() => setField('cover_image_url', null)}
                  />
                ) : (
                  <FieldSkeleton className="h-[120px] w-full rounded-xl" />
                )}
              </ToggleableSection>
            </>
          )}
        </div>

        {/* Pie fijo. El error y el aviso de conflicto viven aquí, junto al botón
            que los provoca: dentro del área con scroll quedarían fuera de vista
            justo al pulsar Guardar. */}
        <div className="shrink-0 space-y-2 border-t border-border/60 px-6 pb-4 pt-3">
          {error && (
            <p role="alert" className="text-center text-sm text-red-500">
              {error}
            </p>
          )}
          {conflictMessage && (
            <p role="alert" className="text-center text-sm text-yellow-500">
              {conflictMessage}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            {post && (
              // En el extremo opuesto a "Guardar" para que no se preste a un toque
              // accidental junto al botón principal, y con 44px de alto al tacto
              // (mínimo recomendado por Apple HIG).
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg px-1 py-1 text-xs font-medium text-red-500 transition-colors hover:text-red-400 active:text-red-300 pointer-coarse:min-h-11 pointer-coarse:px-3"
              >
                <Trash2 className="size-3.5" />
                Eliminar publicación
              </button>
            )}
            <BrandButton
              type="submit"
              size="sm"
              className="ml-auto w-auto"
              disabled={submitting || !ready}
            >
              {submitting
                ? 'Guardando…'
                : post
                  ? 'Guardar cambios'
                  : defaultStatus === 'archivado'
                    ? 'Guardar idea'
                    : 'Crear publicación'}
            </BrandButton>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="¿Eliminar esta publicación?"
        message="Se borra también el archivo adjunto, si tiene. Esta acción no se puede deshacer."
        confirmLabel={deleting ? 'Eliminando…' : 'Eliminar'}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
