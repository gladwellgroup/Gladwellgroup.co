import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/auth/api'
import { withApiErrors } from '@/lib/api/with-errors'
import { logError } from '@/lib/log'

// Autoservicio: cualquier persona autenticada edita su propia foto, sin
// permiso especial. Allowlist explícito de columnas — nunca acepta
// `role`/`nombre`/`cargo` desde acá, eso solo lo asigna el super_admin
// desde /super/usuarios.
const updateProfileSchema = z.object({
  avatar_url: z.string().url().nullable(),
})

export const PATCH = withApiErrors(async (request: NextRequest) => {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const result = updateProfileSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { error } = await getSupabaseServer()
    .from('profiles')
    .update({ avatar_url: result.data.avatar_url })
    .eq('id', user.id)

  if (error) {
    logError('[api/profile] update error', error)
    return NextResponse.json({ error: 'No se pudo actualizar el perfil' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
})
