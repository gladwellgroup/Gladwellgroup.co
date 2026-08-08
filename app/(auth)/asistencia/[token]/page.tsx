import { getSupabaseServer } from '@/lib/supabase/server'
import { BrandCard } from '@/components/brand/brand-card'
import { BrandButton } from '@/components/brand/brand-button'
import { AttendanceForm } from './attendance-form'

function AttendanceMessage({
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

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = getSupabaseServer()

  const { data: link } = await supabase
    .from('session_attendance_links')
    .select(
      `
      token, expires_at,
      therapy_sessions ( title ),
      education_sessions ( title )
    `
    )
    .eq('token', token)
    .maybeSingle()

  if (!link) {
    return (
      <AttendanceMessage
        title="Enlace no válido"
        message="Este enlace de asistencia no existe. Pide al organizador de la sesión que te comparta uno nuevo."
      />
    )
  }

  if (new Date(link.expires_at) <= new Date()) {
    return (
      <AttendanceMessage
        title="Enlace vencido"
        message="Este enlace de asistencia ya venció. Pide al organizador de la sesión que lo regenere."
      />
    )
  }

  // supabase-js tipa las relaciones embebidas como arrays; en runtime son
  // objeto|null (FK hacia adelante, una sola puede estar seteada por sesión).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = link
  const sessionTitle: string =
    row.therapy_sessions?.title ?? row.education_sessions?.title ?? 'la sesión'

  return (
    <BrandCard className="max-w-md w-full">
      <AttendanceForm token={token} sessionTitle={sessionTitle} />
    </BrandCard>
  )
}
