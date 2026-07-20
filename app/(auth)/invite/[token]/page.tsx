import { getSupabaseServer } from '@/lib/supabase/server'
import { ROLE_LABELS, isValidRole } from '@/lib/permissions/roles'
import { BrandCard } from '@/components/brand/brand-card'
import { BrandButton } from '@/components/brand/brand-button'

function InviteMessage({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <BrandCard className="max-w-md w-full text-center space-y-4">
      <h1 className="text-2xl font-bold gladwell-gradient-text">{title}</h1>
      <p className="text-muted-foreground">{message}</p>
      <BrandButton asChild>
        <a href="/login">Ir al login</a>
      </BrandButton>
    </BrandCard>
  )
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = getSupabaseServer()

  const { data: invitation } = await supabase
    .from('invitations')
    .select('email, role, accepted_at, expires_at')
    .eq('token', token)
    .single()

  if (!invitation) {
    return (
      <InviteMessage
        title="Enlace no válido"
        message="Este enlace de invitación no existe. Contacta a un administrador de Gladwell para que te envíe uno nuevo."
      />
    )
  }

  if (invitation.accepted_at) {
    return (
      <InviteMessage
        title="Invitación ya utilizada"
        message="Esta invitación ya fue aceptada anteriormente. Si ya tienes cuenta, ingresa directamente."
      />
    )
  }

  if (new Date(invitation.expires_at) <= new Date()) {
    return (
      <InviteMessage
        title="Invitación expirada"
        message="Este enlace de invitación ya venció. Contacta a un administrador de Gladwell para que te envíe uno nuevo."
      />
    )
  }

  const roleLabel = isValidRole(invitation.role)
    ? ROLE_LABELS[invitation.role]
    : invitation.role

  return (
    <BrandCard className="max-w-md w-full text-center space-y-4">
      <h1 className="text-2xl font-bold gladwell-gradient-text">
        Bienvenido a Gladwell
      </h1>
      <p className="text-muted-foreground">
        Has sido invitado a unirte a la comunidad como{' '}
        <span className="text-foreground font-semibold">{roleLabel}</span>{' '}
        con el correo{' '}
        <span className="text-foreground font-semibold">
          {invitation.email}
        </span>
        .
      </p>
      <BrandButton asChild>
        <a href={`/login?email=${encodeURIComponent(invitation.email)}`}>
          Aceptar invitación e ingresar
        </a>
      </BrandButton>
    </BrandCard>
  )
}
