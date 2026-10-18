import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import { getCharla } from '@/lib/charlas/queries'
import { CharlaDetail } from '@/components/portal/charla-detail'

export default async function SuperCharlaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requirePermission('sessions:read_community')
  if (user.role !== 'super_admin') notFound()

  const { id } = await params
  // Sin el módulo `charlas` ni siquiera se piden los nombres y correos a la
  // base: la ficha llega solo con el conteo.
  const canManage = user.permissions.includes('charlas:manage')
  const data = await getCharla(id, { includeAttendees: canManage })

  if (!data) notFound()

  return (
    <CharlaDetail
      charla={data.charla}
      asistentes={data.asistentes}
      attendees={data.attendees}
      attendanceLink={data.attendanceLink}
      canManage={canManage}
      listPath="/super/encuentros/charlas"
    />
  )
}
