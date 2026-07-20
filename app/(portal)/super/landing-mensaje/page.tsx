import { requirePermission } from '@/lib/auth/session'
import { ComingSoon } from '@/components/portal/coming-soon'

export default async function LandingMensajePage() {
  await requirePermission('landing:weekly_message')

  return (
    <ComingSoon
      title="Mensaje semanal"
      description="Publica un mensaje para la comunidad visible en la landing."
    />
  )
}
