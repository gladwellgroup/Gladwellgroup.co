import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { generateDeliverableSchema } from '@/lib/validations/therapy'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'

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

  if (access.session.status === 'entregado') {
    return NextResponse.json(
      { error: 'El entregable ya fue enviado. Puedes verlo y editarlo, pero no regenerarlo con IA.' },
      { status: 403 }
    )
  }

  const { data: inputs } = await supabase
    .from('therapy_session_inputs')
    .select('reto_problema, recomendaciones_incomodas, foto_sesion_url')
    .eq('session_id', session_id)
    .single()

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

  const { data: deliverable, error: upsertError } = await supabase
    .from('therapy_deliverables')
    .upsert(
      {
        session_id,
        generated_by: user.id,
        processing_status: 'generando',
        problema_recordatorio: reto,
        resumen_audio: '',
        recomendaciones_incomodas: recomendaciones,
        content_html: null,
        pdf_url: null,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'session_id' }
    )
    .select('id')
    .single()

  if (upsertError || !deliverable) {
    console.error('[therapy/generate] upsert error:', upsertError)
    return NextResponse.json(
      { error: 'No se pudo iniciar el entregable' },
      { status: 500 }
    )
  }

  // Client will call /api/therapy/deliverables/process from the editor.
  return NextResponse.json(
    {
      id: deliverable.id,
      session_id,
      processing_status: 'generando',
    },
    { status: 201 }
  )
}
