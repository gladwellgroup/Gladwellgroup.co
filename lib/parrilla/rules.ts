// Reglas de negocio de la parrilla en un solo lugar, puras y sin I/O: las usan
// el formulario (qué campos mostrar y qué cambió), el servidor (qué guardar) y
// el dashboard (a quién le toca cada pieza). Antes la regla de visibilidad
// vivía solo en el diálogo, así que el servidor y el dashboard no la conocían.
//
// Sin imports de runtime a propósito (solo tipos): el cliente las incluye en su
// bundle y las pruebas las cargan sin resolver nada del resto de la app.

import type {
  ParrillaCategory,
  ParrillaFormat,
  ParrillaPost,
  ParrillaSection,
  ParrillaStatus,
} from '@/lib/parrilla/posts'

/** Columnas que el usuario puede cambiar desde el modal. Un test la compara
 *  con el schema de validación, para que una columna nueva no se quede fuera
 *  del diff y no se guarde sin que nadie lo note. */
export const EDITABLE_KEYS = [
  'title',
  'copy_text',
  'caption',
  'platforms',
  'production_date',
  'publish_date',
  'status',
  'format',
  'cover_image_url',
  'talent',
  'inspiration_url',
  'hidden_sections',
  'filmmaker_ids',
  'editor_ids',
  'category',
] as const

export type EditableKey = (typeof EDITABLE_KEYS)[number]
export type EditableFields = Omit<ParrillaPost, 'id' | 'updated_at'>
export type PostPatch = Partial<EditableFields>

/** Lo único que otra pantalla puede prellenar al CREAR una pieza (hoy, la
 *  biblioteca de frases): título y copy. Estrecho a propósito: así nadie prellena
 *  fechas ni estado y rompe «archivada ⇒ sin fecha de publicación», y la categoría se
 *  elige siempre al construir la publicación. */
export type PostDraft = Partial<Pick<EditableFields, 'title' | 'caption'>>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isUuid = (value: string): boolean => UUID_RE.test(value)

/** El enlace de inspiración: http(s) y sin espacios. Es la MISMA regla que el schema de
 *  validación (lib/validations/parrilla.ts) y el CHECK de SQL
 *  (`parrilla_posts_inspiration_url_check`, 20260917): `.url()` solo no basta, acepta
 *  `javascript:alert(1)`. tests/drift.test.ts compara esta con la de SQL. */
export const INSPIRATION_URL_RE = /^https?:\/\/\S+$/i

/** Si un enlace guardado se puede dibujar como un `<a href>`. El CHECK ya impide guardar
 *  otra cosa; esto evita que un valor extraño llegue nunca a un `href`. */
export const isHttpUrl = (value: string | null | undefined): value is string =>
  value != null && INSPIRATION_URL_RE.test(value)

// ───────────────────────── Qué campos aplican ─────────────────────────

/** Responsable en cámara solo aplica a video (nadie "sale en cámara" en un
 *  carrusel de texto). */
export const showsTalent = (format: ParrillaFormat | null): boolean => format === 'video'

/** Inspiración (el enlace a la referencia) solo aplica a video: es de donde
 *  parte la grabación y la edición. Es una regla aparte de `showsTalent` aunque
 *  hoy coincidan: son campos distintos y pueden separarse. */
export const showsInspiration = (format: ParrillaFormat | null): boolean => format === 'video'

/** Filmmaker solo hace falta cuando hay algo que capturar en bruto: siempre en
 *  video, y en imagen/carrusel únicamente si son fotos de evento (categorías
 *  roots y comunidad) — los carruseles de crecer/conectar/construir/aprender
 *  son diseño puro, sin captura previa. */
export function showsFilmmaker(
  format: ParrillaFormat | null,
  category: ParrillaCategory | null
): boolean {
  return (
    format === 'video' ||
    ((format === 'imagen' || format === 'carrusel') &&
      (category === 'roots' || category === 'comunidad'))
  )
}

/** Una pieza archivada no tiene fecha de publicación: archivar la borra, y sin
 *  fecha una pieza solo puede estar archivada (lo exige también el CHECK de
 *  SQL). Aquí y no en posts.ts: este módulo no importa nada en runtime. */
export const isArchived = (status: ParrillaStatus): boolean => status === 'archivado'

/** '' y solo-espacios son lo mismo que «sin valor»: un único NULL para vacío.
 *  También lo usan las frases (lib/parrilla/quotes.ts). */
export const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** Si la sección tiene algo guardado. Ocultar una sección no borra su
 *  contenido, así que el modal lo avisa en la cabecera («con contenido») para que
 *  no quede un dato que nadie ve. Un texto en blanco cuenta como vacío. */
export function sectionHasContent(
  fields: Pick<EditableFields, 'inspiration_url' | 'copy_text' | 'caption' | 'cover_image_url'>,
  section: ParrillaSection
): boolean {
  const value = {
    inspiracion: fields.inspiration_url,
    guion: fields.copy_text,
    copy: fields.caption,
    portada: fields.cover_image_url,
  }[section]
  return blankToNull(value) !== null
}

