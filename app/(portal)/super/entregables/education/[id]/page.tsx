import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getEducationSession } from '@/lib/education/queries'
import { EducationSessionForm } from '@/components/portal/education-session-form'
import { resolvePermissionsFromGrants, type Role } from '@/lib/permissions'

export default async function SuperEducationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requirePermission('sessions:read_community')
  if (user.role !== 'super_admin') notFound()

  const { id } = await params
  const [data, { data: communityAdmins }] = await Promise.all([
    getEducationSession(id),
    getSupabaseServer()
      .from('profiles')
      .select('id, nombre, role, profile_module_grants!profile_module_grants_profile_id_fkey(module_key)')
      .eq('role', 'community_admin')
      .order('nombre'),
  ])

  if (!data) notFound()

  // Solo ofrecer como coadministrador a quien la API ya aceptaría — sin
  // esto el selector deja marcar a cualquier community_admin y el PATCH
  // rechaza en silencio a los que no tienen el módulo de Educación.
  const eligibleCoAdmins = (communityAdmins ?? []).filter((admin) =>
    resolvePermissionsFromGrants(admin.role as Role, admin.profile_module_grants).includes(
      'education:create'
    )
  )

  return (
    <EducationSessionForm
      session={data.session}
      inputs={data.inputs}
      tools={data.tools}
      attendees={data.attendees}
      attendanceLink={data.attendanceLink}
      basePath="/super/entregables/education"
      hasDeliverable={Boolean(data.deliverable)}
      coAdminIds={data.session.co_admin_ids ?? []}
      communityAdmins={eligibleCoAdmins}
    />
  )
}
