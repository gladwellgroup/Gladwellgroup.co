import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { educationSessionRefSchema } from '@/lib/validations/education'
import { resolveEducationAccess } from '@/lib/education/session-access'

export const maxDuration = 60

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
      {
        error:
          'El entregable ya fue enviado. Puedes verlo, pero no regenerarlo con IA.',
      },
      { status: 403 }
    )
  }

  const { data: inputs } = await supabase
    .from('education_session_inputs')
    .select('objetivo, notas_moderador, transcripcion_texto, audio_url, capsulas_emprendimiento')
    .eq('session_id', session_id)
    .single()

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

  const { data: deliverable, error: upsertError } = await supabase
    .from('education_deliverables')
    .upsert(
      {
        session_id,
        generated_by: user.id,
        processing_status: 'generando',
        conclusiones_clave: '',
        capsulas: inputs.capsulas_emprendimiento ?? '',
        content_html: null,
        pdf_url: null,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'session_id' }
    )
    .select('id')
    .single()

  if (upsertError || !deliverable) {
    console.error('[education/generate] upsert error:', upsertError)
    return NextResponse.json(
      { error: 'No se pudo iniciar el entregable' },
      { status: 500 }
    )
  }

  // El cliente llama a /api/education/deliverables/process desde el editor.
  return NextResponse.json(
    { id: deliverable.id, session_id, processing_status: 'generando' },
    { status: 201 }
  )
}
