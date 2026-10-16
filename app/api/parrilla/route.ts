import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { parrillaPostSchema } from '@/lib/validations/parrilla'
import { createPost } from '@/lib/parrilla/mutations'

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission('parrilla:manage')
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const result = parrillaPostSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const created = await createPost(getSupabaseServer(), result.data, auth.user.id)
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: created.status })
  }

  return NextResponse.json({ id: created.id }, { status: 201 })
}
