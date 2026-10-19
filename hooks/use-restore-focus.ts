'use client'

import { useCallback, useRef } from 'react'

type Focusable = { isConnected: boolean; focus: () => void }

/** Lo que tiene el foco, si es algo a lo que se pueda devolver. `<body>` no cuenta:
 *  es lo que hay cuando nada lo tiene (un toque en WebKit no enfoca los botones), y
 *  «devolverle» el foco no hace nada. Puro, para probarlo sin navegador. */
export function captureOpener(active: unknown, body: unknown): Focusable | null {
  const element = active as Partial<Focusable> | null
  if (!element || active === body || typeof element.focus !== 'function') return null
  return element as Focusable
}

/** Devuelve el foco a `opener` si sigue en la página, y evita el comportamiento por
 *  defecto de Radix. `true` = lo devolvió. Si el elemento ya no existe (la fila se
 *  borró al confirmar) no hace nada y Radix hace lo suyo. */
export function returnFocus(
  opener: Focusable | null,
  event: { preventDefault: () => void }
): boolean {
  if (!opener?.isConnected) return false
  event.preventDefault()
  opener.focus()
  return true
}

/** Devuelve el foco a quien abrió un diálogo CONTROLADO (lo abre un estado, no un
 *  `DialogTrigger`).
 *
 *  Radix solo devuelve el foco a un `DialogTrigger`: su `onCloseAutoFocus` enfoca
 *  `triggerRef.current` y, sin trigger, no enfoca nada, así que el foco caía en
 *  `<body>` —quien navega con teclado perdía su lugar, al principio de la página,
 *  cada vez que cerraba o guardaba—. Se recuerda quién lo tenía al abrirse y se le
 *  devuelve al cerrarse. Es lo que hacía a mano `ConfirmDialog` (los 12 usos del
 *  portal); los diálogos de publicaciones y de frases lo necesitan igual.
 *
 *  Uso: `onOpenAutoFocus={() => remember()}` (se dispara ANTES de que Radix mueva el
 *  foco al diálogo, y ahí todavía lo tiene el botón que lo abrió) y
 *  `onCloseAutoFocus={restore}`. */
export function useRestoreFocus() {
  const opener = useRef<Focusable | null>(null)

  const remember = useCallback(() => {
    opener.current = captureOpener(document.activeElement, document.body)
  }, [])

  const restore = useCallback((event: Event) => {
    const element = opener.current
    opener.current = null
    returnFocus(element, event)
  }, [])

  return { remember, restore }
}
