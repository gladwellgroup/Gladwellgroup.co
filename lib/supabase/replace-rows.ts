import type { SupabaseClient } from '@supabase/supabase-js'
import { must } from '@/lib/supabase/must'

export type ReplaceRowsResult = { ok: true } | { ok: false; step: 'insert' | 'delete' }

/** Reemplaza TODAS las filas hijas de una sesión (los co-fundadores de Terapia, las herramientas de Education) con la
 *  lista que llega del formulario, SIN dejar nunca la lista vacía:
 *
 *   1. lee los ids actuales,
 *   2. inserta las filas nuevas,
 *   3. borra solo los ids de antes.
 *
 *  Antes borraba todo y luego insertaba: si el insert fallaba la sesión se quedaba sin co-fundadores (y el error del
 *  borrado ni siquiera se devolvía). Ahora, si falla el insert, lo anterior sigue intacto; si falla el borrado quedan
 *  las dos listas juntas, a la vista, y el siguiente guardado la repara (borra todo lo de antes y deja la lista nueva). */
export async function replaceSessionRows(
  supabase: SupabaseClient,
  table: 'therapy_session_cofounders' | 'education_tools',
  sessionId: string,
  rows: Array<Record<string, unknown>>
): Promise<ReplaceRowsResult> {
  const previous = must(
    await supabase.from(table).select('id').eq('session_id', sessionId),
    table
  )

  if (rows.length > 0) {
    const { error } = await supabase.from(table).insert(rows)
    if (error) {
      console.error(`[${table}] No se pudieron insertar las filas nuevas: ${error.code ?? ''} ${error.message}`.trim())
      return { ok: false, step: 'insert' }
    }
  }

  const oldIds = (previous ?? []).map((row: { id: string }) => row.id)
  if (oldIds.length > 0) {
    const { error } = await supabase.from(table).delete().in('id', oldIds)
    if (error) {
      console.error(`[${table}] No se pudieron borrar las filas anteriores: ${error.code ?? ''} ${error.message}`.trim())
      return { ok: false, step: 'delete' }
    }
  }

  return { ok: true }
}
