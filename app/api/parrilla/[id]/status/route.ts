import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { parrillaStatusSchema } from '@/lib/validations/parrilla'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireApiPermission('parrilla:manage')
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const result = parrillaStatusSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseServer()
  const { error } = await supabase
    .from('parrilla_posts')
    .update({ status: result.data.status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[parrilla/[id]/status] Supabase error:', error)
    return NextResponse.json({ error: 'No se pudo actualizar el estado' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
