import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { educationSessionSchema } from '@/lib/validations/education'
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

  if (!profile || !hasPermission(profile.role, 'education:create')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

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
  if (profile.role !== 'super_admin' && result.data.admin_id !== user.id) {
    return NextResponse.json(
      { error: 'Solo un super administrador puede asignar la sesión a otra persona' },
      { status: 403 }
    )
  }

  const { data: admin } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', result.data.admin_id)
    .single()

  if (!admin || !['super_admin', 'community_admin'].includes(admin.role)) {
    return NextResponse.json(
      { error: 'El responsable debe ser un administrador.' },
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
