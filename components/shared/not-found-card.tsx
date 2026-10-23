import Link from 'next/link'
import { BrandCard } from '@/components/brand/brand-card'
import { BrandButton } from '@/components/brand/brand-button'
import { CenteredPage } from '@/components/layout/centered-page'
import { NOT_FOUND_COPY } from '@/lib/data/error-copy'

interface NotFoundCardProps {
  /** A dónde lleva «Ir al inicio». */
  homeHref: string
  /** Sobre el fondo de marca y a pantalla completa (fuera del portal). Sin esto va dentro del contenido de la página. */
  fullPage?: boolean
}

/** Lo que ve la persona cuando la página no existe: una URL mal escrita, o un `notFound()` de una sesión que ya no está. */
export function NotFoundCard({ homeHref, fullPage = false }: NotFoundCardProps) {
  const card = (
    <BrandCard className="mx-auto w-full max-w-md space-y-4 text-center">
      <h1 className="text-xl font-bold gladwell-gradient-text sm:text-2xl">{NOT_FOUND_COPY.title}</h1>
      <p className="text-sm text-muted-foreground">{NOT_FOUND_COPY.body}</p>
      <BrandButton asChild className="w-auto">
        <Link href={homeHref}>{NOT_FOUND_COPY.home}</Link>
      </BrandButton>
    </BrandCard>
  )

  return fullPage ? <CenteredPage>{card}</CenteredPage> : card
}
