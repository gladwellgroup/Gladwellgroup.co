import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { SessionDetailForm } from '@/components/portal/session-detail-form'

export default async function SuperEntregableDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requirePermission('therapy:create')
  if (user.role !== 'super_admin') notFound()
  const { id } = await params
  const supabase = getSupabaseServer()

  const { data } = await supabase
    .from('therapy_sessions')
    .select(`
      id, title, session_date, moderator_id, pillar, status, created_by, invitado_id,
      therapy_session_inputs ( reto_problema, recomendaciones_incomodas, foto_sesion_url, frase_texto, frase_autor ),
      therapy_session_cofounders ( id, nombre, whatsapp, correo, orden ),
      therapy_session_audios ( id, audio_url, autor_nombre, duracion_segundos, created_at ),
      therapy_deliverables ( id ),
      invitados ( id, nombre, descripcion, red_social, pagina_web )
    `)
    .eq('id', id)
    .order('orden', { referencedTable: 'therapy_session_cofounders' })
    .order('created_at', { referencedTable: 'therapy_session_audios' })
    .single()

  if (!data) notFound()

  // supabase-js tipa las relaciones embebidas como arrays, pero en runtime
  // las to-one (inputs/deliverable/invitado, con FK o session_id UNIQUE)
  // vuelven objeto|null. El cliente ya es <any>, así que desestructuramos
  // desde any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = data
  const {
    therapy_session_inputs: inputs,
    therapy_session_cofounders: cofounders,
    therapy_session_audios: audios,
    therapy_deliverables: deliverable,
    invitados: invitado,
    ...session
  } = row

  return (
    <SessionDetailForm
      session={session}
      inputs={inputs}
      invitado={invitado ?? null}
      cofounders={cofounders ?? []}
      audios={audios ?? []}
      currentUserId={user.id}
      currentUserRole={user.role}
      basePath="/super/entregables"
      hasDeliverable={Boolean(deliverable)}
    />
  )
}
