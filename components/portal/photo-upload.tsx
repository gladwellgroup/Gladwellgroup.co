'use client'

import { useState, useRef } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { ConfirmDialog } from '@/components/portal/confirm-dialog'

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif'
const HEIC_EXTENSIONS = ['heic', 'heif']

function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return HEIC_EXTENSIONS.includes(ext)
}

function isHeicFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return HEIC_EXTENSIONS.includes(ext) || file.type === 'image/heic' || file.type === 'image/heif'
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import('heic2any')).default
  const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
  const jpegBlob = Array.isArray(result) ? result[0] : result
  const baseName = file.name.replace(/\.[^.]+$/, '')
  return new File([jpegBlob], `${baseName}.jpg`, { type: 'image/jpeg' })
}

interface PhotoUploadProps {
  currentUrl: string
  /** Sube el archivo a donde corresponda (bucket/path propios de quien use
   *  este componente) y devuelve la URL pública — terapia/educación usan
   *  `uploadTherapyMedia`, el avatar de perfil usa `uploadAvatar`. Todo lo
   *  demás (HEIC, drag&drop, preview, confirmar antes de quitar) es
   *  genérico y vive acá. */
  onUpload: (file: File) => Promise<{ url: string }>
  onUploaded: (url: string) => void
  disabled?: boolean
  label?: string
  /** Recorte circular para retratos (ponente, avatar de perfil). */
  shape?: 'wide' | 'circle'
  confirmTitle?: string
  confirmMessage?: string
}

export function PhotoUpload({
  currentUrl,
  onUpload,
  onUploaded,
  disabled,
  label = 'Subir foto de la sesión',
  shape = 'wide',
  confirmTitle = '¿Quitar la foto de la sesión?',
  confirmMessage = 'Podrás subir otra en cualquier momento mientras la sesión siga en borrador.',
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string>(currentUrl)
  const [confirmClear, setConfirmClear] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Última URL efectivamente guardada — no el prop `currentUrl`, que queda
  // fijo en lo que había al montar. Si una segunda subida falla, hay que
  // volver a lo último que sí se guardó, no a la foto original de la sesión.
  const lastSavedUrlRef = useRef(currentUrl)

  async function handleFile(file: File) {
    setError(null)

    let uploadFile = file
    if (isHeicFile(file)) {
      setConverting(true)
      try {
        uploadFile = await convertHeicToJpeg(file)
      } catch {
        setError('No se pudo convertir la foto HEIC')
        setConverting(false)
        return
      }
      setConverting(false)
    }

    setUploading(true)
    const localPreview = URL.createObjectURL(uploadFile)
    setPreview(localPreview)

    try {
      const { url } = await onUpload(uploadFile)

      URL.revokeObjectURL(localPreview)
      lastSavedUrlRef.current = url
      setPreview(url)
      onUploaded(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir la foto')
      setPreview(lastSavedUrlRef.current)
    }

    setUploading(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file && isImageFile(file)) {
      handleFile(file)
    }
  }

  function clearPhoto() {
    setConfirmClear(false)
    lastSavedUrlRef.current = ''
    setPreview('')
    onUploaded('')
  }

  const busy = uploading || converting
  const isCircle = shape === 'circle'

  return (
    <div className="space-y-3">
      {isCircle ? (
        <div className="flex flex-col items-center gap-2">
          {preview ? (
            <div className="relative w-32">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || busy}
                className="block aspect-square w-full overflow-hidden rounded-full border border-border bg-muted/30 disabled:pointer-events-none"
                aria-label="Cambiar foto"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt={label} className="h-full w-full object-cover" />
                {busy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <p className="text-xs font-medium text-white">
                      {converting ? 'Convirtiendo...' : 'Subiendo...'}
                    </p>
                  </div>
                )}
              </button>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/70"
                  aria-label="Eliminar foto"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              disabled={disabled || busy}
              className="flex aspect-square w-32 items-center justify-center rounded-full border-2 border-dashed border-border bg-muted/20 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-50"
            >
              <ImagePlus className="h-8 w-8" />
            </button>
          )}
          <div className="text-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || busy}
              className="text-sm font-medium text-[#A78BFA] transition-colors hover:text-[#7C3AED] disabled:pointer-events-none disabled:text-muted-foreground disabled:hover:text-muted-foreground"
            >
              {converting ? 'Convirtiendo...' : uploading ? 'Subiendo...' : preview ? 'Cambiar foto' : label}
            </button>
            {!preview && <p className="mt-0.5 text-xs text-muted-foreground/70">JPG, PNG, WebP o HEIC</p>}
          </div>
        </div>
      ) : preview ? (
        <div className="relative">
          <div className="relative w-full overflow-hidden rounded-xl border border-border bg-muted/30 aspect-[4/3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt={label}
              className="h-full w-full object-cover"
            />
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <p className="text-sm font-medium text-white">
                  {converting ? 'Convirtiendo...' : 'Subiendo...'}
                </p>
              </div>
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/70"
              aria-label="Eliminar foto"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          disabled={disabled || busy}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-12 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-50"
        >
          <ImagePlus className="h-8 w-8" />
          <div className="text-center">
            <p className="text-sm font-medium">
              {converting ? 'Convirtiendo...' : uploading ? 'Subiendo...' : label}
            </p>
            <p className="text-xs mt-1">JPG, PNG, WebP o HEIC (se convierte a JPEG)</p>
          </div>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        onChange={handleFileChange}
        className="hidden"
      />

      {error && (
        <p role="alert" className="text-sm text-red-500">{error}</p>
      )}

      <ConfirmDialog
        open={confirmClear}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel="Quitar"
        onConfirm={clearPhoto}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
