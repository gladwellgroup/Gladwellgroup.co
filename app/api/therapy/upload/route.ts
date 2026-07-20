import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/api'
import { resolveDeliverableAccess } from '@/lib/therapy/deliverable-access'

const AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/x-aac',
])

const AUDIO_EXTENSIONS = new Set(['webm', 'm4a', 'mp3', 'mp4', 'ogg', 'wav', 'aac'])

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

const HEIC_EXTENSIONS = new Set(['heic', 'heif'])

// Kept low: this route proxies through a Vercel Function, which caps request
// bodies at ~4.5 MB. Large media should use uploadTherapyMedia() (direct to
// Supabase Storage from the browser) instead of this endpoint.
const MAX_AUDIO_SIZE = 4 * 1024 * 1024
const MAX_IMAGE_SIZE = 4 * 1024 * 1024

function normalizeMime(type: string): string {
  return type.split(';')[0]?.trim().toLowerCase() ?? ''
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const supabase = getSupabaseServer()

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Formato inválido' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const sessionId = formData.get('session_id') as string | null
  const type = formData.get('type') as string | null

  if (!file || !sessionId || !type) {
    return NextResponse.json(
      { error: 'Faltan campos: file, session_id, type' },
      { status: 400 }
    )
  }

  const access = await resolveDeliverableAccess(supabase, user, sessionId)

  if (!access.allowed || !access.session) {
    return NextResponse.json(
      { error: access.error ?? 'Sin permisos' },
      { status: access.statusCode ?? 403 }
    )
  }

  if (!access.isCreatorModeratorOrSuper) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  if (access.session.status !== 'borrador') {
    return NextResponse.json(
      {
        error:
          'La sesión ya no está en borrador; los datos de captura no se pueden modificar.',
      },
      { status: 403 }
    )
  }

  if (type !== 'audio' && type !== 'foto') {
    return NextResponse.json(
      { error: 'type debe ser "audio" o "foto"' },
      { status: 400 }
    )
  }

  const mimeType = normalizeMime(file.type)
  const isAudio = type === 'audio'
  const fileExt = (file.name.split('.').pop() ?? '').toLowerCase()

  const audioAllowed = AUDIO_TYPES.has(mimeType) || AUDIO_EXTENSIONS.has(fileExt)
  const imageAllowed = IMAGE_TYPES.has(mimeType) || HEIC_EXTENSIONS.has(fileExt)

  if (isAudio && !audioAllowed) {
    return NextResponse.json(
      { error: `Tipo de audio no permitido: ${file.type || fileExt}` },
      { status: 400 }
    )
  }

  if (!isAudio && !imageAllowed) {
    return NextResponse.json(
      { error: `Tipo de imagen no permitido: ${file.type || fileExt}` },
      { status: 400 }
    )
  }

  const maxSize = isAudio ? MAX_AUDIO_SIZE : MAX_IMAGE_SIZE
  if (file.size > maxSize) {
    const limitMB = maxSize / (1024 * 1024)
    return NextResponse.json(
      {
        error: `El archivo excede el límite de ${limitMB} MB de esta ruta. Usa la subida directa a Storage.`,
      },
      { status: 400 }
    )
  }

  const ext = fileExt || (isAudio ? 'webm' : 'jpg')
  const timestamp = Date.now()
  const path = `${sessionId}/${type}/${timestamp}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const resolvedMime =
    mimeType || (HEIC_EXTENSIONS.has(fileExt) ? 'image/heic' : 'application/octet-stream')

  const { error: uploadError } = await supabase.storage
    .from('therapy-media')
    .upload(path, buffer, {
      contentType: resolvedMime,
      upsert: false,
    })

  if (uploadError) {
    console.error('[therapy/upload] Storage error:', uploadError)
    return NextResponse.json(
      { error: 'Error al subir el archivo' },
      { status: 500 }
    )
  }

  const { data: publicUrl } = supabase.storage
    .from('therapy-media')
    .getPublicUrl(path)

  return NextResponse.json(
    { url: publicUrl.publicUrl, path },
    { status: 201 }
  )
}
