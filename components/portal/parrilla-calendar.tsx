'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Instagram, Linkedin, Plus, X, Youtube } from 'lucide-react'
import { BrandCard } from '@/components/brand/brand-card'
import { BrandButton } from '@/components/brand/brand-button'
import { ParrillaPostDialog } from '@/components/portal/parrilla-post-dialog'
import { parseDateOnly } from '@/lib/date'
import {
  PARRILLA_STATUS_COLORS,
  PARRILLA_STATUS_LABELS,
  type ParrillaDateField,
  type ParrillaEditor,
  type ParrillaPost,
  type Platform,
} from '@/lib/parrilla/posts'

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MAX_VISIBLE_PER_DAY = 3

/** Punto de color por estado — mismo criterio visual que el pipeline de
 *  Entregables (celda compacta = punto, panel/agenda = badge completo). */
const DOT_BG: Record<ParrillaPost['status'], string> = {
  idea: 'bg-muted-foreground/50',
  en_produccion: 'bg-yellow-500',
  agendado: 'bg-[#06B6D4]',
  publicado: 'bg-green-500',
  cancelado: 'bg-red-500',
}

const PLATFORM_ICONS: Record<Platform, typeof Instagram> = {
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
}

function PlatformIcons({ platforms, className }: { platforms: Platform[]; className?: string }) {
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {platforms.map((p) => {
        const Icon = PLATFORM_ICONS[p]
        return <Icon key={p} className={className} />
      })}
    </span>
  )
}

