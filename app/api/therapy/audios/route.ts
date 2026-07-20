import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { audioMetaSchema } from '@/lib/validations/therapy'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'

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

  const result = audioMetaSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseServer()

  const access = await resolveDeliverableAccess(
    supabase,
    user,
    result.data.session_id
  )

  if (!access.allowed || !access.session) {
    return NextResponse.json(
      { error: access.error ?? 'Sin permisos' },
      { status: access.statusCode ?? 403 }
    )
  }

  if (!access.isCreatorModeratorOrSuper) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  if (access.session.status !== 'borrador') {
    return NextResponse.json(
      {
        error:
          'La sesión ya no está en borrador; los datos de captura no se pueden modificar.',
      },
      { status: 403 }
    )
  }

  const { data, error } = await supabase
    .from('therapy_session_audios')
    .insert(result.data)
    .select('id, audio_url, autor_nombre, duracion_segundos, created_at')
    .single()

  if (error) {
    console.error('[therapy/audios] Insert error:', error)
    return NextResponse.json(
      { error: 'No se pudo guardar el audio' },
      { status: 500 }
    )
  }

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Falta parámetro id' }, { status: 400 })
  }

  const supabase = getSupabaseServer()

  const { data: audio } = await supabase
    .from('therapy_session_audios')
    .select('session_id')
    .eq('id', id)
    .single()

  if (!audio) {
    return NextResponse.json({ error: 'Audio no encontrado' }, { status: 404 })
  }

  const access = await resolveDeliverableAccess(supabase, user, audio.session_id)

  if (!access.allowed || !access.session) {
    return NextResponse.json(
      { error: access.error ?? 'Sin permisos' },
      { status: access.statusCode ?? 403 }
    )
  }

  if (!access.isCreatorModeratorOrSuper) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  if (access.session.status !== 'borrador') {
    return NextResponse.json(
      {
        error:
          'La sesión ya no está en borrador; los datos de captura no se pueden modificar.',
      },
      { status: 403 }
    )
  }

  const { error } = await supabase
    .from('therapy_session_audios')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[therapy/audios] Delete error:', error)
    return NextResponse.json(
      { error: 'No se pudo eliminar el audio' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
