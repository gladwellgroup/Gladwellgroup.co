import { requirePermission } from '@/lib/auth/session'
import { ComingSoon } from '@/components/portal/coming-soon'

export default async function ContenidoAdminPage() {
  await requirePermission('content:publish')

  return (
    <ComingSoon
      title="Contenido de comunidad"
      description="Publica y gestiona contenido para los integrantes."
    />
  )
}
