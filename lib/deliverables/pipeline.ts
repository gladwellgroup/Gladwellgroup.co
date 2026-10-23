import { daysBetweenKeys, todayKey } from '@/lib/date'

/** Ciclo de vida de una sesión, compartido por Terapia y Education. Vive en un
 *  solo sitio porque lo consumen el dashboard y los dos listados: si cada uno
 *  clasificara por su cuenta, los conteos dejarían de cuadrar entre pantallas.
 *
 *  `programada` no es un valor de la columna `status` — se deriva de que la
 *  fecha de la sesión todavía no llegó. Eso evita un estado que alguien tenga
 *  que mover a mano: la sesión pasa sola a borrador cuando llega el día.
 *
 *  `archivado` sí es un valor de `status`, pero solo se asigna desde Supabase:
 *  el portal no ofrece ningún control para archivar ni para desarchivar. Saca
 *  la sesión del ciclo de vida — el dashboard no la cuenta ni la marca como
 *  estancada — pero sigue visible en los listados y el calendario. */
export const LIFECYCLE_BUCKETS = [
  'programada',
  'borrador',
  'generado',
  'entregado',
] as const

export const PIPELINE_BUCKETS = [...LIFECYCLE_BUCKETS, 'archivado'] as const

export type LifecycleBucket = (typeof LIFECYCLE_BUCKETS)[number]
export type PipelineBucket = (typeof PIPELINE_BUCKETS)[number]

export const PIPELINE_LABELS: Record<PipelineBucket, string> = {
  programada: 'Sesión programada',
  borrador: 'Borrador',
  generado: 'Generado',
  entregado: 'Entregado',
  archivado: 'Archivado',
}

/** Única fuente de verdad del color del estado en toda la plataforma —
 *  sustituye a los mapas por programa, que eran idénticos entre sí y que
 *  además habrían etiquetado "Borrador" una sesión aún por ocurrir. */
export const PIPELINE_COLORS: Record<PipelineBucket, string> = {
  programada: 'bg-[#06B6D4]/15 text-[#06B6D4]',
  borrador: 'bg-muted text-muted-foreground',
  generado: 'bg-yellow-500/15 text-yellow-500',
  entregado: 'bg-green-500/15 text-green-500',
  archivado: 'bg-slate-500/15 text-slate-500',
}

export function isPipelineBucket(value: string): value is PipelineBucket {
  return (PIPELINE_BUCKETS as readonly string[]).includes(value)
}

/** Lo mínimo que necesita una sesión para clasificarse. Deliberadamente laxo
 *  en `status` (`string`, no un enum cerrado): Terapia y Education tienen
 *  enums propios y no conviene atar este helper a uno de los dos. */
export interface PipelineSession {
  status: string | null
  session_date: string
}

/** Devuelve la casilla del pipeline. Son exhaustivas y no se solapan:
 *  `archivado` gana siempre —una decisión manual no la pisa ni la fecha ni el
 *  estado—, luego `entregado` —por si alguna vez se envía antes de la fecha—,
 *  luego la fecha futura, y al final el estado tal cual. */
export function bucketSession(session: PipelineSession): PipelineBucket {
  if (session.status === 'archivado') return 'archivado'
  if (session.status === 'entregado') return 'entregado'
  if (isFutureDate(session.session_date)) return 'programada'
  return session.status === 'generado' ? 'generado' : 'borrador'
}

/** Compara contra el día de HOY en la zona de la plataforma (ver `todayKey`). `session_date` es una columna
 *  `date` sin hora: una sesión de hoy NO es futura. Las claves «YYYY-MM-DD» se ordenan igual como texto. */
function isFutureDate(dateStr: string): boolean {
  return dateStr > todayKey()
}

/** Días completos desde la fecha de la sesión. 0 si es hoy o futura. */
export function daysSinceSession(dateStr: string): number {
  return Math.max(0, daysBetweenKeys(dateStr, todayKey()))
}

/** A partir de aquí una sesión sin entregar deja de ser "en curso" y pasa a
 *  ser algo que alguien tiene que destrabar. */
export const STALE_AFTER_DAYS = 14

/** Más allá de esto ya no es "un poco atrasado" — es abandono. Mismo umbral
 *  visual que separa ámbar de rojo en el pipeline. */
export const CRITICAL_AFTER_DAYS = 30
