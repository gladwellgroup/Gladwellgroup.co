import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { BrandCard } from '@/components/brand/brand-card'
import { SectionDivider } from '@/components/shared'
import { ProgramaIcon } from '@/components/portal/programa-icon'
import { SessionsCalendar } from '@/components/portal/sessions-calendar'
import type { CalendarSession } from '@/lib/deliverables/sessions'
import {
  PROGRAMA_LABEL,
  PROGRAMA_ROUTE,
  type CalendarPrograma,
} from '@/lib/encuentros/programas'

const DESCRIPTIONS: Record<CalendarPrograma, string> = {
  terapia:
    'Sesiones de feedback a fundadores. Genera el entregable con las recomendaciones de la comunidad y lo envía a la empresa invitada.',
  education:
    'Sesiones formativas con ponente. Captura herramientas y cápsulas, y envía el entregable a los asistentes registrados.',
  charla:
    'Espacios abiertos de la comunidad, sin guion ni entregable. Registra quién asiste con un código QR.',
}

/** Rejilla de tarjetas según cuántas ve esta persona. Con tres: una columna en
 *  móvil, dos en iPad vertical —la tercera ocupa el ancho completo en vez de
 *  quedar huérfana a medias— y tres desde `lg`. Con una sola, centrada. */
function gridClass(count: number): string {
  if (count >= 3) return 'sm:grid-cols-2 lg:grid-cols-3'
  if (count === 1) return 'mx-auto w-full max-w-md'
  return 'sm:grid-cols-2'
}

export function EncuentrosHub({
  basePath,
  sessions,
  canManageTherapy,
  canManageEducation,
  canManageCharlas,
}: {
  basePath: string
  sessions: CalendarSession[]
  /** Sin el módulo de administrar el programa, solo se ve el calendario —
   *  no tiene sentido mostrar la tarjeta que lleva a crear/gestionar
   *  sesiones si la página de destino lo va a rechazar de todos modos. */
  canManageTherapy: boolean
  canManageEducation: boolean
  canManageCharlas: boolean
}) {
  const programs = (
    [
      { programa: 'terapia', show: canManageTherapy },
      { programa: 'education', show: canManageEducation },
      { programa: 'charla', show: canManageCharlas },
    ] as const
  ).filter((program) => program.show)

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-1 pt-6 text-center sm:pt-8">
        <h1 className="text-xl sm:text-2xl font-bold gladwell-gradient-text">
          Encuentros
        </h1>
        <p className="text-muted-foreground">
          {programs.length > 0
            ? 'Elige el tipo de encuentro con el que vas a trabajar.'
            : 'Calendario de encuentros de la comunidad.'}
        </p>
      </div>

      {programs.length > 0 && (
        <div className={`grid gap-4 ${gridClass(programs.length)}`}>
          {programs.map(({ programa }, index) => (
            <Link
              key={programa}
              href={`${basePath}/${PROGRAMA_ROUTE[programa]}`}
              className={`group block ${
                programs.length === 3 && index === 2 ? 'sm:col-span-2 lg:col-span-1' : ''
              }`}
            >
              {/* Centrado en mobile; desde sm vuelve al layout original
                  (alineado a la izquierda), sin tocar nada ahí. */}
              <BrandCard className="flex h-full flex-col items-center gap-3 text-center transition-colors hover:bg-muted/30 active:bg-muted/40 sm:items-start sm:text-left">
                <ProgramaIcon programa={programa} className="h-7 w-7 text-[#A78BFA]" />
                <h2 className="flex items-center gap-1.5 text-base font-semibold">
                  {PROGRAMA_LABEL[programa]}
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </h2>
                <p className="text-sm text-muted-foreground">{DESCRIPTIONS[programa]}</p>
              </BrandCard>
            </Link>
          ))}
        </div>
      )}

      {/* Misma línea de marca que separa secciones en la landing — marca el
          quiebre entre "elegir programa" y "ver todo junto" sin un borde
          duro. */}
      {programs.length > 0 && <SectionDivider position="inline" />}

      <SessionsCalendar sessions={sessions} basePath={basePath} />
    </div>
  )
}
