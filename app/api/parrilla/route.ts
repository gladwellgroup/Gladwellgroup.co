import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { parrillaPostSchema } from '@/lib/validations/parrilla'
import { PARRILLA_POST_COLUMNS } from '@/lib/parrilla/posts'

export async function GET() {
  const auth = await requireApiPermission('parrilla:manage')
  if (!auth.ok) return auth.response

  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('parrilla_posts')
    .select(PARRILLA_POST_COLUMNS)
    .order('publish_date')

  if (error) {
    console.error('[parrilla] GET error:', error)
    return NextResponse.json({ error: 'No se pudieron cargar las publicaciones' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

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

  const supabase = getSupabaseServer()
  const { cover_image_url, ...rest } = result.data
  const { data, error } = await supabase
    .from('parrilla_posts')
    .insert({
      ...rest,
      cover_image_url: cover_image_url || null,
      created_by: auth.user.id,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[parrilla] POST error:', error)
    return NextResponse.json({ error: 'No se pudo crear la publicación' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
