import { requirePermission } from '@/lib/auth/session'
import { ComingSoon } from '@/components/portal/coming-soon'

export default async function ContenidoComunidadPage() {
  await requirePermission('content:read')

  return (
    <ComingSoon
      title="Contenido"
      description="Contenido publicado por la comunidad Gladwell."
    />
  )
}
