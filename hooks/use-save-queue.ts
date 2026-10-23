'use client'

import { useCallback, useEffect, useRef } from 'react'
import { createSaveQueue } from '@/lib/save-queue'

/** `saveNow` estable (cola de un solo vuelo, ver lib/save-queue.ts) que siempre ejecuta la ÚLTIMA versión de `saveOnce`,
 *  la que lee los valores actuales del formulario. */
export function useSaveQueue(saveOnce: () => Promise<void>): () => Promise<void> {
  const saveRef = useRef(saveOnce)
  useEffect(() => {
    saveRef.current = saveOnce
  })
  const queueRef = useRef<(() => Promise<void>) | null>(null)

  return useCallback(() => {
    queueRef.current ??= createSaveQueue(() => saveRef.current())
    return queueRef.current()
  }, [])
}
