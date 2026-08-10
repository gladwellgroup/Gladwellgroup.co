'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, GraduationCap, Users, X } from 'lucide-react'
import { BrandCard } from '@/components/brand/brand-card'
import { PipelineBadge } from '@/components/portal/pipeline-badge'
import { bucketSession, type PipelineBucket } from '@/lib/deliverables/pipeline'
import { parseDateOnly } from '@/lib/date'
import type { CalendarSession } from '@/lib/deliverables/sessions'

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MAX_VISIBLE_PER_DAY = 3

/** Punto de color por estado, para el chip compacto de la celda — muy poco
 *  espacio para el badge completo de PipelineBadge, que sí se usa en el panel
 *  del día y en la agenda móvil, donde hay más aire. */
const DOT_BG: Record<PipelineBucket, string> = {
  programada: 'bg-[#06B6D4]',
  borrador: 'bg-muted-foreground/50',
  generado: 'bg-yellow-500',
  entregado: 'bg-green-500',
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

/** Días a mostrar en la cuadrícula, empezando en lunes y completando semanas
 *  enteras con los días sobrantes del mes anterior/siguiente — igual que
 *  Google Calendar. */
function getMonthGrid(monthDate: Date): Date[] {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7 // 0 = lunes
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7
  const start = new Date(year, month, 1 - firstWeekday)

  return Array.from({ length: totalCells }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function CategoryIcon({
  programa,
  className,
}: {
  programa: CalendarSession['programa']
  className?: string
}) {
  const Icon = programa === 'terapia' ? Users : GraduationCap
  return <Icon className={className} />
}

function programaLabel(programa: CalendarSession['programa']): string {
  return programa === 'terapia' ? 'Terapia Organizacional' : 'Gladwell Education'
}

function formatDayHeading(date: Date): string {
  return date.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** Vista general de las sesiones de ambos programas, tipo Google Calendar.
 *  No hace fetch propio: recibe `sessions` ya cargadas y acotadas por
 *  pertenencia (loadPipelineSessions), igual para todos los que la usan. */
export function SessionsCalendar({
  sessions,
  basePath,
}: {
  sessions: CalendarSession[]
  basePath: string
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [dayPanel, setDayPanel] = useState<{
    date: Date
    sessions: CalendarSession[]
  } | null>(null)

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, CalendarSession[]>()
    for (const s of sessions) {
      const list = map.get(s.session_date)
      if (list) list.push(s)
      else map.set(s.session_date, [s])
    }
    return map
  }, [sessions])

  const grid = useMemo(() => getMonthGrid(currentMonth), [currentMonth])
  const todayKey = toDateKey(new Date())
  const monthLabel = currentMonth.toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
  })

  // Agenda móvil: solo los días del mes activo que sí tienen sesiones.
  const agendaGroups = useMemo(() => {
    const groups: { dateKey: string; date: Date; items: CalendarSession[] }[] = []
    const sorted = [...sessions]
      .filter((s) => isSameMonth(parseDateOnly(s.session_date), currentMonth))
      .sort((a, b) => a.session_date.localeCompare(b.session_date))

    for (const s of sorted) {
      const last = groups[groups.length - 1]
      if (last && last.dateKey === s.session_date) {
        last.items.push(s)
      } else {
        groups.push({
          dateKey: s.session_date,
          date: parseDateOnly(s.session_date),
          items: [s],
        })
      }
    }
    return groups
  }, [sessions, currentMonth])

  function goToMonth(offset: number) {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1))
    setDayPanel(null)
  }

  function goToday() {
    const now = new Date()
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setDayPanel(null)
  }

  return (
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
        </div>
      </div>

      {/* Cuadrícula mensual — desde sm. En un teléfono 7 columnas quedan
          ilegibles, por eso la agenda vertical de abajo la reemplaza. */}
      <div className="hidden overflow-hidden rounded-xl border border-border sm:block">
        <div className="grid grid-cols-7 border-b border-border bg-muted/20">
          {WEEKDAYS.map((wd, i) => (
            <div
              key={i}
              className="p-2 text-center text-xs font-medium text-muted-foreground"
            >
              {wd}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((date) => {
            const key = toDateKey(date)
            const daySessions = sessionsByDate.get(key) ?? []
            const inCurrentMonth = isSameMonth(date, currentMonth)
            const isToday = key === todayKey
            const visible = daySessions.slice(0, MAX_VISIBLE_PER_DAY)
            const overflow = daySessions.length - visible.length

            return (
              <div
                key={key}
                className={`flex min-h-[92px] flex-col gap-0.5 border-b border-r border-border p-1 last:border-r-0 ${
                  !inCurrentMonth ? 'opacity-40' : ''
                }`}
              >
                <span
                  className={`self-start rounded-full px-1.5 py-0.5 text-xs ${
                    isToday
                      ? 'bg-[#7C3AED] font-semibold text-white'
                      : 'text-muted-foreground'
                  }`}
                >
                  {date.getDate()}
                </span>
                {visible.map((s) => (
                  <Link
                    key={s.id}
                    href={`${basePath}/${s.programa}/${s.id}`}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] transition-colors hover:bg-muted/60"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_BG[bucketSession(s)]}`}
                    />
                    <CategoryIcon
                      programa={s.programa}
                      className="h-3 w-3 shrink-0 text-muted-foreground"
                    />
                    <span className="truncate">{s.subtitulo ?? s.title}</span>
                  </Link>
                ))}
                {overflow > 0 && (
                  <button
                    type="button"
                    onClick={() => setDayPanel({ date, sessions: daySessions })}
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

      {/* Agenda móvil */}
      <div className="sm:hidden">
        {agendaGroups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay sesiones este mes.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {agendaGroups.map((g) => (
              <div key={g.dateKey} className="space-y-2 py-3 first:pt-0 last:pb-0">
                <p className="text-xs font-medium capitalize text-muted-foreground">
                  {formatDayHeading(g.date)}
                </p>
                <div className="space-y-1.5">
                  {g.items.map((s) => (
                    <Link
                      key={s.id}
                      href={`${basePath}/${s.programa}/${s.id}`}
                      className="flex items-center gap-2 rounded-lg border border-border p-2.5 transition-colors hover:bg-muted/40"
                    >
                      <CategoryIcon
                        programa={s.programa}
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                      />
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">
                        {s.subtitulo ?? s.title}
                      </p>
                      <PipelineBadge session={s} />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panel del día — mismo patrón visual que ConfirmDialog, pero de
          lectura: se cierra con la X, no con confirmar/cancelar. */}
      {dayPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="portal-header w-full max-w-md space-y-4 rounded-xl border border-border/50 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold capitalize">
                {formatDayHeading(dayPanel.date)}
              </h3>
              <button
                type="button"
                onClick={() => setDayPanel(null)}
                aria-label="Cerrar"
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {dayPanel.sessions.map((s) => (
                <Link
                  key={s.id}
                  href={`${basePath}/${s.programa}/${s.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {s.subtitulo ?? s.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {programaLabel(s.programa)}
                    </p>
                  </div>
                  <PipelineBadge session={s} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </BrandCard>
  )
}
