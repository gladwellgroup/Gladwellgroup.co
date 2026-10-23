import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/auth/api'
import { archivedSessionError } from '@/lib/deliverables/archived'
import { educationSessionRefSchema } from '@/lib/validations/education'
import { resolveEducationAccess } from '@/lib/education/session-access'
import { withApiErrors } from '@/lib/api/with-errors'
import { startGeneration } from '@/lib/deliverables/claim'
import { must } from '@/lib/supabase/must'

export const maxDuration = 60

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
      {
        error:
          'El entregable ya fue enviado. Puedes verlo, pero no regenerarlo con IA.',
      },
      { status: 409 }
    )
  }

  const inputs = must(
    await supabase
      .from('education_session_inputs')
      .select('objetivo, notas_moderador, transcripcion_texto, audio_url, capsulas_emprendimiento')
      .eq('session_id', session_id)
      .single(),
    'education_session_inputs'
  )

  if (!inputs) {
    return NextResponse.json(
      { error: 'Primero completa los datos de la sesión' },
      { status: 400 }
    )
  }

  if (!inputs.objetivo?.trim()) {
    return NextResponse.json(
      { error: 'Completa el objetivo de la sesión antes de crear el entregable' },
      { status: 400 }
    )
  }

  const tieneFuente =
    Boolean(inputs.transcripcion_texto?.trim()) || Boolean(inputs.audio_url)

  if (!tieneFuente && !inputs.notas_moderador?.trim()) {
    return NextResponse.json(
      {
        error:
          'Agrega la transcripción de la videollamada o las notas del moderador antes de crear el entregable',
      },
      { status: 400 }
    )
  }

  // Sin pisar una síntesis que sigue viva (antes era un upsert incondicional).
  const started = await startGeneration(supabase, 'education_deliverables', session_id, {
    generated_by: user.id,
    conclusiones_clave: '',
    capsulas: inputs.capsulas_emprendimiento ?? '',
    content_html: null,
    pdf_url: null,
  })

  if (started.status === 'busy') {
    return NextResponse.json(
      { error: 'Ya se está generando el entregable de esta sesión. Espera a que termine.' },
      { status: 409 }
    )
  }

  if (started.status === 'error') {
    return NextResponse.json(
      { error: 'No se pudo iniciar el entregable' },
      { status: 500 }
    )
  }

  // El cliente llama a /api/education/deliverables/process desde el editor.
  return NextResponse.json(
    { id: started.id, session_id, processing_status: 'generando' },
    { status: 201 }
  )
})
