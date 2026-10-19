import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { parrillaQuotePatchSchema } from '@/lib/validations/parrilla'
import { deleteQuote, updateQuote } from '@/lib/parrilla/quote-mutations'
import { respond } from '@/lib/parrilla/http'

type RouteContext = { params: Promise<{ id: string }> }

/** Recibe solo los campos que cambiaron. Sin token de concurrencia: gana la
 *  última escritura de cada campo (ver lib/parrilla/quote-mutations.ts). */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const auth = await requireApiPermission('parrilla:manage')
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const result = parrillaQuotePatchSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  return respond(await updateQuote(getSupabaseServer(), id, result.data))
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const auth = await requireApiPermission('parrilla:manage')
  if (!auth.ok) return auth.response

  return respond(await deleteQuote(getSupabaseServer(), id))
}
