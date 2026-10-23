import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { updateUserSchema } from '@/lib/validations/usuarios'
import { withApiErrors } from '@/lib/api/with-errors'
import { must } from '@/lib/supabase/must'
import { logError } from '@/lib/log'

export const PATCH = withApiErrors(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const auth = await requireApiPermission('users:create_admin')
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const result = updateUserSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }
  const { cargo, granted_modules } = result.data

  const supabase = getSupabaseServer()

  const target = must(
    await supabase
      .from('profiles')
      .select('role')
      .eq('id', id)
      .single(),
    'profiles'
  )

  if (!target) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  // Los módulos solo tienen sentido para un community_admin. Se valida ANTES de tocar nada: antes se actualizaba el
  // cargo y luego se respondía 400 por los módulos, dejando la edición a medias.
  if (granted_modules !== undefined && target.role !== 'community_admin') {
    return NextResponse.json(
      { error: 'Solo se pueden editar módulos de un administrador de comunidad' },
      { status: 400 }
    )
  }

  // El cargo aplica a cualquier persona.
  if (cargo !== undefined) {
    const { error: cargoError } = await supabase
      .from('profiles')
      .update({ cargo: cargo || null })
      .eq('id', id)

    if (cargoError) {
      logError('[admin/usuarios/[id]] cargo update error', cargoError)
      return NextResponse.json({ error: 'No se pudo actualizar el cargo' }, { status: 500 })
    }
  }

  if (granted_modules !== undefined) {
    const { error: modulesError } = await supabase.rpc('set_profile_module_grants', {
      _profile_id: id,
      _module_keys: granted_modules,
      _granted_by: auth.user.id,
    })

    if (modulesError) {
      logError('[admin/usuarios/[id]] set_profile_module_grants error', modulesError)
      return NextResponse.json({ error: 'No se pudieron actualizar los módulos' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
})