function StatusBadge({ status }: { status: ParrillaPost['status'] }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${PARRILLA_STATUS_COLORS[status]}`}
    >
      {PARRILLA_STATUS_LABELS[status]}
    </span>
  )
}

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

/** Mismo algoritmo que SessionsCalendar: semanas completas desde lunes,
 *  con los días sobrantes del mes anterior/siguiente. */
function getMonthGrid(monthDate: Date): Date[] {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7
  const start = new Date(year, month, 1 - firstWeekday)

  return Array.from({ length: totalCells }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function formatDayHeading(date: Date): string {
  return date.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

interface ParrillaCalendarProps {
  posts: ParrillaPost[]
  /** Qué fecha del post posiciona esta instancia del calendario — cada
   *  vista (Producción / Publicación) pasa la suya. */
  dateField: ParrillaDateField
  editors: ParrillaEditor[]
}

/** Calendario mensual de la parrilla — mismo lenguaje visual que
 *  SessionsCalendar (Entregables), pero con edición en modal en vez de
 *  navegar a una página propia, y arrastrar-y-soltar para reprogramar sin
 *  abrir el modal: soltar una publicación sobre otro día mueve SOLO la
 *  fecha de la vista activa (producción o publicación), vía
 *  /api/parrilla/[id]/date. */
export function ParrillaCalendar({ posts, dateField, editors }: ParrillaCalendarProps) {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  // Solo la fecha, no una copia de sus posts — así el panel siempre muestra
  // el estado actual de `posts` en vez de una foto tomada al abrirlo (que
  // quedaría vieja si el post se reprograma/edita mientras el panel sigue
  // abierto y la página se refresca por otro motivo).
  const [dayPanelDate, setDayPanelDate] = useState<Date | null>(null)
  const [editingPost, setEditingPost] = useState<ParrillaPost | null>(null)
  const [creatingForDate, setCreatingForDate] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null)

  const postsByDate = useMemo(() => {
    const map = new Map<string, ParrillaPost[]>()
    for (const p of posts) {
      const key = p[dateField]
      const list = map.get(key)
      if (list) list.push(p)
      else map.set(key, [p])
    }
    return map
  }, [posts, dateField])

  const dayPanelPosts = dayPanelDate ? postsByDate.get(toDateKey(dayPanelDate)) ?? [] : []

  const grid = useMemo(() => getMonthGrid(currentMonth), [currentMonth])
  const todayKey = toDateKey(new Date())
  const monthLabel = currentMonth.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  const agendaGroups = useMemo(() => {
    const groups: { dateKey: string; date: Date; items: ParrillaPost[] }[] = []
    const sorted = [...posts]
      .filter((p) => isSameMonth(parseDateOnly(p[dateField]), currentMonth))
      .sort((a, b) => a[dateField].localeCompare(b[dateField]))

    for (const p of sorted) {
      const key = p[dateField]
      const last = groups[groups.length - 1]
      if (last && last.dateKey === key) {
        last.items.push(p)
      } else {
        groups.push({ dateKey: key, date: parseDateOnly(key), items: [p] })
      }
    }
    return groups
  }, [posts, currentMonth, dateField])

  function goToMonth(offset: number) {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1))
    setDayPanelDate(null)
  }

  function goToday() {
    const now = new Date()
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setDayPanelDate(null)
  }

  function openCreate(dateKey?: string) {
    setEditingPost(null)
    setCreatingForDate(dateKey ?? null)
    setDialogOpen(true)
  }

  function openEdit(post: ParrillaPost) {
    setEditingPost(post)
    setCreatingForDate(null)
    setDialogOpen(true)
    setDayPanelDate(null)
  }

  async function reschedule(postId: string, dateKey: string) {
    try {
      const res = await fetch(`/api/parrilla/${postId}/date`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: dateField, date: dateKey }),
      })
      if (res.ok) router.refresh()
    } catch {
      // Sin estado optimista que revertir: si falla, el post sencillamente
      // no se movió y sigue viéndose donde estaba.
    }
  }

  function handleDragStart(e: React.DragEvent, postId: string) {
    e.dataTransfer.setData('text/plain', postId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(postId)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDropTargetKey(null)
  }

  function handleCellDrop(e: React.DragEvent, dateKey: string) {
    e.preventDefault()
    const postId = e.dataTransfer.getData('text/plain')
    setDropTargetKey(null)
    setDraggingId(null)
    if (!postId) return
    const post = posts.find((p) => p.id === postId)
    if (!post || post[dateField] === dateKey) return
    reschedule(postId, dateKey)
  }

  return (
    <>
      <BrandCard padding="sm" border="solid" className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-semibold capitalize">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goToday}
              className="rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              aria-label="Mes anterior"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              aria-label="Mes siguiente"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <BrandButton
              type="button"
              size="sm"
              className="ml-2 w-auto"
              onClick={() => openCreate()}
            >
              <Plus className="size-4" />
              Nueva
            </BrandButton>
          </div>
        </div>

        {/* Cuadrícula mensual — desde sm, igual que SessionsCalendar. Cada
            celda es zona de suelta; cada publicación es arrastrable. */}
        <div className="hidden overflow-hidden rounded-xl border border-border sm:block">
          <div className="grid grid-cols-7 border-b border-border bg-muted/20">
            {WEEKDAYS.map((wd, i) => (
              <div key={i} className="p-2 text-center text-xs font-medium text-muted-foreground">
                {wd}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((date) => {
              const key = toDateKey(date)
              const dayPosts = postsByDate.get(key) ?? []
              const inCurrentMonth = isSameMonth(date, currentMonth)
              const isToday = key === todayKey
              const visible = dayPosts.slice(0, MAX_VISIBLE_PER_DAY)
              const overflow = dayPosts.length - visible.length
              const isDropTarget = dropTargetKey === key

              return (
                <div
                  key={key}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDropTargetKey(key)
                  }}
                  onDragLeave={() =>
                    setDropTargetKey((prev) => (prev === key ? null : prev))
                  }
                  onDrop={(e) => handleCellDrop(e, key)}
                  className={`group flex min-h-[92px] flex-col gap-0.5 border-b border-r border-border p-1 transition-colors last:border-r-0 ${
                    !inCurrentMonth ? 'opacity-40' : ''
                  } ${isDropTarget ? 'bg-[#7C3AED]/10 ring-1 ring-inset ring-[#7C3AED]/50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`self-start rounded-full px-1.5 py-0.5 text-xs ${
                        isToday ? 'bg-[#7C3AED] font-semibold text-white' : 'text-muted-foreground'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    <button
                      type="button"
                      onClick={() => openCreate(key)}
                      aria-label="Nueva publicación este día"
                      className="hidden h-4 w-4 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 sm:flex"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  {visible.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      draggable
                      onDragStart={(e) => handleDragStart(e, p.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => openEdit(p)}
                      className={`flex cursor-grab items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] transition-colors hover:bg-muted/60 active:cursor-grabbing ${
                        draggingId === p.id ? 'opacity-30' : ''
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_BG[p.status]}`} />
                      <PlatformIcons platforms={p.platforms} className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{p.title}</span>
                    </button>
                  ))}
                  {overflow > 0 && (
                    <button
                      type="button"
                      onClick={() => setDayPanelDate(date)}
                      className="px-1 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      +{overflow} más
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Agenda móvil — sin arrastrar (no aplica en touch); se reprograma
            abriendo el modal y cambiando la fecha a mano. */}
        <div className="sm:hidden">
          {agendaGroups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay publicaciones este mes.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {agendaGroups.map((g) => (
                <div key={g.dateKey} className="space-y-2 py-3 first:pt-0 last:pb-0">
                  <p className="text-xs font-medium capitalize text-muted-foreground">
                    {formatDayHeading(g.date)}
                  </p>
                  <div className="space-y-1.5">
                    {g.items.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => openEdit(p)}
                        className="flex w-full items-center gap-2 rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-muted/40"
                      >
                        <PlatformIcons platforms={p.platforms} className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</p>
                        <StatusBadge status={p.status} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel del día (overflow) */}
        {dayPanelDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="portal-header w-full max-w-md space-y-4 rounded-xl border border-border/50 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold capitalize">
                  {formatDayHeading(dayPanelDate)}
                </h3>
                <button
                  type="button"
                  onClick={() => setDayPanelDate(null)}
                  aria-label="Cerrar"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {dayPanelPosts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openEdit(p)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <PlatformIcons platforms={p.platforms} className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="truncate text-sm font-medium">{p.title}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </BrandCard>

      <ParrillaPostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        post={editingPost}
        defaultDate={creatingForDate ?? undefined}
        editors={editors}
      />
    </>
  )
}
