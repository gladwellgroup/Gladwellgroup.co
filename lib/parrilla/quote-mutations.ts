// Escrituras de la biblioteca de frases. Mismo contrato que mutations.ts: nunca
// lanzan, devuelven `{ ok: true, … }` o un `MutationFailure` con el estado HTTP y
// un mensaje claro, y los errores de Supabase pasan por el mismo `failure`.
//
// A diferencia de las publicaciones, aquí NO hay token de concurrencia ni
// fusión de tres vías: una frase son cuatro campos cortos y el formulario manda
// solo lo que cambió, así que dos personas solo se pisan si editan el MISMO
// campo a la vez (gana la última escritura). Lo que sí se atiende es que otra
// persona haya borrado la frase mientras tanto: 404.

import type { SupabaseClient } from '@supabase/supabase-js'
import { failure, type MutationFailure, type MutationResult } from '@/lib/parrilla/mutations'
import {
  QUOTE_EDITABLE_KEYS,
  normalizeQuoteFields,
  type QuoteFields,
} from '@/lib/parrilla/quotes'
import { isUuid } from '@/lib/parrilla/rules'
import type { ParrillaQuoteInput, ParrillaQuotePatchInput } from '@/lib/validations/parrilla'

const NOT_FOUND = { ok: false, status: 404, error: 'La frase ya no existe' } as const

/** Crea la frase. `created_by` sale siempre de la sesión, nunca del cuerpo. */
export async function createQuote(
  sb: SupabaseClient,
  input: ParrillaQuoteInput,
  userId: string
): Promise<{ ok: true; id: string } | MutationFailure> {
  const fields = normalizeQuoteFields({
    quote_text: input.quote_text,
    author: input.author,
    author_context: input.author_context ?? null,
    source: input.source ?? null,
  })

  const { data, error } = await sb
    .from('parrilla_quotes')
    .insert({ ...fields, created_by: userId })
    .select('id')
    .single()

  if (error) return failure(error, 'No se pudo crear la frase')
  return { ok: true, id: data.id }
}

/** Aplica un parche: solo las claves que llegan. `null` limpia un opcional;
 *  omitir una clave deja la columna como estaba. Sin fila afectada, la frase ya
 *  no existe. */
export async function updateQuote(
  sb: SupabaseClient,
  id: string,
  patch: ParrillaQuotePatchInput
): Promise<MutationResult> {
  if (!isUuid(id)) return NOT_FOUND

  const update: Partial<QuoteFields> = {}
  for (const key of QUOTE_EDITABLE_KEYS) {
    const value = patch[key]
    if (value !== undefined) Object.assign(update, { [key]: value })
  }
  // Sin cambios no hay nada que escribir.
  if (Object.keys(update).length === 0) return { ok: true }

  const { data, error } = await sb
    .from('parrilla_quotes')
    .update(update)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) return failure(error, 'No se pudo actualizar la frase')
  if (!data) return NOT_FOUND
  return { ok: true }
}

/** Borra la frase. Las publicaciones que nacieron de ella se conservan (la FK
 *  `parrilla_posts.quote_id` es ON DELETE SET NULL) y conservan también su
 *  `updated_at`: el trigger ignora ese UPDATE de la FK (20260921), así que sus
 *  ideas no saltan al primer lugar del Banco. Una sola llamada: devuelve la fila
 *  borrada, así que no se responde «éxito» cuando no había nada. */
export async function deleteQuote(sb: SupabaseClient, id: string): Promise<MutationResult> {
  if (!isUuid(id)) return NOT_FOUND

  const { data, error } = await sb
    .from('parrilla_quotes')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) return failure(error, 'No se pudo eliminar la frase')
  if (!data) return NOT_FOUND
  return { ok: true }
}
