import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/auth/api'
import { importAttendeesSchema } from '@/lib/validations/attendees'
import { resolveEducationAccess } from '@/lib/education/session-access'
import { withApiErrors } from '@/lib/api/with-errors'
import { must } from '@/lib/supabase/must'
import { logError } from '@/lib/log'

export const POST = withApiErrors(async (request: NextRequest) => {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const supabase = getSupabaseServer()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const result = importAttendeesSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { session_id, attendees } = result.data
  const access = await resolveEducationAccess(supabase, user, session_id)

  if (!access.allowed || !access.session) {
    return NextResponse.json(
      { error: access.error ?? 'Sin permisos' },
      { status: access.statusCode ?? 403 }
    )
  }

  // La lista se congela al enviar el entregable.
  if (access.session.status !== 'borrador') {
    return NextResponse.json(
      {
        error:
          'La sesión ya no está en borrador; la lista de asistentes no se puede modificar.',
      },
      { status: 409 }
    )
  }

  // Deduplicar dentro del propio lote antes de tocar la base: el índice único
  // es (session_id, lower(correo)) y un mismo correo repetido en el payload
  // haría fallar el insert completo.
  const byEmail = new Map<string, (typeof attendees)[number]>()
  for (const attendee of attendees) {
    byEmail.set(attendee.correo.trim().toLowerCase(), attendee)
  }

  const existing = must(
    await supabase
      .from('education_attendees')
      .select('correo')
      .eq('session_id', session_id),
    'education_attendees'
  )

  const existingEmails = new Set(
    (existing ?? []).map((row: { correo: string }) => row.correo.toLowerCase())
  )

  const rows = [...byEmail.entries()]
    .filter(([correo]) => !existingEmails.has(correo))
    .map(([correo, attendee]) => ({
      session_id,
      nombre: attendee.nombre,
      correo,
      empresa: attendee.empresa || null,
    }))

  if (rows.length > 0) {
    const { error } = await supabase.from('education_attendees').insert(rows)

    if (error) {
      logError('[education/attendees/import] Supabase error', error)
      return NextResponse.json(
        { error: 'No se pudieron guardar los asistentes' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({
    imported: rows.length,
    skipped: byEmail.size - rows.length,
  })
})
