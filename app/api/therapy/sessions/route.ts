import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { therapySessionSchema } from '@/lib/validations/therapy'
import { resolvePermissionsFromGrants, type Role } from '@/lib/permissions'

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission('therapy:create')
  if (!auth.ok) return auth.response
  const { user, role } = auth

  const supabase = getSupabaseServer()

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

  // No basta con "es community_admin": si además no tiene el módulo de
  // Entregables · Terapia otorgado, quedaría con una sesión asignada que
  // jamás puede abrir (resolveDeliverableAccess la bloquearía igual).
  const { data: moderator } = await supabase
    .from('profiles')
    .select('role, profile_module_grants!profile_module_grants_profile_id_fkey(module_key)')
    .eq('id', result.data.moderator_id)
    .single()

  const moderatorPermissions = moderator
    ? resolvePermissionsFromGrants(moderator.role as Role, moderator.profile_module_grants)
    : []

  if (!moderator || !moderatorPermissions.includes('therapy:create')) {
    return NextResponse.json(
      { error: 'El moderador debe tener el módulo Entregables · Terapia.' },
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

  if (role !== 'super_admin' && invitado.created_by !== user.id) {
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
