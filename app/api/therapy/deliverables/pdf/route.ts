import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { deliverableSessionSchema } from '@/lib/validations/therapy'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'
import {
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
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: deliverable } = await supabase
    .from('therapy_deliverables')
    .select(
      'problema_recordatorio, resumen_audio, recomendaciones_incomodas'
    )
    .eq('session_id', session_id)
    .single()

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
  })

  try {
    const pdfUrl = await uploadDeliverablePdf({ sessionId: session_id, content })
    await supabase
      .from('therapy_deliverables')
      .update({ pdf_url: pdfUrl })
      .eq('session_id', session_id)

    return NextResponse.json({ pdf_url: pdfUrl })
  } catch (err) {
    console.error('[deliverables/pdf]', err)
    return NextResponse.json(
      { error: 'No se pudo generar el PDF' },
      { status: 500 }
    )
  }
}
