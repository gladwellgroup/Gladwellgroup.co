import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiUser } from '@/lib/auth/api'
import { educationSessionRefSchema } from '@/lib/validations/education'
import { resolveEducationAccess } from '@/lib/education/session-access'
import { withApiErrors } from '@/lib/api/with-errors'
import { must } from '@/lib/supabase/must'

export const runtime = 'nodejs'

/** El estado de la síntesis de un entregable, y nada más (ver la ruta equivalente de Terapia). */
export const GET = withApiErrors(async (request: NextRequest) => {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response

  const parsed = educationSessionRefSchema.safeParse({
    session_id: request.nextUrl.searchParams.get('session_id'),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Sesión inválida' }, { status: 400 })
  }

  const { session_id } = parsed.data
  const supabase = getSupabaseServer()
  const access = await resolveEducationAccess(supabase, auth.user, session_id)
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.error ?? 'Sin permisos' },
      { status: access.statusCode ?? 403 }
    )
  }

  const deliverable = must(
    await supabase
      .from('education_deliverables')
      .select('processing_status, generated_at')
      .eq('session_id', session_id)
      .maybeSingle(),
    'education_deliverables'
  )
  if (!deliverable) {
    return NextResponse.json({ error: 'Entregable no encontrado' }, { status: 404 })
  }

  return NextResponse.json(
    { processing_status: deliverable.processing_status, generated_at: deliverable.generated_at },
    { headers: { 'Cache-Control': 'no-store' } }
  )
})
