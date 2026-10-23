import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/auth/api'
import { archivedSessionError } from '@/lib/deliverables/archived'
import { deliverableSessionSchema } from '@/lib/validations/therapy'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'
import { synthesizeDeliverable } from '@/lib/therapy/synthesize'
import {
  rebuildHtmlFromFields,
  toDeliverableContent,
  uploadDeliverablePdf,
} from '@/lib/therapy/deliverable-render'
import { withApiErrors } from '@/lib/api/with-errors'
import { claimProcessing, runClaimed } from '@/lib/deliverables/claim'
import { must } from '@/lib/supabase/must'
import { logError } from '@/lib/log'

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
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const archived = archivedSessionError(access.session.status)
  if (archived) {
    return NextResponse.json({ error: archived }, { status: 409 })
  }

  if (access.session.status === 'entregado') {
    return NextResponse.json(
      { error: 'El entregable ya fue enviado' },
      { status: 409 }
    )
  }

  // Claim atómico (lib/deliverables/claim.ts): antes cada apertura del editor relanzaba la transcripción y la llamada al
  // modelo, y dos pestañas se pisaban. Solo gana quien encuentre el entregable en 'generando' o en un 'procesando'
  // vencido; el resto recibe 409 y se limita a esperar el resultado.
  if (!(await claimProcessing(supabase, 'therapy_deliverables', session_id))) {
    return NextResponse.json(
      { error: 'La síntesis de este entregable ya está en curso' },
      { status: 409 }
    )
  }

  const session = access.session
  return runClaimed(supabase, 'therapy_deliverables', session_id, async () => {
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
    const inputs = must(inputsRes, 'therapy_session_inputs')
    const audios = must(audiosRes, 'therapy_session_audios')
    const sessionRow = must(sessionRes, 'therapy_sessions')

    if (!inputs) {
      // Con el claim ya tomado: se deja en 'error' (el editor ofrece reintentar) y no atascado en 'procesando'.
      await supabase
        .from('therapy_deliverables')
        .update({ processing_status: 'error' })
        .eq('session_id', session_id)

      return NextResponse.json(
        { error: 'Faltan inputs de la sesión' },
        { status: 400 }
      )
    }

    const audioUrl = audios?.[0]?.audio_url ?? null
    const reto = inputs.reto_problema?.trim() ?? ''
    const recomendaciones = inputs.recomendaciones_incomodas?.trim() ?? ''
    // supabase-js tipa la relación invitados como array; en runtime es un
    // objeto|null (FK hacia adelante). Cliente <any>.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invitado = (sessionRow as any)?.invitados
    const empresaNombre = invitado?.nombre ?? null
    const empresaDescripcion = invitado?.descripcion ?? null

    const synthesis = await synthesizeDeliverable({
      sessionTitle: session.title,
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
      sessionId: session_id,
      sessionTitle: session.title,
      sessionDate: session.session_date,
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
      sessionId: session_id,
      sessionTitle: session.title,
      sessionDate: session.session_date,
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
      logError('[deliverables/process] PDF error', err)
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
      logError('[deliverables/process] update error', updateError)
      return NextResponse.json(
        { error: 'No se pudo guardar el entregable' },
        { status: 500 }
      )
    }

    // `in` en vez de pisar a ciegas: una sesión archivada desde Supabase no
    // vuelve sola al ciclo de vida por haberle regenerado el entregable.
    await supabase
      .from('therapy_sessions')
      .update({ status: 'generado' })
      .eq('id', session_id)
      .in('status', ['borrador', 'generado'])

    return NextResponse.json({
      processing_status: processingStatus,
      warning: synthesis.warning ?? null,
      pdf_url: pdfUrl,
    })
  })
})
