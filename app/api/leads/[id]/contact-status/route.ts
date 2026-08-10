import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { hasPermission } from '@/lib/permissions'

const contactStatusSchema = z.object({
  contact_status: z.enum([
    'sin_contactar',
    'contactado',
    'grupo_whatsapp',
    'descalificado',
  ]),
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

  if (!profile || !hasPermission(profile.role, 'leads:update_status')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const result = contactStatusSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { data: lead } = await supabase
    .from('walking_list_leads')
    .select('assigned_to')
    .eq('id', leadId)
    .single()

  if (!lead) {
    return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
  }

  // Delegar es exclusivo de super_admin; marcar el avance de contacto lo
  // hace quien tiene el lead asignado — así que aquí sí importa de quién es.
  if (profile.role !== 'super_admin' && lead.assigned_to !== user.id) {
    return NextResponse.json(
      { error: 'Este lead no está delegado a ti' },
      { status: 403 }
    )
  }

  const { error } = await supabase
    .from('walking_list_leads')
    .update({ contact_status: result.data.contact_status })
    .eq('id', leadId)

  if (error) {
    console.error('[contact-status] Supabase error:', error)
    return NextResponse.json(
      { error: 'No se pudo actualizar el estado' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
