import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/auth/session'
import { hasPermission, type Permission } from '@/lib/permissions'
import { getSupabaseServer } from '@/lib/supabase/server'
import { BrandCard } from '@/components/brand/brand-card'
import {
  AttentionList,
  type AttentionItem,
} from '@/components/portal/attention-list'
import {
  DeliverablesPipeline,
  type BucketCount,
  type PipelineCounts,
} from '@/components/portal/deliverables-pipeline'
import {
  PIPELINE_BUCKETS,
  STALE_AFTER_DAYS,
  bucketSession,
  daysSinceSession,
} from '@/lib/deliverables/pipeline'
import {
  loadPipelineSessions,
  type CalendarSession,
} from '@/lib/deliverables/sessions'
import { parseDateOnly } from '@/lib/date'

function can(role: string, perm: Permission) {
  return hasPermission(role as Parameters<typeof hasPermission>[0], perm)
}

function emptyCounts(): PipelineCounts {
  return Object.fromEntries(
    PIPELINE_BUCKETS.map((b) => [
      b,
      { terapia: 0, education: 0, staleDays: null } satisfies BucketCount,
    ])
  ) as PipelineCounts
}

function buildCounts(sessions: CalendarSession[]): PipelineCounts {
  const counts = emptyCounts()

  for (const session of sessions) {
    const bucket = bucketSession(session)
    counts[bucket][session.programa] += 1

    // La antigüedad solo dice algo en lo que aún no se entrega.
    if (bucket === 'borrador' || bucket === 'generado') {
      const dias = daysSinceSession(session.session_date)
      if (dias >= STALE_AFTER_DAYS) {
        counts[bucket].staleDays = Math.max(counts[bucket].staleDays ?? 0, dias)
      }
    }
  }

  return counts
}

interface SessionIds {
  terapia: string[]
  education: string[]
}

/** Sesiones y asistentes con algo roto que nadie ha visto, más las sesiones
 *  estancadas — una por una, no el agregado que ya muestra la tarjeta del
 *  pipeline, porque aquí es donde se decide a quién avisar. */
async function loadAttention(
  supabase: SupabaseClient,
  sessions: CalendarSession[],
  basePath: string,
  role: string,
  ids: SessionIds
): Promise<AttentionItem[]> {
  const byId = new Map(sessions.map((s) => [s.id, s]))

  if (ids.terapia.length === 0 && ids.education.length === 0) return []

  const [terrT, terrE, mailT, mailE] = await Promise.all([
    supabase
      .from('therapy_deliverables')
      .select('session_id')
      .eq('processing_status', 'error')
      .in('session_id', ids.terapia),
    supabase
      .from('education_deliverables')
      .select('session_id')
      .eq('processing_status', 'error')
      .in('session_id', ids.education),
    supabase
      .from('therapy_session_attendees')
      .select('session_id')
      .eq('email_status', 'error')
      .in('session_id', ids.terapia),
    supabase
      .from('education_attendees')
      .select('session_id')
      .eq('email_status', 'error')
      .in('session_id', ids.education),
  ])

  const items: AttentionItem[] = []
  const path = (s: CalendarSession) =>
    `${basePath}/${s.programa === 'terapia' ? 'terapia' : 'education'}/${s.id}`

  for (const row of [...(terrT.data ?? []), ...(terrE.data ?? [])]) {
    const s = byId.get(row.session_id as string)
    if (s) {
      items.push({
        href: `${path(s)}/entregable`,
        titulo: s.title,
        detalle: 'La síntesis falló. Hay que regenerar el entregable.',
      })
    }
  }

  // Un correo fallido por sesión, no uno por persona: la acción es la misma.
  const fallidos = new Map<string, number>()
  for (const row of [...(mailT.data ?? []), ...(mailE.data ?? [])]) {
    const id = row.session_id as string
    fallidos.set(id, (fallidos.get(id) ?? 0) + 1)
  }
  for (const [id, n] of fallidos) {
    const s = byId.get(id)
    if (s) {
      items.push({
        href: path(s),
        titulo: s.title,
        detalle: `${n} asistente(s) no recibieron el entregable.`,
      })
    }
  }

  // Sesiones estancadas, la más vieja primero — después de los errores de
  // arriba, que ya son un problema roto, no solo lento. El nombre del
  // responsable solo tiene sentido para super_admin: un community_admin
  // viendo su propia sesión estancada no necesita que le digan que el
  // responsable es él mismo.
  const estancadas = sessions
    .filter((s) => {
      const bucket = bucketSession(s)
      if (bucket !== 'borrador' && bucket !== 'generado') return false
      return daysSinceSession(s.session_date) >= STALE_AFTER_DAYS
    })
    .sort(
      (a, b) => daysSinceSession(b.session_date) - daysSinceSession(a.session_date)
    )

  for (const s of estancadas) {
    const dias = daysSinceSession(s.session_date)
    const quien = role === 'super_admin' && s.responsable ? ` — ${s.responsable}` : ''
    items.push({
      href: path(s),
      titulo: s.title,
      detalle: `${dias} días sin avanzar${quien}`,
    })
  }

  return items
}

