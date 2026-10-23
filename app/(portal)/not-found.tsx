import { NotFoundCard } from '@/components/shared/not-found-card'

/** Un `notFound()` dentro del portal (una sesión o un lead que ya no existe): con el menú intacto. */
export default function PortalNotFound() {
  return <NotFoundCard homeHref="/dashboard" />
}
