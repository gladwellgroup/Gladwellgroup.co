import type { SupabaseClient } from '@supabase/supabase-js'
import { isAssignedTo, isUuid } from '@/lib/parrilla/rules'
import { must } from '@/lib/supabase/must'

// El flujo, en orden: 'idea' = recién anotada, nada empezado. 'agendado' = la
// idea pasó a la etapa de creación. 'en_produccion' cubre guion, diseño y
// edición como una sola etapa — el editor asignado y las dos fechas ya dicen
// quién y cuándo, no hace falta subdividirla más. 'programado' = ya editada y
// lista para salir el día de la fecha de publicación. 'archivado' = la idea no
// se ejecuta pero no se pierde: vive en el Banco de contenido, sin fecha de
// publicación. Sin estado de aprobación: la parrilla no tiene ese flujo.
export const PARRILLA_STATUSES = [
  'idea',
  'agendado',
  'en_produccion',
  'programado',
  'publicado',
  'archivado',
] as const
export type ParrillaStatus = (typeof PARRILLA_STATUSES)[number]

/** Lo que vive en el calendario: todo menos lo archivado, que no tiene fecha de
 *  publicación y se ve en el Banco de contenido. */
export const PARRILLA_PIPELINE_STATUSES = PARRILLA_STATUSES.filter(
  (status): status is Exclude<ParrillaStatus, 'archivado'> => status !== 'archivado'
)

export const PARRILLA_STATUS_LABELS: Record<ParrillaStatus, string> = {
  idea: 'Idea',
  agendado: 'Agendado',
  en_produccion: 'En producción',
  programado: 'Programado',
  publicado: 'Publicado',
  archivado: 'Archivado',
}

export const PARRILLA_STATUS_COLORS: Record<ParrillaStatus, string> = {
  idea: 'bg-muted text-muted-foreground',
  agendado: 'bg-[#7C3AED]/15 text-[#A78BFA]',
  en_produccion: 'bg-yellow-500/15 text-yellow-500',
  programado: 'bg-[#06B6D4]/15 text-[#06B6D4]',
  publicado: 'bg-green-500/15 text-green-500',
  archivado: 'bg-slate-500/15 text-slate-500',
}

export const PARRILLA_FORMATS = ['carrusel', 'imagen', 'video'] as const
export type ParrillaFormat = (typeof PARRILLA_FORMATS)[number]

export const PARRILLA_FORMAT_LABELS: Record<ParrillaFormat, string> = {
  carrusel: 'Carrusel',
  imagen: 'Imagen',
  video: 'Video',
}

export const PLATFORMS = ['instagram', 'linkedin', 'youtube'] as const
export type Platform = (typeof PLATFORMS)[number]

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
}

export const PARRILLA_CATEGORIES = [
  'crecer',
  'conectar',
  'construir',
  'aprender',
  'roots',
  'comunidad',
] as const
export type ParrillaCategory = (typeof PARRILLA_CATEGORIES)[number]

export const PARRILLA_CATEGORY_LABELS: Record<ParrillaCategory, string> = {
  crecer: 'Crecer',
  conectar: 'Conectar',
  construir: 'Construir',
  aprender: 'Aprender',
  roots: 'Roots',
  comunidad: 'Comunidad',
}

/** Las secciones del modal que se pueden ocultar con el ojo: no todas las
 *  publicaciones llevan Inspiración, Guion, Copy del post o Foto de portada.
 *  Ocultar solo esconde el campo en la pantalla — el contenido no se borra. Las
 *  claves van en la columna `hidden_sections` (el CHECK de SQL lleva la misma
 *  lista; una prueba las compara). */
export const PARRILLA_SECTIONS = ['inspiracion', 'guion', 'copy', 'portada'] as const
export type ParrillaSection = (typeof PARRILLA_SECTIONS)[number]

export const PARRILLA_SECTION_LABELS: Record<ParrillaSection, string> = {
  inspiracion: 'Inspiración',
  guion: 'Guion',
  copy: 'Copy del post',
  portada: 'Foto de portada',
}

/** Lo que dibujan el calendario, la agenda y el modal al abrirse: sin los
 *  textos largos (Guion, Copy) ni la portada, que solo hacen falta dentro del
 *  modal y se piden al abrirlo (GET /api/parrilla/[id]). Así cada carga del
 *  calendario no arrastra el texto de todas las publicaciones. */
export interface ParrillaPostSummary {
  id: string
  title: string
  platforms: Platform[]
  /** Cuándo se crea/edita la pieza — distinto de cuándo sale a redes. */
  production_date: string
  /** NULL solo en las piezas archivadas: archivar borra la fecha de publicación. */
  publish_date: string | null
  status: ParrillaStatus
  /** Formato planeado — se decide antes de grabar/diseñar; el video real
   *  vive en la red social, acá solo hace falta la foto de portada. */
  format: ParrillaFormat | null
  category: ParrillaCategory | null
  /** Quién sale en cámara — texto libre, no siempre tiene cuenta propia. */
  talent: string | null
  /** Inspiración: enlace (http/https) a la referencia de la que parte el video.
   *  Solo aplica a video. Es una URL corta, por eso viaja en el listado y no en
   *  el detalle: el modal la muestra al abrirse, junto a `talent`. */
  inspiration_url: string | null
  /** Secciones del modal que el equipo ocultó en esta pieza. Viaja en el
   *  listado (no en el detalle) porque el modal las necesita al abrirse, antes
   *  de que llegue el detalle: así una sección oculta no parpadea abierta. */
  hidden_sections: ParrillaSection[]
  /** Uno o varios community_admin a cargo de capturar lo crudo (foto/video
   *  del evento) — etapa previa a Editor/Diseñador. */
  filmmaker_ids: string[]
  /** Uno o varios community_admin a cargo de convertir lo crudo en pieza
   *  terminada (portada, carrusel, edición). */
  editor_ids: string[]
  /** Token de concurrencia: un trigger lo mueve en cada UPDATE (migración
   *  20260914). Se reenvía tal cual en el PATCH — es un texto opaco con
   *  microsegundos, no una fecha que haya que parsear. */
  updated_at: string
}