/** Personas distintas que han asistido, uniendo los dos programas por correo,
 *  más qué tanto de eso se capturó por QR en vivo vs. CSV después. Acotado a
 *  las sesiones que `ids` ya filtró por pertenencia — sin esto, un
 *  community_admin vería estadísticas de comunidad de toda la plataforma, no
 *  solo las suyas.
 *
 *  PostgREST no une dos tablas en una consulta, y el volumen es de decenas:
 *  deduplicar en JS evita una vista o RPC. Si la comunidad llega a miles,
 *  esto se mueve a Postgres. */
async function loadCommunity(supabase: SupabaseClient, ids: SessionIds) {
  if (ids.terapia.length === 0 && ids.education.length === 0) {
    return { personas: 0, recurrentes: 0, porQr: null as number | null }
  }

  const [terapia, education] = await Promise.all([
    supabase
      .from('therapy_session_attendees')
      .select('correo, source')
      .in('session_id', ids.terapia),
    supabase
      .from('education_attendees')
      .select('correo, source')
      .in('session_id', ids.education),
  ])

  const rows = [...(terapia.data ?? []), ...(education.data ?? [])]
  const sesionesPorCorreo = new Map<string, number>()
  let porQr = 0

  for (const row of rows) {
    const correo = (row.correo as string)?.trim().toLowerCase()
    if (correo) {
      sesionesPorCorreo.set(correo, (sesionesPorCorreo.get(correo) ?? 0) + 1)
    }
    if (row.source === 'qr') porQr += 1
  }

  let recurrentes = 0
  for (const n of sesionesPorCorreo.values()) if (n > 1) recurrentes += 1

  return {
    personas: sesionesPorCorreo.size,
    recurrentes,
    porQr: rows.length > 0 ? Math.round((porQr / rows.length) * 100) : null,
  }
}

export default async function DashboardPage() {
  const user = await requireAuth()
  const supabase = getSupabaseServer()
  const role = user.role

  const verEntregables = can(role, 'therapy:create') || can(role, 'education:create')
  const basePath = role === 'super_admin' ? '/super/entregables' : '/admin/entregables'

  const sessions = verEntregables ? await loadPipelineSessions(supabase, user) : []
  const counts = buildCounts(sessions)

  // Un solo cálculo de "qué sesiones puede ver este usuario", reutilizado por
  // Requiere atención y por Comunidad — evita que cada una acote distinto.
  const ids: SessionIds = { terapia: [], education: [] }
  for (const s of sessions) ids[s.programa].push(s.id)

  const [attention, community] = await Promise.all([
    verEntregables
      ? loadAttention(supabase, sessions, basePath, role, ids)
      : Promise.resolve([] as AttentionItem[]),
    verEntregables
      ? loadCommunity(supabase, ids)
      : Promise.resolve({ personas: 0, recurrentes: 0, porQr: null as number | null }),
  ])

  const proximas = sessions
    .filter((s) => bucketSession(s) === 'programada')
    .sort((a, b) => a.session_date.localeCompare(b.session_date))
    .slice(0, 5)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold gladwell-gradient-text">
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Bienvenido, {user.nombre}
        </p>
      </div>

      {verEntregables && (
        <DeliverablesPipeline
          counts={counts}
          links={{
            terapia: `${basePath}/terapia`,
            education: `${basePath}/education`,
          }}
        />
      )}

      <AttentionList items={attention} />

      {proximas.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold gladwell-gradient-text">
            Próximas sesiones
          </h2>
          <BrandCard padding="sm" border="solid" className="divide-y divide-border">
            {proximas.map((session) => (
              <Link
                key={session.id}
                href={`${basePath}/${session.programa === 'terapia' ? 'terapia' : 'education'}/${session.id}`}
                className="flex items-center justify-between gap-3 px-2 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{session.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {session.programa === 'terapia'
                      ? 'Terapia Organizacional'
                      : 'Gladwell Education'}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {parseDateOnly(session.session_date).toLocaleDateString('es-CO', {
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
              </Link>
            ))}
          </BrandCard>
        </div>
      )}

      {/* Mismo peso visual que "Próximas sesiones": esta es la métrica de si
          la comunidad realmente vuelve, y antes vivía como una línea de
          texto plano al fondo de la página. */}
      {verEntregables && community.personas > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold gladwell-gradient-text">
            Comunidad
          </h2>
          <BrandCard
            padding="sm"
            border="solid"
            className="flex flex-wrap justify-around gap-4 text-center sm:justify-start sm:gap-10"
          >
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {community.personas}
              </p>
              <p className="text-xs text-muted-foreground">
                {community.personas === 1
                  ? 'persona ha asistido'
                  : 'personas han asistido'}
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {community.recurrentes}
              </p>
              <p className="text-xs text-muted-foreground">
                {community.recurrentes === 1 ? 'ha vuelto' : 'han vuelto'}
              </p>
            </div>
            {community.porQr !== null && (
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {community.porQr}%
                </p>
                <p className="text-xs text-muted-foreground">
                  registrados por QR
                </p>
              </div>
            )}
          </BrandCard>
        </div>
      )}
    </div>
  )
}
