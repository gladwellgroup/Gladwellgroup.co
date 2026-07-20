import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { therapySessionSchema } from '@/lib/validations/therapy'
import { hasPermission } from '@/lib/permissions'

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const supabase = getSupabaseServer()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !hasPermission(profile.role, 'therapy:create')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const result = therapySessionSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { data: moderator } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', result.data.moderator_id)
    .single()

  if (!moderator || !['super_admin', 'community_admin'].includes(moderator.role)) {
    return NextResponse.json(
      { error: 'El moderador debe ser un administrador.' },
      { status: 400 }
    )
  }

  const { data: invitado } = await supabase
    .from('invitados')
    .select('id, created_by')
    .eq('id', result.data.invitado_id)
    .single()

  if (!invitado) {
    return NextResponse.json({ error: 'Invitado no encontrado' }, { status: 400 })
  }

  if (profile.role !== 'super_admin' && invitado.created_by !== user.id) {
    return NextResponse.json(
      { error: 'No tienes acceso a este invitado' },
      { status: 403 }
    )
  }

  const { data: session, error } = await supabase
    .from('therapy_sessions')
    .insert({
      ...result.data,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[therapy/sessions] Supabase error:', error)
    return NextResponse.json(
      { error: 'No se pudo crear la sesión' },
      { status: 500 }
    )
  }

  return NextResponse.json({ id: session.id }, { status: 201 })
}
