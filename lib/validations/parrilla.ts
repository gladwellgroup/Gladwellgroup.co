import { z } from 'zod'
import {
  PARRILLA_CATEGORIES,
  PARRILLA_FORMATS,
  PARRILLA_STATUSES,
  PLATFORMS,
} from '@/lib/parrilla/posts'
import { datesInOrder, isRealDateOnly } from '@/lib/parrilla/rules'

// Los 4 enums se derivan de las constantes de la UI, para que ninguna lista se
// desfase de lo que el modal ofrece (el CHECK de SQL sí se mantiene a mano: una
// prueba compara ambas listas). El mensaje en español es para quien tenga la
// página abierta con una versión anterior: el modal muestra este texto tal cual.
const enumEs = <T extends readonly [string, ...string[]]>(values: T, mensaje: string) =>
  z.enum(values, { message: `${mensaje}. Recarga la página e inténtalo de nuevo.` })

export const parrillaPlatformSchema = enumEs(PLATFORMS, 'Plataforma no válida')
export const parrillaStatusValueSchema = enumEs(PARRILLA_STATUSES, 'Estado no válido')
export const parrillaCategorySchema = enumEs(PARRILLA_CATEGORIES, 'Categoría no válida')
export const parrillaFormatSchema = enumEs(PARRILLA_FORMATS, 'Formato no válido')

// '' y solo-espacios se guardan como NULL: un único valor para "vacío". undefined
// se conserva, para que un PATCH no toque el campo.
const optionalText = z
  .string()
  .nullish()
  .transform((value) => (value == null ? value : value.trim() || null))

const coverImageUrlSchema = optionalText.pipe(
  z.string().url('La imagen de portada no es válida').nullish()
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
  publish_date: dateOnlySchema,
  status: parrillaStatusValueSchema.optional(),
  // `null` = "Sin definir"/"Sin categoría": limpia el valor guardado. Omitirlo
  // (undefined) deja la columna como estaba en un PATCH.
  format: parrillaFormatSchema.nullish(),
  cover_image_url: coverImageUrlSchema,
  talent: optionalText,
  filmmaker_ids: z.array(z.string().uuid('Identificador no válido')),
  editor_ids: z.array(z.string().uuid('Identificador no válido')),
  category: parrillaCategorySchema.nullish(),
}

// Publicar el mismo día que se produce es lo normal; antes, no. Va en un
// superRefine (siempre al final: ZodEffects ya no admite .partial ni .extend) y
// corre aunque otro campo haya fallado, así que no da por buenas las fechas.
function checkDateOrder(
  data: { production_date?: string; publish_date?: string },
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

/** Crear: la pieza completa. */
export const parrillaPostSchema = z
  .object({
    ...parrillaPostShape,
    filmmaker_ids: parrillaPostShape.filmmaker_ids.default([]),
    editor_ids: parrillaPostShape.editor_ids.default([]),
  })
  .superRefine(checkDateOrder)

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

export type ParrillaPostInput = z.infer<typeof parrillaPostSchema>
export type ParrillaPostPatchInput = z.infer<typeof parrillaPostPatchSchema>
export type ParrillaDateField = z.infer<typeof parrillaDateFieldSchema>
