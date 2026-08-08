import { z } from 'zod'

/** Compartido entre la importación CSV de Terapia y de Education — mismo
 *  formato de fila, solo cambia a qué tabla se inserta en cada ruta. */
export const attendeeRowSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  correo: z.string().trim().email('Correo inválido'),
  empresa: z.string().trim().optional(),
})

export const importAttendeesSchema = z.object({
  session_id: z.string().uuid(),
  attendees: z.array(attendeeRowSchema).min(1, 'No hay asistentes para importar'),
})

export type AttendeeRowInput = z.infer<typeof attendeeRowSchema>
