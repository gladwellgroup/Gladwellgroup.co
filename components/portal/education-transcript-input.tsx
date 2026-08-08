'use client'

import { useRef, useState } from 'react'
import { FileText, Mic, Upload, X } from 'lucide-react'
import { BrandTextarea } from '@/components/brand/brand-field'
import { ConfirmDialog } from '@/components/portal/confirm-dialog'
import { TRANSCRIPT_ACCEPT, normalizeTranscript } from '@/lib/education/transcript'
import { uploadTherapyMedia } from '@/lib/therapy/upload-media'

const AUDIO_ACCEPT = 'audio/*,video/mp4,.m4a,.mp3,.wav,.webm,.ogg'
/** Whisper rechaza archivos por encima de este tamaño. */
const WHISPER_LIMIT = 25 * 1024 * 1024

interface EducationTranscriptInputProps {
  sessionId: string
  texto: string
  audioUrl: string
  onTextoChange: (texto: string) => void
  onAudioChange: (url: string) => void
  disabled?: boolean
}

export function EducationTranscriptInput({
  sessionId,
  texto,
  audioUrl,
  onTextoChange,
  onAudioChange,
  disabled,
}: EducationTranscriptInputProps) {
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [confirmClearAudio, setConfirmClearAudio] = useState(false)
  const textFileRef = useRef<HTMLInputElement>(null)
  const audioFileRef = useRef<HTMLInputElement>(null)

  async function handleTranscriptFile(file: File) {
    setError(null)
    try {
      const raw = await file.text()
      const cleaned = normalizeTranscript(raw)
      if (!cleaned) {
        setError('El archivo no tiene texto legible')
        return
      }
      onTextoChange(cleaned)
    } catch {
      setError('No se pudo leer el archivo')
    }
  }

  async function handleAudioFile(file: File) {
    setError(null)
    if (file.size > WHISPER_LIMIT) {
      setError(
        'El audio supera los 25 MB que admite la transcripción automática. Sube la transcripción en texto.'
      )
      return
    }

    setUploading(true)
    try {
      const { url } = await uploadTherapyMedia({
        sessionId,
        type: 'audio',
        file,
        bucket: 'education-media',
      })
      onAudioChange(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir el audio')
    }
    setUploading(false)
  }

  const tieneTexto = Boolean(texto.trim())

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <BrandTextarea
          id="transcripcion_texto"
          label="Transcripción de la videollamada"
          placeholder="Pega aquí la transcripción, o sube el archivo que exporta Zoom, Meet o Teams."
          value={texto}
          onChange={(e) => onTextoChange(e.target.value)}
          rows={8}
          disabled={disabled}
        />

        {!disabled && (
          <button
            type="button"
            onClick={() => textFileRef.current?.click()}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <FileText className="h-4 w-4" />
            Subir archivo .txt, .vtt o .srt
          </button>
        )}

        <input
          ref={textFileRef}
          type="file"
          accept={TRANSCRIPT_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleTranscriptFile(file)
            e.target.value = ''
          }}
        />
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Mic className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Alternativa: subir el audio</p>
            <p className="text-xs text-muted-foreground">
              {tieneTexto
                ? 'Ya hay transcripción en texto, así que el audio no se usará.'
                : 'Se transcribe automáticamente. Más lento y limitado a 25 MB.'}
            </p>
          </div>
        </div>

        {audioUrl ? (
          <div className="flex items-center gap-2">
            <audio controls src={audioUrl} className="h-9 w-full" />
            {!disabled && (
              <button
                type="button"
                onClick={() => setConfirmClearAudio(true)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label="Quitar audio"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          !disabled && (
            <button
              type="button"
              onClick={() => audioFileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Subiendo...' : 'Subir audio de la sesión'}
            </button>
          )
        )}

        <input
          ref={audioFileRef}
          type="file"
          accept={AUDIO_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleAudioFile(file)
            e.target.value = ''
          }}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirmClearAudio}
        title="¿Quitar el audio de la sesión?"
        message="Podrás subir otro mientras la sesión siga en borrador."
        confirmLabel="Quitar"
        onConfirm={() => {
          setConfirmClearAudio(false)
          onAudioChange('')
        }}
        onCancel={() => setConfirmClearAudio(false)}
      />
    </div>
  )
}
