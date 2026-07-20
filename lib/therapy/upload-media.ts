'use client'

import { getSupabaseBrowser } from '@/lib/supabase/browser'

const BUCKET = 'therapy-media'

export const MAX_MEDIA_SIZE = 50 * 1024 * 1024 // 50 MB

export function normalizeMime(type: string): string {
  return type.split(';')[0]?.trim().toLowerCase() ?? ''
}

interface UploadTherapyMediaParams {
  sessionId: string
  type: 'audio' | 'foto'
  file: File
  contentType?: string
}

interface UploadTherapyMediaResult {
  url: string
  path: string
}

export async function uploadTherapyMedia({
  sessionId,
  type,
  file,
  contentType,
}: UploadTherapyMediaParams): Promise<UploadTherapyMediaResult> {
  if (file.size > MAX_MEDIA_SIZE) {
    const limitMB = MAX_MEDIA_SIZE / (1024 * 1024)
    throw new Error(`El archivo excede el límite de ${limitMB} MB`)
  }

  const supabase = getSupabaseBrowser()
  const mimeType = normalizeMime(contentType ?? file.type)
  const ext = file.name.split('.').pop() || (type === 'audio' ? 'webm' : 'jpg')
  const timestamp = Date.now()
  const path = `${sessionId}/${type}/${timestamp}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: mimeType || file.type || 'application/octet-stream',
    upsert: false,
  })

  if (error) {
    console.error('[uploadTherapyMedia] Storage error:', error)
    throw new Error('Error al subir el archivo')
  }

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return { url: publicUrl.publicUrl, path }
}
