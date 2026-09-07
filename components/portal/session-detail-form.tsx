'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useAppRouter } from '@/hooks/use-app-router'
import { BrandField, BrandTextarea } from '@/components/brand/brand-field'
import { BrandButton } from '@/components/brand/brand-button'
import { CofounderFields } from '@/components/portal/cofounder-fields'
import { TeamPicker, type TeamPickerOption } from '@/components/portal/team-picker'
import { AudioRecorder } from '@/components/portal/audio-recorder'
import { PhotoUpload } from '@/components/portal/photo-upload'
import { uploadTherapyMedia } from '@/lib/therapy/upload-media'
import {
  AttendanceQrSection,
  type AttendanceLinkData,
} from '@/components/portal/attendance-qr-section'
import {
  TherapyAttendees,
  type TherapyAttendeeData,
} from '@/components/portal/therapy-attendees'
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
  moderator_id: string
  pillar: string | null
  status: string
  created_by: string
}

interface InputsData {
  reto_problema: string | null
  recomendaciones_incomodas: string | null
  foto_sesion_url: string | null
  frase_texto: string | null
  frase_autor: string | null
}

export interface InvitadoSummary {
  id: string
  nombre: string
  descripcion: string | null
  red_social: string | null
  pagina_web: string | null
}

export interface CofounderData {
  id?: string
  nombre: string
  whatsapp: string | null
  correo: string | null
  orden: number
}

export interface AudioData {
  id: string
  audio_url: string
  autor_nombre: string | null
  duracion_segundos: number | null
  created_at: string
}

