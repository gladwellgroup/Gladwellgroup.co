'use client'

import { useEffect } from 'react'

/** Se monta solo en producción (ver app/layout.tsx) — un service worker en
 *  `next dev` pelea con el hot-reload y hace parecer roto un cambio que en
 *  realidad sí se aplicó. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('[sw] registration failed:', error)
    })
  }, [])

  return null
}
