import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServer } from '@/lib/supabase/server'
import type { CalendarSession } from '@/lib/deliverables/sessions'
import type {
  CharlaAttendanceLink,
  CharlaAttendee,
  CharlaDetail,
  CharlaListItem,
} from '@/lib/charlas/types'

// supabase-js tipa las relaciones embebidas como arrays; en runtime una relación
// a-uno vuelve objeto|null y una a-muchos, array. Las lecturas de abajo las
// normalizan en un solo sitio.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmbeddedRow = any

// Las columnas que cada lectura pide, como listas y no solo como texto dentro del
// `select`: la prueba de deriva (tests/charlas.test.ts) las compara con la
// migración, y un nombre mal escrito aquí fallaba como una lista vacía en
// producción en vez de en el CI.
export const CHARLA_COLUMNS = ['id', 'title', 'session_date', 'photo_url'] as const
export const CHARLA_ATTENDEE_COLUMNS = ['id', 'nombre', 'correo', 'created_at'] as const
export const CHARLA_LINK_COLUMNS = ['token', 'expires_at'] as const
/** Lo que necesita el calendario: título y fecha, sin foto ni asistentes. */
export const CHARLA_CALENDAR_COLUMNS = ['id', 'title', 'session_date'] as const

const columns = (list: readonly string[]) => list.join(', ')

/** Deja en el registro del servidor un error de lectura que NO sea «no hay tal
 *  fila». Sin esto, una migración sin aplicar o una columna mal escrita se veía
 *  como una lista vacía y nadie sabía por qué (así costó encontrar la de la
 *  parrilla). PGRST116 es un `single()` sin filas y 22P02 un id que no es uuid
 *  en la URL: los dos son un 404 normal, no un fallo. */
function logUnexpected(scope: string, error: { code?: string; message?: string } | null) {
  if (!error || error.code === 'PGRST116' || error.code === '22P02') return
  console.error(`[charlas] ${scope}:`, error.code, error.message)
}

/** El primer elemento si vino como array, el valor si vino como objeto. */
function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/** El `count` de un embed `tabla(count)`, que PostgREST devuelve como `[{ count }]`. */
function embeddedCount(value: EmbeddedRow): number {
  return Number(first<{ count: number }>(value)?.count ?? 0)
}

/** Todas las charlas, de la más reciente a la más antigua. Quien llega acá ya
 *  pasó `sessions:read_community`, así que ve la lista completa: el título, la
 *  fecha, la foto y el número de asistentes no son datos de contacto. */
export async function listCharlas(): Promise<CharlaListItem[]> {
  const { data, error } = await getSupabaseServer()
    .from('charlas')
    .select(`${columns(CHARLA_COLUMNS)}, charla_attendees ( count )`)
    .order('session_date', { ascending: false })
    .order('created_at', { ascending: false })
  logUnexpected('listCharlas', error)

  return ((data ?? []) as EmbeddedRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    session_date: row.session_date,
    photo_url: row.photo_url ?? null,
    asistentes: embeddedCount(row.charla_attendees),
  }))
}

/** La charla con su asistencia. `includeAttendees` es la barrera de privacidad:
 *  con `false` ni siquiera se piden los nombres y correos a la base, solo el
 *  conteo, así que no hay nada que redactar después. */
export async function getCharla(
  id: string,
  { includeAttendees }: { includeAttendees: boolean }
): Promise<CharlaDetail | null> {
  const select = includeAttendees
    ? `${columns(CHARLA_COLUMNS)},
       charla_attendees ( ${columns(CHARLA_ATTENDEE_COLUMNS)} ),
       session_attendance_links ( ${columns(CHARLA_LINK_COLUMNS)} )`
    : `${columns(CHARLA_COLUMNS)}, charla_attendees ( count )`

  let query = getSupabaseServer().from('charlas').select(select).eq('id', id)
  // El orden de un embed solo existe cuando se piden filas, no un conteo.
  if (includeAttendees) {
    query = query.order('created_at', { referencedTable: 'charla_attendees' })
  }

  const { data, error } = await query.single()
  logUnexpected('getCharla', error)
  if (!data) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = data
  const charla = {
    id: row.id as string,
    title: row.title as string,
    session_date: row.session_date as string,
    photo_url: (row.photo_url ?? null) as string | null,
  }

  if (!includeAttendees) {
    return {
      charla,
      asistentes: embeddedCount(row.charla_attendees),
      attendees: null,
      attendanceLink: null,
    }
  }

  const attendees = (row.charla_attendees ?? []) as CharlaAttendee[]
  return {
    charla,
    asistentes: attendees.length,
    attendees,
    attendanceLink: first<CharlaAttendanceLink>(row.session_attendance_links),
  }
}

/** Las charlas en la forma del calendario. Sin estado, subtítulo ni
 *  responsable: una charla no tiene entregable ni dueño. */
export async function loadCharlaSessions(
  supabase: SupabaseClient
): Promise<CalendarSession[]> {
  const { data, error } = await supabase.from('charlas').select(columns(CHARLA_CALENDAR_COLUMNS))
  logUnexpected('loadCharlaSessions', error)

  return ((data ?? []) as EmbeddedRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    session_date: row.session_date,
    status: null,
    programa: 'charla' as const,
    subtitulo: null,
    responsable: null,
  }))
}
