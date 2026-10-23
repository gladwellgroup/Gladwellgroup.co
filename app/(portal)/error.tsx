'use client'

import { ErrorCard } from '@/components/shared/error-card'

/** Una página del portal que no se pudo cargar (una consulta que falló o tardó de más): con el menú intacto, para
 *  reintentar o irse a otra sección sin recargar. */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorCard error={error} reset={reset} homeHref="/dashboard" />
}
