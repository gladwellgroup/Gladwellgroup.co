'use client'

import { getSupabaseBrowser } from '@/lib/supabase/browser'

// Solo foto de portada, no el archivo final — 10 MB es de sobra.
export const MAX_MEDIA_SIZE = 10 * 1024 * 1024

interface UploadParrillaMediaParams {
  file: File
  contentType?: string
}

interface UploadParrillaMediaResult {
  url: string
  path: string
}

export async function uploadParrillaMedia({
  file,
  contentType,
}: UploadParrillaMediaParams): Promise<UploadParrillaMediaResult> {
  if (file.size > MAX_MEDIA_SIZE) {
    const limitMB = MAX_MEDIA_SIZE / (1024 * 1024)
    throw new Error(`El archivo excede el límite de ${limitMB} MB`)
  }

  const supabase = getSupabaseBrowser()
  const mimeType = (contentType ?? file.type).split(';')[0]?.trim().toLowerCase() ?? ''
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${Date.now()}.${ext}`

  const { error } = await supabase.storage.from('parrilla-media').upload(path, file, {
    contentType: mimeType || file.type || 'application/octet-stream',
    upsert: false,
  })

  if (error) {
    console.error('[uploadParrillaMedia] Storage error:', error)
    throw new Error('Error al subir el archivo')
  }

  const { data: publicUrl } = supabase.storage.from('parrilla-media').getPublicUrl(path)

  return { url: publicUrl.publicUrl, path }
}
