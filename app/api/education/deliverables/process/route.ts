import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/auth/api'
import { archivedSessionError } from '@/lib/deliverables/archived'
import { educationSessionRefSchema } from '@/lib/validations/education'
import { resolveEducationAccess } from '@/lib/education/session-access'
import { synthesizeEducation } from '@/lib/education/synthesize'
import { loadEducationContentSource } from '@/lib/education/content'
import {
  rebuildEducationHtml,
  toEducationContent,
  uploadEducationPdf,
} from '@/lib/education/deliverable-render'
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

  // Claim atómico (lib/deliverables/claim.ts): solo gana quien encuentre el entregable en 'generando' o en un
  // 'procesando' vencido.
  if (!(await claimProcessing(supabase, 'education_deliverables', session_id))) {
    return NextResponse.json(
      { error: 'La síntesis de este entregable ya está en curso' },
      { status: 409 }
    )
  }

  const session = access.session
  return runClaimed(supabase, 'education_deliverables', session_id, async () => {
    const inputs = must(
      await supabase
        .from('education_session_inputs')
        .select(
          'ponente_nombre, ponente_rol, objetivo, notas_moderador, transcripcion_texto, audio_url, capsulas_emprendimiento'
        )
        .eq('session_id', session_id)
        .single(),
      'education_session_inputs'
    )

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
      sessionTitle: session.title,
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

    const source = await loadEducationContentSource(supabase, session, {
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
      logError('[education/process] PDF error', err)
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
      logError('[education/process] update error', updateError)
      return NextResponse.json(
        { error: 'No se pudo guardar el entregable' },
        { status: 500 }
      )
    }

    // `in` en vez de pisar a ciegas: una sesión archivada desde Supabase no
    // vuelve sola al ciclo de vida por haberle regenerado el entregable.
    await supabase
      .from('education_sessions')
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
