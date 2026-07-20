import { requirePermission } from '@/lib/auth/session'
import { ComingSoon } from '@/components/portal/coming-soon'

export default async function EventosPage() {
  await requirePermission('events:create')

  return (
    <ComingSoon
      title="Eventos principales"
      description="Crea y gestiona los eventos de la comunidad Gladwell."
    />
  )
}
