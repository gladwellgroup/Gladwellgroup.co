import { z } from 'zod'

export const parrillaPlatformSchema = z.enum(['instagram', 'linkedin', 'youtube'])
export const parrillaStatusValueSchema = z.enum([
  'idea',
  'en_produccion',
  'agendado',
  'publicado',
  'cancelado',
])
export const parrillaCategorySchema = z.enum(['valor', 'prospeccion', 'viral', 'comunidad'])
export const parrillaFormatSchema = z.enum(['carrusel', 'imagen', 'video'])

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

export const parrillaPostSchema = z.object({
  title: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres'),
  copy_text: z.string().trim().optional(),
  platforms: z.array(parrillaPlatformSchema).min(1, 'Selecciona al menos una plataforma'),
  production_date: dateOnlySchema,
  publish_date: dateOnlySchema,
  status: parrillaStatusValueSchema.optional(),
  format: parrillaFormatSchema.optional(),
  cover_image_url: z.string().url().optional().or(z.literal('')),
  talent: z.string().trim().optional(),
  filmmaker_ids: z.array(z.string().uuid()).default([]),
  editor_ids: z.array(z.string().uuid()).default([]),
  category: parrillaCategorySchema.optional(),
})

export const parrillaStatusSchema = z.object({
  status: parrillaStatusValueSchema,
})

// Para el arrastre en el calendario: mueve solo UNA de las dos fechas, la de
// la vista activa — no toca el resto del post.
export const parrillaDateFieldSchema = z.enum(['production_date', 'publish_date'])
export const parrillaRescheduleSchema = z.object({
  field: parrillaDateFieldSchema,
  date: dateOnlySchema,
})

export type ParrillaPostInput = z.infer<typeof parrillaPostSchema>
export type ParrillaDateField = z.infer<typeof parrillaDateFieldSchema>
