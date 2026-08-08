import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { educationSessionRefSchema } from '@/lib/validations/education'
import { resolveEducationAccess } from '@/lib/education/session-access'
import { loadEducationContentSource } from '@/lib/education/content'
import {
  rebuildEducationHtml,
  toEducationContent,
  uploadEducationPdf,
} from '@/lib/education/deliverable-render'
import { sendPersonalizedBatch, type BatchRecipient } from '@/lib/deliverables/send-batch'

export const maxDuration = 300
export const runtime = 'nodejs'

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

  if (access.session.status === 'entregado') {
    return NextResponse.json(
      { error: 'Este entregable ya fue enviado' },
      { status: 403 }
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

  const { data: deliverable } = await supabase
    .from('education_deliverables')
    .select('processing_status')
    .eq('session_id', session_id)
    .single()

  if (!deliverable) {
    return NextResponse.json(
      { error: 'Entregable no encontrado' },
      { status: 404 }
    )
  }

  if (['generando', 'procesando'].includes(deliverable.processing_status)) {
    return NextResponse.json(
      { error: 'Espera a que termine la síntesis del entregable' },
      { status: 409 }
    )
  }

  if (deliverable.processing_status === 'error') {
    return NextResponse.json(
      {
        error:
          'La síntesis del entregable falló. Regenera el entregable antes de enviarlo.',
      },
      { status: 409 }
    )
  }

  // Solo los que aún no recibieron: reintentar tras un envío parcial no
  // duplica correos a quien ya lo tiene.
  const { data: pending } = await supabase
    .from('education_attendees')
    .select('id, nombre, correo')
    .eq('session_id', session_id)
    .neq('email_status', 'enviado')
    .order('created_at', { ascending: true })

  const attendees = (pending ?? []) as BatchRecipient[]

  if (attendees.length === 0) {
    return NextResponse.json(
      {
        error:
          'No hay asistentes pendientes. Importa la lista de registrados antes de enviar.',
      },
      { status: 400 }
    )
  }

  const source = await loadEducationContentSource(supabase, access.session)

  let pdfUrl: string
  try {
    pdfUrl = await uploadEducationPdf({
      sessionId: session_id,
      content: toEducationContent(source),
    })
  } catch (err) {
    console.error('[education/approve] PDF error:', err)
    return NextResponse.json(
      { error: 'No se pudo generar el PDF final' },
      { status: 500 }
    )
  }

  const withPdf = { ...source, pdfUrl }

  await supabase
    .from('education_deliverables')
    .update({
      content_html: rebuildEducationHtml(withPdf),
      pdf_url: pdfUrl,
      processing_status: 'listo',
    })
    .eq('session_id', session_id)

  const resend = new Resend(resendKey)
  const subject = `Gladwell Education — ${access.session.title}`

  const { sent, failed } = await sendPersonalizedBatch({
    supabase,
    tableName: 'education_attendees',
    resend,
    fromEmail,
    subject,
    recipients: attendees,
    // El saludo es lo único que cambia por destinatario.
    buildHtml: (attendee) =>
      rebuildEducationHtml({ ...withPdf, attendeeNombre: attendee.nombre }),
  })

  if (sent === 0) {
    return NextResponse.json(
      {
        error:
          failed[0]?.error ??
          'No se pudo enviar ningún correo. El entregable no se marcó como enviado.',
      },
      { status: 502 }
    )
  }

  // Solo se cierra la sesión cuando no queda nadie pendiente. Con envíos
  // parciales sigue en 'generado' para poder reintentar con el mismo botón.
  if (failed.length === 0) {
    await supabase
      .from('education_sessions')
      .update({ status: 'entregado' })
      .eq('id', session_id)
  }

  return NextResponse.json({
    ok: true,
    pdf_url: pdfUrl,
    sent,
    failed: failed.length,
    status: failed.length === 0 ? 'entregado' : 'generado',
  })
}
