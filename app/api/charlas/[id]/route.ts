import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { resolveCharlaAccess } from '@/lib/charlas/access'
import { charlaUpdateSchema } from '@/lib/validations/charlas'

export const runtime = 'nodejs'

/** Edita lo que llegue: nombre, fecha y/o foto (`photo_url: null` la quita). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await params
  const supabase = getSupabaseServer()

  const access = await resolveCharlaAccess(supabase, user, id)
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.statusCode })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const parsed = charlaUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('charlas')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, title, session_date, photo_url')
    .single()

  if (error || !data) {
    console.error('[charlas] update error:', error)
    return NextResponse.json({ error: 'No se pudo guardar la charla' }, { status: 500 })
  }

  return NextResponse.json({ charla: data })
}
