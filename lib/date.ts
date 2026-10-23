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

/** La plataforma se opera desde Colombia (UTC-5, sin horario de verano): «hoy» y las horas se cuentan SIEMPRE
 *  en esta zona. No en la del servidor —en Vercel es UTC: `TZ` es una variable reservada de sus funciones y el
 *  `process.env.TZ` de next.config.mjs no se ejecuta allí—, ni en la del navegador (quien viaja vería otro «hoy»,
 *  y el servidor y el navegador dejarían de coincidir al hidratar). */
export const APP_TIME_ZONE = 'America/Bogota'

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** «YYYY-MM-DD» de un instante en la zona de la plataforma (por defecto, ahora). A diferencia de `toDateKey` —el
 *  día LOCAL de quien ejecuta el código— no cambia con la zona del servidor o del navegador: desde las 7 p. m. en
 *  Colombia sigue siendo «hoy» aunque en UTC ya sea mañana. */
export function todayKey(now: Date = new Date()): string {
  const parts = DAY_FORMAT.formatToParts(now)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Días completos de `from` a `to` (ambos «YYYY-MM-DD»; negativo si `to` es anterior). Se cuentan sobre el
 *  calendario, sin relojes ni zonas: un cambio de hora local no suma ni resta un día. */
export function daysBetweenKeys(from: string, to: string): number {
  const utc = (key: string) => {
    const [year, month, day] = key.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.round((utc(to) - utc(from)) / 86_400_000)
}

/** Primer día del mes de HOY (en la zona de la plataforma) como fecha local: el mes con el que abren los
 *  calendarios. */
export function currentMonthStart(now: Date = new Date()): Date {
  const [year, month] = todayKey(now).split('-').map(Number)
  return new Date(year, month - 1, 1)
}

/** «22/10/2026» de un instante con hora (`created_at`) en la zona de la plataforma: el servidor y el navegador
 *  escriben lo mismo. Con `toLocaleDateString` a secas, el servidor (UTC) y el navegador (Bogotá) discrepaban
 *  para lo creado entre las 7 p. m. y la medianoche. */
export function formatDay(instant: string | Date): string {
  return new Date(instant).toLocaleDateString('es-CO', { timeZone: APP_TIME_ZONE })
}
