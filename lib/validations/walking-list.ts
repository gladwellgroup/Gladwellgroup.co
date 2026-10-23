import { z } from 'zod'
import { getPhoneCodeByIso, isValidAmericasPhoneIso } from '@/lib/data/americas-phone-codes'
import { buildWhatsappE164, normalizePhoneDigits } from '@/lib/phone'

// Topes de longitud: el endpoint es PÚBLICO y guarda lo que llegue; sin ellos, una sola petición podía meter megabytes en
// cada campo de la tabla de leads (que luego se pinta entera en el CRM).
const walkingListBaseSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(80, 'El nombre es demasiado largo'),
  apellidos: z
    .string()
    .trim()
    .min(2, 'Los apellidos deben tener al menos 2 caracteres')
    .max(80, 'Los apellidos son demasiado largos'),
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, 'El correo es demasiado largo')
    .email('Ingresa un correo electrónico válido'),
  whatsapp_pais: z.string().length(2, 'Selecciona un país válido'),
  whatsapp_numero: z
    .string()
    .trim()
    .transform(normalizePhoneDigits)
    .pipe(z.string().regex(/^\d{9,15}$/, 'Ingresa un número de WhatsApp válido')),
  red_social: z.enum(['linkedin', 'instagram'], {
    errorMap: () => ({ message: 'Selecciona una red social' }),
  }),
  perfil: z
    .string()
    .trim()
    .min(1, 'Ingresa tu usuario o enlace de red social')
    .max(200, 'El usuario o enlace es demasiado largo'),
})

export const walkingListSchema = walkingListBaseSchema
  .superRefine((data, ctx) => {
    if (!isValidAmericasPhoneIso(data.whatsapp_pais)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Selecciona un país válido',
        path: ['whatsapp_pais'],
      })
    }

    const perfil = data.perfil.toLowerCase()
    if (data.red_social === 'linkedin' && !perfil.includes('linkedin.com')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Ingresa la URL completa de tu perfil de LinkedIn (ej. linkedin.com/in/tuperfil)',
        path: ['perfil'],
      })
    }
    if (
      data.red_social === 'instagram' &&
      !data.perfil.startsWith('@') &&
      !perfil.includes('instagram.com')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Ingresa tu usuario de Instagram (@usuario) o la URL de tu perfil',
        path: ['perfil'],
      })
    }
  })
  .transform((data) => {
    const country = getPhoneCodeByIso(data.whatsapp_pais)!
    const whatsapp_indicativo = country.dialCode
    const whatsapp_e164 = buildWhatsappE164(whatsapp_indicativo, data.whatsapp_numero)
    return {
      ...data,
      whatsapp_indicativo,
      whatsapp_e164,
    }
  })

export type WalkingListInput = z.input<typeof walkingListBaseSchema>
export type WalkingListPayload = z.output<typeof walkingListSchema>
