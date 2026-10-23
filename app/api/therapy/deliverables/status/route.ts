import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/auth/api'
import { deliverableSessionSchema } from '@/lib/validations/therapy'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'
import { withApiErrors } from '@/lib/api/with-errors'
import { must } from '@/lib/supabase/must'

export const runtime = 'nodejs'

/** El estado de la síntesis de un entregable, y nada más. Lo consulta el editor cada pocos segundos mientras se genera:
 *  antes pedía la página entera (`router.refresh()`: middleware + perfil + 2–3 consultas + las precargas de los
 *  enlaces) cada 4 s. Mismo permiso que ver el entregable. */
export const GET = withApiErrors(async (request: NextRequest) => {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response

  const parsed = deliverableSessionSchema.safeParse({
    session_id: request.nextUrl.searchParams.get('session_id'),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Sesión inválida' }, { status: 400 })
  }

  const { session_id } = parsed.data
  const supabase = getSupabaseServer()
  const access = await resolveDeliverableAccess(supabase, auth.user, session_id)
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.error ?? 'Sin permisos' },
      { status: access.statusCode ?? 403 }
    )
  }

  const deliverable = must(
    await supabase
      .from('therapy_deliverables')
      .select('processing_status, generated_at')
      .eq('session_id', session_id)
      .maybeSingle(),
    'therapy_deliverables'
  )
  if (!deliverable) {
    return NextResponse.json({ error: 'Entregable no encontrado' }, { status: 404 })
  }

  return NextResponse.json(
    { processing_status: deliverable.processing_status, generated_at: deliverable.generated_at },
    { headers: { 'Cache-Control': 'no-store' } }
  )
})
