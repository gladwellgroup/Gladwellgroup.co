import type { SupabaseClient } from '@supabase/supabase-js'

// 'idea' = recién anotada, nada empezado. 'en_produccion' cubre guion,
// diseño y edición como una sola etapa — el editor asignado y las dos
// fechas ya dicen quién y cuándo, no hace falta subdividirla más. Sin
// estado de aprobación: la parrilla no tiene ese flujo.
export const PARRILLA_STATUSES = [
  'idea',
  'en_produccion',
  'agendado',
  'publicado',
  'cancelado',
] as const
export type ParrillaStatus = (typeof PARRILLA_STATUSES)[number]

export const PARRILLA_STATUS_LABELS: Record<ParrillaStatus, string> = {
  idea: 'Idea',
  en_produccion: 'En producción',
  agendado: 'Agendado',
  publicado: 'Publicado',
  cancelado: 'Cancelado',
}

export const PARRILLA_STATUS_COLORS: Record<ParrillaStatus, string> = {
  idea: 'bg-muted text-muted-foreground',
  en_produccion: 'bg-yellow-500/15 text-yellow-500',
  agendado: 'bg-[#06B6D4]/15 text-[#06B6D4]',
  publicado: 'bg-green-500/15 text-green-500',
  cancelado: 'bg-red-500/15 text-red-500',
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

export const PARRILLA_CATEGORIES = ['valor', 'prospeccion', 'viral', 'comunidad'] as const
export type ParrillaCategory = (typeof PARRILLA_CATEGORIES)[number]

export const PARRILLA_CATEGORY_LABELS: Record<ParrillaCategory, string> = {
  valor: 'Valor',
  prospeccion: 'Prospección',
  viral: 'Viral',
  comunidad: 'Comunidad',
}

export interface ParrillaPost {
  id: string
  title: string
  copy_text: string | null
  platforms: Platform[]
  /** Cuándo se crea/edita la pieza — distinto de cuándo sale a redes. */
  production_date: string
  publish_date: string
  status: ParrillaStatus
  /** Formato planeado — se decide antes de grabar/diseñar; el video real
   *  vive en la red social, acá solo hace falta la foto de portada. */
  format: ParrillaFormat | null
  cover_image_url: string | null
  /** Quién sale en cámara — texto libre, no siempre tiene cuenta propia. */
  talent: string | null
  /** Uno o varios community_admin a cargo de capturar lo crudo (foto/video
   *  del evento) — etapa previa a Editor/Diseñador. */
  filmmaker_ids: string[]
  /** Uno o varios community_admin a cargo de convertir lo crudo en pieza
   *  terminada (portada, carrusel, edición). */
  editor_ids: string[]
  category: ParrillaCategory | null
}

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

export const PARRILLA_POST_COLUMNS =
  'id, title, copy_text, platforms, production_date, publish_date, status, format, cover_image_url, talent, filmmaker_ids, editor_ids, category'

/** Sin scoping por dueño: quien tiene el módulo "parrilla" ve y edita todas
 *  las publicaciones, no solo las que creó — es la premisa del producto. */
export async function loadParrillaPosts(supabase: SupabaseClient): Promise<ParrillaPost[]> {
  const { data } = await supabase
    .from('parrilla_posts')
    .select(PARRILLA_POST_COLUMNS)
    .order('publish_date')

  return (data ?? []) as ParrillaPost[]
}

/** community_admin elegibles como "Editor" de una pieza — editor_ids es un
 *  array plano (sin FK real, así que no hay embed de PostgREST posible),
 *  por eso se resuelve aparte y se cruza en el cliente por id. */
export async function loadParrillaEditors(supabase: SupabaseClient): Promise<ParrillaEditor[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, nombre')
    .eq('role', 'community_admin')
    .order('nombre')

  return (data ?? []) as ParrillaEditor[]
}
