'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
} from 'lucide-react'
import { BrandCard } from '@/components/brand/brand-card'
import { BrandButton } from '@/components/brand/brand-button'
import { ParrillaPostDialog } from '@/components/portal/parrilla-post-dialog'
import { PlatformIcons } from '@/components/portal/parrilla-shared'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { parseDateOnly } from '@/lib/date'
import {
  DATE_FIELD_LABELS,
  PARRILLA_CATEGORY_LABELS,
  PARRILLA_PIPELINE_STATUSES,
  PARRILLA_STATUS_COLORS,
  PARRILLA_STATUS_LABELS,
  type ParrillaDateField,
  type ParrillaEditor,
  type ParrillaPostSummary,
  type ParrillaStatus,
} from '@/lib/parrilla/posts'

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MAX_VISIBLE_PER_DAY = 3
const MAX_DOTS = 6

/** Punto de color por estado — mismo criterio visual que el pipeline de
 *  Encuentros (celda compacta = punto, panel/agenda = badge completo). */
const DOT_BG: Record<ParrillaStatus, string> = {
  idea: 'bg-muted-foreground/50',
  agendado: 'bg-[#7C3AED]',
  en_produccion: 'bg-yellow-500',
  programado: 'bg-[#06B6D4]',
  publicado: 'bg-green-500',
  archivado: 'bg-slate-500',
}

