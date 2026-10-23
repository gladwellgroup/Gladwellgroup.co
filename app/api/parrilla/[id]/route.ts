import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { parrillaPostPatchSchema } from '@/lib/validations/parrilla'
import { PARRILLA_DETAIL_COLUMNS } from '@/lib/parrilla/posts'
import { applyPostUpdate, deletePost, describeDbError } from '@/lib/parrilla/mutations'
import { respond } from '@/lib/parrilla/http'
import { isUuid } from '@/lib/parrilla/rules'
import { withApiErrors } from '@/lib/api/with-errors'
import { logError } from '@/lib/log'

type RouteContext = { params: Promise<{ id: string }> }

/** Detalle completo (con Guion, Copy y portada). Lo pide el modal al abrir una
 *  publicación; el listado del calendario no lo trae, para que cada carga de
 *  página no arrastre el texto de todas las publicaciones. */
export const GET = withApiErrors(async (_request: NextRequest, { params }: RouteContext) => {
  const { id } = await params
  const auth = await requireApiPermission('parrilla:manage')
  if (!auth.ok) return auth.response

  // Un id mal formado nunca existe: 404, no el 500 que daría Postgres al
  // intentar convertirlo a uuid.
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'La publicación ya no existe' }, { status: 404 })
  }

  const { data, error } = await getSupabaseServer()
    .from('parrilla_posts')
    .select(PARRILLA_DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    logError('[parrilla/[id]] GET error', error)
    return NextResponse.json(
      { error: describeDbError(error, 'No se pudo cargar la publicación') },
      { status: 500 }
    )
  }
  if (!data) {
    return NextResponse.json({ error: 'La publicación ya no existe' }, { status: 404 })
  }

  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
})

/** Recibe solo los campos que cambiaron, más `expected_updated_at`: el token
 *  de la versión que la persona tenía abierta. */
export const PATCH = withApiErrors(async (request: NextRequest, { params }: RouteContext) => {
  const { id } = await params
  const auth = await requireApiPermission('parrilla:manage')
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const result = parrillaPostPatchSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const { expected_updated_at, ...patch } = result.data
  return respond(
    await applyPostUpdate(getSupabaseServer(), id, patch, { expected: expected_updated_at })
  )
})

export const DELETE = withApiErrors(async (_request: NextRequest, { params }: RouteContext) => {
  const { id } = await params
  const auth = await requireApiPermission('parrilla:manage')
  if (!auth.ok) return auth.response

  return respond(await deletePost(getSupabaseServer(), id))
})
