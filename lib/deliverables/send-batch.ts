import type { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'

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
}

/** Envía un correo personalizado por destinatario vía resend.batch.send y
 *  deja el resultado (`email_status`/`email_error`/`sent_at`) en `tableName`
 *  por fila — mismas columnas en education_attendees y
 *  therapy_session_attendees, así que un solo helper sirve para ambas. */
export async function sendPersonalizedBatch({
  supabase,
  tableName,
  resend,
  fromEmail,
  subject,
  recipients,
  buildHtml,
}: {
  supabase: SupabaseClient
  tableName: string
  resend: Resend
  fromEmail: string
  subject: string
  recipients: BatchRecipient[]
  buildHtml: (recipient: BatchRecipient) => string
}): Promise<SendBatchResult> {
  const sentAt = new Date().toISOString()
  let sent = 0
  const failed: { id: string; error: string }[] = []

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE)

    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS))
    }

    try {
      const { data, error } = await resend.batch.send(
        batch.map((recipient) => ({
          from: fromEmail,
          to: [recipient.correo],
          subject,
          html: buildHtml(recipient),
        })),
        // 'strict' (el default) descarta el lote entero si un solo correo es
        // inválido; con 'permissive' pasan los válidos y los fallos vienen
        // señalados por índice.
        { batchValidation: 'permissive' }
      )

      if (error) throw new Error(error.message)

      const errorsByIndex = new Map(
        (data?.errors ?? []).map((e) => [e.index, e.message])
      )

      await Promise.all(
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

  return { sent, failed }
}
