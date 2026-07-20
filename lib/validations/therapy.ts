import { z } from 'zod'

export const therapySessionSchema = z.object({
  title: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres'),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  moderator_id: z.string().uuid('Selecciona un moderador válido'),
  invitado_id: z.string().uuid('Selecciona o crea un invitado'),
  pillar: z.string().optional(),
})

export const invitadoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  descripcion: z.string().trim().optional(),
  red_social: z.string().trim().optional(),
  pagina_web: z.string().trim().optional(),
})

export const patchInvitadoSchema = invitadoSchema.partial()

export const cofounderSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  whatsapp: z.string().trim().optional(),
  correo: z.string().trim().email('Correo inválido').optional().or(z.literal('')),
  orden: z.number().int().min(0).default(0),
})

export const therapyInputsSchema = z.object({
  session_id: z.string().uuid(),
  reto_problema: z.string().optional(),
  recomendaciones_incomodas: z.string().optional(),
  foto_sesion_url: z.string().url().optional().or(z.literal('')),
  frase_texto: z.string().optional(),
  frase_autor: z.string().optional(),
  cofounders: z.array(cofounderSchema).optional(),
})

export const uploadFileSchema = z.object({
  session_id: z.string().uuid(),
  type: z.enum(['audio', 'foto']),
})

export const audioMetaSchema = z.object({
  session_id: z.string().uuid(),
  audio_url: z.string().url(),
  autor_nombre: z.string().trim().optional(),
  duracion_segundos: z.number().int().min(0).optional(),
})

export const generateDeliverableSchema = z.object({
  session_id: z.string().uuid(),
})

export const deliverableSessionSchema = z.object({
  session_id: z.string().uuid(),
})

export const patchDeliverableSchema = z.object({
  session_id: z.string().uuid(),
  problema_recordatorio: z.string().optional(),
  resumen_audio: z.string().optional(),
  recomendaciones_incomodas: z.string().optional(),
})

export type TherapySessionInput = z.infer<typeof therapySessionSchema>
export type TherapyInputsPayload = z.infer<typeof therapyInputsSchema>
export type CofounderInput = z.infer<typeof cofounderSchema>
export type UploadFilePayload = z.infer<typeof uploadFileSchema>
export type AudioMetaPayload = z.infer<typeof audioMetaSchema>
export type PatchDeliverablePayload = z.infer<typeof patchDeliverableSchema>
export type InvitadoInput = z.infer<typeof invitadoSchema>
