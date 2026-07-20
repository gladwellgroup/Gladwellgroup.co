import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { DeliverableEditor } from '@/components/portal/deliverable-editor'

export default async function SuperEntregableEditorPage({
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
      id, title, session_date, moderator_id, status, created_by,
      therapy_deliverables ( id, problema_recordatorio, resumen_audio, recomendaciones_incomodas, content_html, pdf_url, processing_status, generated_at ),
      therapy_session_inputs ( foto_sesion_url ),
      therapy_session_audios ( audio_url )
    `)
    .eq('id', id)
    .order('created_at', { referencedTable: 'therapy_session_audios' })
    .limit(1, { referencedTable: 'therapy_session_audios' })
    .single()

  if (!data) notFound()

  // supabase-js tipa las relaciones embebidas como arrays, pero en runtime
  // las to-one (deliverable/inputs, con session_id UNIQUE) vuelven objeto|null.
  // El cliente ya es <any>, así que desestructuramos desde any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = data
  const {
    therapy_deliverables: deliverable,
    therapy_session_inputs: inputs,
    therapy_session_audios: audios,
    ...session
  } = row

  if (!deliverable) notFound()

  const canEdit =
    user.role === 'super_admin' || user.id === session.moderator_id

  return (
    <DeliverableEditor
      session={session}
      deliverable={deliverable}
      fotoSesionUrl={inputs?.foto_sesion_url ?? null}
      audioUrl={audios?.[0]?.audio_url ?? null}
      canEdit={canEdit}
      basePath="/super/entregables"
    />
  )
}
