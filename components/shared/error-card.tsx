'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BrandCard } from '@/components/brand/brand-card'
import { BrandButton } from '@/components/brand/brand-button'
import { CenteredPage } from '@/components/layout/centered-page'
import { ERROR_COPY } from '@/lib/data/error-copy'

interface ErrorCardProps {
  error: Error & { digest?: string }
  reset: () => void
  /** A dónde lleva «Ir al inicio». */
  homeHref: string
  /** Sobre el fondo de marca y a pantalla completa: para la pantalla raíz, que reemplaza todo el layout. Sin esto,
   *  la tarjeta va dentro del contenido de la página (la del portal, con su menú alrededor). */
  fullPage?: boolean
}

/** La pantalla que ve la persona cuando una página no se pudo cargar. «Reintentar» pide la página de nuevo al
 *  servidor (`router.refresh()`) Y vuelve a pintar el segmento (`reset()`): solo `reset()` repetiría el render con los
 *  mismos datos del fallo. El error ya lo registra React en la consola (en producción como «error #441», el mensaje
 *  oculto de un fallo del servidor); el `digest` que se muestra permite cruzarlo con el registro del servidor. */
export function ErrorCard({ error, reset, homeHref, fullPage = false }: ErrorCardProps) {
  const router = useRouter()
  const [retrying, startTransition] = useTransition()

  const card = (
    <BrandCard role="alert" className="mx-auto w-full max-w-md space-y-4 text-center">
      <h1 className="text-xl font-bold gladwell-gradient-text sm:text-2xl">{ERROR_COPY.title}</h1>
      <p className="text-sm text-muted-foreground">{ERROR_COPY.body}</p>
      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <BrandButton
          type="button"
          className="w-auto"
          disabled={retrying}
          onClick={() =>
            startTransition(() => {
              router.refresh()
              reset()
            })
          }
        >
          {retrying ? ERROR_COPY.retrying : ERROR_COPY.retry}
        </BrandButton>
        <BrandButton asChild variant="secondary" className="w-auto">
          <Link href={homeHref}>{ERROR_COPY.home}</Link>
        </BrandButton>
      </div>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          {ERROR_COPY.reference}: {error.digest}
        </p>
      )}
    </BrandCard>
  )

  return fullPage ? <CenteredPage>{card}</CenteredPage> : card
}
