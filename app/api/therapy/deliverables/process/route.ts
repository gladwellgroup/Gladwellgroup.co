import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { deliverableSessionSchema } from '@/lib/validations/therapy'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'
import { synthesizeDeliverable } from '@/lib/therapy/synthesize'
import {
  rebuildHtmlFromFields,
  toDeliverableContent,
  uploadDeliverablePdf,
} from '@/lib/therapy/deliverable-render'

export const maxDuration = 800
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
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  if (access.session.status === 'entregado') {
    return NextResponse.json(
      { error: 'El entregable ya fue enviado' },
      { status: 403 }
    )
  }

  const [inputsRes, audiosRes, sessionRes] = await Promise.all([
    supabase
      .from('therapy_session_inputs')
      .select(
        'reto_problema, recomendaciones_incomodas, foto_sesion_url, frase_texto, frase_autor'
      )
      .eq('session_id', session_id)
      .single(),
    supabase
      .from('therapy_session_audios')
      .select('audio_url')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
      .limit(1),
    supabase
      .from('therapy_sessions')
      .select('invitados ( nombre, descripcion )')
      .eq('id', session_id)
      .single(),
  ])

  const inputs = inputsRes.data
  if (!inputs) {
    return NextResponse.json(
      { error: 'Faltan inputs de la sesión' },
      { status: 400 }
    )
  }

  const audioUrl = audiosRes.data?.[0]?.audio_url ?? null
  const reto = inputs.reto_problema?.trim() ?? ''
  const recomendaciones = inputs.recomendaciones_incomodas?.trim() ?? ''
  // supabase-js tipa la relación invitados como array; en runtime es un
  // objeto|null (FK hacia adelante). Cliente <any>.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invitado = (sessionRes.data as any)?.invitados
  const empresaNombre = invitado?.nombre ?? null
  const empresaDescripcion = invitado?.descripcion ?? null

  const synthesis = await synthesizeDeliverable({
    sessionTitle: access.session.title,
    retoProblema: reto,
    recomendacionesIncomodas: recomendaciones,
    empresaNombre,
    empresaDescripcion,
    audioUrl,
  })

  const hadHardFailure =
    Boolean(synthesis.warning) && !synthesis.resumen_audio.trim()
  const processingStatus = hadHardFailure ? 'error' : 'listo'

  const content = toDeliverableContent({
    sessionTitle: access.session.title,
    sessionDate: access.session.session_date,
    problemaRecordatorio: synthesis.problema_recordatorio,
    resumenAudio: synthesis.resumen_audio,
    recomendacionesIncomodas: synthesis.recomendaciones_incomodas,
    fotoSesionUrl: inputs.foto_sesion_url,
    audioUrl,
    invitadoNombre: empresaNombre,
    fraseTexto: inputs.frase_texto,
    fraseAutor: inputs.frase_autor,
  })

  const contentHtml = rebuildHtmlFromFields({
    sessionTitle: access.session.title,
    sessionDate: access.session.session_date,
    problemaRecordatorio: synthesis.problema_recordatorio,
    resumenAudio: synthesis.resumen_audio,
    recomendacionesIncomodas: synthesis.recomendaciones_incomodas,
    fotoSesionUrl: inputs.foto_sesion_url,
    audioUrl,
    invitadoNombre: empresaNombre,
    fraseTexto: inputs.frase_texto,
    fraseAutor: inputs.frase_autor,
  })

  let pdfUrl: string | null = null
  try {
    pdfUrl = await uploadDeliverablePdf({ sessionId: session_id, content })
  } catch (err) {
    console.error('[deliverables/process] PDF error:', err)
  }

  const { error: updateError } = await supabase
    .from('therapy_deliverables')
    .update({
      problema_recordatorio: synthesis.problema_recordatorio,
      resumen_audio: synthesis.resumen_audio,
      recomendaciones_incomodas: synthesis.recomendaciones_incomodas,
      content_html: contentHtml,
      pdf_url: pdfUrl,
      processing_status: processingStatus,
      generated_by: user.id,
      generated_at: new Date().toISOString(),
    })
    .eq('session_id', session_id)

  if (updateError) {
    console.error('[deliverables/process] update error:', updateError)
    return NextResponse.json(
      { error: 'No se pudo guardar el entregable' },
      { status: 500 }
    )
  }

  await supabase
    .from('therapy_sessions')
    .update({ status: 'generado' })
    .eq('id', session_id)

  return NextResponse.json({
    processing_status: processingStatus,
    warning: synthesis.warning ?? null,
    pdf_url: pdfUrl,
  })
}
