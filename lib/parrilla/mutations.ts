// Toda escritura de las PUBLICACIONES de la parrilla pasa por aquí. Antes cada
// ruta hacía su propio update sin comprobar cuántas filas tocó (editar una pieza
// ya borrada "funcionaba"), seteaba updated_at a mano y guardaba lo que llegara.
// Ahora hay una sola vía: leer lo mínimo → planear con funciones puras → escribir
// con compare-and-set sobre updated_at.
//
// `planPostUpdate`, `describeDbError` y `storagePathFromUrl` son puras y tienen
// pruebas; el resto es el pegamento con Supabase. Las escrituras de las frases
// viven en quote-mutations.ts, que reutiliza `failure` y `describeDbError`.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParrillaPost } from '@/lib/parrilla/posts'
import {
  QUOTE_AUTHOR_MAX,
  QUOTE_AUTHOR_MIN,
  QUOTE_CONTEXT_MAX,
  QUOTE_SOURCE_MAX,
  QUOTE_TEXT_MAX,
  QUOTE_TEXT_MIN,
} from '@/lib/parrilla/quotes'
import {
  datesInOrder,
  isArchived,
  isUuid,
  normalizeFields,
  showsFilmmaker,
  showsInspiration,
  showsTalent,
  type PostPatch,
} from '@/lib/parrilla/rules'
import type { ParrillaPostInput } from '@/lib/validations/parrilla'
import { logError } from '@/lib/log'

const BUCKET = 'parrilla-media'

/** Lo único que hace falta leer antes de escribir: el estado efectivo para
 *  validar fechas y visibilidad, el token y la portada actual. */
export const GUARD_COLUMNS =
  'status, format, category, production_date, publish_date, cover_image_url, talent, inspiration_url, filmmaker_ids, updated_at'

export type GuardRow = Pick<
  ParrillaPost,
  | 'status'
  | 'format'
  | 'category'
  | 'production_date'
  | 'publish_date'
  | 'cover_image_url'
  | 'talent'
  | 'inspiration_url'
  | 'filmmaker_ids'
  | 'updated_at'
>

export type Plan = { ok: true; update: PostPatch } | { ok: false; status: 400 | 409; error: string }

export type MutationFailure = { ok: false; status: 400 | 404 | 409 | 500; error: string }
export type MutationResult = { ok: true } | MutationFailure

// `as const` para que el tipo sea el literal (status 404 / 409): así el mismo
// objeto sirve como `Plan` (solo 400 | 409) y como `MutationFailure`.
const NOT_FOUND = {
  ok: false,
  status: 404,
  error: 'La publicación ya no existe',
} as const
const CONFLICT = {
  ok: false,
  status: 409,
  error: 'Esta publicación cambió mientras la editabas.',
} as const

// ───────────────────────────── Plan (puro) ─────────────────────────────

/** Qué escribir, dado el estado guardado y el parche. Calcula con el estado
 *  EFECTIVO (guardado + parche), porque un parche con solo la categoría no
 *  trae el formato y viceversa. */
export function planPostUpdate(current: GuardRow, patch: PostPatch, expected?: string): Plan {
  const touched = Object.values(patch).some((value) => value !== undefined)
  // Sin cambios no hay nada que pelear: ni conflicto ni escritura.
  if (!touched) return { ok: true, update: {} }

  if (expected !== undefined && expected !== current.updated_at) return CONFLICT

  const update: PostPatch = { ...patch }

  // `null` es un valor válido de publish_date (pieza archivada), así que no se
  // puede resolver con `??`: un null explícito del parche sí cuenta.
  let publish = patch.publish_date !== undefined ? patch.publish_date : current.publish_date

  // Archivar borra la fecha de publicación; sacar una pieza del archivo exige
  // una. Solo se evalúa si el parche toca el estado o esa fecha: así una pieza
  // vieja con datos raros se puede seguir renombrando.
  if (patch.status !== undefined || patch.publish_date !== undefined) {
    const status = patch.status ?? current.status
    if (isArchived(status)) {
      if (publish !== null) update.publish_date = null
      publish = null
    } else if (publish === null) {
      return {
        ok: false,
        status: 400,
        error: 'Pon una fecha de publicación para sacarla del archivo',
      }
    }
  }

  // El orden solo se valida si el parche toca una fecha: así una pieza vieja
  // que ya quedó con fechas al revés se puede seguir renombrando.
  if (patch.production_date !== undefined || patch.publish_date !== undefined) {
    const production = patch.production_date ?? current.production_date
    if (!datesInOrder(production, publish)) {
      return {
        ok: false,
        status: 400,
        error: 'La publicación no puede ser anterior a la producción',
      }
    }
  }

  // Las asignaciones que la combinación formato/categoría oculta se vacían
  // cuando el parche toca algo que decide esa visibilidad. Solo se escribe si
  // hay algo que vaciar.
  const decidesVisibility =
    patch.format !== undefined ||
    patch.category !== undefined ||
    patch.talent !== undefined ||
    patch.inspiration_url !== undefined ||
    patch.filmmaker_ids !== undefined

  if (decidesVisibility) {
    const format = patch.format !== undefined ? patch.format : current.format
    const category = patch.category !== undefined ? patch.category : current.category

    if (!showsTalent(format) && (patch.talent != null || current.talent != null)) {
      update.talent = null
    }
    if (
      !showsInspiration(format) &&
      (patch.inspiration_url != null || current.inspiration_url != null)
    ) {
      update.inspiration_url = null
    }
    if (
      !showsFilmmaker(format, category) &&
      ((patch.filmmaker_ids?.length ?? 0) > 0 || current.filmmaker_ids.length > 0)
    ) {
      update.filmmaker_ids = []
    }
  }

  return { ok: true, update }
}

