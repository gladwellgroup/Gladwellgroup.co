'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, MessagesSquare, Search } from 'lucide-react'
import { useAppRouter } from '@/hooks/use-app-router'
import { BrandButton } from '@/components/brand/brand-button'
import { BrandCard } from '@/components/brand/brand-card'
import { BrandField } from '@/components/brand/brand-field'
import { CharlaBadge } from '@/components/portal/session-badge'
import {
  CHARLA_TITLE_MAX,
  CHARLA_TITLE_MIN,
  type CharlaListItem,
} from '@/lib/charlas/types'
import { parseDateOnly, todayKey } from '@/lib/date'

/** Listado de Charlas Catárticas: lo que importa de cada una es su nombre, su
 *  fecha y cuánta gente asistió, así que cada fila lo dice de un vistazo. */
export function CharlasDashboard({
  charlas,
  canCreate,
  basePath,
  hubPath,
}: {
  charlas: CharlaListItem[]
  /** Sin el módulo `charlas` (solo el de calendario) se ve la lista, pero no se
   *  crean charlas. */
  canCreate: boolean
  basePath: string
  hubPath: string
}) {
  const router = useAppRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  // Hoy en hora de Bogotá, no `toISOString()`: de noche en Colombia el día UTC ya es mañana.
  const [sessionDate, setSessionDate] = useState(todayKey)
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return q ? charlas.filter((charla) => charla.title.toLowerCase().includes(q)) : charlas
  }, [charlas, searchQuery])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/charlas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, session_date: sessionDate }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'No se pudo crear la charla')
        setCreating(false)
        return
      }

      router.push(`${basePath}/${data.id}`)
    } catch {
      setError('Error de red al crear la charla')
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={hubPath}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground active:text-foreground pointer-coarse:min-h-11"
      >
        <ArrowLeft className="h-4 w-4" />
        Encuentros
      </Link>

      <div className="flex flex-col items-center gap-4 text-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold gladwell-gradient-text">
            Charlas Catárticas
          </h1>
          <p className="text-muted-foreground">
            Espacios abiertos de la comunidad. Sin guion ni entregable: lo que
            cuenta es la asistencia.
          </p>
        </div>
        {canCreate && (
          <BrandButton
            size="sm"
            className="w-auto"
            aria-expanded={showCreate}
            onClick={() => setShowCreate(!showCreate)}
          >
            Nueva charla
          </BrandButton>
        )}
      </div>

      {canCreate && showCreate && (
        <BrandCard>
          <form onSubmit={handleCreate} className="space-y-4">
            <BrandField
              id="charla-new-title"
              label="Nombre de la charla"
              type="text"
              required
              minLength={CHARLA_TITLE_MIN}
              maxLength={CHARLA_TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Hablemos de lo que cuesta emprender"
            />
            <BrandField
              id="charla-new-date"
              label="Fecha"
              type="date"
              required
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}
            <BrandButton type="submit" disabled={creating} className="w-auto">
              {creating ? 'Creando...' : 'Crear charla'}
            </BrandButton>
          </form>
        </BrandCard>
      )}

      {/* Buscador centrado, sobre el mismo eje que el encabezado. */}
      {charlas.length > 0 && (
        <div className="mx-auto w-full max-w-xl">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar una charla por nombre..."
              aria-label="Buscar una charla por nombre"
              className="modal-field w-full pl-9"
            />
          </div>
        </div>
      )}

      {charlas.length === 0 ? (
        <BrandCard className="text-center">
          <p className="text-muted-foreground">
            {canCreate
              ? 'Aún no hay charlas. Crea la primera con «Nueva charla».'
              : 'Aún no hay charlas.'}
          </p>
        </BrandCard>
      ) : filtered.length === 0 ? (
        <BrandCard className="text-center">
          <p className="text-muted-foreground">
            Ninguna charla coincide con &quot;{searchQuery.trim()}&quot;.
          </p>
        </BrandCard>
      ) : (
        <BrandCard padding="sm" border="solid" className="divide-y divide-border">
          {filtered.map((charla) => (
            <Link
              key={charla.id}
              href={`${basePath}/${charla.id}`}
              className="flex min-h-14 items-center gap-3 px-2 py-3 transition-colors hover:bg-muted/40 active:bg-muted/60"
            >
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30 text-muted-foreground">
                {charla.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={charla.photo_url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <MessagesSquare className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{charla.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {parseDateOnly(charla.session_date).toLocaleDateString('es-CO', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <CharlaBadge sessionDate={charla.session_date} />
                <span className="text-xs tabular-nums text-muted-foreground">
                  {charla.asistentes === 1 ? '1 asistente' : `${charla.asistentes} asistentes`}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </BrandCard>
      )}
    </div>
  )
}
