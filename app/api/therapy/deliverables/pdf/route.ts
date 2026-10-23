import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/auth/api'
import { deliverableSessionSchema } from '@/lib/validations/therapy'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'
import {
  toDeliverableContent,
  uploadDeliverablePdf,
} from '@/lib/therapy/deliverable-render'
import { withApiErrors } from '@/lib/api/with-errors'
import { must } from '@/lib/supabase/must'
import { logError } from '@/lib/log'

export const maxDuration = 60
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

  const deliverable = must(
    await supabase
      .from('therapy_deliverables')
      .select(
        'problema_recordatorio, resumen_audio, recomendaciones_incomodas'
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
  const inputs = must(inputsRes, 'therapy_session_inputs')
  const audios = must(audiosRes, 'therapy_session_audios')

  const content = toDeliverableContent({
    sessionId: session_id,
    sessionTitle: access.session.title,
    sessionDate: access.session.session_date,
    problemaRecordatorio: deliverable.problema_recordatorio ?? '',
    resumenAudio: deliverable.resumen_audio ?? '',
    recomendacionesIncomodas: deliverable.recomendaciones_incomodas ?? '',
    fotoSesionUrl: inputs?.foto_sesion_url,
    audioUrl: audios?.[0]?.audio_url,
    invitadoNombre: access.session.invitadoNombre,
    fraseTexto: inputs?.frase_texto,
    fraseAutor: inputs?.frase_autor,
  })

  try {
    const pdfUrl = await uploadDeliverablePdf({ sessionId: session_id, content })
    await supabase
      .from('therapy_deliverables')
      .update({ pdf_url: pdfUrl })
      .eq('session_id', session_id)

    return NextResponse.json({ pdf_url: pdfUrl })
  } catch (err) {
    logError('[deliverables/pdf]', err)
    return NextResponse.json(
      { error: 'No se pudo generar el PDF' },
      { status: 500 }
    )
  }
})
