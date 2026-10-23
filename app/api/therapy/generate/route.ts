import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/auth/api'
import { archivedSessionError } from '@/lib/deliverables/archived'
import { generateDeliverableSchema } from '@/lib/validations/therapy'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'
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

  const parsed = generateDeliverableSchema.safeParse(body)
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
      { error: 'Solo el moderador o un super administrador pueden crear el entregable' },
      { status: 403 }
    )
  }

  const archived = archivedSessionError(access.session.status)
  if (archived) {
    return NextResponse.json({ error: archived }, { status: 409 })
  }

  if (access.session.status === 'entregado') {
    return NextResponse.json(
      { error: 'El entregable ya fue enviado. Puedes verlo y editarlo, pero no regenerarlo con IA.' },
      { status: 409 }
    )
  }

  const inputs = must(
    await supabase
      .from('therapy_session_inputs')
      .select('reto_problema, recomendaciones_incomodas, foto_sesion_url')
      .eq('session_id', session_id)
      .single(),
    'therapy_session_inputs'
  )

  if (!inputs) {
    return NextResponse.json(
      { error: 'Primero completa los inputs de la sesión' },
      { status: 400 }
    )
  }

  const reto = inputs.reto_problema?.trim() ?? ''
  const recomendaciones = inputs.recomendaciones_incomodas?.trim() ?? ''

  if (!reto) {
    return NextResponse.json(
      { error: 'Completa el reto o problema antes de crear el entregable' },
      { status: 400 }
    )
  }

  if (!recomendaciones) {
    return NextResponse.json(
      { error: 'Completa las recomendaciones incómodas antes de crear el entregable' },
      { status: 400 }
    )
  }

  // Sin pisar una síntesis que sigue viva (antes era un upsert incondicional: reiniciaba la generación en curso y
  // borraba el resumen del audio).
  const started = await startGeneration(supabase, 'therapy_deliverables', session_id, {
    generated_by: user.id,
    problema_recordatorio: reto,
    resumen_audio: '',
    recomendaciones_incomodas: recomendaciones,
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

  // Client will call /api/therapy/deliverables/process from the editor.
  return NextResponse.json(
    {
      id: started.id,
      session_id,
      processing_status: 'generando',
    },
    { status: 201 }
  )
})
