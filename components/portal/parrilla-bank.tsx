'use client'

import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { BrandButton } from '@/components/brand/brand-button'
import { BrandCard } from '@/components/brand/brand-card'
import { ParrillaPostDialog } from '@/components/portal/parrilla-post-dialog'
import { PlatformIcons } from '@/components/portal/parrilla-shared'
import { parseDateOnly } from '@/lib/date'
import {
  PARRILLA_CATEGORY_LABELS,
  PARRILLA_FORMAT_LABELS,
  type ParrillaEditor,
  type ParrillaPostSummary,
} from '@/lib/parrilla/posts'

interface ParrillaBankProps {
  /** Las piezas archivadas que pasaron los filtros del tablero. */
  posts: ParrillaPostSummary[]
  /** Cuántas hay archivadas en total, sin filtros: distingue "el banco está
   *  vacío" de "ninguna coincide con el filtro". */
  total: number
  editors: ParrillaEditor[]
}

function formatDate(dateKey: string): string {
  return parseDateOnly(dateKey).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Banco de contenido: las ideas archivadas. Archivar no borra nada — el
 *  guion, el copy y la portada siguen en la pieza — y no tiene fecha de
 *  publicación, por eso no vive en el calendario. Las ideas nuevas también se
 *  crean aquí: nacen ya archivadas. Para recuperar una idea se abre y se
 *  cambia su estado: el modal pide de nuevo la fecha de publicación.
 *
 *  Una sola superficie con filas de la misma altura (mismo criterio que la
 *  agenda del calendario), con el alto táctil de 44 px de las filas. */
export function ParrillaBank({ posts, total, editors }: ParrillaBankProps) {
  const [query, setQuery] = useState('')
  const [editingPost, setEditingPost] = useState<ParrillaPostSummary | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = q ? posts.filter((p) => p.title.toLowerCase().includes(q)) : posts
    // `updated_at` es el de la última edición, que al archivar es el momento en
    // que la idea entró al banco: las más recientes arriba. Es texto ISO, se
    // ordena igual como texto.
    return [...matches].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }, [posts, query])

  function openPost(post: ParrillaPostSummary) {
    setEditingPost(post)
    setDialogOpen(true)
  }

  function openCreate() {
    setEditingPost(null)
    setDialogOpen(true)
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
                placeholder="Buscar una idea por título..."
                aria-label="Buscar una idea por título"
                className="modal-field w-full pl-9"
              />
            </div>
          )}
          <BrandButton type="button" size="sm" className="w-auto shrink-0" onClick={openCreate}>
            <Plus className="size-4" />
            Nueva idea
          </BrandButton>
        </div>

        {visible.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">
            {total === 0
              ? 'Aún no hay ideas guardadas. Crea una con «Nueva idea» o archiva una publicación: queda guardada aquí, con su guion, copy y portada.'
              : query.trim()
                ? `Ninguna idea coincide con "${query.trim()}".`
                : 'Ninguna idea archivada coincide con los filtros.'}
          </p>
        ) : (
          // `flex` en cada `li`: el botón se estira a la altura de la fila de la
          // cuadrícula; sin él, dos ideas vecinas con títulos de 1 y 2 líneas
          // quedaban de alturas distintas.
          <ul className="grid gap-2 sm:grid-cols-2">
            {visible.map((post) => (
              <li key={post.id} className="flex">
                <button
                  type="button"
                  onClick={() => openPost(post)}
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
                >
                  <PlatformIcons
                    platforms={post.platforms}
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words text-sm font-medium">{post.title}</p>
                    {/* Alto fijo: las filas con y sin categoría/formato no
                        quedan de alturas dispares. */}
                    <span className="mt-0.5 flex h-5 items-center gap-1.5 text-[11px] leading-none text-muted-foreground">
                      {post.category && (
                        <span className="rounded-full border border-border px-2 py-0.5">
                          {PARRILLA_CATEGORY_LABELS[post.category]}
                        </span>
                      )}
                      {post.format && <span>{PARRILLA_FORMAT_LABELS[post.format]}</span>}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(post.production_date)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </BrandCard>

      <ParrillaPostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        post={editingPost}
        // Una idea nueva del Banco nace archivada: sin fecha de publicación, que
        // es lo que la mantiene fuera del calendario.
        defaultStatus="archivado"
        editors={editors}
      />
    </>
  )
}
