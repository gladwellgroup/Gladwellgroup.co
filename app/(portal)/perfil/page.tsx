import { requireAuth } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { ROLE_LABELS, type Role } from '@/lib/permissions'
import type { ModuleKey } from '@/lib/permissions/modules'
import { BrandCard } from '@/components/brand/brand-card'
import { Separator } from '@/components/ui/separator'
import { ChangePasswordForm } from '@/components/portal/change-password-form'
import { SignOutButton } from '@/components/portal/sign-out-button'
import { AvatarCard } from '@/components/portal/avatar-card'
import { ModuleChips } from '@/components/portal/usuarios-table'

export default async function PerfilPage() {
  const user = await requireAuth()
  const supabase = getSupabaseServer()

  // avatar_url/cargo no vienen en SessionUser (solo carga permisos ya
  // resueltos) — una consulta chica, ya cubierta por la policy "Users read
  // own module grants" para los módulos.
  const [{ data: profile }, { data: grants }] = await Promise.all([
    supabase.from('profiles').select('avatar_url, cargo').eq('id', user.id).single(),
    supabase.from('profile_module_grants').select('module_key').eq('profile_id', user.id),
  ])

  const grantedModules = (grants ?? []).map((g) => g.module_key as ModuleKey)

  return (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-xl sm:text-2xl font-bold gladwell-gradient-text">Mi perfil</h1>
      <BrandCard border="solid" className="w-full max-w-md space-y-4 text-center">
        <div className="space-y-1">
          <AvatarCard userId={user.id} initialUrl={profile?.avatar_url ?? ''} />
          <p className="text-lg font-semibold">{user.nombre}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="text-sm text-muted-foreground">{ROLE_LABELS[user.role as Role]}</p>
          {profile?.cargo && <p className="text-sm text-muted-foreground">{profile.cargo}</p>}
        </div>

        {user.role === 'community_admin' && (
          <>
            <Separator />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Tus módulos</h2>
              <ModuleChips modules={grantedModules} align="center" />
            </div>
          </>
        )}

        <Separator />
        <ChangePasswordForm />

        <Separator />
        <SignOutButton />
      </BrandCard>
    </div>
  )
}
