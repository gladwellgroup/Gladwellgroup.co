'use client'

import { useEffect, useRef } from 'react'
import { sendOnLeave, type KeepaliveRequest } from '@/lib/keepalive'

interface FlushOnLeaveOptions {
  /** ¿Hay cambios sin guardar (o un guardado en marcha que pudo quedarse a medias)? */
  isDirty: () => boolean
  /** Las peticiones que guardan el estado actual del formulario (las mismas que el autoguardado). */
  buildRequests: () => KeepaliveRequest[]
}

/** No perder lo escrito al salir. El autoguardado espera 1,2 s tras la última tecla y su temporizador se cancela al
 *  desmontar el formulario: quien escribía y navegaba a otra sección (o cerraba la pestaña) perdía el último texto sin
 *  aviso. Este gancho manda el guardado pendiente con `keepalive` en tres momentos:
 *   - al DESMONTAR (navegar dentro del portal),
 *   - en `pagehide` (cerrar o recargar),
 *   - en `visibilitychange` a oculto: es lo único fiable en iPad, donde pasar a otra app puede matar la página sin
 *     disparar `pagehide` ni `beforeunload`. */
export function useFlushOnLeave({ isDirty, buildRequests }: FlushOnLeaveOptions): void {
  const latest = useRef({ isDirty, buildRequests })
  useEffect(() => {
    latest.current = { isDirty, buildRequests }
  })

  useEffect(() => {
    function flush() {
      if (latest.current.isDirty()) sendOnLeave(latest.current.buildRequests())
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
    }
  }, [])
}
