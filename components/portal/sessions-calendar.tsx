'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BrandCard } from '@/components/brand/brand-card'
import { ProgramaIcon } from '@/components/portal/programa-icon'
import { SessionBadge } from '@/components/portal/session-badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CHARLA_DOTS, bucketCharla } from '@/lib/charlas/status'
import { bucketSession, type PipelineBucket } from '@/lib/deliverables/pipeline'
import { currentMonthStart, parseDateOnly, toDateKey, todayKey } from '@/lib/date'
import type { CalendarSession } from '@/lib/deliverables/sessions'
import { PROGRAMA_LABEL, sessionHref } from '@/lib/encuentros/programas'

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
  archivado: 'bg-slate-500',
}

/** El punto de color de una sesión: por casilla del pipeline, o por fecha en
 *  una charla (que no tiene entregable ni pipeline). */
function dotClass(session: CalendarSession): string {
  if (session.programa === 'charla') return CHARLA_DOTS[bucketCharla(session.session_date)]
  return DOT_BG[bucketSession(session)]
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

function formatDayHeading(date: Date): string {
  return date.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** Vista general de los encuentros de los tres programas, tipo Google Calendar.
 *  No hace fetch propio: recibe `sessions` ya cargadas y acotadas por
 *  pertenencia (loadPipelineSessions), igual para todos los que la usan. */
export function SessionsCalendar({
  sessions,
  basePath,
}: {
  sessions: CalendarSession[]
  basePath: string
}) {
  // El mes de HOY en hora de Bogotá, no el del servidor (UTC): ver `todayKey` en lib/date.ts.
  const [currentMonth, setCurrentMonth] = useState(currentMonthStart)
  // Los datos del día y su apertura van por separado: al cerrar, el Dialog anima su
  // salida con el contenido todavía a la vista en vez de vaciarse de golpe.
  const [dayPanel, setDayPanel] = useState<{
    date: Date
    sessions: CalendarSession[]
  } | null>(null)
  const [dayPanelOpen, setDayPanelOpen] = useState(false)

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
  const today = todayKey()
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
    setDayPanelOpen(false)
  }

  function goToday() {
    setCurrentMonth(currentMonthStart())
    setDayPanelOpen(false)
  }

  return (
    <BrandCard padding="sm" border="solid" className="space-y-4">
      {/* `first-letter:uppercase` y no `capitalize` en los títulos de mes y día: este
          pone «De» en mayúscula («Octubre De 2026»); en español solo va la primera letra. */}
      {/* Encabezado y agenda comparten una columna centrada de hasta 48 rem: en un
          iPad horizontal las filas medían más de 1000 px y el nombre quedaba a un
          extremo y el estado al otro. La rejilla de escritorio (ratón y ancho) sí
          usa todo el ancho, y con ella el encabezado. */}
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-1 lg:pointer-fine:max-w-none">
        <h2 className="text-base font-semibold first-letter:uppercase">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          {/* 44 px al tacto (Apple HIG) con `pointer-coarse:`, no por ancho: un iPad
              horizontal pasa de 1024 px y sigue siendo un dedo. `active:` porque
              `hover:` no existe al tacto. */}
          <button
            type="button"
            onClick={goToday}
            className="rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:bg-muted/60 pointer-coarse:min-h-11 pointer-coarse:px-4"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            aria-label="Mes anterior"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:bg-muted/60 pointer-coarse:size-11"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            aria-label="Mes siguiente"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:bg-muted/60 pointer-coarse:size-11"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Cuadrícula mensual — solo con ancho Y ratón (`lg:pointer-fine:`). El ancho
          no decide si algo es táctil: un iPad horizontal pasa de 1024 px y sigue
          siendo un dedo, y sus chips de 21 px y el «+N más» de 17 px eran
          imposibles de acertar. Al tacto, a cualquier ancho, manda la agenda de
          abajo, con filas de 44 px. */}
      <div className="hidden overflow-hidden rounded-xl border border-border lg:pointer-fine:block">
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
            const isToday = key === today
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
                    href={sessionHref(basePath, s)}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] transition-colors hover:bg-muted/60"
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass(s)}`} />
                    <ProgramaIcon
                      programa={s.programa}
                      className="h-3 w-3 shrink-0 text-muted-foreground"
                    />
                    <span className="truncate">{s.subtitulo ?? s.title}</span>
                  </Link>
                ))}
                {overflow > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDayPanel({ date, sessions: daySessions })
                      setDayPanelOpen(true)
                    }}
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

      {/* Agenda: móvil, tablet y cualquier pantalla táctil, aunque sea ancha. Solo
          se oculta cuando la cuadrícula de arriba ocupa su lugar. */}
      <div className="mx-auto w-full max-w-3xl lg:pointer-fine:hidden">
        {agendaGroups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay sesiones este mes.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {agendaGroups.map((g) => (
              <div key={g.dateKey} className="space-y-2 py-3 first:pt-0 last:pb-0">
                <p className="text-xs font-medium text-muted-foreground first-letter:uppercase">
                  {formatDayHeading(g.date)}
                </p>
                <div className="space-y-1.5">
                  {g.items.map((s) => (
                    <Link
                      key={s.id}
                      href={sessionHref(basePath, s)}
                      className="flex min-h-11 items-center gap-2 rounded-lg border border-border p-2.5 transition-colors hover:bg-muted/40 active:bg-muted/60"
                    >
                      <ProgramaIcon
                        programa={s.programa}
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                      />
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">
                        {s.subtitulo ?? s.title}
                      </p>
                      <SessionBadge session={s} />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panel del día, sobre el Dialog de Radix y no sobre un `fixed inset-0` propio:
          la tarjeta que envuelve el calendario lleva `backdrop-filter` (.glass) y
          Safari ata cualquier `fixed` a un ancestro así — el panel se dibujaba del
          tamaño de la tarjeta (no de la pantalla) y, con la página desplazada, medio
          fuera de vista. El Dialog sale a <body>, cierra con Esc, atrapa el foco y
          trae su propia X de 44 px al tacto. */}
      <Dialog open={dayPanelOpen} onOpenChange={setDayPanelOpen}>
        <DialogContent className="portal-header rounded-xl border-border/50 sm:max-w-md">
          <DialogHeader className="pr-8 text-left sm:text-left">
            <DialogTitle className="text-base font-semibold first-letter:uppercase">
              {dayPanel ? formatDayHeading(dayPanel.date) : ''}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Encuentros programados para este día.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60dvh] space-y-2 overflow-y-auto">
            {dayPanel?.sessions.map((s) => (
              <Link
                key={s.id}
                href={sessionHref(basePath, s)}
                className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/40 active:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {s.subtitulo ?? s.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {PROGRAMA_LABEL[s.programa]}
                  </p>
                </div>
                <SessionBadge session={s} />
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </BrandCard>
  )
}
