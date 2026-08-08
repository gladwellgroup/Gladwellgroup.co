import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'

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
    .from('therapy_session_attendees')
    .select('id, session_id')
    .eq('id', id)
    .single()

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
      { status: 403 }
    )
  }

  const { error } = await supabase
    .from('therapy_session_attendees')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[therapy/attendees/delete] Supabase error:', error)
    return NextResponse.json(
      { error: 'No se pudo eliminar el asistente' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
