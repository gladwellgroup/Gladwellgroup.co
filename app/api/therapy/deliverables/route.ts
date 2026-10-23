import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/auth/api'
import { patchDeliverableSchema } from '@/lib/validations/therapy'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'
import { rebuildHtmlFromFields } from '@/lib/therapy/deliverable-render'
import { withApiErrors } from '@/lib/api/with-errors'
import { must } from '@/lib/supabase/must'
import { logError } from '@/lib/log'

export const PATCH = withApiErrors(async (request: NextRequest) => {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const parsed = patchDeliverableSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const {
    session_id,
    problema_recordatorio,
    resumen_audio,
    recomendaciones_incomodas,
  } = parsed.data

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
      { error: 'Solo el moderador o un super administrador pueden editar' },
      { status: 403 }
    )
  }

  const existing = must(
    await supabase
      .from('therapy_deliverables')
      .select(
        'problema_recordatorio, resumen_audio, recomendaciones_incomodas'
      )
      .eq('session_id', session_id)
      .single(),
    'therapy_deliverables'
  )

  if (!existing) {
    return NextResponse.json(
      { error: 'Entregable no encontrado' },
      { status: 404 }
    )
  }

  const nextProblema =
    problema_recordatorio ?? existing.problema_recordatorio ?? ''
  const nextResumen = resumen_audio ?? existing.resumen_audio ?? ''
  const nextRecs =
    recomendaciones_incomodas ?? existing.recomendaciones_incomodas ?? ''

  const [inputsRes, audiosRes] = await Promise.all([
    supabase
      .from('therapy_session_inputs')
      .select('foto_sesion_url')
      .eq('session_id', session_id)
      .single(),
    supabase
      .from('therapy_session_audios')
      .select('audio_url')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
      .limit(1),
  ])
  const inputs = must(inputsRes, 'therapy_session_inputs')
  const audios = must(audiosRes, 'therapy_session_audios')

  const contentHtml = rebuildHtmlFromFields({
    sessionId: session_id,
    sessionTitle: access.session.title,
    sessionDate: access.session.session_date,
    problemaRecordatorio: nextProblema,
    resumenAudio: nextResumen,
    recomendacionesIncomodas: nextRecs,
    fotoSesionUrl: inputs?.foto_sesion_url,
    audioUrl: audios?.[0]?.audio_url,
  })

  const { error } = await supabase
    .from('therapy_deliverables')
    .update({
      problema_recordatorio: nextProblema,
      resumen_audio: nextResumen,
      recomendaciones_incomodas: nextRecs,
      content_html: contentHtml,
    })
    .eq('session_id', session_id)

  if (error) {
    logError('[deliverables PATCH]', error)
    return NextResponse.json(
      { error: 'No se pudo guardar' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, content_html: contentHtml })
})
