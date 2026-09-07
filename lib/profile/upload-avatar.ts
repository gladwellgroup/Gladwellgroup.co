'use client'

import { getSupabaseBrowser } from '@/lib/supabase/browser'

export const MAX_AVATAR_SIZE = 10 * 1024 * 1024 // 10 MB

interface UploadAvatarParams {
  userId: string
  file: File
  contentType?: string
}

interface UploadAvatarResult {
  url: string
  path: string
}

/** Mismo patrón que `uploadTherapyMedia` (lib/therapy/upload-media.ts):
 *  sube directo desde el browser, sin pasar por una API route. La policy
 *  de Storage del bucket `avatars` exige que el primer segmento del path
 *  sea el propio uid, así que cada quien solo puede escribir en su carpeta. */
export async function uploadAvatar({
  userId,
  file,
  contentType,
}: UploadAvatarParams): Promise<UploadAvatarResult> {
  if (file.size > MAX_AVATAR_SIZE) {
    const limitMB = MAX_AVATAR_SIZE / (1024 * 1024)
    throw new Error(`El archivo excede el límite de ${limitMB} MB`)
  }

  const supabase = getSupabaseBrowser()
  const mimeType = (contentType ?? file.type).split(';')[0]?.trim().toLowerCase() ?? ''
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    contentType: mimeType || file.type || 'application/octet-stream',
    upsert: false,
  })

  if (error) {
    console.error('[uploadAvatar] Storage error:', error)
    throw new Error('Error al subir la foto')
  }

  const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(path)

  return { url: publicUrl.publicUrl, path }
}
