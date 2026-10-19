import { z } from 'zod'
import {
  PARRILLA_CATEGORIES,
  PARRILLA_FORMATS,
  PARRILLA_SECTIONS,
  PARRILLA_STATUSES,
  PLATFORMS,
} from '@/lib/parrilla/posts'
import {
  QUOTE_AUTHOR_MAX,
  QUOTE_AUTHOR_MIN,
  QUOTE_CONTEXT_MAX,
  QUOTE_SOURCE_MAX,
  QUOTE_TEXT_MAX,
  QUOTE_TEXT_MIN,
  charLength,
  stripOuterQuotes,
} from '@/lib/parrilla/quotes'
import { datesInOrder, isRealDateOnly } from '@/lib/parrilla/rules'

// Los enums se derivan de las constantes de la UI, para que ninguna lista se
// desfase de lo que el modal ofrece (el CHECK de SQL sí se mantiene a mano: una
// prueba compara ambas listas). El mensaje en español es para quien tenga la
// página abierta con una versión anterior: el modal muestra este texto tal cual.
const enumEs = <T extends readonly [string, ...string[]]>(values: T, mensaje: string) =>
  z.enum(values, { message: `${mensaje}. Recarga la página e inténtalo de nuevo.` })

export const parrillaPlatformSchema = enumEs(PLATFORMS, 'Plataforma no válida')
export const parrillaStatusValueSchema = enumEs(PARRILLA_STATUSES, 'Estado no válido')
export const parrillaCategorySchema = enumEs(PARRILLA_CATEGORIES, 'Categoría no válida')
export const parrillaFormatSchema = enumEs(PARRILLA_FORMATS, 'Formato no válido')
export const parrillaSectionSchema = enumEs(PARRILLA_SECTIONS, 'Sección no válida')

// '' y solo-espacios se guardan como NULL: un único valor para "vacío". undefined
// se conserva, para que un PATCH no toque el campo.
const optionalText = z
  .string()
  .nullish()
  .transform((value) => (value == null ? value : value.trim() || null))

const coverImageUrlSchema = optionalText.pipe(
  z.string().url('La imagen de portada no es válida').nullish()
)

// Inspiración: un enlace que el modal convierte en un <a href>. `.url()` solo
// no basta —acepta `javascript:alert(1)`—, así que se exige http(s) sin
// espacios, igual que el CHECK de SQL (parrilla_posts_inspiration_url_check): si
// una de las dos reglas cambia, la otra también.
const INSPIRATION_URL_MESSAGE = 'El enlace de inspiración no es válido'
const inspirationUrlSchema = optionalText.pipe(
  z
    .string()
    .max(2048, INSPIRATION_URL_MESSAGE)
    .url(INSPIRATION_URL_MESSAGE)
    .regex(/^https?:\/\/\S+$/i, INSPIRATION_URL_MESSAGE)
    .nullish()
)

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
  .refine(isRealDateOnly, 'Fecha inválida')

// Todas las columnas editables, sin defaults a propósito: `.partial()` anula los
// `.default()` de zod (un PATCH sin listas las vaciaría), así que el POST los
// agrega explícitamente y el PATCH no. Un test compara estas claves con
// EDITABLE_KEYS (lib/parrilla/rules.ts).
export const parrillaPostShape = {
  title: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres'),
  // Guion — el nombre de la columna es histórico; el copy publicado es `caption`.
  copy_text: optionalText,
  caption: optionalText,
  platforms: z.array(parrillaPlatformSchema).min(1, 'Selecciona al menos una plataforma'),
  production_date: dateOnlySchema,
  // `null` solo llega de una pieza archivada (archivar borra la fecha); que
  // falte en una pieza que no lo está lo revisan el POST (abajo) y el PATCH
  // (planPostUpdate, que conoce el estado guardado).
  publish_date: dateOnlySchema.nullish(),
  status: parrillaStatusValueSchema.optional(),
  // `null` = "Sin definir"/"Sin categoría": limpia el valor guardado. Omitirlo
  // (undefined) deja la columna como estaba en un PATCH.
  format: parrillaFormatSchema.nullish(),
  cover_image_url: coverImageUrlSchema,
  talent: optionalText,
  inspiration_url: inspirationUrlSchema,
  // Secciones del modal que el equipo ocultó (el ojo). Solo esconden el campo.
  hidden_sections: z.array(parrillaSectionSchema),
  filmmaker_ids: z.array(z.string().uuid('Identificador no válido')),
  editor_ids: z.array(z.string().uuid('Identificador no válido')),
  category: parrillaCategorySchema.nullish(),
}

// Publicar el mismo día que se produce es lo normal; antes, no. Va en un
// superRefine (siempre al final: ZodEffects ya no admite .partial ni .extend) y
// corre aunque otro campo haya fallado, así que no da por buenas las fechas.
function checkDateOrder(
  data: { production_date?: string; publish_date?: string | null },
  ctx: z.RefinementCtx
) {
  const { production_date: production, publish_date: publish } = data
  if (
    production &&
    publish &&
    isRealDateOnly(production) &&
    isRealDateOnly(publish) &&
    !datesInOrder(production, publish)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['publish_date'],
      message: 'La publicación no puede ser anterior a la producción',
    })
  }
}

// Al crear no hay estado guardado contra el que comparar: sin fecha de
// publicación solo vale una pieza archivada.
function checkPublishDateRequired(
  data: { publish_date?: string | null; status?: string },
  ctx: z.RefinementCtx
) {
  if (!data.publish_date && data.status !== 'archivado') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['publish_date'],
      message: 'Falta la fecha de publicación',
    })
  }
}

