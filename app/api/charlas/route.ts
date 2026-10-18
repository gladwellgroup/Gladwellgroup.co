import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { charlaCreateSchema } from '@/lib/validations/charlas'

export const runtime = 'nodejs'

/** Crea una charla: solo nombre y fecha. La foto y la asistencia se agregan
 *  desde su ficha. */
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission('charlas:manage')
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const parsed = charlaCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { data, error } = await getSupabaseServer()
    .from('charlas')
    .insert({ ...parsed.data, created_by: auth.user.id })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[charlas] insert error:', error)
    return NextResponse.json({ error: 'No se pudo crear la charla' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
