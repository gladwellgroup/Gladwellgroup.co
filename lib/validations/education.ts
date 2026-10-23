import { z } from 'zod'
import { isProjectStorageUrl } from '@/lib/storage/hosts'
import { normalizeHttpUrl } from '@/lib/url'

/** Una URL de un archivo del Storage de ESTE proyecto (fotos y audio que sube el propio portal). El servidor las
 *  descarga: aceptarlas de cualquier host dejaba que se le pidiera una dirección interna o un archivo enorme. */
const storageUrl = z
  .string()
  .url()
  .refine((value) => isProjectStorageUrl(value), 'La URL debe ser un archivo subido al portal')

export const educationSessionSchema = z.object({
  title: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres'),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  admin_id: z.string().uuid('Selecciona un administrador responsable válido'),
})

export const educationToolSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre de la herramienta es obligatorio'),
  descripcion: z.string().trim().optional(),
  // Solo enlaces http(s): un `javascript:` llegaba tal cual a un `<a href>` del correo y de la vista previa.
  url: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || normalizeHttpUrl(value) !== null, 'El enlace de la herramienta debe ser http(s)'),
  orden: z.number().int().min(0).default(0),
})

export const educationInputsSchema = z.object({
  session_id: z.string().uuid(),
  ponente_nombre: z.string().optional(),
  ponente_rol: z.string().optional(),
  ponente_foto_url: storageUrl.optional().or(z.literal('')),
  ponente_red_social: z.string().optional(),
  descripcion_sesion: z.string().optional(),
  objetivo: z.string().optional(),
  notas_moderador: z.string().optional(),
  frase_texto: z.string().optional(),
  frase_autor: z.string().optional(),
  capsulas_emprendimiento: z.string().optional(),
  foto_sesion_url: storageUrl.optional().or(z.literal('')),
  transcripcion_texto: z.string().optional(),
  transcripcion_fuente: z.enum(['texto', 'audio']).optional(),
  audio_url: storageUrl.optional().or(z.literal('')),
  tools: z.array(educationToolSchema).optional(),
})

export const educationSessionRefSchema = z.object({
  session_id: z.string().uuid(),
})

export const patchEducationDeliverableSchema = z.object({
  session_id: z.string().uuid(),
  conclusiones_clave: z.string().optional(),
  capsulas: z.string().optional(),
})

export type EducationSessionInput = z.infer<typeof educationSessionSchema>
export type EducationInputsPayload = z.infer<typeof educationInputsSchema>
export type EducationToolInput = z.infer<typeof educationToolSchema>
export type PatchEducationDeliverablePayload = z.infer<
  typeof patchEducationDeliverableSchema
>
