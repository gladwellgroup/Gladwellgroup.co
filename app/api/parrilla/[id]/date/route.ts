import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { parrillaRescheduleSchema } from '@/lib/validations/parrilla'

/** Mueve solo una fecha (producción o publicación, según la vista activa del
 *  calendario) — es lo que dispara el arrastre de una publicación a otro
 *  día, sin tocar el resto del post. */
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

  const result = parrillaRescheduleSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseServer()
  const { error } = await supabase
    .from('parrilla_posts')
    .update({ [result.data.field]: result.data.date, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[parrilla/[id]/date] Supabase error:', error)
    return NextResponse.json({ error: 'No se pudo mover la publicación' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
