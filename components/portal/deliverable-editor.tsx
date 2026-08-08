'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, ExternalLink } from 'lucide-react'
import { BrandTextarea } from '@/components/brand/brand-field'
import { BrandButton } from '@/components/brand/brand-button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { ConfirmDialog } from '@/components/portal/confirm-dialog'
import { parseDateOnly } from '@/lib/date'

export interface DeliverableEditorData {
  id: string
  problema_recordatorio: string | null
  resumen_audio: string | null
  recomendaciones_incomodas: string | null
  content_html: string | null
  pdf_url: string | null
  processing_status: string
  generated_at: string | null
}

interface DeliverableEditorProps {
  session: {
    id: string
    title: string
    session_date: string
    status: string
    moderator_id: string
  }
  deliverable: DeliverableEditorData
  fotoSesionUrl: string | null
  audioUrl: string | null
  canEdit: boolean
  basePath: string
}

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 1200
const RETRY_THRESHOLD_MS = 6 * 60 * 1000

const SAVE_COPY: Record<SaveStatus, string> = {
  idle: '',
  dirty: 'Sin guardar',
  saving: 'Guardando…',
  saved: 'Guardado',
  error: 'Error al guardar',
}

export function DeliverableEditor({
  session,
  deliverable: initial,
  fotoSesionUrl,
  audioUrl,
  canEdit,
  basePath,
}: DeliverableEditorProps) {
  const router = useRouter()
  const isEntregado = session.status === 'entregado'
  const isGenerating = initial.processing_status === 'generando'

  const [problema, setProblema] = useState(initial.problema_recordatorio ?? '')
  const [resumen, setResumen] = useState(initial.resumen_audio ?? '')
  const [recomendaciones, setRecomendaciones] = useState(
    initial.recomendaciones_incomodas ?? ''
  )
  const [contentHtml, setContentHtml] = useState(initial.content_html ?? '')
  const [pdfUrl, setPdfUrl] = useState(initial.pdf_url)
  const [processingStatus, setProcessingStatus] = useState(
    initial.processing_status
  )
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [actionError, setActionError] = useState<string | null>(null)
  /** Envío parcial a asistentes QR: no es un error del entregable (los
   *  cofundadores ya lo recibieron), pero callarlo dejaría al moderador
   *  creyendo que llegó a todos. */
  const [actionWarning, setActionWarning] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isStuck, setIsStuck] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)
  const pendingRef = useRef(false)
  const isFirst = useRef(true)

  const problemaRef = useRef(problema)
  const resumenRef = useRef(resumen)
  const recomendacionesRef = useRef(recomendaciones)
  useEffect(() => {
    problemaRef.current = problema
    resumenRef.current = resumen
    recomendacionesRef.current = recomendaciones
  })

  const saveNow = useCallback(async () => {
    if (!canEdit) return
    if (isSavingRef.current) {
      pendingRef.current = true
      return
    }
    isSavingRef.current = true

    do {
      pendingRef.current = false
      setSaveStatus('saving')

      try {
        const res = await fetch('/api/therapy/deliverables', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.id,
            problema_recordatorio: problemaRef.current,
            resumen_audio: resumenRef.current,
            recomendaciones_incomodas: recomendacionesRef.current,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setSaveStatus('error')
          setActionError(data.error ?? 'Error al guardar')
        } else {
          setSaveStatus('saved')
          if (data.content_html) setContentHtml(data.content_html)
          setActionError(null)
        }
      } catch {
        setSaveStatus('error')
      }
    } while (pendingRef.current)

    isSavingRef.current = false
  }, [canEdit, session.id])

  useEffect(() => {
    if (!canEdit || isGenerating) return
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    setSaveStatus('dirty')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void saveNow()
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [problema, resumen, recomendaciones, canEdit, isGenerating, saveNow])

  const processStartedRef = useRef(false)

  const triggerProcess = useCallback(async () => {
    try {
      const res = await fetch('/api/therapy/deliverables/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setActionError(
          data.error ?? 'No se pudo completar la síntesis del entregable'
        )
      } else {
        setActionError(null)
      }
      router.refresh()
    } catch {
      setActionError('Error de red al sintetizar el entregable')
      router.refresh()
    }
  }, [session.id, router])

  // Kick off / resume processing when shell is generating
  useEffect(() => {
    if (processingStatus !== 'generando') {
      processStartedRef.current = false
      setIsStuck(false)
      return
    }
    if (processStartedRef.current) return
    processStartedRef.current = true

    let cancelled = false

    void triggerProcess()

    const checkStuck = () => {
      if (!initial.generated_at) return
      const elapsed = Date.now() - new Date(initial.generated_at).getTime()
      if (!cancelled) setIsStuck(elapsed > RETRY_THRESHOLD_MS)
    }
    checkStuck()

    const poll = setInterval(() => {
      if (!cancelled) {
        checkStuck()
        router.refresh()
      }
    }, 4000)

    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [processingStatus, triggerProcess, initial.generated_at, router])

  async function handleRetry() {
    setIsStuck(false)
    setRetrying(true)
    await triggerProcess()
    setRetrying(false)
  }

  // Sync when server props update after refresh
  useEffect(() => {
    setProblema(initial.problema_recordatorio ?? '')
    setResumen(initial.resumen_audio ?? '')
    setRecomendaciones(initial.recomendaciones_incomodas ?? '')
    setContentHtml(initial.content_html ?? '')
    setPdfUrl(initial.pdf_url)
    setProcessingStatus(initial.processing_status)
  }, [initial])

  async function handleDownloadPdf() {
    setActionError(null)
    setPdfBusy(true)
    try {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (canEdit && saveStatus === 'dirty') await saveNow()

      const res = await fetch('/api/therapy/deliverables/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setActionError(data.error ?? 'No se pudo generar el PDF')
        return
      }
      setPdfUrl(data.pdf_url)
      window.open(data.pdf_url, '_blank', 'noopener,noreferrer')
    } catch {
      setActionError('Error de red al generar el PDF')
    } finally {
      setPdfBusy(false)
    }
  }

  async function handleApprove() {
    setConfirmOpen(false)
    setActionError(null)
    setActionWarning(null)
    setApproving(true)
    try {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      await saveNow()

      const res = await fetch('/api/therapy/deliverables/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setActionError(data.error ?? 'No se pudo enviar el entregable')
        setApproving(false)
        return
      }
      if (data.qr_failed > 0) {
        setActionWarning(
          `El entregable se envió, pero ${data.qr_failed} asistente(s) de la lista de asistencia no lo recibieron. Reintenta desde "Asistencia (QR)" en la sesión.`
        )
      }
      if (data.pdf_url) setPdfUrl(data.pdf_url)
      router.refresh()
    } catch {
      setActionError('Error de red al enviar')
    } finally {
      setApproving(false)
    }
  }

  const dateLabel = parseDateOnly(session.session_date).toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="space-y-6 max-w-2xl mx-auto pt-6 sm:pt-8">
      <div className="flex flex-col items-center text-center gap-1">
        <Link
          href={`${basePath}/${session.id}`}
          className="mb-4 inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la sesión
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold gladwell-gradient-text">
          Entregable — {session.title}
        </h1>
        <p className="text-sm text-muted-foreground">{dateLabel}</p>
      </div>

      {processingStatus === 'generando' && !isStuck && (
        <p className="text-sm text-muted-foreground text-center rounded-lg border border-border/50 px-4 py-3">
          Generando síntesis del audio y la narrativa… Esto puede tardar unos
          minutos.
        </p>
      )}

      {processingStatus === 'generando' && isStuck && (
        <div className="flex flex-col items-center gap-2 text-center rounded-lg border border-amber-500/30 px-4 py-3">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Esto está tardando más de lo esperado. Puede que el proceso se
            haya interrumpido.
          </p>
          <BrandButton
            type="button"
            variant="secondary"
            size="sm"
            className="w-auto"
            onClick={handleRetry}
            disabled={retrying}
          >
            {retrying ? 'Reintentando…' : 'Reintentar'}
          </BrandButton>
        </div>
      )}

      {processingStatus === 'error' && (
        <p className="text-sm text-amber-600 dark:text-amber-400 text-center rounded-lg border border-amber-500/30 px-4 py-3">
          La síntesis automática no se completó del todo. Revisa y completa el
          resumen del audio manualmente.
        </p>
      )}

      {isEntregado && (
        <p className="text-sm text-muted-foreground text-center rounded-lg border border-border/50 px-4 py-3">
          Entregable enviado a los fundadores. Puedes seguir editando y
          descargar el PDF; no se regenera con IA ni se reenvía el correo
          automáticamente.
        </p>
      )}

      <div className="space-y-4">
        <BrandTextarea
          id="problema_recordatorio"
          label="Recordar el problema"
          value={problema}
          onChange={(e) => setProblema(e.target.value)}
          rows={4}
          disabled={!canEdit || isGenerating}
        />
        <BrandTextarea
          id="resumen_audio"
          label="Resumen del audio"
          value={resumen}
          onChange={(e) => setResumen(e.target.value)}
          rows={6}
          disabled={!canEdit || isGenerating}
        />
        {audioUrl && (
          <div className="space-y-2">
            <p className="modal-label">Audio de la comunidad</p>
            <audio controls src={audioUrl} className="w-full" />
            <a
              href={audioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Abrir audio
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
        <BrandTextarea
          id="recomendaciones_incomodas"
          label="Recomendaciones incómodas"
          value={recomendaciones}
          onChange={(e) => setRecomendaciones(e.target.value)}
          rows={5}
          disabled={!canEdit || isGenerating}
        />
        {fotoSesionUrl && (
          <div className="space-y-2">
            <p className="modal-label">Foto del grupo</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fotoSesionUrl}
              alt="Foto de la sesión"
              className="w-full rounded-lg border border-border/50 object-cover aspect-[4/3]"
            />
          </div>
        )}
      </div>

      <Accordion type="single" collapsible>
        <AccordionItem value="preview">
          <AccordionTrigger className="text-base font-semibold">
            Vista previa HTML
          </AccordionTrigger>
          <AccordionContent>
            {contentHtml ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-border/50 p-4 bg-background/50"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                La vista previa aparecerá cuando termine la generación.
              </p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p
          role={actionError || actionWarning ? 'alert' : undefined}
          aria-live="polite"
          className={`text-xs ${
            actionError || saveStatus === 'error'
              ? 'text-red-500'
              : actionWarning
                ? 'text-amber-500'
                : saveStatus === 'saved'
                  ? 'text-green-500'
                  : 'text-muted-foreground'
          }`}
        >
          {actionError ?? actionWarning ?? SAVE_COPY[saveStatus]}
        </p>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <BrandButton
            type="button"
            variant="secondary"
            size="sm"
            className="w-auto"
            onClick={handleDownloadPdf}
            disabled={pdfBusy || isGenerating}
          >
            <Download className="h-4 w-4 mr-1.5" />
            {pdfBusy ? 'Generando PDF…' : 'Descargar PDF'}
          </BrandButton>
          {canEdit && !isEntregado && (
            <BrandButton
              type="button"
              size="sm"
              className="w-auto"
              onClick={() => setConfirmOpen(true)}
              disabled={
                approving ||
                isGenerating ||
                processingStatus === 'generando' ||
                saveStatus === 'saving'
              }
            >
              {approving ? 'Enviando…' : 'Dar visto bueno y enviar correo'}
            </BrandButton>
          )}
        </div>
      </div>

      {pdfUrl && (
        <p className="text-xs text-muted-foreground text-right">
          PDF listo para WhatsApp:{' '}
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            abrir enlace
          </a>
        </p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="¿Enviar el entregable?"
        message="Se enviará el HTML por correo a los fundadores con correo registrado. El PDF quedará listo para que lo descargues y lo compartas por WhatsApp. Esta acción no se puede deshacer desde el portal."
        confirmLabel="Confirmar envío"
        onConfirm={handleApprove}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
