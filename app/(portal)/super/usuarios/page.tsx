import { requirePermission } from '@/lib/auth/session'
import { ComingSoon } from '@/components/portal/coming-soon'

export default async function UsuariosPage() {
  await requirePermission('users:list')

  return (
    <ComingSoon
      title="Gestión de usuarios"
      description="Administra invitaciones, roles y accesos de la comunidad."
    />
  )
}
