'use client'

import { useCallback, useSyncExternalStore } from 'react'
import {
  DEFAULT_LIST_VIEW,
  resolveListView,
  writeStoredView,
  type ListViewKey,
  type ParrillaListView,
  type StorageLike,
} from '@/lib/parrilla/table'

/** `window.localStorage` mismo puede lanzar (SecurityError) con el almacenamiento
 *  bloqueado: por eso se pide dentro de un `try`. */
function getStorage(): StorageLike | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

// Lo elegido en esta sesión manda sobre lo guardado: si el almacenamiento falla, la
// elección sigue valiendo mientras la página esté abierta.
const chosen: Partial<Record<ListViewKey, ParrillaListView>> = {}
const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** La vista (tabla o tarjetas) de una base de datos de la parrilla, recordada en este
 *  dispositivo. Sin nada guardado, la principal: la tabla.
 *
 *  El servidor y la hidratación pintan siempre la principal; el navegador aplica lo
 *  guardado justo después, sin aviso de desajuste de hidratación. Es la vía de
 *  `useSyncExternalStore` (la misma de `useIsClient`) y no un `useEffect` que llame a
 *  `setState`, que dispara un render en cascada.
 *
 *  Quien eligió «tarjetas» no ve un salto de una vista a otra: el Banco y las Frases solo se
 *  montan al pulsar su pestaña (el tablero arranca en el Calendario), cuando la página ya se
 *  hidrató y lo guardado ya se leyó. Por eso no hace falta mover la preferencia a una cookie
 *  que obligaría a leerla en cada página del servidor. */
export function useListView(key: ListViewKey): [ParrillaListView, (view: ParrillaListView) => void] {
  const view = useSyncExternalStore(
    subscribe,
    () => resolveListView(chosen, getStorage(), key),
    () => DEFAULT_LIST_VIEW
  )

  const setView = useCallback(
    (next: ParrillaListView) => {
      chosen[key] = next
      writeStoredView(getStorage(), key, next)
      listeners.forEach((listener) => listener())
    },
    [key]
  )

  return [view, setView]
}