interface SessionDetailFormProps {
  session: SessionData
  inputs: InputsData | null
  invitado: InvitadoSummary | null
  cofounders: CofounderData[]
  audios: AudioData[]
  attendanceLink: AttendanceLinkData | null
  attendees: TherapyAttendeeData[]
  basePath: string
  hasDeliverable?: boolean
  /** Solo se reciben desde la página de super_admin — su sola presencia es
   *  lo que decide si se muestra el selector de coadministrador(es). */
  communityAdmins?: TeamPickerOption[]
  /** Coadministradores actuales de la sesión — acceso total de edición
   *  (incluye ver contacto), igual que el moderador original. Solo se
   *  editan desde la vista de super_admin (mismo gate que communityAdmins). */
  coAdminIds?: string[]
  /** false para un community_admin que ve una sesión ajena (con el módulo
   *  de solo lectura, o delegado) — bloquea todo el formulario y oculta las
   *  acciones de administrar, sin ocultar la información en sí. */
  canEdit?: boolean
  /** true cuando el visor no puede ver WhatsApp/correo de fundadores ni de
   *  asistentes — el dato real ya llega redactado desde el servidor, esto
   *  solo decide si se muestra "Oculto" en su lugar. */
  hideContact?: boolean
  /** Controla ver/editar "Recomendaciones incómodas" — más restrictivo que
   *  canEdit a propósito (solo moderador/coadministrador/super_admin, ni
   *  siquiera el creador si no es también el moderador). El valor real ya
   *  llega en null desde el servidor cuando es false, así que este prop es
   *  solo para decidir si se renderiza la sección, no para ocultar nada por
   *  CSS. Default true: en la vista de super_admin, que no manda este prop,
   *  siempre puede verla. */
  canEditRecomendaciones?: boolean
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

export function SessionDetailForm({
  session,
  inputs,
  invitado,
  cofounders: initialCofounders,
  audios: initialAudios,
  attendanceLink: initialAttendanceLink,
  attendees,
  basePath,
  hasDeliverable = false,
  communityAdmins,
  coAdminIds: initialCoAdminIds = [],
  canEdit = true,
  hideContact = false,
  canEditRecomendaciones = true,
}: SessionDetailFormProps) {
  const router = useAppRouter()
  const [coAdminIds, setCoAdminIds] = useState<string[]>(initialCoAdminIds)
  const [coAdminSaving, setCoAdminSaving] = useState(false)
  const [coAdminError, setCoAdminError] = useState<string | null>(null)

  async function handleToggleCoAdmin(id: string) {
    // Sin esto, dos clics rápidos disparan dos PATCH en paralelo — si el de
    // la selección anterior responde después del más reciente, pisa el
    // estado nuevo con uno viejo. Un guard simple evita la carrera del
    // todo: nunca hay dos solicitudes en vuelo a la vez.
    if (coAdminSaving) return
    const previous = coAdminIds
    const next = coAdminIds.includes(id)
      ? coAdminIds.filter((existing) => existing !== id)
      : [...coAdminIds, id]
    setCoAdminIds(next)
    setCoAdminSaving(true)
    setCoAdminError(null)
    try {
      const res = await fetch(`/api/therapy/sessions/${session.id}/co-admins`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ co_admin_ids: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setCoAdminIds(previous)
        setCoAdminError(data.error ?? 'No se pudo actualizar los coadministradores')
      }
    } catch {
      setCoAdminIds(previous)
      setCoAdminError('Error de red al actualizar')
    } finally {
      setCoAdminSaving(false)
    }
  }
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

  // Datos de la empresa (invitado), editables aquí mismo — mismo autoguardado
  // debounced que el resto del formulario, sin botón separado.
  const [empresaNombre, setEmpresaNombre] = useState(invitado?.nombre ?? '')
  const [empresaDescripcion, setEmpresaDescripcion] = useState(invitado?.descripcion ?? '')
  const [empresaRedSocial, setEmpresaRedSocial] = useState(invitado?.red_social ?? '')
  const [empresaPaginaWeb, setEmpresaPaginaWeb] = useState(invitado?.pagina_web ?? '')

  const [retoProblema, setRetoProblema] = useState(inputs?.reto_problema ?? '')
  const [recomendacionesIncomodas, setRecomendacionesIncomodas] = useState(inputs?.recomendaciones_incomodas ?? '')
  const [fotoSesionUrl, setFotoSesionUrl] = useState(inputs?.foto_sesion_url ?? '')
  const [fraseTexto, setFraseTexto] = useState(inputs?.frase_texto ?? '')
  const [fraseAutor, setFraseAutor] = useState(inputs?.frase_autor ?? '')
  const [cofounders, setCofounders] = useState<CofounderData[]>(
    initialCofounders.length > 0
      ? initialCofounders
      : [{ nombre: '', whatsapp: null, correo: null, orden: 0 }]
  )
  const [audios, setAudios] = useState<AudioData[]>(initialAudios)

  const isReadOnly = !canEdit || session.status !== 'borrador'

  // Refs for single-flight queue — read latest state without stale closures
  const retoRef = useRef(retoProblema)
  const recomendacionesRef = useRef(recomendacionesIncomodas)
  const fotoRef = useRef(fotoSesionUrl)
  const cofoundersRef = useRef(cofounders)
  const empresaNombreRef = useRef(empresaNombre)
  const empresaDescripcionRef = useRef(empresaDescripcion)
  const empresaRedSocialRef = useRef(empresaRedSocial)
  const empresaPaginaWebRef = useRef(empresaPaginaWeb)
  const fraseTextoRef = useRef(fraseTexto)
  const fraseAutorRef = useRef(fraseAutor)

  useEffect(() => {
    retoRef.current = retoProblema
    recomendacionesRef.current = recomendacionesIncomodas
    fotoRef.current = fotoSesionUrl
    cofoundersRef.current = cofounders
    empresaNombreRef.current = empresaNombre
    empresaDescripcionRef.current = empresaDescripcion
    empresaRedSocialRef.current = empresaRedSocial
    empresaPaginaWebRef.current = empresaPaginaWeb
    fraseTextoRef.current = fraseTexto
    fraseAutorRef.current = fraseAutor
  })

  const isSavingRef = useRef(false)
  const pendingRef = useRef(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)

  const buildPayload = useCallback(() => {
    const validCofounders = cofoundersRef.current
      .filter((c) => c.nombre.trim().length > 0)
      .map((c, i) => ({
        nombre: c.nombre.trim(),
        whatsapp: c.whatsapp?.trim() || undefined,
        correo: c.correo?.trim() || undefined,
        orden: i,
      }))

    return {
      session_id: session.id,
      reto_problema: retoRef.current.trim() || undefined,
      recomendaciones_incomodas: recomendacionesRef.current.trim() || undefined,
      foto_sesion_url: fotoRef.current || undefined,
      frase_texto: fraseTextoRef.current.trim() || undefined,
      frase_autor: fraseAutorRef.current.trim() || undefined,
      cofounders: validCofounders,
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
        const payload = buildPayload()
        const requests = [
          fetch('/api/therapy/inputs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        ]

        if (invitado) {
          requests.push(
            fetch(`/api/therapy/invitados/${invitado.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nombre: empresaNombreRef.current,
                descripcion: empresaDescripcionRef.current || undefined,
                red_social: empresaRedSocialRef.current || undefined,
                pagina_web: empresaPaginaWebRef.current || undefined,
              }),
            })
          )
        }

        const results = await Promise.all(requests)
        const failed = results.find((r) => !r.ok)

        if (failed) {
          const data = await failed.json().catch(() => ({}))
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
  }, [buildPayload, isReadOnly, invitado])

  // Debounced autosave on text/cofounders changes
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
    retoProblema,
    recomendacionesIncomodas,
    cofounders,
    empresaNombre,
    empresaDescripcion,
    empresaRedSocial,
    empresaPaginaWeb,
    fraseTexto,
    fraseAutor,
    isReadOnly,
    saveNow,
  ])

  // beforeunload warning when dirty or saving
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (saveStatus === 'dirty' || saveStatus === 'saving') {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [saveStatus])

  async function handleCreateDeliverable() {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    setGenerateError(null)
    await saveNow()

    setGenerating(true)
    try {
      const res = await fetch('/api/therapy/generate', {
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

  // Photo: persist immediately via same single-flight queue
  function handlePhotoUploaded(url: string) {
    setFotoSesionUrl(url)
    fotoRef.current = url
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    saveNow()
  }

  function handleAudioAdded(audio: AudioData) {
    setAudios((prev) => [...prev, audio])
  }

  function handleAudioRemoved(audioId: string) {
    setAudios((prev) => prev.filter((a) => a.id !== audioId))
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-col items-center text-center gap-1 pt-6 sm:pt-8">
        <Link
          href={basePath}
          className="mb-4 inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold gladwell-gradient-text">
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

      {communityAdmins && (
        <Accordion type="single" collapsible className="mx-auto w-full max-w-sm">
          <AccordionItem value="coadministradores">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                Integrar coadministrador de la sesión
                {coAdminIds.length > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({coAdminIds.length})
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="flex flex-col items-center gap-2 text-center">
              <TeamPicker
                options={communityAdmins}
                selected={coAdminIds}
                onToggle={handleToggleCoAdmin}
                size="lg"
              />
              {coAdminSaving && (
                <p className="text-xs text-muted-foreground">Guardando…</p>
              )}
              {coAdminError && (
                <p role="alert" className="text-xs text-red-500">
                  {coAdminError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Le da acceso total a esta sesión, igual que el moderador
                original: puede editar todo, gestionar asistentes y generar el
                entregable con IA.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Accordion Form */}
      <Accordion type="single" collapsible>
        <AccordionItem value="cofundadores">
          <AccordionTrigger className="text-base font-semibold">
            Fundadores
          </AccordionTrigger>
          <AccordionContent>
            <CofounderFields
              cofounders={cofounders}
              onChange={setCofounders}
              disabled={isReadOnly}
              hideContact={hideContact}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="empresa">
          <AccordionTrigger className="text-base font-semibold">
            Empresa e invitado
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            {invitado ? (
              <>
                <BrandField
                  id="empresa_nombre"
                  label="Nombre de la empresa"
                  value={empresaNombre}
                  onChange={(e) => setEmpresaNombre(e.target.value)}
                  disabled={isReadOnly}
                />
                <BrandTextarea
                  id="empresa_descripcion"
                  label="Descripción de la empresa"
                  placeholder="Descripción básica de la empresa"
                  value={empresaDescripcion}
                  onChange={(e) => setEmpresaDescripcion(e.target.value)}
                  rows={3}
                  disabled={isReadOnly}
                />
                <BrandField
                  id="empresa_red_social"
                  label="Red social principal"
                  placeholder="@handle o URL"
                  value={empresaRedSocial}
                  onChange={(e) => setEmpresaRedSocial(e.target.value)}
                  disabled={isReadOnly}
                />
                <BrandField
                  id="empresa_pagina_web"
                  label="Página web"
                  placeholder="https://..."
                  value={empresaPaginaWeb}
                  onChange={(e) => setEmpresaPaginaWeb(e.target.value)}
                  disabled={isReadOnly}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Esta sesión no tiene un invitado vinculado.
              </p>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="reto">
          <AccordionTrigger className="text-base font-semibold">
            <span className="flex items-center gap-2">
              Reto o problema
              {!retoProblema.trim() && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-amber-500"
                  aria-label="Campo obligatorio vacío"
                  title="Obligatorio para crear el entregable"
                />
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <BrandTextarea
              id="reto_problema"
              label="Desafío"
              placeholder="¿Cuál es el reto con el que llega a la sesión?"
              value={retoProblema}
              onChange={(e) => setRetoProblema(e.target.value)}
              rows={4}
              disabled={isReadOnly}
            />
          </AccordionContent>
        </AccordionItem>

        {canEditRecomendaciones && (
          <AccordionItem value="recomendaciones">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2">
                Recomendaciones incómodas
                {!recomendacionesIncomodas.trim() && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-amber-500"
                    aria-label="Campo obligatorio vacío"
                    title="Obligatorio para crear el entregable"
                  />
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <BrandTextarea
                id="recomendaciones_incomodas"
                label="Recomendaciones del moderador"
                placeholder="Recomendaciones directas del moderador para los fundadores"
                value={recomendacionesIncomodas}
                onChange={(e) => setRecomendacionesIncomodas(e.target.value)}
                rows={5}
                disabled={isReadOnly}
              />
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="foto">
          <AccordionTrigger className="text-base font-semibold">
            Foto de la sesión
          </AccordionTrigger>
          <AccordionContent>
            <PhotoUpload
              currentUrl={fotoSesionUrl}
              onUpload={(file) => uploadTherapyMedia({ sessionId: session.id, type: 'foto', file })}
              onUploaded={handlePhotoUploaded}
              disabled={isReadOnly}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="audio">
          <AccordionTrigger className="text-base font-semibold">
            Audio de la comunidad
          </AccordionTrigger>
          <AccordionContent>
            <AudioRecorder
              sessionId={session.id}
              audios={audios}
              onAudioAdded={handleAudioAdded}
              onAudioRemoved={handleAudioRemoved}
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
              placeholder="Frase de un escritor, empresario o referente de autoridad"
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

        <AccordionItem value="asistencia">
          <AccordionTrigger className="text-base font-semibold">
            <span className="flex items-center gap-2">
              Asistencia (QR)
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
              program="therapy"
              link={attendanceLink}
              onLinkChange={setAttendanceLink}
              disabled={isReadOnly}
            />
            <TherapyAttendees
              sessionId={session.id}
              attendees={attendees}
              deliverySent={session.status === 'entregado'}
              disabled={isReadOnly}
              hideContact={hideContact}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Save status bar / deliverable actions */}
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
          {generateError ?? (saveStatus === 'error' ? saveErrorMessage ?? SAVE_STATUS_COPY.error : SAVE_STATUS_COPY[saveStatus])}
        </p>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {canEdit && hasDeliverable && (
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
          {canEdit && session.status !== 'entregado' && (
            <BrandButton
              onClick={handleCreateDeliverable}
              disabled={
                (!isReadOnly && saveStatus === 'saving') || generating
              }
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