/** Estado listo para guardar: un solo valor para "vacío" (NULL), sin
 *  asignaciones de campos que la combinación formato/categoría oculta — si no,
 *  quedan datos que la pantalla ya no muestra pero el dashboard sí cuenta — y
 *  sin fecha de publicación si la pieza está archivada. */
export function normalizeFields(fields: EditableFields): EditableFields {
  return {
    ...fields,
    title: fields.title.trim(),
    publish_date: isArchived(fields.status) ? null : fields.publish_date,
    copy_text: blankToNull(fields.copy_text),
    caption: blankToNull(fields.caption),
    cover_image_url: blankToNull(fields.cover_image_url),
    talent: showsTalent(fields.format) ? blankToNull(fields.talent) : null,
    inspiration_url: showsInspiration(fields.format) ? blankToNull(fields.inspiration_url) : null,
    filmmaker_ids: showsFilmmaker(fields.format, fields.category) ? fields.filmmaker_ids : [],
  }
}

/** Si la pieza le toca a esta persona. Un filmmaker asignado cuando el campo
 *  está oculto (dato viejo) no cuenta: la cola de trabajo del dashboard solo
 *  refleja asignaciones que la pantalla de edición todavía muestra. */
export function isAssignedTo(
  post: Pick<ParrillaPost, 'format' | 'category' | 'filmmaker_ids' | 'editor_ids'>,
  userId: string
): boolean {
  return (
    post.editor_ids.includes(userId) ||
    (showsFilmmaker(post.format, post.category) && post.filmmaker_ids.includes(userId))
  )
}

// ───────────────────────────── Fechas ─────────────────────────────

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** Fecha de calendario real en formato YYYY-MM-DD. Aritmética a propósito, sin
 *  `Date`: `parseDateOnly` normaliza el 30 de febrero al 2 de marzo y
 *  `Date.UTC` toma los años menores de 100 como 19xx. */
export function isRealDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1) return false

  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  const daysInMonth = month === 2 && leap ? 29 : DAYS_IN_MONTH[month - 1]
  return day <= daysInMonth
}

/** Publicar el mismo día que se produce es lo normal; antes, no. Las fechas
 *  ISO se ordenan igual como texto que como fechas. Sin fecha de publicación
 *  (pieza archivada) no hay orden que romper. */
export const datesInOrder = (production: string, publish: string | null): boolean =>
  publish === null || publish >= production

// ───────────────── Qué cambió y cómo fusionar con lo último ─────────────────

const SET_KEYS: ReadonlySet<EditableKey> = new Set([
  'platforms',
  'filmmaker_ids',
  'editor_ids',
  'hidden_sections',
])

/** Valor comparable: el orden de una lista no es un cambio, y '' o solo
 *  espacios es lo mismo que null. Sin esto, alternar una plataforma dejaría
 *  "sucio" un campo que en realidad quedó igual. */
function comparable(key: EditableKey, value: unknown): string | null {
  if (SET_KEYS.has(key)) return [...new Set(value as string[])].sort().join('|')
  if (typeof value === 'string') return value.trim() === '' ? null : value.trim()
  return (value ?? null) as string | null
}

function sameField(key: EditableKey, a: EditableFields, b: EditableFields): boolean {
  return comparable(key, a[key]) === comparable(key, b[key])
}

function copyField<K extends EditableKey>(to: EditableFields, from: EditableFields, key: K): void {
  to[key] = from[key]
}

/** Solo lo que la persona cambió respecto a la foto de partida. Mandar solo
 *  eso es lo que evita pisar lo que otra persona guardó en otros campos. */
export function diffPost(base: EditableFields, mine: EditableFields): PostPatch {
  const patch: Partial<EditableFields> = {}
  for (const key of EDITABLE_KEYS) {
    if (!sameField(key, base, mine)) copyField(patch as EditableFields, mine, key)
  }
  return patch
}

/** Mezcla de tres vías entre la foto de partida (`base`), lo que la persona
 *  tiene en el formulario (`mine`) y lo último guardado (`latest`). Un campo
 *  que no tocó adopta siempre lo último; uno que tocó conserva su valor. Hay
 *  conflicto solo si ADEMÁS otra persona lo cambió a un valor distinto. */
export function mergeLatest(
  base: EditableFields,
  mine: EditableFields,
  latest: EditableFields
): { merged: EditableFields; conflicts: EditableKey[] } {
  const merged: EditableFields = { ...latest }
  const conflicts: EditableKey[] = []

  for (const key of EDITABLE_KEYS) {
    if (sameField(key, base, mine)) continue

    copyField(merged, mine, key)
    if (!sameField(key, base, latest) && !sameField(key, mine, latest)) conflicts.push(key)
  }

  return { merged, conflicts }
}
