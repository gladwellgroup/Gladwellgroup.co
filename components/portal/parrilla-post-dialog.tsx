'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { BrandButton } from '@/components/brand/brand-button'
import { BrandField, BrandTextarea } from '@/components/brand/brand-field'
import { ParrillaMediaUpload } from '@/components/portal/parrilla-media-upload'
import { ConfirmDialog } from '@/components/portal/confirm-dialog'
import { TeamPicker } from '@/components/portal/team-picker'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  PARRILLA_CATEGORIES,
  PARRILLA_CATEGORY_LABELS,
  PARRILLA_FORMATS,
  PARRILLA_FORMAT_LABELS,
  PARRILLA_STATUSES,
  PARRILLA_STATUS_LABELS,
  PLATFORMS,
  PLATFORM_LABELS,
  type ParrillaCategory,
  type ParrillaEditor,
  type ParrillaFormat,
  type ParrillaPost,
  type ParrillaStatus,
  type Platform,
} from '@/lib/parrilla/posts'

interface ParrillaPostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  post: ParrillaPost | null
  defaultDate?: string
  editors: ParrillaEditor[]
}

function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function ParrillaPostDialog({
  open,
  onOpenChange,
  post,
  defaultDate,
  editors,
}: ParrillaPostDialogProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [copyText, setCopyText] = useState('')
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [productionDate, setProductionDate] = useState('')
  const [publishDate, setPublishDate] = useState('')
  const [status, setStatus] = useState<ParrillaStatus>('idea')
  const [format, setFormat] = useState<ParrillaFormat | ''>('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [talent, setTalent] = useState('')
  const [filmmakerIds, setFilmmakerIds] = useState<string[]>([])
  const [editorIds, setEditorIds] = useState<string[]>([])
  const [category, setCategory] = useState<ParrillaCategory | ''>('')
  // Colapsado por defecto: un guion largo no debe dominar el modal. Si ya
  // tenía texto (edición), arranca abierto para que no parezca que se perdió.
  const [guionExpanded, setGuionExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (post) {
      setTitle(post.title)
      setCopyText(post.copy_text ?? '')
      setPlatforms(post.platforms)
      setProductionDate(post.production_date)
      setPublishDate(post.publish_date)
      setStatus(post.status)
      setFormat(post.format ?? '')
      setCoverImageUrl(post.cover_image_url ?? '')
      setTalent(post.talent ?? '')
      setFilmmakerIds(post.filmmaker_ids)
      setEditorIds(post.editor_ids)
      setCategory(post.category ?? '')
      setGuionExpanded(!!post.copy_text)
    } else {
      setTitle('')
      setCopyText('')
      setPlatforms([])
      // Al crear desde un día del calendario, las dos fechas arrancan
      // iguales — lo normal es producir y publicar el mismo día salvo que
      // se ajuste a mano.
      setProductionDate(defaultDate ?? todayIso())
      setPublishDate(defaultDate ?? todayIso())
      setStatus('idea')
      setFormat('')
      setCoverImageUrl('')
      setTalent('')
      setFilmmakerIds([])
      setEditorIds([])
      setCategory('')
      setGuionExpanded(false)
    }
  }, [open, post, defaultDate])

  function toggleFilmmaker(id: string) {
    setFilmmakerIds((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]))
  }

  function toggleEditor(id: string) {
    setEditorIds((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]))
  }

  // Responsable en cámara solo aplica a video (nadie "sale en cámara" en un
  // carrusel de texto). Filmmaker solo hace falta cuando hay algo que
  // capturar en bruto: siempre en video, y en imagen/carrusel únicamente si
  // son fotos de evento (categoría comunidad) — los carruseles de
  // valor/prospección/viral son diseño puro, sin captura previa.
  const showTalent = format === 'video'
  const showFilmmaker =
    format === 'video' ||
    ((format === 'imagen' || format === 'carrusel') && category === 'comunidad')

  function togglePlatform(platform: Platform) {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const payload = {
      title,
      copy_text: copyText,
      platforms,
      production_date: productionDate,
      publish_date: publishDate,
      status,
      format: format || undefined,
      cover_image_url: coverImageUrl,
      talent,
      filmmaker_ids: filmmakerIds,
      editor_ids: editorIds,
      category: category || undefined,
    }

    try {
      const res = await fetch(post ? `/api/parrilla/${post.id}` : '/api/parrilla', {
        method: post ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar la publicación')
        return
      }
      onOpenChange(false)
      router.refresh()
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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'No se pudo eliminar la publicación')
        return
      }
      setConfirmDelete(false)
      onOpenChange(false)
      router.refresh()
    } catch {
      setError('Error de red al eliminar la publicación')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="portal-header max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle>{post ? 'Editar publicación' : 'Nueva publicación'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <BrandField
            id="parrilla-title"
            label="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            wrapperClassName="text-center"
            className="text-left"
            required
          />
          <div className="space-y-1.5 text-center">
            <span className="modal-label">Plataformas</span>
            <div className="flex flex-wrap justify-center gap-2">
              {PLATFORMS.map((platform) => {
                const active = platforms.includes(platform)
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => togglePlatform(platform)}
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
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
              value={productionDate}
              onChange={(e) => setProductionDate(e.target.value)}
              wrapperClassName="text-center"
              className="text-left"
              required
            />
            <BrandField
              id="parrilla-publish-date"
              label="Fecha de publicación"
              type="date"
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
              wrapperClassName="text-center"
              className="text-left"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <label htmlFor="parrilla-status" className="modal-label">
                Estado
              </label>
              <select
                id="parrilla-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ParrillaStatus)}
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
                value={format}
                onChange={(e) => setFormat(e.target.value as ParrillaFormat | '')}
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
            <div className="flex flex-col items-center gap-1.5 text-center">
              <label htmlFor="parrilla-category" className="modal-label">
                Categoría
              </label>
              <select
                id="parrilla-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ParrillaCategory | '')}
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

          {showTalent && (
            <BrandField
              id="parrilla-talent"
              label="Responsable en cámara"
              value={talent}
              onChange={(e) => setTalent(e.target.value)}
              placeholder="Nombre(s)…"
              wrapperClassName="text-center"
              className="text-left"
            />
          )}

          {showFilmmaker && (
            <TeamPicker
              label="Filmmaker(es)"
              options={editors}
              selected={filmmakerIds}
              onToggle={toggleFilmmaker}
            />
          )}

          <TeamPicker
            label="Editor/Diseñador(es)"
            options={editors}
            selected={editorIds}
            onToggle={toggleEditor}
          />

          <div className="space-y-1.5 text-center">
            {guionExpanded ? (
              <>
                <BrandTextarea
                  id="parrilla-copy"
                  label="Guion"
                  value={copyText}
                  onChange={(e) => setCopyText(e.target.value)}
                  placeholder="Hook, cuerpo, tiempos y dirección — todo el guion cabe acá…"
                  wrapperClassName="text-center"
                  className="text-left"
                />
                <button
                  type="button"
                  onClick={() => setGuionExpanded(false)}
                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Colapsar
                </button>
              </>
            ) : (
              <>
                <span className="modal-label">Guion</span>
                <button
                  type="button"
                  onClick={() => setGuionExpanded(true)}
                  className="w-full truncate rounded-lg border border-dashed border-border bg-muted/20 px-4 py-2.5 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  {copyText || 'Agregar guion…'}
                </button>
              </>
            )}
          </div>

          <div className="space-y-1.5 text-center">
            <span className="modal-label">Foto de portada</span>
            <ParrillaMediaUpload
              coverImageUrl={coverImageUrl}
              onUploaded={setCoverImageUrl}
              onCleared={() => setCoverImageUrl('')}
            />
          </div>

          {error && <p className="text-center text-sm text-red-500">{error}</p>}

          <DialogFooter className="items-center gap-3 sm:justify-between">
            {post ? (
              // Separado del botón principal por un borde + espacio propio, y con
              // un área de toque de 44px (mínimo recomendado por Apple HIG) — para
              // que no se preste a un toque accidental justo debajo de "Guardar".
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 border-t border-border/60 pt-3 text-xs font-medium text-red-500 transition-colors hover:text-red-400 sm:w-auto sm:min-h-0 sm:border-t-0 sm:pt-0"
              >
                <Trash2 className="size-3.5" />
                Eliminar publicación
              </button>
            ) : (
              <span />
            )}
            <BrandButton type="submit" size="sm" className="w-auto" disabled={submitting}>
              {submitting ? 'Guardando…' : post ? 'Guardar cambios' : 'Crear publicación'}
            </BrandButton>
          </DialogFooter>
        </form>

        <ConfirmDialog
          open={confirmDelete}
          title="¿Eliminar esta publicación?"
          message="Se borra también el archivo adjunto, si tiene. Esta acción no se puede deshacer."
          confirmLabel={deleting ? 'Eliminando…' : 'Eliminar'}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
