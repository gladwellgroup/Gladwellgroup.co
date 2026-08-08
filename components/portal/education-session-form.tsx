'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useAppRouter } from '@/hooks/use-app-router'
import { BrandField, BrandTextarea } from '@/components/brand/brand-field'
import { BrandButton } from '@/components/brand/brand-button'
import { PhotoUpload } from '@/components/portal/photo-upload'
import {
  EducationToolFields,
  type ToolData,
} from '@/components/portal/education-tool-fields'
import { EducationTranscriptInput } from '@/components/portal/education-transcript-input'
import {
  EducationAttendees,
  type AttendeeData,
} from '@/components/portal/education-attendees'
import {
  AttendanceQrSection,
  type AttendanceLinkData,
} from '@/components/portal/attendance-qr-section'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { parseDateOnly } from '@/lib/date'

interface SessionData {
  id: string
  title: string
  session_date: string
  admin_id: string
  status: string
  created_by: string
}

export interface EducationInputsData {
  ponente_nombre: string | null
  ponente_rol: string | null
  ponente_foto_url: string | null
  ponente_red_social: string | null
  descripcion_sesion: string | null
  objetivo: string | null
  notas_moderador: string | null
  frase_texto: string | null
  frase_autor: string | null
  capsulas_emprendimiento: string | null
  foto_sesion_url: string | null
  transcripcion_texto: string | null
  audio_url: string | null
}

interface EducationSessionFormProps {
  session: SessionData
  inputs: EducationInputsData | null
  tools: ToolData[]
  attendees: AttendeeData[]
  attendanceLink: AttendanceLinkData | null
  basePath: string
  hasDeliverable?: boolean
}

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 1500

const SAVE_STATUS_COPY: Record<SaveStatus, string> = {
  idle: '',
  dirty: 'Sin guardar',
  saving: 'Guardando…',
  saved: 'Guardado',
  error: 'Error al guardar',
}

/** Punto ámbar en el acordeón cuando falta un campo obligatorio. */
function RequiredDot({
  filled,
  reason = 'Obligatorio para crear el entregable',
}: {
  filled: boolean
  reason?: string
}) {
  if (filled) return null
  return (
    <span
      className="h-1.5 w-1.5 rounded-full bg-amber-500"
      aria-label={reason}
      title={reason}
    />
  )
}

