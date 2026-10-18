import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { resolveCharlaAccess } from '@/lib/charlas/access'

export const runtime = 'nodejs'

/** Quita a una persona de la lista de asistencia. El formulario público del QR
 *  no tiene login, así que alguien tiene que poder limpiar un correo mal
 *  escrito o un registro de relleno. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await params
  const supabase = getSupabaseServer()

  const { data: attendee } = await supabase
    .from('charla_attendees')
    .select('id, charla_id')
    .eq('id', id)
    .single()

  if (!attendee) {
    return NextResponse.json({ error: 'Asistente no encontrado' }, { status: 404 })
  }

  const access = await resolveCharlaAccess(supabase, user, attendee.charla_id)
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.statusCode })
  }

  const { error } = await supabase.from('charla_attendees').delete().eq('id', id)

  if (error) {
    console.error('[charlas/attendees] delete error:', error)
    return NextResponse.json({ error: 'No se pudo quitar al asistente' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
