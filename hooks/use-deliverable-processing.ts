'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { isStale, isWorkingStatus } from '@/lib/deliverables/processing'

/** Cada cuánto se pregunta cómo va la síntesis. */
const POLL_MS = 4000

interface DeliverableProcessingOptions {
  sessionId: string
  /** Estado y fecha de inicio que llegan del servidor con la página. */
  initialStatus: string
  initialGeneratedAt: string | null
  /** POST { session_id }: reclama y ejecuta la síntesis (409 = ya la lleva otra pestaña). */
  processUrl: string
  /** GET ?session_id=: solo el estado (ver las rutas deliverables/status de Terapia y Education). */
  statusUrl: string
  /** La síntesis terminó (o un intento acabó): hay que traer el contenido nuevo de la página. */
  onSettled: () => void
  onError: (message: string | null) => void
  /** Lo que devolvió la ruta de síntesis (p. ej. un aviso de que se completó a medias). */
  onProcessed?: (data: { warning?: string | null }) => void
}

/** El ciclo de «generando → procesando → listo/error» de un entregable, compartido por los editores de Terapia y de
 *  Education (cada uno tenía su copia, con sus propios fallos):
 *   - arranca la síntesis cuando el entregable está «generando» (el servidor decide quién la reclama; un 409 no es un
 *     error: otra pestaña ya la lleva);
 *   - mientras trabaja, pregunta el ESTADO cada 4 s a una ruta ligera, no la página entera (`router.refresh()` costaba
 *     middleware + perfil + 2–3 consultas + las precargas de los enlaces, cada vez), y solo con la pestaña visible;
 *   - al terminar pide la página UNA vez;
 *   - detecta una síntesis muerta (más de 6 min en «generando»/«procesando») para ofrecer «Reintentar», también en
 *     «procesando» (Education solo lo ofrecía en «generando» y sondeaba para siempre). */
export function useDeliverableProcessing(options: DeliverableProcessingOptions) {
  const { initialStatus, initialGeneratedAt } = options
  const propsKey = `${initialStatus}|${initialGeneratedAt ?? ''}`

  // Lo que dice el sondeo manda sobre lo que trajo la página, hasta que la página trae algo nuevo (otra clave).
  const [polled, setPolled] = useState<{ key: string; status: string; generatedAt: string | null } | null>(null)
  const current = polled && polled.key === propsKey ? polled : null
  const status = current?.status ?? initialStatus
  const generatedAt = current ? current.generatedAt : initialGeneratedAt

  // 0 hasta el primer sondeo: no se declara «muerta» una síntesis por una hora que aún no se midió (y no hay desajuste
  // de hidratación por leer el reloj al pintar).
  const [now, setNow] = useState(0)
  const [retrying, setRetrying] = useState(false)

  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })

  const trigger = useCallback(async () => {
    const { processUrl, sessionId, onError, onProcessed, onSettled } = latest.current
    try {
      const res = await fetch(processUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        onError(null)
        onProcessed?.(data)
      } else if (res.status !== 409) {
        onError(data.error ?? 'No se pudo completar la síntesis del entregable')
      }
    } catch {
      onError('Error de red al sintetizar el entregable')
    }
    onSettled()
  }, [])

  // Arranca (o retoma) la síntesis cuando el entregable está esperando a que alguien la reclame.
  const startedRef = useRef(false)
  useEffect(() => {
    if (status !== 'generando') {
      startedRef.current = false
      return
    }
    if (startedRef.current) return
    startedRef.current = true
    void trigger()
  }, [status, trigger])

  // Mientras trabaja: pregunta el estado.
  const working = isWorkingStatus(status)
  useEffect(() => {
    if (!working) return
    let cancelled = false

    async function poll() {
      if (document.visibilityState !== 'visible') return
      try {
        const { statusUrl, sessionId, onSettled } = latest.current
        const res = await fetch(`${statusUrl}?session_id=${encodeURIComponent(sessionId)}`, { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { processing_status: string; generated_at: string | null }
        if (cancelled) return
        setNow(Date.now())
        setPolled({ key: propsKey, status: data.processing_status, generatedAt: data.generated_at ?? null })
        if (!isWorkingStatus(data.processing_status)) onSettled()
      } catch {
        // Sin red: se vuelve a preguntar en el siguiente turno.
      }
    }

    void poll()
    const interval = setInterval(() => void poll(), POLL_MS)
    const onVisible = () => void poll()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [working, propsKey])

  const retry = useCallback(async () => {
    setRetrying(true)
    await trigger()
    setRetrying(false)
  }, [trigger])

  return {
    status,
    isBusy: working,
    isStuck: now > 0 && isStale(status, generatedAt, now),
    retrying,
    retry,
  }
}
