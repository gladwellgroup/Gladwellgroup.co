import { z } from 'zod'
import { CHARLA_TITLE_MAX, CHARLA_TITLE_MIN } from '@/lib/charlas/types'

/** Fecha de calendario real (`YYYY-MM-DD`). El patrón solo no alcanza:
 *  `2026-02-31` lo cumple y Postgres lo rechaza al insertar, que llegaba al
 *  usuario como un «No se pudo crear» genérico. */
export function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  // `Date` se traga los desbordes (31 de febrero → 3 de marzo) y trata los años
  // 0–99 como 1900–1999: si algún campo no vuelve igual, la fecha no existe.
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

const title = z
  .string()
  .trim()
  .min(CHARLA_TITLE_MIN, `El nombre debe tener al menos ${CHARLA_TITLE_MIN} caracteres`)
  .max(CHARLA_TITLE_MAX, `El nombre no puede pasar de ${CHARLA_TITLE_MAX} caracteres`)

const sessionDate = z.string().refine(isRealDate, 'Fecha inválida')

// Solo http(s): la foto termina en un <img src> de la página pública del QR.
const photoUrl = z
  .string()
  .url('La foto no es válida')
  .refine((value) => /^https?:\/\//i.test(value), 'La foto no es válida')

export const charlaCreateSchema = z.object({
  title,
  session_date: sessionDate,
})

/** Parcial: cada campo se guarda por separado (el nombre y la fecha con su botón,
 *  la foto al subirla o quitarla). `photo_url: null` quita la foto. */
export const charlaUpdateSchema = z
  .object({
    title: title.optional(),
    session_date: sessionDate.optional(),
    photo_url: photoUrl.nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'No hay nada que guardar',
  })

export type CharlaCreateInput = z.infer<typeof charlaCreateSchema>
export type CharlaUpdateInput = z.infer<typeof charlaUpdateSchema>
