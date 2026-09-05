import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { updateModulesSchema } from '@/lib/validations/usuarios'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireApiPermission('users:create_admin')
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const result = updateModulesSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseServer()

  const { data: target } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', id)
    .single()

  if (!target) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }
  if (target.role !== 'community_admin') {
    return NextResponse.json(
      { error: 'Solo se pueden editar módulos de un administrador de comunidad' },
      { status: 400 }
    )
  }

  const { error } = await supabase.rpc('set_profile_module_grants', {
    _profile_id: id,
    _module_keys: result.data.granted_modules,
    _granted_by: auth.user.id,
  })

  if (error) {
    console.error('[admin/usuarios/[id]] set_profile_module_grants error:', error)
    return NextResponse.json({ error: 'No se pudieron actualizar los módulos' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
