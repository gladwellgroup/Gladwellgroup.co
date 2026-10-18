import { z } from 'zod'

/** Compartido entre la importación CSV de Terapia y de Education — mismo
 *  formato de fila, solo cambia a qué tabla se inserta en cada ruta. */
export const attendeeRowSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  correo: z.string().trim().email('Correo inválido'),
  empresa: z.string().trim().optional(),
})

/** Lo que envía quien escanea el QR: formulario público, sin login. Con tope de
 *  largo: el enlace puede estar proyectado o compartido (una charla es abierta a
 *  la comunidad), y sin tope cualquiera podía guardar un nombre de megabytes.
 *  254 es el máximo de una dirección de correo (RFC 5321). */
export const attendanceFormSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'El nombre es demasiado largo'),
  correo: z.string().trim().email('Correo inválido').max(254, 'Correo inválido'),
})

export const importAttendeesSchema = z.object({
  session_id: z.string().uuid(),
  attendees: z.array(attendeeRowSchema).min(1, 'No hay asistentes para importar'),
})

export type AttendeeRowInput = z.infer<typeof attendeeRowSchema>
