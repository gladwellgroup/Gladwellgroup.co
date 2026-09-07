import Link from 'next/link'
import { Briefcase, ChevronRight } from 'lucide-react'
import { BrandCard } from '@/components/brand/brand-card'
import { parseDateOnly } from '@/lib/date'
import type { CalendarSession } from '@/lib/deliverables/sessions'

/** Para quien solo tiene el módulo de solo lectura "Calendario de
 *  sesiones" (sin administrar ningún programa) — no tiene sentido mostrarle
 *  el pipeline/atención/comunidad de Entregables, que son de quien
 *  administra. Esto es lo único relevante: qué se viene en la comunidad. */
export function CommunityCalendarCard({
  sessions,
  href,
}: {
  sessions: CalendarSession[]
  href: string
}) {
  if (sessions.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold gladwell-gradient-text">
        <Briefcase className="h-5 w-5" />
        Próximas sesiones de la comunidad
      </h2>
      <BrandCard padding="sm" border="solid" className="divide-y divide-border">
        {sessions.map((session) => (
          <Link
            key={session.id}
            href={href}
            className="flex items-center justify-between gap-3 px-2 py-3 transition-colors hover:bg-muted/40"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{session.title}</p>
              <p className="text-xs text-muted-foreground">
                {session.programa === 'terapia'
                  ? 'Terapia Organizacional'
                  : 'Gladwell Education'}
              </p>
            </div>
            <p className="shrink-0 text-xs text-muted-foreground">
              {parseDateOnly(session.session_date).toLocaleDateString('es-CO', {
                day: 'numeric',
                month: 'long',
              })}
            </p>
          </Link>
        ))}
      </BrandCard>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Ver calendario completo
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
