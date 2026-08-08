'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download } from 'lucide-react'
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

export interface EducationDeliverableData {
  id: string
  conclusiones_clave: string | null
  capsulas: string | null
  content_html: string | null
  pdf_url: string | null
  processing_status: string
  generated_at: string | null
}

interface EducationDeliverableEditorProps {
  session: {
    id: string
    title: string
    session_date: string
    status: string
  }
  deliverable: EducationDeliverableData
  fotoSesionUrl: string | null
  attendeesPendientes: number
  attendeesFallidos: number
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

export function EducationDeliverableEditor({
  session,
  deliverable: initial,
  fotoSesionUrl,
  attendeesPendientes,
  attendeesFallidos,
  basePath,
}: EducationDeliverableEditorProps) {
  const router = useRouter()
  const isEntregado = session.status === 'entregado'

  const [conclusiones, setConclusiones] = useState(initial.conclusiones_clave ?? '')
  const [capsulas, setCapsulas] = useState(initial.capsulas ?? '')
  const [contentHtml, setContentHtml] = useState(initial.content_html ?? '')
  const [pdfUrl, setPdfUrl] = useState(initial.pdf_url)
  const [processingStatus, setProcessingStatus] = useState(initial.processing_status)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isStuck, setIsStuck] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const canEdit = !isEntregado
  // 'procesando' es el claim que toma la ruta de síntesis mientras trabaja.
  const isBusy = ['generando', 'procesando'].includes(processingStatus)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)
  const pendingRef = useRef(false)
  const isFirst = useRef(true)

  const fieldsRef = useRef({ conclusiones, capsulas })
  useEffect(() => {
    fieldsRef.current = { conclusiones, capsulas }
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
        const res = await fetch('/api/education/deliverables', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.id,
            conclusiones_clave: fieldsRef.current.conclusiones,
            capsulas: fieldsRef.current.capsulas,
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
    if (!canEdit || isBusy) return
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
  }, [conclusiones, capsulas, canEdit, isBusy, saveNow])

  const processStartedRef = useRef(false)

  const triggerProcess = useCallback(async () => {
    try {
      const res = await fetch('/api/education/deliverables/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        // 409 = otra pestaña ya está sintetizando; el polling la seguirá.
        if (res.status !== 409) {
          setActionError(
            data.error ?? 'No se pudo completar la síntesis del entregable'
          )
        }
      } else {
        const data = await res.json().catch(() => ({}))
        setActionError(null)
        setNotice(data.warning ?? null)
      }
      router.refresh()
    } catch {
      setActionError('Error de red al sintetizar el entregable')
      router.refresh()
    }
  }, [session.id, router])

  // Arranca o retoma el procesamiento cuando el shell está en 'generando'.
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

  // Mientras otra pestaña procesa, este cliente solo refresca hasta ver el
  // resultado; no vuelve a llamar a la ruta de síntesis.
  useEffect(() => {
    if (processingStatus !== 'procesando') return

    let cancelled = false
    const poll = setInterval(() => {
      if (!cancelled) router.refresh()
    }, 4000)

    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [processingStatus, router])

  async function handleRetry() {
    setIsStuck(false)
    setRetrying(true)
    await triggerProcess()
    setRetrying(false)
  }

  useEffect(() => {
    setConclusiones(initial.conclusiones_clave ?? '')
    setCapsulas(initial.capsulas ?? '')
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

      const res = await fetch('/api/education/deliverables/pdf', {
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
    setNotice(null)
    setApproving(true)
    try {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      await saveNow()

      const res = await fetch('/api/education/deliverables/approve', {
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
      if (data.pdf_url) setPdfUrl(data.pdf_url)
      setNotice(
        data.failed > 0
          ? `Enviado a ${data.sent} asistente(s). ${data.failed} falló(aron): vuelve a enviar para reintentar solo esos.`
          : `Entregable enviado a ${data.sent} asistente(s).`
      )
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

      {isBusy && !isStuck && (
        <p className="text-sm text-muted-foreground text-center rounded-lg border border-border/50 px-4 py-3">
          Analizando la transcripción contra el objetivo de la sesión… Esto puede
          tardar unos minutos.
        </p>
      )}

      {processingStatus === 'generando' && isStuck && (
        <div className="flex flex-col items-center gap-2 text-center rounded-lg border border-amber-500/30 px-4 py-3">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Esto está tardando más de lo esperado. Puede que el proceso se haya
            interrumpido.
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
          La síntesis automática no se completó. Revisa y completa las
          conclusiones manualmente, o regenera desde la sesión.
        </p>
      )}

      {isEntregado && (
        <p className="text-sm text-muted-foreground text-center rounded-lg border border-border/50 px-4 py-3">
          Entregable enviado a los asistentes. La sesión quedó cerrada: no se
          regenera con IA ni se reenvía el correo.
        </p>
      )}

      {!isEntregado && attendeesFallidos > 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-400 text-center rounded-lg border border-amber-500/30 px-4 py-3">
          {attendeesFallidos} correo(s) fallaron en el último envío. Vuelve a
          enviar para reintentar solo esos.
        </p>
      )}

      <div className="space-y-4">
        <BrandTextarea
          id="conclusiones_clave"
          label="Conclusiones clave (una por línea)"
          value={conclusiones}
          onChange={(e) => setConclusiones(e.target.value)}
          rows={6}
          disabled={!canEdit || isBusy}
        />
        <BrandTextarea
          id="capsulas"
          label="Cápsulas de emprendimiento (una por línea)"
          value={capsulas}
          onChange={(e) => setCapsulas(e.target.value)}
          rows={5}
          disabled={!canEdit || isBusy}
        />
        {fotoSesionUrl && (
          <div className="space-y-2">
            <p className="modal-label">Foto de la sesión</p>
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
            Vista previa del correo
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
          role={actionError ? 'alert' : undefined}
          aria-live="polite"
          className={`text-xs ${
            actionError || saveStatus === 'error'
              ? 'text-red-500'
              : notice
                ? 'text-green-500'
                : saveStatus === 'saved'
                  ? 'text-green-500'
                  : 'text-muted-foreground'
          }`}
        >
          {actionError ?? notice ?? SAVE_COPY[saveStatus]}
        </p>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <BrandButton
            type="button"
            variant="secondary"
            size="sm"
            className="w-auto"
            onClick={handleDownloadPdf}
            disabled={pdfBusy || isBusy}
          >
            <Download className="h-4 w-4 mr-1.5" />
            {pdfBusy ? 'Generando PDF…' : 'Descargar PDF'}
          </BrandButton>
          {canEdit && (
            <BrandButton
              type="button"
              size="sm"
              className="w-auto"
              onClick={() => setConfirmOpen(true)}
              disabled={
                approving ||
                isBusy ||
                saveStatus === 'saving' ||
                attendeesPendientes === 0
              }
            >
              {approving ? 'Enviando…' : 'Dar visto bueno y enviar'}
            </BrandButton>
          )}
        </div>
      </div>

      {attendeesPendientes === 0 && !isEntregado && (
        <p className="text-xs text-muted-foreground text-right">
          Importa la lista de asistentes en la sesión para poder enviar.
        </p>
      )}

      {pdfUrl && (
        <p className="text-xs text-muted-foreground text-right">
          PDF del entregable:{' '}
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
        message={`Se enviará un correo personalizado a ${attendeesPendientes} asistente(s) pendiente(s), con el enlace al PDF. Una vez enviado a todos, la sesión queda cerrada.`}
        confirmLabel="Confirmar envío"
        onConfirm={handleApprove}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
