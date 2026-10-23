import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/auth/api'
import { resolveCharlaAccess } from '@/lib/charlas/access'
import { withApiErrors } from '@/lib/api/with-errors'
import { must } from '@/lib/supabase/must'
import { logError } from '@/lib/log'

export const runtime = 'nodejs'

/** Quita a una persona de la lista de asistencia. El formulario público del QR
 *  no tiene login, así que alguien tiene que poder limpiar un correo mal
 *  escrito o un registro de relleno. */
export const DELETE = withApiErrors(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const { id } = await params
  const supabase = getSupabaseServer()

  const attendee = must(
    await supabase
      .from('charla_attendees')
      .select('id, charla_id')
      .eq('id', id)
      .single(),
    'charla_attendees'
  )

  if (!attendee) {
    return NextResponse.json({ error: 'Asistente no encontrado' }, { status: 404 })
  }

  const access = await resolveCharlaAccess(supabase, user, attendee.charla_id)
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.statusCode })
  }

  const { error } = await supabase.from('charla_attendees').delete().eq('id', id)

  if (error) {
    logError('[charlas/attendees] delete error', error)
    return NextResponse.json({ error: 'No se pudo quitar al asistente' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
})
