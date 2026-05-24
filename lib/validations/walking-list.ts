import { z } from 'zod'

export const walkingListSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  apellidos: z.string().trim().min(2, 'Los apellidos deben tener al menos 2 caracteres'),
  correo: z.string().trim().toLowerCase().email('Ingresa un correo electrónico válido'),
  red_social: z.enum(['linkedin', 'instagram'], {
    errorMap: () => ({ message: 'Selecciona una red social' }),
  }),
  perfil: z.string().trim().optional(),
})

export type WalkingListInput = z.infer<typeof walkingListSchema>
