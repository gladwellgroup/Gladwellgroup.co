import { requireAuth } from '@/lib/auth/session'
import { ComingSoon } from '@/components/portal/coming-soon'

export default async function PerfilLinktreePage() {
  await requireAuth()

  return (
    <ComingSoon
      title="Mi perfil público"
      description="Configura tu perfil tipo linktree visible para otros integrantes o públicamente."
    />
  )
}
