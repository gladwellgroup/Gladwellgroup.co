'use client'

import { useEffect, useRef, useState } from 'react'
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
import { useDeliverableProcessing } from '@/hooks/use-deliverable-processing'
import { useFlushOnLeave } from '@/hooks/use-flush-on-leave'
import { useSaveQueue } from '@/hooks/use-save-queue'
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const canEdit = !isEntregado

  // La síntesis (generando → procesando → listo/error): arranque, sondeo ligero y «Reintentar» (ver el gancho).
  // 'procesando' es el claim que toma la ruta de síntesis mientras trabaja.
  const {
    status: processingStatus,
    isBusy,
    isStuck,
    retrying,
    retry: handleRetry,
  } = useDeliverableProcessing({
    sessionId: session.id,
    initialStatus: initial.processing_status,
    initialGeneratedAt: initial.generated_at,
    processUrl: '/api/education/deliverables/process',
    statusUrl: '/api/education/deliverables/status',
    onSettled: () => router.refresh(),
    onError: setActionError,
    onProcessed: (data) => setNotice(data.warning ?? null),
  })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirst = useRef(true)
  // Un doble toque en «Confirmar envío» entra antes de que el diálogo termine de cerrarse (su animación de salida):
  // sin esta guarda, el segundo toque mandaba el correo otra vez.
  const approvingRef = useRef(false)
  // Los valores recién traídos del servidor no cuentan como «cambios del usuario»: no deben disparar un autoguardado.
  const skipAutosaveRef = useRef(false)

  const fieldsRef = useRef({ conclusiones, capsulas })
  const saveStatusRef = useRef(saveStatus)
  useEffect(() => {
    fieldsRef.current = { conclusiones, capsulas }
    saveStatusRef.current = saveStatus
  })

  /** Lo que guarda el editor ahora mismo (lo usan el autoguardado y el guardado al salir). */
  const buildRequest = () => ({
    url: '/api/education/deliverables',
    method: 'PATCH' as const,
    body: {
      session_id: session.id,
      conclusiones_clave: fieldsRef.current.conclusiones,
      capsulas: fieldsRef.current.capsulas,
    },
  })

  /** Un guardado; la cola (useSaveQueue) lo repite mientras haya algo nuevo y nunca corre dos a la vez. */
  const saveOnce = async () => {
    if (!canEdit) return
    setSaveStatus('saving')

    try {
      const request = buildRequest()
      const res = await fetch(request.url, {
        method: request.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body),
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
  }
  const saveNow = useSaveQueue(saveOnce)

  // Al salir (navegar, cerrar, pasar a segundo plano) se manda lo pendiente: el temporizador del autoguardado se
  // cancela al desmontar y el último texto se perdía sin aviso.
  useFlushOnLeave({
    isDirty: () => canEdit && !isBusy && (saveStatusRef.current === 'dirty' || saveStatusRef.current === 'saving'),
    buildRequests: () => [buildRequest()],
  })

  useEffect(() => {
    if (!canEdit || isBusy) return
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false
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

  // Trae lo que el servidor tenga de nuevo (p. ej. la síntesis recién terminada), pero NUNCA pisa lo que se está
  // escribiendo: antes un refresco a mitad de una edición devolvía el texto anterior.
  useEffect(() => {
    // Sincroniza lo que llega del servidor con el borrador, y solo si no hay cambios sin guardar (`saveStatusRef`, que el
    // compilador no puede seguir): derivado del render o con `key` se perdería lo que la persona está escribiendo.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ver arriba
    setContentHtml(initial.content_html ?? '')
    setPdfUrl(initial.pdf_url)
    if (saveStatusRef.current === 'dirty' || saveStatusRef.current === 'saving') return
    const next = {
      conclusiones: initial.conclusiones_clave ?? '',
      capsulas: initial.capsulas ?? '',
    }
    if (next.conclusiones !== fieldsRef.current.conclusiones || next.capsulas !== fieldsRef.current.capsulas) {
      skipAutosaveRef.current = true
      setConclusiones(next.conclusiones)
      setCapsulas(next.capsulas)
    }
  }, [initial])

  async function handleDownloadPdf() {
    setActionError(null)
    setPdfBusy(true)
    try {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (canEdit && (saveStatus === 'dirty' || saveStatus === 'saving')) await saveNow()

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
    if (approvingRef.current) return
    approvingRef.current = true
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
      approvingRef.current = false
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
          className="mb-4 inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground active:text-foreground pointer-coarse:min-h-11"
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

      {isBusy && isStuck && (
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