// ─────────────────────────── Errores y rutas (puras) ───────────────────────────

const CONSTRAINT_MESSAGES: Record<string, string> = {
  parrilla_posts_category_check: 'La categoría no es válida',
  parrilla_posts_format_check: 'El formato no es válido',
  parrilla_posts_platforms_check: 'Alguna plataforma no es válida',
  parrilla_posts_publish_date_check: 'Falta la fecha de publicación',
  parrilla_posts_inspiration_url_check: 'El enlace de inspiración no es válido',
  parrilla_posts_hidden_sections_check: 'Alguna sección oculta no es válida',
  // Frases (supabase/migrations/20260920_parrilla_frases.sql).
  parrilla_quotes_quote_text_check: `La frase debe tener entre ${QUOTE_TEXT_MIN} y ${QUOTE_TEXT_MAX} caracteres`,
  parrilla_quotes_author_check: `El referente debe tener entre ${QUOTE_AUTHOR_MIN} y ${QUOTE_AUTHOR_MAX} caracteres`,
  parrilla_quotes_author_context_check: `«Quién fue» no puede pasar de ${QUOTE_CONTEXT_MAX} caracteres`,
  parrilla_quotes_source_check: `La fuente no puede pasar de ${QUOTE_SOURCE_MAX} caracteres`,
  parrilla_quotes_category_check: 'La categoría no es válida',
}

const RELOAD_HINT = 'Recarga la página e inténtalo de nuevo.'

type DbError = { code?: string; message?: string }

/** Mensaje claro para quien guarda, según el código de Postgres. La causa real
 *  (si es una migración sin aplicar, p. ej.) queda además en el log. */
export function describeDbError(error: DbError, fallback: string): string {
  if (error.code === '23514') {
    // violates check constraint "parrilla_posts_category_check"
    const name = /violates check constraint "([^"]+)"/.exec(error.message ?? '')?.[1]
    const what = (name && CONSTRAINT_MESSAGES[name]) || 'Alguno de los valores no está permitido'
    return `${what}. ${RELOAD_HINT}`
  }
  // 42703 = columna inexistente; PGRST204 = PostgREST no la encuentra en su
  // caché de esquema. 42P01 = tabla inexistente; PGRST205 = lo mismo para una
  // tabla. En la práctica: se desplegó el código antes que el SQL.
  if (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    error.code === '42P01' ||
    error.code === 'PGRST205'
  ) {
    return 'Falta aplicar una migración de la base de datos. Avisa a quien administra la plataforma.'
  }
  return fallback
}

/** Ruta del archivo dentro del bucket a partir de su URL pública. Devuelve
 *  null si la URL no es de este bucket: la limpieza corre con la service role
 *  y nunca debe borrar algo ajeno. */
export function storagePathFromUrl(url: string): string | null {
  let pathname: string
  try {
    pathname = new URL(url).pathname
  } catch {
    return null
  }

  const marker = `/object/public/${BUCKET}/`
  const index = pathname.indexOf(marker)
  if (index === -1) return null

  let path: string
  try {
    path = decodeURIComponent(pathname.slice(index + marker.length))
  } catch {
    return null
  }
  if (!path || path.split('/').includes('..')) return null
  return path
}

// ───────────────────────────── Escrituras ─────────────────────────────

/** Un error de Supabase como fallo de escritura: se loguea y se traduce a un
 *  mensaje claro. Compartido con quote-mutations.ts. */
export function failure(error: DbError, fallback: string): MutationFailure {
  logError('[parrilla] Supabase error', error)
  return {
    ok: false,
    status: error.code === '23514' ? 400 : 500,
    error: describeDbError(error, fallback),
  }
}

