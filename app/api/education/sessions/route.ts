import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { educationSessionSchema } from '@/lib/validations/education'
import { resolvePermissionsFromGrants, type Role } from '@/lib/permissions'

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission('education:create')
  if (!auth.ok) return auth.response
  const { user, role } = auth

  const supabase = getSupabaseServer()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const result = educationSessionSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  // Solo el super admin delega la sesión a otro administrador de comunidad.
  if (role !== 'super_admin' && result.data.admin_id !== user.id) {
    return NextResponse.json(
      { error: 'Solo un super administrador puede asignar la sesión a otra persona' },
      { status: 403 }
    )
  }

  // No basta con "es community_admin": si además no tiene el módulo de
  // Entregables · Educación otorgado, quedaría con una sesión asignada que
  // jamás puede abrir (resolveEducationAccess la bloquearía igual).
  const { data: admin } = await supabase
    .from('profiles')
    .select('role, profile_module_grants!profile_module_grants_profile_id_fkey(module_key)')
    .eq('id', result.data.admin_id)
    .single()

  const adminPermissions = admin
    ? resolvePermissionsFromGrants(admin.role as Role, admin.profile_module_grants)
    : []

  if (!admin || !adminPermissions.includes('education:create')) {
    return NextResponse.json(
      { error: 'El responsable debe tener el módulo Entregables · Educación.' },
      { status: 400 }
    )
  }

  const { data: session, error } = await supabase
    .from('education_sessions')
    .insert({ ...result.data, created_by: user.id })
    .select('id')
    .single()

  if (error) {
    console.error('[education/sessions] Supabase error:', error)
    return NextResponse.json(
      { error: 'No se pudo crear la sesión' },
      { status: 500 }
    )
  }

  return NextResponse.json({ id: session.id }, { status: 201 })
}
