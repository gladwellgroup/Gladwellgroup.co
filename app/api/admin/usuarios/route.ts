import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { createUserSchema } from '@/lib/validations/usuarios'

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission('users:create_admin')
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const result = createUserSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { role, nombre, correo, password } = result.data
  const supabase = getSupabaseServer()

  // El alta es directa (correo + contraseña que fija el super_admin, sin
  // invitación previa) — admin_created en el metadata es lo que le permite
  // pasar el trigger check_invitation_before_signup (ver migración
  // 20260905_profile_module_grants.sql).
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: correo,
    password,
    email_confirm: true,
    user_metadata: { admin_created: true, full_name: nombre },
  })

  if (createError || !created?.user) {
    const yaExiste = createError?.message?.toLowerCase().includes('already')
    return NextResponse.json(
      {
        error: yaExiste
          ? 'Ya existe una cuenta con ese correo'
          : 'No se pudo crear la cuenta',
      },
      { status: yaExiste ? 400 : 500 }
    )
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: created.user.id,
    role,
    nombre,
    correo,
  })

  if (profileError) {
    console.error('[admin/usuarios] profiles insert error:', profileError)
    // No dejar una cuenta de auth huérfana sin perfil.
    await supabase.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: 'No se pudo crear el perfil' }, { status: 500 })
  }

  if (role === 'community_admin' && result.data.granted_modules.length > 0) {
    const { error: grantsError } = await supabase.rpc('set_profile_module_grants', {
      _profile_id: created.user.id,
      _module_keys: result.data.granted_modules,
      _granted_by: auth.user.id,
    })
    if (grantsError) {
      console.error('[admin/usuarios] set_profile_module_grants error:', grantsError)
      return NextResponse.json(
        { error: 'La cuenta se creó, pero no se pudieron asignar los módulos' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ id: created.user.id }, { status: 201 })
}
