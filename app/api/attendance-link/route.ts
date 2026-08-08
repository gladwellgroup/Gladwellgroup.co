import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'
import { resolveEducationAccess } from '@/lib/education/session-access'
import { buildAttendanceToken } from '@/lib/deliverables/slugify'

export const runtime = 'nodejs'

const EXPIRES_IN_MS = 24 * 60 * 60 * 1000

const bodySchema = z.object({
  session_id: z.string().uuid(),
  program: z.enum(['therapy', 'education']),
})

/** Genera o regenera el link/QR de asistencia de una sesión. Sirve para
 *  ambos casos: si ya existe una fila para esa sesión se actualiza (eso es
 *  lo que invalida el token anterior al instante); si no, se crea. */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { session_id, program } = parsed.data
  const supabase = getSupabaseServer()

  let title: string
  if (program === 'therapy') {
    const access = await resolveDeliverableAccess(supabase, user, session_id)
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
    title = access.session.title
  } else {
    const access = await resolveEducationAccess(supabase, user, session_id)
    if (!access.allowed || !access.session) {
      return NextResponse.json(
        { error: access.error ?? 'Sin permisos' },
        { status: access.statusCode ?? 403 }
      )
    }
    title = access.session.title
  }

  const sessionColumn =
    program === 'therapy' ? 'therapy_session_id' : 'education_session_id'
  const token = buildAttendanceToken(title)
  const expiresAt = new Date(Date.now() + EXPIRES_IN_MS).toISOString()
  const now = new Date().toISOString()

  const { data: existing } = await supabase
    .from('session_attendance_links')
    .select('id')
    .eq(sessionColumn, session_id)
    .maybeSingle()

  const result = existing
    ? await supabase
        .from('session_attendance_links')
        .update({
          token,
          expires_at: expiresAt,
          regenerated_by: user.id,
          updated_at: now,
        })
        .eq('id', existing.id)
        .select('token, expires_at')
        .single()
    : await supabase
        .from('session_attendance_links')
        .insert({
          [sessionColumn]: session_id,
          token,
          expires_at: expiresAt,
          regenerated_by: user.id,
        })
        .select('token, expires_at')
        .single()

  if (result.error || !result.data) {
    console.error('[attendance-link] error:', result.error)
    return NextResponse.json(
      { error: 'No se pudo generar el enlace de asistencia' },
      { status: 500 }
    )
  }

  const url = `${request.nextUrl.origin}/asistencia/${result.data.token}`

  return NextResponse.json({
    token: result.data.token,
    url,
    expires_at: result.data.expires_at,
  })
}
