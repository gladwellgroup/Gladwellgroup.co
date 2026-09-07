import { z } from 'zod'
import { MODULES, type ModuleKey } from '@/lib/permissions/modules'

// Derivado de MODULES (no una lista aparte a mano) para que un módulo nuevo
// registrado ahí quede automáticamente aceptado acá — de lo contrario, un
// checkbox nuevo en /super/usuarios pasaría la UI pero la API lo rechazaría.
const moduleKeySchema = z.enum(
  Object.values(MODULES) as [ModuleKey, ...ModuleKey[]]
)

// Texto libre y opcional: el "cargo" que la persona ejecuta dentro de la
// comunidad Gladwell (ej. Terapeuta, Mentor de Educación) — distinto del
// `role` técnico (community_admin/community_member), que decide permisos.
const cargoSchema = z.string().trim().max(80, 'Máximo 80 caracteres').optional()

// El rol es lo primero que decide el super_admin en el formulario — de eso
// depende si el resto pide módulos (community_admin) o no (community_member).
export const createUserSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('community_admin'),
    nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
    correo: z.string().trim().toLowerCase().email('Correo inválido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    cargo: cargoSchema,
    granted_modules: z.array(moduleKeySchema).default([]),
  }),
  z.object({
    role: z.literal('community_member'),
    nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
    correo: z.string().trim().toLowerCase().email('Correo inválido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    cargo: cargoSchema,
  }),
])

// `cargo` y `granted_modules` se validan y aplican por separado en la API
// (el segundo solo tiene sentido para community_admin) — ambos opcionales
// porque el diálogo de edición puede mandar solo uno de los dos.
export const updateUserSchema = z.object({
  cargo: cargoSchema.nullable(),
  granted_modules: z.array(moduleKeySchema).optional(),
})

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
