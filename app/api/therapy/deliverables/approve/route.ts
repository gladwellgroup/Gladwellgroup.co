import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/auth/api'
import { archivedSessionError } from '@/lib/deliverables/archived'
import { deliverableSessionSchema } from '@/lib/validations/therapy'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'
import {
  rebuildHtmlFromFields,
  toDeliverableContent,
  uploadDeliverablePdf,
} from '@/lib/therapy/deliverable-render'
import { buildDeliverableHtmlFor } from '@/lib/therapy/deliverable-template'
import { sendPersonalizedBatch, type BatchRecipient } from '@/lib/deliverables/send-batch'
import { SEND_IN_PROGRESS_MESSAGE, idempotencyKey, isDuplicateSend } from '@/lib/deliverables/idempotency'
import { withApiErrors } from '@/lib/api/with-errors'
import { must } from '@/lib/supabase/must'
import { logError } from '@/lib/log'

// 300s (máximo del plan Hobby, ver commit 3beb363) y no 60: además del PDF y
// del correo grupal, esta ruta ahora envía un correo personalizado por cada
// asistente QR en lotes de 100 con pausas entre lotes, igual que la ruta
// equivalente de Education.
export const maxDuration = 300
export const runtime = 'nodejs'

export const POST = withApiErrors(async (request: NextRequest) => {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { user } = auth

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
      { error: 'Solo el moderador o un super administrador pueden dar el visto bueno' },
      { status: 403 }
    )
  }

  const archived = archivedSessionError(access.session.status)
  if (archived) {
    return NextResponse.json({ error: archived }, { status: 409 })
  }

  if (access.session.status === 'entregado') {
    return NextResponse.json(
      { error: 'Este entregable ya fue enviado' },
      { status: 409 }
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

  const deliverable = must(
    await supabase
      .from('therapy_deliverables')
      .select(
        'problema_recordatorio, resumen_audio, recomendaciones_incomodas, processing_status'
      )
      .eq('session_id', session_id)
      .single(),
    'therapy_deliverables'
  )

  if (!deliverable) {
    return NextResponse.json(
      { error: 'Entregable no encontrado' },
      { status: 404 }
    )
  }

  if (deliverable.processing_status === 'generando') {
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

  const [inputsRes, audiosRes, cofoundersRes] = await Promise.all([
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
    supabase
      .from('therapy_session_cofounders')
      .select('nombre, correo')
      .eq('session_id', session_id),
  ])
  const inputs = must(inputsRes, 'therapy_session_inputs')
  const audios = must(audiosRes, 'therapy_session_audios')
  const cofounders = must(cofoundersRes, 'therapy_session_cofounders')

  const emails = (cofounders ?? [])
    .map((c) => c.correo?.trim())
    .filter((e): e is string => Boolean(e && e.includes('@')))

  if (emails.length === 0) {
    return NextResponse.json(
      {
        error:
          'Ningún fundador tiene correo. Agrega al menos un correo válido antes de enviar.',
      },
      { status: 400 }
    )
  }

  const problema = deliverable.problema_recordatorio ?? ''
  const resumen = deliverable.resumen_audio ?? ''
  const recomendaciones = deliverable.recomendaciones_incomodas ?? ''
  const foto = inputs?.foto_sesion_url
  const audioUrl = audios?.[0]?.audio_url
  const fraseTexto = inputs?.frase_texto
  const fraseAutor = inputs?.frase_autor

  const contentHtml = rebuildHtmlFromFields({
    sessionId: session_id,
    sessionTitle: access.session.title,
    sessionDate: access.session.session_date,
    problemaRecordatorio: problema,
    resumenAudio: resumen,
    recomendacionesIncomodas: recomendaciones,
    fotoSesionUrl: foto,
    audioUrl,
    invitadoNombre: access.session.invitadoNombre,
    fraseTexto,
    fraseAutor,
  })

  const content = toDeliverableContent({
    sessionId: session_id,
    sessionTitle: access.session.title,
    sessionDate: access.session.session_date,
    problemaRecordatorio: problema,
    resumenAudio: resumen,
    recomendacionesIncomodas: recomendaciones,
    fotoSesionUrl: foto,
    audioUrl,
    invitadoNombre: access.session.invitadoNombre,
    fraseTexto,
    fraseAutor,
  })

  let pdfUrl: string
  try {
    pdfUrl = await uploadDeliverablePdf({ sessionId: session_id, content })
  } catch (err) {
    logError('[deliverables/approve] PDF error', err)
    return NextResponse.json(
      { error: 'No se pudo generar el PDF final' },
      { status: 500 }
    )
  }

  await supabase
    .from('therapy_deliverables')
    .update({
      content_html: contentHtml,
      pdf_url: pdfUrl,
      processing_status: 'listo',
    })
    .eq('session_id', session_id)

  const resend = new Resend(resendKey)
  const groupMail = {
    from: fromEmail,
    to: emails,
    subject: `Entregable Gladwell — ${access.session.title}`,
    html: contentHtml,
  }
  const { error: mailError } = await resend.emails.send(groupMail, {
    // Dos peticiones idénticas (doble toque, otra pestaña) comparten clave y Resend envía el correo UNA vez.
    idempotencyKey: idempotencyKey('approve-therapy', session_id, JSON.stringify(groupMail)),
  })

  if (mailError && isDuplicateSend(mailError)) {
    return NextResponse.json({ error: SEND_IN_PROGRESS_MESSAGE }, { status: 409 })
  }

  if (mailError) {
    logError('[deliverables/approve] Resend error', mailError)
    return NextResponse.json(
      {
        error:
          mailError.message ||
          'No se pudo enviar el correo. El entregable no se marcó como enviado.',
      },
      { status: 502 }
    )
  }

  // `in` en vez de pisar a ciegas: una sesión archivada desde Supabase no
  // vuelve sola al ciclo de vida por haberle enviado el entregable.
  await supabase
    .from('therapy_sessions')
    .update({ status: 'entregado' })
    .eq('id', session_id)
    .in('status', ['borrador', 'generado'])

  // Envío adicional, personalizado por persona, a quienes se registraron por
  // QR — separado del correo grupal de arriba, que no cambia. Es best-effort:
  // un fallo puntual queda reflejado en email_status/email_error de esa fila
  // sin bloquear ni revertir el correo grupal, que ya se envió.
  const qrAttendees = must(
    await supabase
      .from('therapy_session_attendees')
      .select('id, nombre, correo')
      .eq('session_id', session_id)
      .neq('email_status', 'enviado')
      .order('created_at', { ascending: true }),
    'therapy_session_attendees'
  )

  let qrSent = 0
  let qrFailed = 0

  if (qrAttendees && qrAttendees.length > 0) {
    const attendeeContent = { ...content, pdfUrl }
    const result = await sendPersonalizedBatch({
      supabase,
      tableName: 'therapy_session_attendees',
      resend,
      fromEmail,
      subject: `Entregable Gladwell — ${access.session.title}`,
      recipients: qrAttendees as BatchRecipient[],
      idempotencyScope: session_id,
      buildHtml: (attendee) => buildDeliverableHtmlFor(attendeeContent, attendee.nombre),
    })
    qrSent = result.sent
    qrFailed = result.failed.length
  }

  return NextResponse.json({
    ok: true,
    pdf_url: pdfUrl,
    recipients: emails.length,
    qr_sent: qrSent,
    qr_failed: qrFailed,
  })
})
