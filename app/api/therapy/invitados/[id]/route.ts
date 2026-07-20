import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { hasPermission } from '@/lib/permissions'
import { patchInvitadoSchema } from '@/lib/validations/therapy'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const { data: invitado } = await supabase
    .from('invitados')
    .select('id, created_by')
    .eq('id', id)
    .single()

  if (!invitado) {
    return NextResponse.json({ error: 'Invitado no encontrado' }, { status: 404 })
  }

  if (profile.role !== 'super_admin' && invitado.created_by !== user.id) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const result = patchInvitadoSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('invitados')
    .update({ ...result.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, nombre, descripcion, red_social, pagina_web')
    .single()

  if (error) {
    console.error('[invitados/[id]] PATCH error:', error)
    return NextResponse.json({ error: 'No se pudo actualizar el invitado' }, { status: 500 })
  }

  return NextResponse.json(data)
}
