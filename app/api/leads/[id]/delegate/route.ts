import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { hasPermission } from '@/lib/permissions'

const delegateSchema = z.object({
  assigned_to: z.string().uuid('ID de administrador inválido'),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params

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

  if (!profile || !hasPermission(profile.role, 'leads:delegate')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

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

  const { data: targetAdmin } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', assigned_to)
    .single()

  if (!targetAdmin || targetAdmin.role !== 'community_admin') {
    return NextResponse.json(
      { error: 'El usuario destino no es administrador de comunidad' },
      { status: 400 }
    )
  }

  const { data: currentLead } = await supabase
    .from('walking_list_leads')
    .select('status')
    .eq('id', leadId)
    .single()

  if (!currentLead) {
    return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
  }

  const nextStatus =
    currentLead.status === 'nuevo' ? 'delegado' : currentLead.status

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
