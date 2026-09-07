import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { resolvePermissionsFromGrants, type Role } from '@/lib/permissions'

const delegateSchema = z.object({
  // null = sin delegar, el lead vuelve a quedar en manos del
  // superadministrador (la opción "Superadministrador" del selector).
  assigned_to: z.string().uuid('ID de administrador inválido').nullable(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params

  const auth = await requireApiPermission('leads:delegate')
  if (!auth.ok) return auth.response
  const { user } = auth

  const supabase = getSupabaseServer()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const result = delegateSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { assigned_to } = result.data

  // assigned_to = null es la opción "Superadministrador": no hay a quién
  // validar, el lead simplemente vuelve a quedar sin delegar.
  if (assigned_to !== null) {
    // Rol correcto no basta: sin el módulo CRM otorgado, quedaría delegado a
    // alguien que no puede ver el lead en /admin/leads.
    const { data: targetAdmin } = await supabase
      .from('profiles')
      .select('role, profile_module_grants!profile_module_grants_profile_id_fkey(module_key)')
      .eq('id', assigned_to)
      .single()

    const targetPermissions = targetAdmin
      ? resolvePermissionsFromGrants(targetAdmin.role as Role, targetAdmin.profile_module_grants)
      : []

    if (
      !targetAdmin ||
      targetAdmin.role !== 'community_admin' ||
      !targetPermissions.includes('leads:read_delegated')
    ) {
      return NextResponse.json(
        { error: 'El usuario destino no tiene el módulo CRM otorgado' },
        { status: 400 }
      )
    }
  }

  const { data: currentLead } = await supabase
    .from('walking_list_leads')
    .select('status')
    .eq('id', leadId)
    .single()

  if (!currentLead) {
    return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
  }

  // Mismo par nuevo/delegado en ambos sentidos: delegar a un admin pasa un
  // lead "nuevo" a "delegado"; volver a "Superadministrador" lo regresa a
  // "nuevo". Cualquier otro status (ej. ya trabajado) queda intacto.
  const nextStatus =
    assigned_to === null
      ? currentLead.status === 'delegado'
        ? 'nuevo'
        : currentLead.status
      : currentLead.status === 'nuevo'
        ? 'delegado'
        : currentLead.status

  const { error } = await supabase
    .from('walking_list_leads')
    .update({ assigned_to, status: nextStatus })
    .eq('id', leadId)

  if (error) {
    console.error('[delegate] Supabase error:', error)
    return NextResponse.json(
      { error: 'No se pudo delegar el lead' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
