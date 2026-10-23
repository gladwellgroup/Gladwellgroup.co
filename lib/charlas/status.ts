import { todayKey } from '@/lib/date'

/** Una charla no tiene entregable ni estado que alguien mueva a mano: solo
 *  está por ocurrir o ya ocurrió, y eso se deduce de la fecha. Por eso no usa
 *  las casillas del pipeline, que la habrían llamado «Borrador» al pasar el día. */
export type CharlaBucket = 'programada' | 'realizada'

export const CHARLA_LABELS: Record<CharlaBucket, string> = {
  programada: 'Programada',
  realizada: 'Realizada',
}

export const CHARLA_COLORS: Record<CharlaBucket, string> = {
  // El mismo cian que «Sesión programada» en Terapia y Education —significa lo
  // mismo—, pero con el texto más oscuro en tema claro: #06B6D4 sobre ese fondo da
  // 2,04:1 (mínimo AA: 4,5:1) y #155E75 da más de 6:1. En tema oscuro no cambia.
  programada: 'bg-[#06B6D4]/15 text-[#155E75] dark:text-[#06B6D4]',
  realizada: 'bg-muted text-muted-foreground',
}

/** Punto de color de la celda compacta del calendario. */
export const CHARLA_DOTS: Record<CharlaBucket, string> = {
  programada: 'bg-[#06B6D4]',
  realizada: 'bg-muted-foreground/50',
}

/** `programada` hasta que termina el día de la charla; `realizada` desde el día
 *  siguiente. `session_date` no tiene hora, así que una charla de HOY todavía no
 *  ha ocurrido (o está ocurriendo): llamarla «Realizada» desde las 00:00 sería
 *  decir que pasó antes de empezar. Una sesión de Terapia o Education, en cambio,
 *  pasa a borrador el mismo día —ya hay algo que preparar—, por eso no comparten
 *  la regla. Las fechas «YYYY-MM-DD» se ordenan igual como texto. */
export function bucketCharla(sessionDate: string): CharlaBucket {
  return sessionDate >= todayKey() ? 'programada' : 'realizada'
}
