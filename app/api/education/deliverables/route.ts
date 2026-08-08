import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { patchEducationDeliverableSchema } from '@/lib/validations/education'
import { resolveEducationAccess } from '@/lib/education/session-access'
import { loadEducationContentSource } from '@/lib/education/content'
import { rebuildEducationHtml } from '@/lib/education/deliverable-render'

export async function PATCH(request: NextRequest) {
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

  const parsed = patchEducationDeliverableSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { session_id, ...fields } = parsed.data
  const supabase = getSupabaseServer()
  const access = await resolveEducationAccess(supabase, user, session_id)

  if (!access.allowed || !access.session) {
    return NextResponse.json(
      { error: access.error ?? 'Sin permisos' },
      { status: access.statusCode ?? 403 }
    )
  }

  if (access.session.status === 'entregado') {
    return NextResponse.json(
      { error: 'El entregable ya fue enviado y no se puede editar' },
      { status: 403 }
    )
  }

  const { error: updateError } = await supabase
    .from('education_deliverables')
    .update(fields)
    .eq('session_id', session_id)

  if (updateError) {
    console.error('[education/deliverables] update error:', updateError)
    return NextResponse.json(
      { error: 'No se pudo guardar el entregable' },
      { status: 500 }
    )
  }

  // Se devuelve el HTML recalculado para refrescar la vista previa sin
  // esperar al siguiente refresh del servidor.
  const source = await loadEducationContentSource(supabase, access.session)
  const contentHtml = rebuildEducationHtml(source)

  await supabase
    .from('education_deliverables')
    .update({ content_html: contentHtml })
    .eq('session_id', session_id)

  return NextResponse.json({ success: true, content_html: contentHtml })
}