/** Crear: la pieza completa. */
export const parrillaPostSchema = z
  .object({
    ...parrillaPostShape,
    hidden_sections: parrillaPostShape.hidden_sections.default([]),
    filmmaker_ids: parrillaPostShape.filmmaker_ids.default([]),
    editor_ids: parrillaPostShape.editor_ids.default([]),
    // La frase de la que nace la pieza («Crear contenido», pestaña Frases). Solo
    // se escribe al crear y nadie la edita después, por eso NO está en
    // `parrillaPostShape` (ni en EDITABLE_KEYS): el PATCH la descarta.
    quote_id: z
      .string({ invalid_type_error: 'Identificador no válido' })
      .uuid('Identificador no válido')
      .nullish(),
  })
  .superRefine(checkDateOrder)
  .superRefine(checkPublishDateRequired)

/** Editar: solo lo que cambió. `expected_updated_at` es el token de
 *  concurrencia tal como llegó del servidor — un texto opaco: con
 *  `.datetime()` se rechazaría el `+00:00`, y pasarlo por `Date` pierde los
 *  microsegundos y daría un conflicto perpetuo. */
export const parrillaPostPatchSchema = z
  .object(parrillaPostShape)
  .partial()
  .extend({ expected_updated_at: z.string().min(1).max(40).optional() })
  .superRefine(checkDateOrder)

// Para el arrastre en el calendario: mueve solo UNA de las dos fechas, la de
// la vista activa — no toca el resto del post.
export const parrillaDateFieldSchema = z.enum(['production_date', 'publish_date'])
export const parrillaRescheduleSchema = z.object({
  field: parrillaDateFieldSchema,
  date: dateOnlySchema,
})

// ───────────────────────── Frases de referentes ─────────────────────────

// Los límites son los del CHECK de SQL (20260920_parrilla_frases.sql): si uno
// cambia, el otro también (tests/drift.test.ts los compara). Se miden con
// `charLength` —puntos de código, como `char_length` de Postgres— y no con
// `.min()/.max()` de zod, que cuentan unidades UTF-16: un emoji fuera del plano
// básico mide 2 allí y 1 en la base, y los extremos dejaban de coincidir.
const quoteText = z
  .string({ required_error: 'Escribe la frase', invalid_type_error: 'La frase no es válida' })
  // Recorta y quita las comillas que envuelven la frase ANTES de medirla: «“ab”» mide 2.
  .transform(stripOuterQuotes)
  .pipe(
    z
      .string()
      .refine(
        (value) => charLength(value) >= QUOTE_TEXT_MIN,
        `La frase debe tener al menos ${QUOTE_TEXT_MIN} caracteres`
      )
      .refine(
        (value) => charLength(value) <= QUOTE_TEXT_MAX,
        `La frase no puede pasar de ${QUOTE_TEXT_MAX} caracteres`
      )
  )

const quoteAuthor = z
  .string({ required_error: 'Escribe el referente', invalid_type_error: 'El referente no es válido' })
  .trim()
  .refine(
    (value) => charLength(value) >= QUOTE_AUTHOR_MIN,
    `El referente debe tener al menos ${QUOTE_AUTHOR_MIN} caracteres`
  )
  .refine(
    (value) => charLength(value) <= QUOTE_AUTHOR_MAX,
    `El referente no puede pasar de ${QUOTE_AUTHOR_MAX} caracteres`
  )

// Todas las columnas editables, sin defaults a propósito (igual que
// `parrillaPostShape`): el PATCH deriva de aquí con `.partial()`. Un test
// compara estas claves con QUOTE_EDITABLE_KEYS (lib/parrilla/quotes.ts).
export const parrillaQuoteShape = {
  quote_text: quoteText,
  author: quoteAuthor,
  author_context: optionalText.pipe(
    z
      .string()
      .refine(
        (value) => charLength(value) <= QUOTE_CONTEXT_MAX,
        `«Quién fue» no puede pasar de ${QUOTE_CONTEXT_MAX} caracteres`
      )
      .nullish()
  ),
  source: optionalText.pipe(
    z
      .string()
      .refine(
        (value) => charLength(value) <= QUOTE_SOURCE_MAX,
        `La fuente no puede pasar de ${QUOTE_SOURCE_MAX} caracteres`
      )
      .nullish()
  ),
  // `null` = «Sin categoría»; omitirlo deja la columna como estaba en un PATCH.
  category: parrillaCategorySchema.nullish(),
}

// Un cuerpo que no es un objeto (`"hola"`, `5`, `null`, `[]`) llegaba a la persona con el
// mensaje en inglés de zod («Expected object, received string»).
const quoteBody = { invalid_type_error: 'Datos inválidos', required_error: 'Datos inválidos' }

/** Crear: la frase completa. */
export const parrillaQuoteSchema = z.object(parrillaQuoteShape, quoteBody)

/** Editar: solo lo que cambió. Un parche vacío no es una edición. */
export const parrillaQuotePatchSchema = z
  .object(parrillaQuoteShape, quoteBody)
  .partial()
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), {
    message: 'No hay nada que guardar',
  })

export type ParrillaPostInput = z.infer<typeof parrillaPostSchema>
export type ParrillaPostPatchInput = z.infer<typeof parrillaPostPatchSchema>
export type ParrillaDateField = z.infer<typeof parrillaDateFieldSchema>
export type ParrillaQuoteInput = z.infer<typeof parrillaQuoteSchema>
export type ParrillaQuotePatchInput = z.infer<typeof parrillaQuotePatchSchema>
