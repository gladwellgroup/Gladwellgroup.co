import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/auth/api'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'
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
      .from('therapy_session_attendees')
      .select('id, session_id')
      .eq('id', id)
      .single(),
    'therapy_session_attendees'
  )

  if (!attendee) {
    return NextResponse.json({ error: 'Asistente no encontrado' }, { status: 404 })
  }

  const access = await resolveDeliverableAccess(
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

  // resolveDeliverableAccess devuelve allowed:true para cualquier
  // community_admin; el vínculo con esta sesión concreta lo da esta segunda
  // comprobación, igual que en /api/therapy/inputs y /api/therapy/audios.
  if (!access.isCreatorModeratorOrSuper) {
    return NextResponse.json(
      { error: 'Sin permisos sobre esta sesión' },
      { status: 403 }
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
    .from('therapy_session_attendees')
    .delete()
    .eq('id', id)

  if (error) {
    logError('[therapy/attendees/delete] Supabase error', error)
    return NextResponse.json(
      { error: 'No se pudo eliminar el asistente' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
})
