import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { deliverableSessionSchema } from '@/lib/validations/therapy'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'
import { toDeliverableContent } from '@/lib/therapy/deliverable-render'
import { buildDeliverableHtmlFor } from '@/lib/therapy/deliverable-template'
import { sendPersonalizedBatch, type BatchRecipient } from '@/lib/deliverables/send-batch'

// Envía en lotes de 100 con pausas entre lotes: mismo presupuesto que la
// ruta de aprobación, no los 60s de una ruta de un solo correo.
export const maxDuration = 300
export const runtime = 'nodejs'

/** Reintenta el correo personalizado a los asistentes QR de Terapia que
 *  quedaron en 'pendiente'/'error'. Existe aparte de /approve porque una vez
 *  el correo grupal a cofundadores se envía, la sesión pasa a 'entregado' y
 *  /approve queda bloqueado — reenviar solo a los QR pendientes necesita una
 *  vía que no toque el correo grupal ni el estado de la sesión. Reutiliza el
 *  pdf_url ya subido: no genera un PDF nuevo. */
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

  const parsed = deliverableSessionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { session_id } = parsed.data
  const supabase = getSupabaseServer()
  const access = await resolveDeliverableAccess(supabase, user, session_id)

  if (!access.allowed || !access.session) {
    return NextResponse.json(
      { error: access.error ?? 'Sin permisos' },
      { status: access.statusCode ?? 403 }
    )
  }

  if (!access.isModeratorOrSuper) {
    return NextResponse.json(
      { error: 'Solo el moderador o un super administrador pueden reenviar' },
      { status: 403 }
    )
  }

  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!resendKey || !fromEmail) {
    return NextResponse.json(
      {
        error:
          'Configura RESEND_API_KEY y RESEND_FROM_EMAIL para enviar el correo',
      },
      { status: 503 }
    )
  }

  const { data: deliverable } = await supabase
    .from('therapy_deliverables')
    .select(
      'problema_recordatorio, resumen_audio, recomendaciones_incomodas, pdf_url'
    )
    .eq('session_id', session_id)
    .single()

  if (!deliverable || !deliverable.pdf_url) {
    return NextResponse.json(
      { error: 'Este entregable todavía no se ha enviado' },
      { status: 409 }
    )
  }

  const { data: qrAttendees } = await supabase
    .from('therapy_session_attendees')
    .select('id, nombre, correo')
    .eq('session_id', session_id)
    .neq('email_status', 'enviado')
    .order('created_at', { ascending: true })

  const attendees = (qrAttendees ?? []) as BatchRecipient[]

  if (attendees.length === 0) {
    return NextResponse.json(
      { error: 'No hay asistentes pendientes por reenviar' },
      { status: 400 }
    )
  }

  const [inputsRes, audiosRes] = await Promise.all([
    supabase
      .from('therapy_session_inputs')
      .select('foto_sesion_url, frase_texto, frase_autor')
      .eq('session_id', session_id)
      .single(),
    supabase
      .from('therapy_session_audios')
      .select('audio_url')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
      .limit(1),
  ])

  const content = toDeliverableContent({
    sessionId: session_id,
    sessionTitle: access.session.title,
    sessionDate: access.session.session_date,
    problemaRecordatorio: deliverable.problema_recordatorio ?? '',
    resumenAudio: deliverable.resumen_audio ?? '',
    recomendacionesIncomodas: deliverable.recomendaciones_incomodas ?? '',
    fotoSesionUrl: inputsRes.data?.foto_sesion_url,
    audioUrl: audiosRes.data?.[0]?.audio_url,
    invitadoNombre: access.session.invitadoNombre,
    fraseTexto: inputsRes.data?.frase_texto,
    fraseAutor: inputsRes.data?.frase_autor,
    pdfUrl: deliverable.pdf_url,
  })

  const resend = new Resend(resendKey)
  const { sent, failed } = await sendPersonalizedBatch({
    supabase,
    tableName: 'therapy_session_attendees',
    resend,
    fromEmail,
    subject: `Entregable Gladwell — ${access.session.title}`,
    recipients: attendees,
    buildHtml: (attendee) => buildDeliverableHtmlFor(content, attendee.nombre),
  })

  return NextResponse.json({ ok: true, sent, failed: failed.length })
}
