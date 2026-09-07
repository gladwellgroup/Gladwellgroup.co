import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { resolvePermissionsFromGrants, type Role } from '@/lib/permissions'

const coAdminsSchema = z.object({
  co_admin_ids: z.array(z.string().uuid('ID de administrador inválido')),
})

/** Gemela de la ruta de Terapia — reemplazo atómico del set completo de
 *  coadministradores, validando que cada destino ya tenga el módulo de
 *  Entregables · Educación otorgado. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params

  const auth = await requireApiPermission('sessions:delegate_admin')
  if (!auth.ok) return auth.response

  const supabase = getSupabaseServer()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const result = coAdminsSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { co_admin_ids } = result.data

  if (co_admin_ids.length > 0) {
    const { data: targets } = await supabase
      .from('profiles')
      .select('id, role, profile_module_grants!profile_module_grants_profile_id_fkey(module_key)')
      .in('id', co_admin_ids)

    const validIds = new Set(
      (targets ?? [])
        .filter((t) => {
          if (t.role !== 'community_admin') return false
          const permissions = resolvePermissionsFromGrants(t.role as Role, t.profile_module_grants)
          return permissions.includes('education:create')
        })
        .map((t) => t.id)
    )

    const invalid = co_admin_ids.filter((id) => !validIds.has(id))
    if (invalid.length > 0) {
      return NextResponse.json(
        {
          error:
            'Cada coadministrador debe ser un administrador de comunidad con el módulo de Entregables · Educación otorgado',
        },
        { status: 400 }
      )
    }
  }

  const { data: session } = await supabase
    .from('education_sessions')
    .select('id')
    .eq('id', sessionId)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
  }

  const { error } = await supabase
    .from('education_sessions')
    .update({ co_admin_ids })
    .eq('id', sessionId)

  if (error) {
    console.error('[co-admins/education] Supabase error:', error)
    return NextResponse.json(
      { error: 'No se pudo actualizar los coadministradores' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
