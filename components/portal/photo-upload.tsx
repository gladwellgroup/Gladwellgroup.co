'use client'

import { useState, useRef } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { uploadTherapyMedia } from '@/lib/therapy/upload-media'
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
  sessionId: string
  currentUrl: string
  onUploaded: (url: string) => void
  disabled?: boolean
}

export function PhotoUpload({
  sessionId,
  currentUrl,
  onUploaded,
  disabled,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string>(currentUrl)
  const [confirmClear, setConfirmClear] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      const { url } = await uploadTherapyMedia({
        sessionId,
        type: 'foto',
        file: uploadFile,
      })

      URL.revokeObjectURL(localPreview)
      setPreview(url)
      onUploaded(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir la foto')
      setPreview(currentUrl)
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
    setPreview('')
    onUploaded('')
  }

  const busy = uploading || converting

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="relative">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Foto de la sesión"
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
              {converting ? 'Convirtiendo...' : uploading ? 'Subiendo...' : 'Subir foto de la sesión'}
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
        title="¿Quitar la foto de la sesión?"
        message="Podrás subir otra en cualquier momento mientras la sesión siga en borrador."
        confirmLabel="Quitar"
        onConfirm={clearPhoto}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
