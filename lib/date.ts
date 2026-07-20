/** Parsea un string "YYYY-MM-DD" (columna `date` de Postgres, sin hora ni
 *  zona horaria) como medianoche LOCAL, no UTC. `new Date(str)` interpreta
 *  ese formato como medianoche UTC, lo que en cualquier zona horaria con
 *  offset negativo (ej. Colombia, UTC-5) muestra un día antes. */
export function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}
