import type { SupabaseClient } from '@supabase/supabase-js'
import { STALE_PROCESSING_MS } from '@/lib/deliverables/processing'
import { must } from '@/lib/supabase/must'

export type DeliverableTable = 'therapy_deliverables' | 'education_deliverables'

/** Filtro de PostgREST de «la síntesis NO está viva»: no está en un estado de trabajo, o no tiene fecha de inicio, o
 *  empezó hace más de `STALE_PROCESSING_MS`. Es la negación exacta de `isWorking`. */
function notWorkingFilter(staleBefore: string): string {
  return `processing_status.not.in.(generando,procesando),generated_at.is.null,generated_at.lt.${staleBefore}`
}

/** Claim atómico del trabajo de síntesis: solo gana quien encuentre el entregable en 'generando' o en un 'procesando'
 *  vencido. Sin esto, cada apertura del editor (o dos pestañas) relanzaba la transcripción y la llamada al modelo sobre
 *  la misma sesión, pisándose entre sí. También retoma un 'procesando' viejo: si la función murió a mitad de camino
 *  (timeout, despliegue) el registro quedaría atascado para siempre.
 *
 *  Devuelve `true` si ESTE proceso es ahora el dueño de la síntesis. */
export async function claimProcessing(
  supabase: SupabaseClient,
  table: DeliverableTable,
  sessionId: string,
  now: number = Date.now()
): Promise<boolean> {
  const staleBefore = new Date(now - STALE_PROCESSING_MS).toISOString()
  // `generated_at` se renueva con el claim: la vida de la síntesis se mide desde que ESTE proceso empezó. Sin eso, un
  // «procesando» retomado seguía pareciendo muerto (conservaba la fecha del intento anterior) y el editor insistía
  // en ofrecer «Reintentar» mientras la nueva síntesis corría.
  const claimed = must(
    await supabase
      .from(table)
      .update({ processing_status: 'procesando', generated_at: new Date(now).toISOString() })
      .eq('session_id', sessionId)
      .or(
        `processing_status.eq.generando,and(processing_status.eq.procesando,or(generated_at.is.null,generated_at.lt.${staleBefore}))`
      )
      .select('id'),
    table
  )
  return (claimed?.length ?? 0) > 0
}

export type StartGenerationResult =
  | { status: 'started'; id: string }
  /** Ya hay una síntesis viva: no se pisa. */
  | { status: 'busy' }
  /** No se pudo escribir (la base falló): el llamador responde con su propio mensaje. */
  | { status: 'error' }

/** Deja el entregable en 'generando' con `values` (los campos de arranque de cada programa) SIN pisar una síntesis que
 *  sigue viva. Antes los dos `/generate` hacían un upsert incondicional: pulsar «Crear entregable» (o abrirlo desde otra
 *  pestaña) mientras se sintetizaba lo reiniciaba, y en Terapia además borraba el resumen del audio.
 *
 *  - Si ya hay una fila y NO está viva (terminada, con error o muerta), se reinicia con un UPDATE condicional.
 *  - Si no hay fila, se inserta; si otra petición la creó un instante antes (23505), está ocupada. */
export async function startGeneration(
  supabase: SupabaseClient,
  table: DeliverableTable,
  sessionId: string,
  values: Record<string, unknown>,
  now: number = Date.now()
): Promise<StartGenerationResult> {
  const nowIso = new Date(now).toISOString()
  const staleBefore = new Date(now - STALE_PROCESSING_MS).toISOString()
  const fields = { ...values, processing_status: 'generando', generated_at: nowIso }

  const restarted = must(
    await supabase
      .from(table)
      .update(fields)
      .eq('session_id', sessionId)
      .or(notWorkingFilter(staleBefore))
      .select('id'),
    table
  )
  if (restarted && restarted.length > 0) return { status: 'started', id: restarted[0].id as string }

  const existing = must(
    await supabase.from(table).select('id').eq('session_id', sessionId).maybeSingle(),
    table
  )
  if (existing) return { status: 'busy' }

  const { data, error } = await supabase
    .from(table)
    .insert({ session_id: sessionId, ...fields })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return { status: 'busy' }
    console.error(`[${table}] No se pudo iniciar la generación: ${error.code ?? ''} ${error.message}`.trim())
    return { status: 'error' }
  }
  return { status: 'started', id: data.id as string }
}

/** Corre `work` con el claim ya tomado. Si lanza (una lectura que falló, una excepción), deja el entregable en 'error'
 *  y relanza: el editor ofrece «Reintentar» al instante y no a los 6 minutos en que un 'procesando' se da por muerto.
 *  Solo toca la fila si sigue en 'procesando' (si otro proceso ya la retomó, no se la pisa). */
export async function runClaimed<T>(
  supabase: SupabaseClient,
  table: DeliverableTable,
  sessionId: string,
  work: () => Promise<T>
): Promise<T> {
  try {
    return await work()
  } catch (error) {
    await supabase
      .from(table)
      .update({ processing_status: 'error' })
      .eq('session_id', sessionId)
      .eq('processing_status', 'procesando')
    throw error
  }
}
