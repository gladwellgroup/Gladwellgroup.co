import { PipelineBadge } from '@/components/portal/pipeline-badge'
import { CHARLA_COLORS, CHARLA_LABELS, bucketCharla } from '@/lib/charlas/status'
import type { CalendarSession } from '@/lib/deliverables/sessions'

const BADGE_CLASS =
  'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium'

/** Estado de una charla: «Programada» o «Realizada», según su fecha. */
export function CharlaBadge({ sessionDate }: { sessionDate: string }) {
  const bucket = bucketCharla(sessionDate)

  return <span className={`${BADGE_CLASS} ${CHARLA_COLORS[bucket]}`}>{CHARLA_LABELS[bucket]}</span>
}

/** El estado de cualquier encuentro del calendario. Una sesión con entregable
 *  usa el pipeline; una charla no tiene entregable, así que mostrarle el del
 *  pipeline la habría etiquetado «Borrador» al pasar la fecha. */
export function SessionBadge({ session }: { session: CalendarSession }) {
  if (session.programa === 'charla') {
    return <CharlaBadge sessionDate={session.session_date} />
  }

  return <PipelineBadge session={session} />
}