export interface ParrillaPost extends ParrillaPostSummary {
  /** Es el Guion (así se llama en el modal) — el nombre de la columna es
   *  histórico. El copy que se publica en redes vive en `caption`. */
  copy_text: string | null
  /** Copy del post: el texto (caption, hashtags, CTA) que acompaña la
   *  publicación en redes — distinto del Guion (`copy_text`). */
  caption: string | null
  cover_image_url: string | null
}

/** Lo mínimo que necesita la cola "pendiente para ti" del dashboard. */
export type ParrillaPostPending = Pick<
  ParrillaPostSummary,
  'id' | 'title' | 'status' | 'format' | 'category' | 'filmmaker_ids' | 'editor_ids'
>

/** Cuál de las dos fechas del post posiciona el calendario — cada vista usa
 *  una. */
export type ParrillaDateField = 'production_date' | 'publish_date'

export const DATE_FIELD_LABELS: Record<ParrillaDateField, string> = {
  production_date: 'Producción',
  publish_date: 'Publicación',
}

export interface ParrillaEditor {
  id: string
  nombre: string
}

// Listado y detalle son consultas distintas a propósito: el listado va en
// cada carga de página; el detalle (con Guion, Copy y portada) solo al abrir
// una publicación en el modal.
export const PARRILLA_LIST_COLUMNS =
  'id, title, platforms, production_date, publish_date, status, format, category, talent, inspiration_url, hidden_sections, filmmaker_ids, editor_ids, updated_at'
export const PARRILLA_DETAIL_COLUMNS = `${PARRILLA_LIST_COLUMNS}, copy_text, caption, cover_image_url`
export const PARRILLA_PENDING_COLUMNS =
  'id, title, status, format, category, filmmaker_ids, editor_ids'

/** Sin scoping por dueño: quien tiene el módulo "parrilla" ve y edita todas
 *  las publicaciones, no solo las que creó — es la premisa del producto. */
export async function loadParrillaPosts(supabase: SupabaseClient): Promise<ParrillaPostSummary[]> {
  // `must`: un select roto (p. ej. una columna nueva cuya migración aún no se aplicó) o un tope de tiempo se veía
  // como un calendario vacío, sin rastro de por qué. Ahora llega a la pantalla de error, con «Reintentar».
  const data = must(
    await supabase
      .from('parrilla_posts')
      .select(PARRILLA_LIST_COLUMNS)
      .order('publish_date')
      // Desempate: sin él, las piezas de un mismo día cambian de orden al
      // editarlas (Postgres devuelve empates en orden físico, y un UPDATE lo mueve).
      .order('created_at'),
    'Publicaciones de la parrilla'
  )

  return (data ?? []) as ParrillaPostSummary[]
}

/** La cola de trabajo de una persona: piezas sin terminar donde es Editor o
 *  Filmmaker. Se filtra en SQL — la cola crece con las piezas de la persona,
 *  no con toda la tabla — y luego con `isAssignedTo`, que ignora asignaciones
 *  de Filmmaker en piezas donde ese campo ya no aplica. */
export async function loadParrillaPending(
  supabase: SupabaseClient,
  userId: string
): Promise<ParrillaPostPending[]> {
  // Viene de la sesión, pero se interpola dentro de un filtro de PostgREST:
  // se valida antes de armarlo.
  if (!isUuid(userId)) return []

  const data = must(
    await supabase
      .from('parrilla_posts')
      .select(PARRILLA_PENDING_COLUMNS)
      .in('status', ['idea', 'agendado', 'en_produccion'])
      .or(`editor_ids.cs.{${userId}},filmmaker_ids.cs.{${userId}}`)
      .order('publish_date')
      .order('created_at'),
    'Cola pendiente de la parrilla'
  )

  return ((data ?? []) as ParrillaPostPending[]).filter((post) => isAssignedTo(post, userId))
}

/** community_admin elegibles como "Editor" de una pieza — editor_ids es un
 *  array plano (sin FK real, así que no hay embed de PostgREST posible),
 *  por eso se resuelve aparte y se cruza en el cliente por id. */
export async function loadParrillaEditors(supabase: SupabaseClient): Promise<ParrillaEditor[]> {
  // Igual que con las publicaciones: un fallo aquí se vería como un selector de Editor vacío.
  const data = must(
    await supabase.from('profiles').select('id, nombre').eq('role', 'community_admin').order('nombre'),
    'Editores de la parrilla'
  )

  return (data ?? []) as ParrillaEditor[]
}
