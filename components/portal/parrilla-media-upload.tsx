'use client'

import { useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { uploadParrillaMedia } from '@/lib/parrilla/upload-media'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

interface ParrillaMediaUploadProps {
  coverImageUrl: string
  onUploaded: (url: string) => void
  onCleared: () => void
  disabled?: boolean
}

/** Solo foto de portada — el video real (si lo hay) vive en la red social
 *  una vez publicado; acá solo hace falta identificar la pieza a simple
 *  vista, sirve igual para video, foto o carrusel. */
export function ParrillaMediaUpload({
  coverImageUrl,
  onUploaded,
  onCleared,
  disabled,
}: ParrillaMediaUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)
    setUploading(true)
    try {
      const { url } = await uploadParrillaMedia({ file })
      onUploaded(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir el archivo')
    }
    setUploading(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-2">
      {coverImageUrl ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverImageUrl} alt="" className="h-full w-full object-cover" />
          {!disabled && (
            <button
              type="button"
              onClick={onCleared}
              aria-label="Quitar foto de portada"
              className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/70"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 py-8 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-50"
        >
          {uploading ? (
            <p className="text-sm font-medium">Subiendo…</p>
          ) : (
            <>
              <ImagePlus className="h-6 w-6" />
              <p className="text-sm font-medium">Adjuntar foto/imagen de portada de la publicación</p>
            </>
          )}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleFileChange}
        className="hidden"
      />

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
