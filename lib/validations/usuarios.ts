import { z } from 'zod'

const moduleKeySchema = z.enum([
  'crm',
  'entregables_terapia',
  'entregables_educacion',
  'parrilla',
])

// El rol es lo primero que decide el super_admin en el formulario — de eso
// depende si el resto pide módulos (community_admin) o no (community_member).
export const createUserSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('community_admin'),
    nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
    correo: z.string().trim().toLowerCase().email('Correo inválido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    granted_modules: z.array(moduleKeySchema).default([]),
  }),
  z.object({
    role: z.literal('community_member'),
    nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
    correo: z.string().trim().toLowerCase().email('Correo inválido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  }),
])

export const updateModulesSchema = z.object({
  granted_modules: z.array(moduleKeySchema),
})

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateModulesInput = z.infer<typeof updateModulesSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
