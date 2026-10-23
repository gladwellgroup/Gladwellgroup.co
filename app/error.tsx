'use client'

import { ErrorCard } from '@/components/shared/error-card'

/** La pantalla de error de toda la app. Recoge, entre otros, el fallo del layout del portal (`requireAuth` lanza
 *  `SessionLoadError` si Supabase no contesta): un `error.tsx` no atrapa los errores del layout de su propio segmento,
 *  así que `app/(portal)/error.tsx` solo cubre las páginas de adentro. */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorCard error={error} reset={reset} homeHref="/" fullPage />
}
