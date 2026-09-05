import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { resetPasswordSchema } from '@/lib/validations/usuarios'

export async function POST(
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

  const result = resetPasswordSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseServer()

  // El UI esconde este botón para filas super_admin, pero eso no protege un
  // POST directo a la ruta — el servidor tiene que rechazarlo también.
  const { data: target } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', id)
    .single()

  if (!target) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }
  if (target.role === 'super_admin') {
    return NextResponse.json(
      { error: 'No se puede restablecer la contraseña de un super administrador desde aquí' },
      { status: 400 }
    )
  }

  const { error } = await supabase.auth.admin.updateUserById(id, {
    password: result.data.password,
  })

  if (error) {
    console.error('[admin/usuarios/[id]/reset-password] error:', error)
    return NextResponse.json({ error: 'No se pudo restablecer la contraseña' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
