import { requirePermission } from '@/lib/auth/session'
import { ComingSoon } from '@/components/portal/coming-soon'

export default async function DirectorioPage() {
  await requirePermission('profile:view_members')

  return (
    <ComingSoon
      title="Directorio de integrantes"
      description="Conoce a los integrantes curados de la comunidad Gladwell."
    />
  )
}