export function EducationSessionForm({
  session,
  inputs,
  tools: initialTools,
  attendees,
  attendanceLink: initialAttendanceLink,
  basePath,
  hasDeliverable = false,
}: EducationSessionFormProps) {
  const router = useAppRouter()
  // Vive aquí (no dentro de AttendanceQrSection) porque el acordeón que lo
  // contiene desmonta su contenido al cerrarse; un link recién generado no
  // debe perderse solo por colapsar y volver a abrir la sección.
  const [attendanceLink, setAttendanceLink] = useState<AttendanceLinkData | null>(
    initialAttendanceLink
  )
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const [ponenteNombre, setPonenteNombre] = useState(inputs?.ponente_nombre ?? '')
  const [ponenteRol, setPonenteRol] = useState(inputs?.ponente_rol ?? '')
  const [ponenteFotoUrl, setPonenteFotoUrl] = useState(inputs?.ponente_foto_url ?? '')
  const [ponenteRedSocial, setPonenteRedSocial] = useState(inputs?.ponente_red_social ?? '')
  const [descripcionSesion, setDescripcionSesion] = useState(inputs?.descripcion_sesion ?? '')
  const [objetivo, setObjetivo] = useState(inputs?.objetivo ?? '')
  const [notasModerador, setNotasModerador] = useState(inputs?.notas_moderador ?? '')
  const [fraseTexto, setFraseTexto] = useState(inputs?.frase_texto ?? '')
  const [fraseAutor, setFraseAutor] = useState(inputs?.frase_autor ?? '')
  const [capsulas, setCapsulas] = useState(inputs?.capsulas_emprendimiento ?? '')
  const [fotoSesionUrl, setFotoSesionUrl] = useState(inputs?.foto_sesion_url ?? '')
  const [transcripcion, setTranscripcion] = useState(inputs?.transcripcion_texto ?? '')
  const [audioUrl, setAudioUrl] = useState(inputs?.audio_url ?? '')
  const [tools, setTools] = useState<ToolData[]>(
    initialTools.length > 0
      ? initialTools
      : [{ nombre: '', descripcion: null, url: null, orden: 0 }]
  )

  const isReadOnly = session.status !== 'borrador'

  // Refs para la cola single-flight: leer el estado más reciente sin closures
  // obsoletos.
  const stateRef = useRef({
    ponenteNombre,
    ponenteRol,
    ponenteFotoUrl,
    ponenteRedSocial,
    descripcionSesion,
    objetivo,
    notasModerador,
    fraseTexto,
    fraseAutor,
    capsulas,
    fotoSesionUrl,
    transcripcion,
    audioUrl,
    tools,
  })

  useEffect(() => {
    stateRef.current = {
      ponenteNombre,
      ponenteRol,
      ponenteFotoUrl,
      ponenteRedSocial,
      descripcionSesion,
      objetivo,
      notasModerador,
      fraseTexto,
      fraseAutor,
      capsulas,
      fotoSesionUrl,
      transcripcion,
      audioUrl,
      tools,
    }
  })

  const isSavingRef = useRef(false)
  const pendingRef = useRef(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)

  const buildPayload = useCallback(() => {
    const s = stateRef.current
    const validTools = s.tools
      .filter((tool) => tool.nombre.trim().length > 0)
      .map((tool, i) => ({
        nombre: tool.nombre.trim(),
        descripcion: tool.descripcion?.trim() || undefined,
        url: tool.url?.trim() || undefined,
        orden: i,
      }))

    return {
      session_id: session.id,
      ponente_nombre: s.ponenteNombre.trim() || undefined,
      ponente_rol: s.ponenteRol.trim() || undefined,
      ponente_foto_url: s.ponenteFotoUrl || undefined,
      ponente_red_social: s.ponenteRedSocial.trim() || undefined,
      descripcion_sesion: s.descripcionSesion.trim() || undefined,
      objetivo: s.objetivo.trim() || undefined,
      notas_moderador: s.notasModerador.trim() || undefined,
      frase_texto: s.fraseTexto.trim() || undefined,
      frase_autor: s.fraseAutor.trim() || undefined,
      capsulas_emprendimiento: s.capsulas.trim() || undefined,
      foto_sesion_url: s.fotoSesionUrl || undefined,
      transcripcion_texto: s.transcripcion.trim() || undefined,
      transcripcion_fuente: s.transcripcion.trim()
        ? ('texto' as const)
        : s.audioUrl
          ? ('audio' as const)
          : undefined,
      audio_url: s.audioUrl || undefined,
      tools: validTools,
    }
  }, [session.id])

  const saveNow = useCallback(async () => {
    if (isReadOnly) return
    if (isSavingRef.current) {
      pendingRef.current = true
      return
    }

    isSavingRef.current = true

    do {
      pendingRef.current = false
      setSaveStatus('saving')
      setSaveErrorMessage(null)

      try {
        const res = await fetch('/api/education/inputs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload()),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setSaveStatus('error')
          setSaveErrorMessage(data.error ?? null)
        } else {
          setSaveStatus('saved')
        }
      } catch {
        setSaveStatus('error')
        setSaveErrorMessage('Error de red al guardar')
      }
    } while (pendingRef.current)

    isSavingRef.current = false
  }, [buildPayload, isReadOnly])

  useEffect(() => {
    if (isReadOnly) return
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    setSaveStatus('dirty')

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      saveNow()
    }, DEBOUNCE_MS)

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [
    ponenteNombre,
    ponenteRol,
    ponenteRedSocial,
    descripcionSesion,
    objetivo,
    notasModerador,
    fraseTexto,
    fraseAutor,
    capsulas,
    transcripcion,
    tools,
    isReadOnly,
    saveNow,
  ])

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (saveStatus === 'dirty' || saveStatus === 'saving') {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [saveStatus])

  /** Las URLs de media se persisten de inmediato: el usuario ya esperó la
   *  subida, no tiene sentido dejarlas en el debounce. */
  function saveImmediately() {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    saveNow()
  }

  async function handleCreateDeliverable() {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    setGenerateError(null)
    await saveNow()

    setGenerating(true)
    try {
      const res = await fetch('/api/education/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setGenerateError(data.error ?? 'No se pudo generar el entregable')
        setGenerating(false)
        return
      }

      router.push(`${basePath}/${session.id}/entregable`)
      router.refresh()
    } catch {
      setGenerateError('Error de red al generar el entregable')
      setGenerating(false)
    }
  }

  // Igual a la regla del backend (app/api/education/generate/route.ts): la IA
  // puede partir de transcripción/audio, o de las notas del moderador si no
  // hay grabación.
  const tieneFuente =
    Boolean(transcripcion.trim()) ||
    Boolean(audioUrl) ||
    Boolean(notasModerador.trim())

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex flex-col items-center text-center gap-1 pt-6 sm:pt-8">
        <Link
          href={basePath}
          className="mb-4 inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        <h1 className="text-balance text-xl sm:text-2xl font-bold gladwell-gradient-text">
          {session.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {parseDateOnly(session.session_date).toLocaleDateString('es-CO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <Accordion type="single" collapsible>
        <AccordionItem value="ponente">
          <AccordionTrigger className="text-base font-semibold">
            Ponente
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <BrandField
              id="ponente_nombre"
              label="Nombre del ponente"
              placeholder="Nombre completo"
              value={ponenteNombre}
              onChange={(e) => setPonenteNombre(e.target.value)}
              disabled={isReadOnly}
            />
            <BrandField
              id="ponente_rol"
              label="Cargo o descripción"
              placeholder="Ej: Fundador de Acme, inversionista ángel"
              value={ponenteRol}
              onChange={(e) => setPonenteRol(e.target.value)}
              disabled={isReadOnly}
            />
            <BrandField
              id="ponente_red_social"
              label="Red social principal"
              placeholder="@handle o URL"
              value={ponenteRedSocial}
              onChange={(e) => setPonenteRedSocial(e.target.value)}
              disabled={isReadOnly}
            />
            <BrandTextarea
              id="descripcion_sesion"
              label="Descripción de la sesión"
              placeholder="De qué trató la sesión, en un par de frases"
              value={descripcionSesion}
              onChange={(e) => setDescripcionSesion(e.target.value)}
              rows={3}
              disabled={isReadOnly}
            />
            <div className="flex flex-col gap-1.5">
              <span className="modal-label">Foto del ponente</span>
              <PhotoUpload
                sessionId={session.id}
                currentUrl={ponenteFotoUrl}
                onUploaded={(url) => {
                  setPonenteFotoUrl(url)
                  stateRef.current.ponenteFotoUrl = url
                  saveImmediately()
                }}
                disabled={isReadOnly}
                bucket="education-media"
                type="ponente"
                label="Subir foto del ponente"
                shape="circle"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="objetivo">
          <AccordionTrigger className="text-base font-semibold">
            <span className="flex items-center gap-2">
              Objetivo de la sesión
              <RequiredDot filled={Boolean(objetivo.trim())} />
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <BrandTextarea
              id="objetivo"
              label="¿Qué debe lograr esta sesión en los asistentes?"
              placeholder="La IA mide la transcripción contra este objetivo para sacar las conclusiones."
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              rows={4}
              disabled={isReadOnly}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="notas">
          <AccordionTrigger className="text-base font-semibold">
            Notas del moderador
          </AccordionTrigger>
          <AccordionContent>
            <BrandTextarea
              id="notas_moderador"
              label="Lo que importó de verdad en la sesión"
              placeholder="Sirven de lente para filtrar la transcripción. No se copian literal en el entregable."
              value={notasModerador}
              onChange={(e) => setNotasModerador(e.target.value)}
              rows={5}
              disabled={isReadOnly}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="herramientas">
          <AccordionTrigger className="text-base font-semibold">
            Herramientas recomendadas
          </AccordionTrigger>
          <AccordionContent>
            <EducationToolFields
              tools={tools}
              onChange={setTools}
              disabled={isReadOnly}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="capsulas">
          <AccordionTrigger className="text-base font-semibold">
            Cápsulas de emprendimiento
          </AccordionTrigger>
          <AccordionContent>
            <BrandTextarea
              id="capsulas"
              label="Una cápsula por línea"
              placeholder="Si lo dejas vacío, la IA las propone a partir de la transcripción."
              value={capsulas}
              onChange={(e) => setCapsulas(e.target.value)}
              rows={5}
              disabled={isReadOnly}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="frase">
          <AccordionTrigger className="text-base font-semibold">
            Frase de la sesión
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <BrandTextarea
              id="frase_texto"
              label="Frase"
              placeholder="La frase que resume el espíritu de la sesión"
              value={fraseTexto}
              onChange={(e) => setFraseTexto(e.target.value)}
              rows={3}
              disabled={isReadOnly}
            />
            <BrandField
              id="frase_autor"
              label="Autor"
              placeholder="Nombre del autor"
              value={fraseAutor}
              onChange={(e) => setFraseAutor(e.target.value)}
              disabled={isReadOnly}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="foto">
          <AccordionTrigger className="text-base font-semibold">
            Foto asistentes
          </AccordionTrigger>
          <AccordionContent>
            <PhotoUpload
              sessionId={session.id}
              currentUrl={fotoSesionUrl}
              onUploaded={(url) => {
                setFotoSesionUrl(url)
                stateRef.current.fotoSesionUrl = url
                saveImmediately()
              }}
              disabled={isReadOnly}
              bucket="education-media"
              label="Subir foto de los asistentes"
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="asistentes">
          <AccordionTrigger className="text-base font-semibold">
            <span className="flex items-center gap-2">
              Asistentes
              <RequiredDot
                filled={attendees.length > 0}
                reason="Obligatorio para enviar el entregable"
              />
              {attendees.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({attendees.length})
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <AttendanceQrSection
              sessionId={session.id}
              program="education"
              link={attendanceLink}
              onLinkChange={setAttendanceLink}
              disabled={isReadOnly}
            />
            <EducationAttendees
              sessionId={session.id}
              attendees={attendees}
              deliverySent={session.status === 'entregado'}
              disabled={isReadOnly}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="transcripcion">
          <AccordionTrigger className="text-base font-semibold">
            <span className="flex items-center gap-2">
              Transcripción de la videollamada
              <RequiredDot filled={tieneFuente} />
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <EducationTranscriptInput
              sessionId={session.id}
              texto={transcripcion}
              audioUrl={audioUrl}
              onTextoChange={setTranscripcion}
              onAudioChange={(url) => {
                setAudioUrl(url)
                stateRef.current.audioUrl = url
                saveImmediately()
              }}
              disabled={isReadOnly}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p
          role={generateError || saveStatus === 'error' ? 'alert' : undefined}
          aria-live="polite"
          className={`text-xs transition-opacity duration-200 ${
            generateError || saveStatus === 'error'
              ? 'text-red-500'
              : saveStatus === 'saved'
                ? 'text-green-500'
                : 'text-muted-foreground'
          } ${!generateError && saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'}`}
        >
          {generateError ??
            (saveStatus === 'error'
              ? (saveErrorMessage ?? SAVE_STATUS_COPY.error)
              : SAVE_STATUS_COPY[saveStatus])}
        </p>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {hasDeliverable && (
            <BrandButton
              type="button"
              variant="secondary"
              size="sm"
              className="w-auto"
              onClick={() => router.push(`${basePath}/${session.id}/entregable`)}
            >
              Ver / editar entregable
            </BrandButton>
          )}
          {session.status !== 'entregado' && (
            <BrandButton
              onClick={handleCreateDeliverable}
              disabled={(!isReadOnly && saveStatus === 'saving') || generating}
              size="sm"
              className="w-auto shrink-0"
            >
              {generating
                ? 'Generando…'
                : hasDeliverable
                  ? 'Regenerar con IA'
                  : 'Crear el entregable'}
            </BrandButton>
          )}
        </div>
      </div>
    </div>
  )
}
