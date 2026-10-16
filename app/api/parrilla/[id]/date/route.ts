import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { parrillaRescheduleSchema } from '@/lib/validations/parrilla'
import { applyPostUpdate } from '@/lib/parrilla/mutations'
import { respond } from '@/lib/parrilla/http'

/** Mueve solo una fecha (producción o publicación, según la vista activa del
 *  calendario) — es lo que dispara el arrastre de una publicación a otro
 *  día, sin tocar el resto del post. Es de un solo campo, así que no lleva
 *  token de concurrencia: mover una fecha no pisa lo que otra persona editó. */
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

  const { field, date } = result.data
  const patch = field === 'production_date' ? { production_date: date } : { publish_date: date }

  return respond(
    await applyPostUpdate(getSupabaseServer(), id, patch, {
      fallback: 'No se pudo mover la publicación',
    })
  )
}
