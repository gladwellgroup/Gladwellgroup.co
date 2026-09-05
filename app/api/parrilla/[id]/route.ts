import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { requireApiPermission } from '@/lib/auth/api'
import { parrillaPostSchema } from '@/lib/validations/parrilla'

/** El public URL de Storage trae el bucket embebido en la ruta
 *  (.../object/public/parrilla-media/<path>) — se recorta ahí para volver a
 *  tener el `path` relativo que .remove() necesita. */
function storagePathFromUrl(url: string): string | null {
  const marker = '/parrilla-media/'
  const index = url.indexOf(marker)
  return index === -1 ? null : url.slice(index + marker.length)
}

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

  const result = parrillaPostSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseServer()
  const { cover_image_url, ...rest } = result.data
  const { error } = await supabase
    .from('parrilla_posts')
    .update({
      ...rest,
      cover_image_url: cover_image_url || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('[parrilla/[id]] PATCH error:', error)
    return NextResponse.json({ error: 'No se pudo actualizar la publicación' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireApiPermission('parrilla:manage')
  if (!auth.ok) return auth.response

  const supabase = getSupabaseServer()

  const { data: post } = await supabase
    .from('parrilla_posts')
    .select('cover_image_url')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('parrilla_posts').delete().eq('id', id)

  if (error) {
    console.error('[parrilla/[id]] DELETE error:', error)
    return NextResponse.json({ error: 'No se pudo eliminar la publicación' }, { status: 500 })
  }

  const path = post?.cover_image_url ? storagePathFromUrl(post.cover_image_url) : null
  if (path) {
    const { error: storageError } = await supabase.storage.from('parrilla-media').remove([path])
    // No fatal: el post ya se borró; un archivo huérfano en Storage no
    // rompe nada y no vale la pena revertir la fila por esto.
    if (storageError) {
      console.error('[parrilla/[id]] Storage cleanup error:', storageError)
    }
  }

  return NextResponse.json({ success: true })
}
