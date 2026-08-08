import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { educationSessionRefSchema } from '@/lib/validations/education'
import { resolveEducationAccess } from '@/lib/education/session-access'
import { loadEducationContentSource } from '@/lib/education/content'
import { rebuildEducationHtml } from '@/lib/education/deliverable-render'
import { sendPersonalizedBatch, type BatchRecipient } from '@/lib/deliverables/send-batch'

// Envía en lotes de 100 con pausas entre lotes: mismo presupuesto que la
// ruta de aprobación, no los 60s de una ruta de un solo correo.
export const maxDuration = 300
export const runtime = 'nodejs'

/** Reintenta el correo a los asistentes que quedaron en 'pendiente'/'error'.
 *  Existe aparte de /approve porque una vez la sesión pasa a 'entregado'
 *  aquella queda bloqueada — y el registro tardío es el caso esperado, no la
 *  excepción: el link de asistencia vive 24h justamente para quien se le
 *  olvidó firmar en la sesión. Reutiliza el pdf_url ya subido: no genera un
 *  PDF nuevo ni toca el estado de la sesión. */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const parsed = educationSessionRefSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { session_id } = parsed.data
  const supabase = getSupabaseServer()
  const access = await resolveEducationAccess(supabase, user, session_id)

  if (!access.allowed || !access.session) {
    return NextResponse.json(
      { error: access.error ?? 'Sin permisos' },
      { status: access.statusCode ?? 403 }
    )
  }

  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!resendKey || !fromEmail) {
    return NextResponse.json(
      { error: 'Configura RESEND_API_KEY y RESEND_FROM_EMAIL para enviar el correo' },
      { status: 503 }
    )
  }

  const source = await loadEducationContentSource(supabase, access.session)

  // Sin PDF subido el entregable nunca se envió: este endpoint solo reintenta,
  // no hace el primer envío (ese es /approve, que además genera el PDF).
  if (!source.pdfUrl) {
    return NextResponse.json(
      { error: 'Este entregable todavía no se ha enviado' },
      { status: 409 }
    )
  }

  const { data: pending } = await supabase
    .from('education_attendees')
    .select('id, nombre, correo')
    .eq('session_id', session_id)
    .neq('email_status', 'enviado')
    .order('created_at', { ascending: true })

  const attendees = (pending ?? []) as BatchRecipient[]

  if (attendees.length === 0) {
    return NextResponse.json(
      { error: 'No hay asistentes pendientes por reenviar' },
      { status: 400 }
    )
  }

  const resend = new Resend(resendKey)
  const { sent, failed } = await sendPersonalizedBatch({
    supabase,
    tableName: 'education_attendees',
    resend,
    fromEmail,
    subject: `Gladwell Education — ${access.session.title}`,
    recipients: attendees,
    buildHtml: (attendee) =>
      rebuildEducationHtml({ ...source, attendeeNombre: attendee.nombre }),
  })

  return NextResponse.json({ ok: true, sent, failed: failed.length })
}
