'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Square, Upload, Trash2 } from 'lucide-react'
import { BrandButton } from '@/components/brand/brand-button'
import { uploadTherapyMedia, normalizeMime } from '@/lib/therapy/upload-media'
import { nowMs, recordedSeconds } from '@/lib/therapy/recording'
import { ConfirmDialog } from '@/components/portal/confirm-dialog'
import type { AudioData } from '@/components/portal/session-detail-form'

interface AudioRecorderProps {
  sessionId: string
  audios: AudioData[]
  onAudioAdded: (audio: AudioData) => void
  onAudioRemoved: (audioId: string) => void
  disabled?: boolean
}

const MAX_DURATION = 1800

function getPreferredMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  if (MediaRecorder.isTypeSupported('audio/ogg')) return 'audio/ogg'
  return 'audio/webm'
}

function getExtForMime(mime: string): string {
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AudioRecorder({
  sessionId,
  audios,
  onAudioAdded,
  onAudioRemoved,
  disabled,
}: AudioRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Todo lo que vive mientras se graba, en un solo objeto (su identidad no cambia; solo se mutan sus campos): el
  // `onstop` del grabador y el cierre al desmontar leen siempre lo último, sin clausuras viejas.
  const capture = useRef({
    recorder: null as MediaRecorder | null,
    stream: null as MediaStream | null,
    timer: null as ReturnType<typeof setInterval> | null,
    startedAt: 0,
    /** Al desmontar a mitad de una grabación se descarta: no se sube un audio que nadie va a ver. */
    discard: false,
  })
  const chunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const stopRecording = useCallback(() => {
    const state = capture.current
    if (state.recorder && state.recorder.state !== 'inactive') {
      state.recorder.stop()
    }
    if (state.timer) {
      clearInterval(state.timer)
      state.timer = null
    }
    setRecording(false)
  }, [])

  // Navegar durante una grabación dejaba el micrófono abierto (y el intervalo corriendo): al desmontar se detiene todo
  // y se suelta el micrófono.
  useEffect(() => {
    const state = capture.current
    return () => {
      state.discard = true
      if (state.timer) clearInterval(state.timer)
      if (state.recorder && state.recorder.state !== 'inactive') state.recorder.stop()
      state.stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getPreferredMimeType()
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      const state = capture.current
      state.discard = false

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (state.discard) return
        const baseMime = normalizeMime(mimeType) || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: baseMime })
        const ext = getExtForMime(baseMime)
        const file = new File([blob], `grabacion.${ext}`, { type: baseMime })
        // La duración sale del reloj al parar: el `elapsed` que veía esta función era el del momento de EMPEZAR (0),
        // y todas las grabaciones se guardaban con duración 0.
        await uploadFile(file, recordedSeconds(state.startedAt, nowMs(), MAX_DURATION))
        setElapsed(0)
      }

      state.stream = stream
      state.recorder = recorder
      recorder.start()
      state.startedAt = nowMs()
      setRecording(true)
      setElapsed(0)

      state.timer = setInterval(() => {
        const seconds = recordedSeconds(state.startedAt, nowMs(), MAX_DURATION)
        setElapsed(seconds)
        // El tope se aplica aquí mismo, no desde un efecto que mira el estado un render después.
        if (seconds >= MAX_DURATION) stopRecording()
      }, 1000)
    } catch {
      setError('No se pudo acceder al micrófono')
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadFile(file)
    e.target.value = ''
  }

  async function uploadFile(file: File, duration?: number) {
    setUploading(true)
    setError(null)

    try {
      const { url } = await uploadTherapyMedia({
        sessionId,
        type: 'audio',
        file,
      })

      const metaRes = await fetch('/api/therapy/audios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          audio_url: url,
          duracion_segundos: duration ?? undefined,
        }),
      })

      if (!metaRes.ok) {
        const data = await metaRes.json()
        setError(data.error ?? 'Error al registrar audio')
        setUploading(false)
        return
      }

      const savedAudio: AudioData = await metaRes.json()
      onAudioAdded(savedAudio)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir audio')
    }

    setUploading(false)
  }

  async function handleDelete(audioId: string) {
    setConfirmDeleteId(null)
    setError(null)
    try {
      const res = await fetch(`/api/therapy/audios?id=${audioId}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'No se pudo eliminar el audio')
        return
      }
      onAudioRemoved(audioId)
    } catch {
      setError('Error de red al eliminar el audio')
    }
  }

  const hasAudio = audios.length > 0
  const showControls = !disabled && !hasAudio

  return (
    <div className="space-y-4">
      {hasAudio && (
        <div className="space-y-2">
          {audios.map((audio) => (
            <div
              key={audio.id}
              className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    Audio de la sesión
                  </p>
                  {audio.duracion_segundos != null && (
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(audio.duracion_segundos)}
                    </p>
                  )}
                </div>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(audio.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive pointer-coarse:size-11"
                    aria-label="Eliminar audio"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {audio.audio_url ? (
                <audio src={audio.audio_url} controls className="w-full" />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Solo el moderador o coadministrador de esta sesión puede escuchar este audio.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {showControls && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Un solo audio de hasta 30 minutos por sesión.
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            {recording ? (
              <div className="flex items-center gap-3">
                <BrandButton
                  variant="secondary"
                  size="sm"
                  className="w-auto"
                  onClick={stopRecording}
                >
                  <Square className="h-4 w-4 mr-1.5 fill-red-500 text-red-500" />
                  Detener
                </BrandButton>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                  <span className="text-sm font-mono tabular-nums text-muted-foreground">
                    {formatDuration(elapsed)} / {formatDuration(MAX_DURATION)}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <BrandButton
                  variant="secondary"
                  size="sm"
                  className="w-auto"
                  onClick={startRecording}
                  disabled={uploading}
                >
                  <Mic className="h-4 w-4 mr-1.5" />
                  Grabar
                </BrandButton>
                <BrandButton
                  variant="secondary"
                  size="sm"
                  className="w-auto"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  {uploading ? 'Subiendo...' : 'Subir archivo'}
                </BrandButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.m4a"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </>
            )}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-500">{error}</p>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="¿Eliminar este audio?"
        message="Se borrará permanentemente y no podrás deshacerlo."
        confirmLabel="Eliminar"
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
