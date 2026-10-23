import type { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import { idempotencyKey, isDuplicateSend } from '@/lib/deliverables/idempotency'

/** Límite de destinatarios por llamada a la API de lotes de Resend. */
const BATCH_SIZE = 100
/** Pausa entre lotes: el rate limit por defecto de Resend es de 2 req/s. */
const BATCH_PAUSE_MS = 600

export interface BatchRecipient {
  id: string
  nombre: string
  correo: string
}

export interface SendBatchResult {
  sent: number
  failed: { id: string; error: string }[]
  /** Destinatarios de lotes que Resend reconoció como YA enviados o en marcha (misma clave de idempotencia): no se
   *  enviaron de nuevo y no se tocó su estado. Distinto de `failed`: ahí el envío no se hizo. */
  skipped: number
  /** Correos que salieron pero cuyo estado (`enviado`) no se pudo anotar en la base. */
  unrecorded: number
}

/** Envía un correo personalizado por destinatario vía resend.batch.send y
 *  deja el resultado (`email_status`/`email_error`/`sent_at`) en `tableName`
 *  por fila — mismas columnas en education_attendees y
 *  therapy_session_attendees, así que un solo helper sirve para ambas.
 *
 *  Cada lote lleva una clave de idempotencia (ver lib/deliverables/idempotency.ts): un doble toque, dos pestañas o un
 *  reintento inmediato mandan el MISMO lote y Resend no lo envía dos veces. Cuando responde que ya está hecho o en
 *  marcha, aquí NO se escribe ningún estado: antes cualquier error de Resend marcaba a todos los destinatarios como
 *  `error`, y el duplicado le pisaba el `enviado` al envío bueno. */
export async function sendPersonalizedBatch({
  supabase,
  tableName,
  resend,
  fromEmail,
  subject,
  recipients,
  buildHtml,
  idempotencyScope,
}: {
  supabase: SupabaseClient
  tableName: string
  resend: Resend
  fromEmail: string
  subject: string
  recipients: BatchRecipient[]
  buildHtml: (recipient: BatchRecipient) => string
  /** Qué se está enviando (normalmente el id de la sesión): parte de la clave de idempotencia. */
  idempotencyScope: string
}): Promise<SendBatchResult> {
  const sentAt = new Date().toISOString()
  let sent = 0
  let skipped = 0
  let unrecorded = 0
  const failed: { id: string; error: string }[] = []

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE)

    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS))
    }

    try {
      const payload = batch.map((recipient) => ({
        from: fromEmail,
        to: [recipient.correo],
        subject,
        html: buildHtml(recipient),
      }))

      const { data, error } = await resend.batch.send(
        payload,
        // 'strict' (el default) descarta el lote entero si un solo correo es
        // inválido; con 'permissive' pasan los válidos y los fallos vienen
        // señalados por índice.
        {
          batchValidation: 'permissive',
          idempotencyKey: idempotencyKey(`batch-${tableName}`, idempotencyScope, JSON.stringify(payload)),
        }
      )

      if (error) {
        if (isDuplicateSend(error)) {
          skipped += batch.length
          continue
        }
        throw new Error(error.message)
      }

      const errorsByIndex = new Map(
        (data?.errors ?? []).map((e) => [e.index, e.message])
      )

      const writes = await Promise.all(
        batch.map((recipient, index) => {
          const failure = errorsByIndex.get(index)
          if (failure) failed.push({ id: recipient.id, error: failure })
          else sent += 1

          return supabase
            .from(tableName)
            .update(
              failure
                ? { email_status: 'error', email_error: failure }
                : { email_status: 'enviado', email_error: null, sent_at: sentAt }
            )
            .eq('id', recipient.id)
        })
      )
      const lost = writes.filter((write) => write.error).length
      if (lost > 0) {
        unrecorded += lost
        console.error(`[send-batch] No se pudo anotar el estado de ${lost} correo(s) en ${tableName}`)
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido al enviar'

      await Promise.all(
        batch.map((recipient) => {
          failed.push({ id: recipient.id, error: message })
          return supabase
            .from(tableName)
            .update({ email_status: 'error', email_error: message })
            .eq('id', recipient.id)
        })
      )
    }
  }

  return { sent, failed, skipped, unrecorded }
}
