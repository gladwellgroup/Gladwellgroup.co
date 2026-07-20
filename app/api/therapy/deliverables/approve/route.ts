import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { deliverableSessionSchema } from '@/lib/validations/therapy'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'
import {
  rebuildHtmlFromFields,
  toDeliverableContent,
  uploadDeliverablePdf,
} from '@/lib/therapy/deliverable-render'

export const maxDuration = 60
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
      'problema_recordatorio, resumen_audio, recomendaciones_incomodas, processing_status'
    )
    .eq('session_id', session_id)
    .single()

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

  const emails = (cofoundersRes.data ?? [])
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
  const foto = inputsRes.data?.foto_sesion_url
  const audioUrl = audiosRes.data?.[0]?.audio_url
  const fraseTexto = inputsRes.data?.frase_texto
  const fraseAutor = inputsRes.data?.frase_autor

  const contentHtml = rebuildHtmlFromFields({
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
    console.error('[deliverables/approve] PDF error:', err)
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
  const { error: mailError } = await resend.emails.send({
    from: fromEmail,
    to: emails,
    subject: `Entregable Gladwell — ${access.session.title}`,
    html: contentHtml,
  })

  if (mailError) {
    console.error('[deliverables/approve] Resend error:', mailError)
    return NextResponse.json(
      {
        error:
          mailError.message ||
          'No se pudo enviar el correo. El entregable no se marcó como enviado.',
      },
      { status: 502 }
    )
  }

  await supabase
    .from('therapy_sessions')
    .update({ status: 'entregado' })
    .eq('id', session_id)

  return NextResponse.json({
    ok: true,
    pdf_url: pdfUrl,
    recipients: emails.length,
  })
}
