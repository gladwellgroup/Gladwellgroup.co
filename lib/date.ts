/** Parsea un string "YYYY-MM-DD" (columna `date` de Postgres, sin hora ni
 *  zona horaria) como medianoche LOCAL, no UTC. `new Date(str)` interpreta
 *  ese formato como medianoche UTC, lo que en cualquier zona horaria con
 *  offset negativo (ej. Colombia, UTC-5) muestra un día antes. */
export function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** El inverso: el día LOCAL de una fecha como "YYYY-MM-DD". `toISOString()`
 *  sirve para esto solo hasta las 7 p. m. en Colombia: de ahí en adelante ya
 *  es "mañana" en UTC y el valor por defecto de un campo de fecha salía con un
 *  día de más. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
