import { requireAuth } from '@/lib/auth/session'
import { ROLE_LABELS, type Role } from '@/lib/permissions'
import { BrandCard } from '@/components/brand/brand-card'

export default async function PerfilPage() {
  const user = await requireAuth()

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold gladwell-gradient-text">Mi perfil</h1>
      <BrandCard className="space-y-2 max-w-md">
        <p>
          <span className="text-muted-foreground">Nombre:</span> {user.nombre}
        </p>
        <p>
          <span className="text-muted-foreground">Correo:</span> {user.email}
        </p>
        <p>
          <span className="text-muted-foreground">Rol:</span>{' '}
          {ROLE_LABELS[user.role as Role]}
        </p>
      </BrandCard>
    </div>
  )
}
