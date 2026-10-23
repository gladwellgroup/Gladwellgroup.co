'use client'

import { getSupabaseBrowser } from '@/lib/supabase/browser'
import { logError } from '@/lib/log'

// Subida directa desde el navegador a un bucket público (sin pasar por una API
// route: evita el límite de 4,5 MB del cuerpo de las funciones de Vercel). Lo que
// cuida este helper es lo que el bucket no puede cuidar solo: qué se acepta,
// cómo se nombra y cuánto pesa.
//
// Antes cada módulo copiaba su propio helper con la misma receta: nombre con la
// hora (adivinable en un bucket público), extensión tomada del nombre del
// archivo (cualquiera) y solo un límite de tamaño.

/** Tipos aceptados y la extensión que les corresponde. La extensión sale de
 *  aquí, nunca del nombre del archivo ni de lo que declare quien sube. */
export const IMAGE_MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
} as const

type ImageMime = keyof typeof IMAGE_MIME_EXT

/** Para el atributo `accept` del input de archivos. */
export const IMAGE_ACCEPT = Object.keys(IMAGE_MIME_EXT).join(',')

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024
/** Más que esto ni se intenta decodificar en el navegador. */
const MAX_INPUT_BYTES = 40 * 1024 * 1024
/** Debajo de este peso no vale la pena re-codificar. */
const REDUCE_ABOVE_BYTES = 400 * 1024
const MAX_SIDE_PX = 1600
const JPEG_QUALITY = 0.85

const normalizeMime = (type: string): string => type.split(';')[0]?.trim().toLowerCase() ?? ''

const isImageMime = (mime: string): mime is ImageMime =>
  Object.prototype.hasOwnProperty.call(IMAGE_MIME_EXT, mime)

const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024))

function typeError(type: string): string | null {
  return isImageMime(normalizeMime(type))
    ? null
    : 'Solo se admiten imágenes JPG, PNG, WebP o GIF'
}

function sizeError(size: number, maxBytes: number): string | null {
  return size > maxBytes ? `El archivo excede el límite de ${megabytes(maxBytes)} MB` : null
}

/** Mensaje para mostrar si el archivo no se puede subir, o null si está bien. */
export function validateImage(file: { type: string; size: number }, maxBytes: number): string | null {
  return typeError(file.type) ?? sizeError(file.size, maxBytes)
}

/** Dimensiones que caben en un cuadrado de `max` px sin deformar ni agrandar. */
export function fitWithin(width: number, height: number, max: number): { w: number; h: number } {
  const longest = Math.max(width, height)
  if (longest <= max) return { w: width, h: height }

  const scale = max / longest
  return {
    w: Math.max(1, Math.round(width * scale)),
    h: Math.max(1, Math.round(height * scale)),
  }
}

/** Nombre imposible de adivinar. `crypto.randomUUID` solo existe en contextos
 *  seguros (https o localhost): en un LAN por http hay que caer a
 *  `getRandomValues`, que sí está disponible en cualquier contexto. */
export function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Reduce una foto pesada a un JPEG de hasta 1600 px. Una portada solo sirve
 *  para identificar la pieza a simple vista, y una foto de celular de varios MB
 *  se descargaba completa cada vez que se abría el modal. Devuelve null si no
 *  hay nada que ganar o si algo falla: en ese caso se sube el original.
 *
 *  JPEG y no WebP: el canvas de Safari no codifica WebP y devuelve PNG, que
 *  pesa más que el original. */
async function reduceImage(file: File): Promise<File | null> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = objectUrl
    await image.decode()

    const { w, h } = fitWithin(image.naturalWidth, image.naturalHeight, MAX_SIDE_PX)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h

    const context = canvas.getContext('2d')
    if (!context) return null
    // JPEG no tiene transparencia: sin un fondo, un PNG transparente queda negro.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, w, h)
    context.drawImage(image, 0, 0, w, h)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    )
    // Si re-codificar no achicó el archivo (ya venía muy comprimido), se sube el original.
    if (!blob || blob.size >= file.size) return null
    return new File([blob], 'imagen.jpg', { type: 'image/jpeg' })
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export interface UploadImageResult {
  url: string
  path: string
}

export async function uploadImage({
  bucket,
  file,
  maxBytes = DEFAULT_MAX_BYTES,
}: {
  bucket: string
  file: File
  maxBytes?: number
}): Promise<UploadImageResult> {
  // El tipo se valida antes de reducir; el tamaño, sobre lo que de verdad se
  // sube: una foto de 12 MB que baja a 300 KB no debe rechazarse.
  const problem = typeError(file.type) ?? sizeError(file.size, MAX_INPUT_BYTES)
  if (problem) throw new Error(problem)

  let toUpload = file
  let mime = normalizeMime(file.type) as ImageMime
  if (mime !== 'image/gif' && file.size > REDUCE_ABOVE_BYTES) {
    const reduced = await reduceImage(file)
    if (reduced) {
      toUpload = reduced
      mime = 'image/jpeg'
    }
  }

  const tooBig = sizeError(toUpload.size, maxBytes)
  if (tooBig) throw new Error(tooBig)

  const path = `${randomId()}.${IMAGE_MIME_EXT[mime]}`
  const supabase = getSupabaseBrowser()

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, toUpload, { contentType: mime, upsert: false })

  if (error) {
    logError('[uploadImage] Storage error', error)
    throw new Error('Error al subir el archivo')
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data.publicUrl, path }
}