async function removeCover(sb: SupabaseClient, url: string): Promise<void> {
  const path = storagePathFromUrl(url)
  if (!path) return

  const { error } = await sb.storage.from(BUCKET).remove([path])
  // No fatal: la publicación ya quedó guardada (o borrada); un archivo huérfano
  // no rompe nada y no vale la pena revertir la escritura por esto.
  if (error) logError('[parrilla] Storage cleanup error', error)
}

/** Crea la publicación con todos sus campos normalizados. */
export async function createPost(
  sb: SupabaseClient,
  input: ParrillaPostInput,
  userId: string
): Promise<{ ok: true; id: string } | MutationFailure> {
  const fields = normalizeFields({
    title: input.title,
    copy_text: input.copy_text ?? null,
    caption: input.caption ?? null,
    platforms: input.platforms,
    production_date: input.production_date,
    publish_date: input.publish_date ?? null,
    status: input.status ?? 'idea',
    format: input.format ?? null,
    cover_image_url: input.cover_image_url ?? null,
    talent: input.talent ?? null,
    inspiration_url: input.inspiration_url ?? null,
    hidden_sections: input.hidden_sections,
    filmmaker_ids: input.filmmaker_ids,
    editor_ids: input.editor_ids,
    category: input.category ?? null,
  })

  const row: Record<string, unknown> = { ...fields, created_by: userId }

  // `quote_id` (la frase de la que nace la pieza) viaja SOLO cuando existe: una
  // alta normal no debe depender de la migración 20260920. Con el código
  // desplegado antes que el SQL, enviar la columna —aunque fuera null— haría
  // fallar TODAS las altas de publicaciones.
  let result = await sb
    .from('parrilla_posts')
    .insert(input.quote_id ? { ...row, quote_id: input.quote_id } : row)
    .select('id')
    .single()

  // 23503: la frase se borró mientras se llenaba el formulario. La pieza se crea
  // igual, sin el vínculo: no se pierde el trabajo de la persona.
  if (result.error?.code === '23503' && input.quote_id) {
    result = await sb.from('parrilla_posts').insert(row).select('id').single()
  }

  const { data, error } = result
  if (error) return failure(error, 'No se pudo crear la publicación')
  return { ok: true, id: data.id }
}

/** Aplica un parche (solo los campos que cambiaron). Si llega `expected`, el
 *  parche solo se aplica si nadie guardó desde que la persona abrió la pieza.
 *  El UPDATE lleva el token que se acaba de leer, así que entre la lectura y la
 *  escritura tampoco se pisa a nadie: Postgres re-evalúa el WHERE si otra
 *  transacción tocó la fila. */
export async function applyPostUpdate(
  sb: SupabaseClient,
  id: string,
  patch: PostPatch,
  options: { expected?: string; fallback?: string } = {}
): Promise<MutationResult> {
  const fallback = options.fallback ?? 'No se pudo actualizar la publicación'
  if (!isUuid(id)) return NOT_FOUND

  const { data, error: readError } = await sb
    .from('parrilla_posts')
    .select(GUARD_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (readError) return failure(readError, fallback)
  if (!data) return NOT_FOUND
  const current = data as unknown as GuardRow

  const plan = planPostUpdate(current, patch, options.expected)
  if (!plan.ok) return plan
  if (Object.keys(plan.update).length === 0) return { ok: true }

  const { data: updated, error } = await sb
    .from('parrilla_posts')
    .update(plan.update)
    .eq('id', id)
    .eq('updated_at', current.updated_at)
    .select('id')
    .maybeSingle()
  if (error) return failure(error, fallback)
  // Sin fila: alguien guardó (o borró) entre la lectura y la escritura. Se
  // responde como conflicto; si la pieza ya no existe, el reintento lo dirá.
  if (!updated) return CONFLICT

  // La portada reemplazada o quitada ya no la usa nadie.
  const cover = plan.update.cover_image_url
  if (cover !== undefined && current.cover_image_url && cover !== current.cover_image_url) {
    await removeCover(sb, current.cover_image_url)
  }

  return { ok: true }
}

/** Borra la publicación y su portada. Una sola llamada: devuelve la fila
 *  borrada, así que ni hay una lectura previa que pueda quedar vieja ni se
 *  responde "éxito" cuando no había nada que borrar. */
export async function deletePost(sb: SupabaseClient, id: string): Promise<MutationResult> {
  if (!isUuid(id)) return NOT_FOUND

  const { data, error } = await sb
    .from('parrilla_posts')
    .delete()
    .eq('id', id)
    .select('cover_image_url')
    .maybeSingle()
  if (error) return failure(error, 'No se pudo eliminar la publicación')
  if (!data) return NOT_FOUND

  if (data.cover_image_url) await removeCover(sb, data.cover_image_url)
  return { ok: true }
}