function StatusBadge({ status }: { status: ParrillaStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${PARRILLA_STATUS_COLORS[status]}`}
    >
      {PARRILLA_STATUS_LABELS[status]}
    </span>
  )
}

/** Categoría como segunda línea de la fila (agenda y panel del día). Neutra a
 *  propósito: el mismo borde gris de los chips de filtro, sin colores nuevos
 *  que se confundan con los del estado. La línea se reserva para TODAS las
 *  filas cuando alguna pieza tiene categoría, para que las filas con y sin
 *  categoría no queden de alturas dispares. */
function CategoryLine({ category }: { category: ParrillaPostSummary['category'] }) {
  return (
    <span className="mt-0.5 flex h-5 items-center">
      {category && (
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] leading-none text-muted-foreground">
          {PARRILLA_CATEGORY_LABELS[category]}
        </span>
      )}
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

function countLabel(count: number): string {
  if (count === 0) return 'Sin publicaciones'
  return count === 1 ? '1 publicación' : `${count} publicaciones`
}

/** Fecha con la que la vista activa posiciona la pieza. Solo las archivadas
 *  tienen vacía la de publicación, y esas viven en el Banco de contenido: no
 *  llegan al calendario. El respaldo evita que un dato inesperado lo rompa. */
function dateOf(post: ParrillaPostSummary, field: ParrillaDateField): string {
  return post[field] ?? post.production_date
}

interface ParrillaCalendarProps {
  posts: ParrillaPostSummary[]
  /** Qué fecha del post posiciona esta instancia del calendario — cada
   *  vista (Producción / Publicación) pasa la suya. */
  dateField: ParrillaDateField
  editors: ParrillaEditor[]
}

/** Calendario mensual de la parrilla — mismo lenguaje visual que
 *  SessionsCalendar (Encuentros), pero con edición en modal en vez de
 *  navegar a una página propia.
 *
 *  La cuadrícula se ve desde `sm` (640px, iPad en vertical incluido) y tiene
 *  dos modos que se resuelven solo con CSS, sin medir nada en JS:
 *  - Escritorio (`lg` + puntero fino): títulos arrastrables — soltar una
 *    publicación sobre otro día mueve SOLO la fecha de la vista activa, vía
 *    /api/parrilla/[id]/date — y "+" al pasar el ratón.
 *  - Táctil (iPad, o una ventana angosta): celda compacta con puntos de estado
 *    y un botón que la cubre entera y abre la "hoja del día". Arrastrar con el
 *    dedo no es fiable en iPad, así que mover una publicación se hace con el
 *    selector de fecha de esa hoja. */
export function ParrillaCalendar({ posts, dateField, editors }: ParrillaCalendarProps) {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  // Solo la fecha, no una copia de sus posts — así la hoja siempre muestra el
  // estado actual de `posts` en vez de una foto tomada al abrirla. La fecha
  // NO se borra al cerrar: el contenido debe seguir ahí durante la animación
  // de salida del diálogo.
  const [dayPanelDate, setDayPanelDate] = useState<Date | null>(null)
  const [dayPanelOpen, setDayPanelOpen] = useState(false)
  // Publicación cuyo selector de fecha está abierto en la hoja, y su valor.
  const [movingId, setMovingId] = useState<string | null>(null)
  const [moveDate, setMoveDate] = useState('')
  const [moveSending, setMoveSending] = useState(false)
  const [editingPost, setEditingPost] = useState<ParrillaPostSummary | null>(null)
  const [creatingForDate, setCreatingForDate] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null)
  // Aviso en línea de lo que falló al mover (mismo patrón de role="alert"
  // que usa el resto del portal) — antes un arrastre fallido no decía nada.
  const [notice, setNotice] = useState<string | null>(null)

  // Si alguna pieza en pantalla tiene categoría, todas las filas reservan la
  // línea de categoría (ver CategoryLine).
  const showCategoryLine = useMemo(() => posts.some((p) => p.category !== null), [posts])

  const postsByDate = useMemo(() => {
    const map = new Map<string, ParrillaPostSummary[]>()
    for (const p of posts) {
      const key = dateOf(p, dateField)
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
    const groups: { dateKey: string; date: Date; items: ParrillaPostSummary[] }[] = []
    const sorted = [...posts]
      .filter((p) => isSameMonth(parseDateOnly(dateOf(p, dateField)), currentMonth))
      .sort((a, b) => dateOf(a, dateField).localeCompare(dateOf(b, dateField)))

    for (const p of sorted) {
      const key = dateOf(p, dateField)
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
    setNotice(null)
  }

  function goToday() {
    const now = new Date()
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setNotice(null)
  }

  function openDayPanel(date: Date) {
    setNotice(null)
    setMovingId(null)
    setDayPanelDate(date)
    setDayPanelOpen(true)
  }

  function closeDayPanel() {
    setDayPanelOpen(false)
    setMovingId(null)
  }

  function openCreate(dateKey?: string) {
    setEditingPost(null)
    setCreatingForDate(dateKey ?? null)
    setDialogOpen(true)
    closeDayPanel()
  }

  function openEdit(post: ParrillaPostSummary) {
    setEditingPost(post)
    setCreatingForDate(null)
    setDialogOpen(true)
    closeDayPanel()
  }

  /** true si la fecha se movió. Si falla, deja el motivo en `notice`. */
  async function reschedule(postId: string, dateKey: string): Promise<boolean> {
    setNotice(null)
    try {
      const res = await fetch(`/api/parrilla/${postId}/date`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: dateField, date: dateKey }),
      })
      if (res.ok) {
        router.refresh()
        return true
      }

      // Sin estado optimista que revertir: la publicación sencillamente no se
      // movió y sigue viéndose donde estaba — pero ahora se dice por qué.
      const data = await res.json().catch(() => ({}))
      setNotice(data.error ?? 'No se pudo mover la publicación')
      // Ya no existe (404): se refresca para que el calendario muestre lo real.
      if (res.status === 404) router.refresh()
    } catch {
      setNotice('Sin conexión: no se pudo mover la publicación.')
    }
    return false
  }

  function toggleMove(post: ParrillaPostSummary) {
    setNotice(null)
    if (movingId === post.id) {
      setMovingId(null)
      return
    }
    setMovingId(post.id)
    setMoveDate(dateOf(post, dateField))
  }

  /** Mueve con un botón explícito y no al cambiar el valor: Safari en iOS
   *  dispara `change` mientras se gira la rueda del selector, lo que movería la
   *  publicación varias veces (y cerraría la hoja a la primera). */
  async function handleMove(e: React.FormEvent, post: ParrillaPostSummary) {
    e.preventDefault()
    if (!moveDate || moveDate === dateOf(post, dateField)) return
    setMoveSending(true)
    const moved = await reschedule(post.id, moveDate)
    setMoveSending(false)
    if (moved) closeDayPanel()
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
    if (!post || dateOf(post, dateField) === dateKey) return
    reschedule(postId, dateKey)
  }

  return (
    <>
      <BrandCard padding="sm" border="solid" className="touch-manipulation space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-1">
          <h2 className="text-base font-semibold first-letter:uppercase">{monthLabel}</h2>
          <div className="ml-auto flex items-center gap-1 pointer-coarse:gap-2">
            <button
              type="button"
              onClick={goToday}
              className="rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:bg-muted/60 pointer-coarse:min-h-11 pointer-coarse:px-4 pointer-coarse:text-sm"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              aria-label="Mes anterior"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:bg-muted/60 pointer-coarse:size-11"
            >
              <ChevronLeft className="h-4 w-4 pointer-coarse:h-5 pointer-coarse:w-5" />
            </button>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              aria-label="Mes siguiente"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:bg-muted/60 pointer-coarse:size-11"
            >
              <ChevronRight className="h-4 w-4 pointer-coarse:h-5 pointer-coarse:w-5" />
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

        {notice && (
          <p role="alert" className="text-center text-sm text-red-500">
            {notice}
          </p>
        )}

        {/* Cuadrícula mensual desde `sm`. Cada celda es zona de suelta (ratón).
            En modo escritorio (`lg` + puntero fino) las publicaciones son
            títulos arrastrables; en modo táctil la celda muestra puntos de
            estado y un botón superpuesto (`lg:pointer-fine:hidden`) la vuelve
            tocable entera — por eso en táctil los títulos de `lg` son solo
            lectura: el botón queda por encima. */}
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
                  className={`group relative flex min-h-[76px] flex-col gap-0.5 border-b border-r border-border p-1 transition-colors last:border-r-0 lg:min-h-[92px] ${
                    !inCurrentMonth ? 'opacity-40' : ''
                  } ${isDropTarget ? 'bg-[#7C3AED]/10 ring-1 ring-inset ring-[#7C3AED]/50' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => openDayPanel(date)}
                    aria-label={`${formatDayHeading(date)}: ${countLabel(dayPosts.length).toLowerCase()}`}
                    className="absolute inset-0 z-10 transition-colors active:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7C3AED]/60 lg:pointer-fine:hidden"
                  />
                  <div className="flex items-center justify-between">
                    <span
                      className={`self-start rounded-full px-1.5 py-0.5 text-sm lg:pointer-fine:text-xs ${
                        isToday ? 'bg-[#7C3AED] font-semibold text-white' : 'text-muted-foreground'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    <button
                      type="button"
                      onClick={() => openCreate(key)}
                      aria-label="Nueva publicación este día"
                      className="hidden h-4 w-4 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 lg:pointer-fine:flex"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  {dayPosts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 px-1 lg:hidden" aria-hidden="true">
                      {dayPosts.slice(0, MAX_DOTS).map((p) => (
                        <span key={p.id} className={`h-2 w-2 rounded-full ${DOT_BG[p.status]}`} />
                      ))}
                      {dayPosts.length > MAX_DOTS && (
                        <span className="text-[10px] leading-none text-muted-foreground">
                          +{dayPosts.length - MAX_DOTS}
                        </span>
                      )}
                    </div>
                  )}
                  {visible.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      draggable
                      // Tooltip con el título completo y la categoría: la celda es
                      // demasiado angosta para mostrar la categoría en línea.
                      title={
                        p.category
                          ? `${p.title} · ${PARRILLA_CATEGORY_LABELS[p.category]}`
                          : p.title
                      }
                      onDragStart={(e) => handleDragStart(e, p.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => openEdit(p)}
                      className={`hidden cursor-grab items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] transition-colors hover:bg-muted/60 active:cursor-grabbing lg:flex ${
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
                      onClick={() => openDayPanel(date)}
                      className="hidden px-1 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground lg:block"
                    >
                      +{overflow} más
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Los puntos son solo color: la leyenda los nombra. Con títulos (`lg`)
            no hace falta, igual que en escritorio. */}
        <ul
          aria-label="Significado de los colores"
          className="hidden flex-wrap justify-center gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground sm:flex lg:hidden"
        >
          {PARRILLA_PIPELINE_STATUSES.map((status) => (
            <li key={status} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${DOT_BG[status]}`} aria-hidden="true" />
              {PARRILLA_STATUS_LABELS[status]}
            </li>
          ))}
        </ul>

        {/* Agenda de teléfono (< sm): lista del mes; se reprograma abriendo el
            modal y cambiando la fecha. */}
        <div className="sm:hidden">
          {agendaGroups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay publicaciones este mes.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {agendaGroups.map((g) => (
                <div key={g.dateKey} className="space-y-2 py-3 first:pt-0 last:pb-0">
                  <p className="text-xs font-medium text-muted-foreground first-letter:uppercase">
                    {formatDayHeading(g.date)}
                  </p>
                  <div className="space-y-1.5">
                    {g.items.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => openEdit(p)}
                        className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
                      >
                        <PlatformIcons platforms={p.platforms} className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 break-words text-sm font-medium">{p.title}</p>
                          {showCategoryLine && <CategoryLine category={p.category} />}
                        </div>
                        <StatusBadge status={p.status} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </BrandCard>

      {/* Hoja del día. Sobre el Dialog de Radix y no un `fixed inset-0` propio:
          la tarjeta del calendario tiene blur, y Safari ata cualquier `fixed`
          descendiente a ese ancestro (la capa se dibujaba del tamaño de la
          tarjeta). El Dialog sale a `body`, cierra con Esc y bloquea el scroll
          del fondo. Es donde se LEE el día completo, así que va amplio: la
          lista ocupa lo que quede y solo hace scroll si de verdad no cabe. */}
      <Dialog open={dayPanelOpen} onOpenChange={(open) => !open && closeDayPanel()}>
        <DialogContent
          showCloseButton={false}
          // min(): `sm:max-w-3xl` a secas pisaría el margen de 2rem del Dialog y,
          // en un iPad de 744px, la hoja tocaría los bordes de la pantalla.
          className="portal-header flex max-h-[85dvh] flex-col gap-0 overflow-hidden overscroll-y-contain p-0 sm:max-w-[min(48rem,calc(100%-2rem))]"
        >
          <DialogHeader className="shrink-0 gap-1 border-b border-border/60 px-6 pb-3 pr-16 pt-6 text-left sm:text-left">
            {/* first-letter y no `capitalize`: este pondría "De" en mayúscula
                ("16 De Octubre"); en español solo va la primera letra. */}
            <DialogTitle className="text-lg font-semibold first-letter:uppercase">
              {dayPanelDate ? formatDayHeading(dayPanelDate) : ''}
            </DialogTitle>
            <DialogDescription>{countLabel(dayPanelPosts.length)}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain px-6 py-4">
            {dayPanelPosts.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nada programado este día.
              </p>
            )}
            {dayPanelPosts.map((p) => (
              <div key={p.id} className="space-y-2">
                <div className="flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <PlatformIcons platforms={p.platforms} className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        {/* Hasta 2 líneas en vez de cortar con "…": para eso se
                            agrandó la ventana. `title` por si pasa de 2. */}
                        <p title={p.title} className="line-clamp-2 break-words text-base font-medium">
                          {p.title}
                        </p>
                        {showCategoryLine && <CategoryLine category={p.category} />}
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </button>
                  {/* Sustituto del arrastre: solo donde no hay arrastre (táctil). */}
                  <button
                    type="button"
                    onClick={() => toggleMove(p)}
                    aria-expanded={movingId === p.id}
                    aria-label={`Mover «${p.title}» a otra fecha`}
                    className="flex size-11 shrink-0 items-center justify-center self-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground active:bg-muted/60 lg:pointer-fine:hidden"
                  >
                    <CalendarDays className="h-5 w-5" />
                  </button>
                </div>
                {movingId === p.id && (
                  <form
                    onSubmit={(e) => handleMove(e, p)}
                    className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-3"
                  >
                    <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
                      <label htmlFor={`parrilla-move-${p.id}`} className="modal-label">
                        Nueva fecha de {DATE_FIELD_LABELS[dateField].toLowerCase()}
                      </label>
                      <input
                        id={`parrilla-move-${p.id}`}
                        type="date"
                        value={moveDate}
                        onChange={(e) => setMoveDate(e.target.value)}
                        // Mismo orden que valida el servidor: publicar no puede
                        // quedar antes de producir.
                        min={dateField === 'publish_date' ? p.production_date : undefined}
                        max={dateField === 'production_date' ? (p.publish_date ?? undefined) : undefined}
                        required
                        className="modal-field text-left"
                      />
                    </div>
                    <BrandButton
                      type="submit"
                      size="sm"
                      className="w-auto"
                      disabled={moveSending || !moveDate || moveDate === dateOf(p, dateField)}
                    >
                      {moveSending ? 'Moviendo…' : 'Mover'}
                    </BrandButton>
                    <BrandButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-auto"
                      onClick={() => setMovingId(null)}
                    >
                      Cancelar
                    </BrandButton>
                    {notice && (
                      <p role="alert" className="basis-full text-sm text-red-500">
                        {notice}
                      </p>
                    )}
                  </form>
                )}
              </div>
            ))}
          </div>

          <div className="flex shrink-0 justify-center border-t border-border/60 px-6 pb-4 pt-3">
            <BrandButton
              type="button"
              size="sm"
              className="w-auto"
              onClick={() => dayPanelDate && openCreate(toDateKey(dayPanelDate))}
            >
              <Plus className="size-4" />
              Nueva publicación este día
            </BrandButton>
          </div>

          {/* Al final del DOM (posición absoluta: no cambia lo que se ve) para
              que el foco inicial caiga en el contenido y no en la X. */}
          <DialogClose className="modal-close-button-panel" aria-label="Cerrar">
            <X className="h-5 w-5" aria-hidden="true" />
          </DialogClose>
        </DialogContent>
      </Dialog>

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
