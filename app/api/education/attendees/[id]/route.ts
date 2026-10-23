import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/auth/api'
import { resolveEducationAccess } from '@/lib/education/session-access'
import { withApiErrors } from '@/lib/api/with-errors'
import { must } from '@/lib/supabase/must'
import { logError } from '@/lib/log'

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
      .from('education_attendees')
      .select('id, session_id')
      .eq('id', id)
      .single(),
    'education_attendees'
  )

  if (!attendee) {
    return NextResponse.json({ error: 'Asistente no encontrado' }, { status: 404 })
  }

  const access = await resolveEducationAccess(
    supabase,
    user,
    attendee.session_id
  )

  if (!access.allowed || !access.session) {
    return NextResponse.json(
      { error: access.error ?? 'Sin permisos' },
      { status: access.statusCode ?? 403 }
    )
  }

  if (access.session.status !== 'borrador') {
    return NextResponse.json(
      {
        error:
          'La sesión ya no está en borrador; la lista de asistentes no se puede modificar.',
      },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('education_attendees')
    .delete()
    .eq('id', id)

  if (error) {
    logError('[education/attendees/delete] Supabase error', error)
    return NextResponse.json(
      { error: 'No se pudo eliminar el asistente' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
})
