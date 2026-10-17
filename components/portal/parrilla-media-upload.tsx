'use client'

import { useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { COVER_DEFAULT_RATIO, coverRatio } from '@/lib/parrilla/cover'
import { IMAGE_ACCEPT, uploadImage } from '@/lib/storage/upload-image'
import { cn } from '@/lib/utils'

interface ParrillaMediaUploadProps {
  coverImageUrl: string
  onUploaded: (url: string) => void
  onCleared: () => void
  disabled?: boolean
}

/** Altura máxima de la portada en el modal: una foto vertical (reel, story) a
 *  todo el ancho ocuparía más que la pantalla. `dvh` y no `vh`: `vh` ignora las
 *  barras del navegador del iPad. */
const COVER_MAX_HEIGHT = 'min(60dvh, 32rem)'

/** La portada, en su propia proporción: un reel (9:16), el feed de Instagram
 *  (4:5 o 1:1), un post de LinkedIn (1,91:1) o un video horizontal (16:9) se ven
 *  completos, sin recorte. El contenedor toma la forma de la foto, centrado, y
 *  una vertical se queda en el alto máximo en vez de crecer sin límite.
 *
 *  La proporción se conoce al cargar la foto: hasta entonces se reserva un 16:9
 *  con el barrido de carga. El `key` de quien lo usa reinicia el estado si la
 *  foto cambia. */
function CoverPreview({ url, onClear }: { url: string; onClear?: () => void }) {
  const [ratio, setRatio] = useState<number | null>(null)
  const loaded = ratio !== null
  const shown = ratio ?? COVER_DEFAULT_RATIO

  return (
    <div
      className={cn(
        'relative mx-auto overflow-hidden rounded-xl border border-border',
        loaded ? 'bg-muted/30' : 'skeleton-shimmer'
      )}
      style={{
        aspectRatio: shown,
        width: loaded ? `min(100%, calc(${COVER_MAX_HEIGHT} * ${shown}))` : '100%',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        // `contain` y no `cover`: con la proporción exacta no sobra nada, y en los
        // extremos (más allá del tope) la foto se ve entera en vez de recortada.
        className={cn('h-full w-full object-contain', !loaded && 'opacity-0')}
        onLoad={(event) =>
          setRatio(
            coverRatio(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight) ??
              COVER_DEFAULT_RATIO
          )
        }
        // Una foto rota no deja el barrido girando para siempre.
        onError={() => setRatio(COVER_DEFAULT_RATIO)}
      />
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Quitar foto de portada"
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/70 pointer-coarse:h-11 pointer-coarse:w-11"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
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
      const { url } = await uploadImage({ bucket: 'parrilla-media', file })
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
        <CoverPreview
          key={coverImageUrl}
          url={coverImageUrl}
          onClear={disabled ? undefined : onCleared}
        />
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
        accept={IMAGE_ACCEPT}
        onChange={handleFileChange}
        className="hidden"
      />

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
