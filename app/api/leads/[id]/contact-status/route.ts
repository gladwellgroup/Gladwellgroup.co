import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { withApiErrors } from '@/lib/api/with-errors'
import { must } from '@/lib/supabase/must'
import { logError } from '@/lib/log'

const contactStatusSchema = z.object({
  contact_status: z.enum([
    'sin_contactar',
    'contactado',
    'grupo_whatsapp',
    'descalificado',
  ]),
})

export const PATCH = withApiErrors(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: leadId } = await params

  const auth = await requireApiPermission('leads:update_status')
  if (!auth.ok) return auth.response
  const { user, role } = auth

  const supabase = getSupabaseServer()

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

  const lead = must(
    await supabase
      .from('walking_list_leads')
      .select('assigned_to')
      .eq('id', leadId)
      .single(),
    'walking_list_leads'
  )

  if (!lead) {
    return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
  }

  // Delegar es exclusivo de super_admin; marcar el avance de contacto lo
  // hace quien tiene el lead asignado — así que aquí sí importa de quién es.
  if (role !== 'super_admin' && lead.assigned_to !== user.id) {
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
    logError('[contact-status] Supabase error', error)
    return NextResponse.json(
      { error: 'No se pudo actualizar el estado' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
})
