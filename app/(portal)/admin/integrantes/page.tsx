import { requirePermission } from '@/lib/auth/session'
import { ComingSoon } from '@/components/portal/coming-soon'

export default async function IntegrantesPage() {
  await requirePermission('content:publish')

  return (
    <ComingSoon
      title="Integrantes"
      description="Gestiona los integrantes de la comunidad asignados a ti."
    />
  )
}
