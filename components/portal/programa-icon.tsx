import { GraduationCap, MessagesSquare, Users, type LucideIcon } from 'lucide-react'
import type { CalendarPrograma } from '@/lib/encuentros/programas'

/** Un icono por tipo de encuentro, el mismo en el hub, el calendario y las
 *  fichas. Vive aparte de `lib/encuentros/programas.ts` porque esos datos son
 *  puros (los usan rutas y pruebas) y un icono es un componente de React. */
export const PROGRAMA_ICON: Record<CalendarPrograma, LucideIcon> = {
  terapia: Users,
  education: GraduationCap,
  charla: MessagesSquare,
}

export function ProgramaIcon({
  programa,
  className,
}: {
  programa: CalendarPrograma
  className?: string
}) {
  const Icon = PROGRAMA_ICON[programa]
  return <Icon className={className} />
}
