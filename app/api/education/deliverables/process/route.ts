import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { educationSessionRefSchema } from '@/lib/validations/education'
import { resolveEducationAccess } from '@/lib/education/session-access'
import { synthesizeEducation } from '@/lib/education/synthesize'
import { loadEducationContentSource } from '@/lib/education/content'
import {
  rebuildEducationHtml,
  toEducationContent,
  uploadEducationPdf,
} from '@/lib/education/deliverable-render'

export const maxDuration = 300
export const runtime = 'nodejs'

/** Un 'procesando' más viejo que esto se considera muerto y se puede retomar.
 *  Por encima de maxDuration, así que nunca pisa a un proceso vivo. */
const STALE_PROCESSING_MS = 6 * 60 * 1000

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
      { error: 'El entregable ya fue enviado' },
      { status: 403 }
    )
  }

  // Claim atómico: solo gana quien encuentre el entregable en 'generando'.
  // Sin esto, dos pestañas abiertas disparan dos transcripciones y dos
  // llamadas al modelo sobre la misma sesión, pisándose entre sí.
  //
  // También se retoma un 'procesando' viejo: si la función murió a mitad de
  // camino (timeout, deploy), el registro quedaría atascado para siempre y el
  // botón de reintentar no podría hacer nada.
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString()

  const { data: claimed } = await supabase
    .from('education_deliverables')
    .update({ processing_status: 'procesando' })
    .eq('session_id', session_id)
    .or(
      `processing_status.eq.generando,and(processing_status.eq.procesando,generated_at.lt.${staleBefore})`
    )
    .select('id')

  if (!claimed || claimed.length === 0) {
    return NextResponse.json(
      { error: 'La síntesis de este entregable ya está en curso' },
      { status: 409 }
    )
  }

  const { data: inputs } = await supabase
    .from('education_session_inputs')
    .select(
      'ponente_nombre, ponente_rol, objetivo, notas_moderador, transcripcion_texto, audio_url, capsulas_emprendimiento'
    )
    .eq('session_id', session_id)
    .single()

  if (!inputs) {
    await supabase
      .from('education_deliverables')
      .update({ processing_status: 'error' })
      .eq('session_id', session_id)

    return NextResponse.json(
      { error: 'Faltan los datos de la sesión' },
      { status: 400 }
    )
  }

  const synthesis = await synthesizeEducation({
    sessionTitle: access.session.title,
    objetivo: inputs.objetivo ?? '',
    notasModerador: inputs.notas_moderador ?? '',
    ponenteNombre: inputs.ponente_nombre,
    ponenteRol: inputs.ponente_rol,
    transcripcionTexto: inputs.transcripcion_texto,
    audioUrl: inputs.audio_url,
    capsulas: inputs.capsulas_emprendimiento ?? '',
  })

  // Sin conclusiones no hay entregable útil: se marca error para que el editor
  // ofrezca reintentar en vez de dejar una página vacía como "lista".
  const hadHardFailure =
    Boolean(synthesis.warning) && !synthesis.conclusiones_clave.trim()
  const processingStatus = hadHardFailure ? 'error' : 'listo'

  const source = await loadEducationContentSource(supabase, access.session, {
    conclusionesClave: synthesis.conclusiones_clave,
    capsulas: synthesis.capsulas,
  })

  let pdfUrl: string | null = null
  try {
    pdfUrl = await uploadEducationPdf({
      sessionId: session_id,
      content: toEducationContent(source),
    })
  } catch (err) {
    console.error('[education/process] PDF error:', err)
  }

  // El enlace al PDF va dentro del HTML, así que se reconstruye ya con la URL.
  const contentHtml = rebuildEducationHtml({ ...source, pdfUrl })

  const { error: updateError } = await supabase
    .from('education_deliverables')
    .update({
      conclusiones_clave: synthesis.conclusiones_clave,
      capsulas: synthesis.capsulas,
      content_html: contentHtml,
      pdf_url: pdfUrl,
      processing_status: processingStatus,
      generated_by: user.id,
      generated_at: new Date().toISOString(),
    })
    .eq('session_id', session_id)

  if (updateError) {
    console.error('[education/process] update error:', updateError)
    return NextResponse.json(
      { error: 'No se pudo guardar el entregable' },
      { status: 500 }
    )
  }

  await supabase
    .from('education_sessions')
    .update({ status: 'generado' })
    .eq('id', session_id)

  return NextResponse.json({
    processing_status: processingStatus,
    warning: synthesis.warning ?? null,
    pdf_url: pdfUrl,
  })
}
