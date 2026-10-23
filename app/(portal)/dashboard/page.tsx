import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { must } from '@/lib/supabase/must'
import { BrandCard } from '@/components/brand/brand-card'
import { BrandButton } from '@/components/brand/brand-button'
import {
  AttentionList,
  type AttentionItem,
} from '@/components/portal/attention-list'
import {
  DeliverablesPipeline,
  type BucketCount,
  type PipelineCounts,
} from '@/components/portal/deliverables-pipeline'
import { CrmCard, type DashboardLead } from '@/components/portal/dashboard/crm-card'
import { ParrillaCard } from '@/components/portal/dashboard/parrilla-card'
import { CommunityCalendarCard } from '@/components/portal/dashboard/community-calendar-card'
import {
  LIFECYCLE_BUCKETS,
  STALE_AFTER_DAYS,
  bucketSession,
  daysSinceSession,
} from '@/lib/deliverables/pipeline'
import {
  isUpcoming,
  loadCalendarSessions,
  loadPipelineSessions,
  type DeliverableSession,
} from '@/lib/deliverables/sessions'
import { loadCharlaSessions } from '@/lib/charlas/queries'
import { PROGRAMA_LABEL, sessionHref } from '@/lib/encuentros/programas'
import { loadParrillaPending } from '@/lib/parrilla/posts'
import { parseDateOnly } from '@/lib/date'

function emptyCounts(): PipelineCounts {
  return Object.fromEntries(
    LIFECYCLE_BUCKETS.map((b) => [
      b,
      { terapia: 0, education: 0, staleDays: null } satisfies BucketCount,
    ])
  ) as PipelineCounts
}

function buildCounts(sessions: DeliverableSession[]): PipelineCounts {
  const counts = emptyCounts()

  for (const session of sessions) {
    const bucket = bucketSession(session)
    if (bucket === 'archivado') continue
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
  sessions: DeliverableSession[],
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

  // `must`: una consulta caída dejaba «Requiere atención» vacío, como si todo estuviera bien.
  const fallidosT = must(terrT, 'Entregables con error (Terapia)') ?? []
  const fallidosE = must(terrE, 'Entregables con error (Education)') ?? []
  const correosT = must(mailT, 'Correos fallidos (Terapia)') ?? []
  const correosE = must(mailE, 'Correos fallidos (Education)') ?? []

  const items: AttentionItem[] = []
  const path = (s: DeliverableSession) => sessionHref(basePath, s)

  for (const row of [...fallidosT, ...fallidosE]) {
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
  for (const row of [...correosT, ...correosE]) {
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

  const rows = [
    ...(must(terapia, 'Asistentes de Terapia') ?? []),
    ...(must(education, 'Asistentes de Education') ?? []),
  ]
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

  // Cada sección del dashboard depende de su propio módulo, sin relación
  // entre sí — un admin con CRM y Parrilla pero sin Terapia ni Education no
  // debería ver nada de sesiones, y viceversa. `sessions:read_community` sin
  // ningún módulo de administrar es el caso "solo puede ver el calendario, no
  // administra nada" (el módulo nuevo de solo lectura).
  //
  // `hasEntregables` es solo Terapia y Education: son los programas con
  // entregable, los únicos que alimentan el pipeline, «Requiere atención» y
  // «Comunidad». Las charlas no tienen entregable; solo aportan sus próximas
  // fechas (abajo).
  const canTherapy = user.permissions.includes('therapy:create')
  const canEducation = user.permissions.includes('education:create')
  const canCharlas = user.permissions.includes('charlas:manage')
  const hasEntregables = canTherapy || canEducation
  const hasCalendarOnly = !hasEntregables && user.permissions.includes('sessions:read_community')
  const hasCrm = user.permissions.includes('leads:read_delegated')
  const hasParrilla = user.permissions.includes('parrilla:manage')

  const basePath = role === 'super_admin' ? '/super/encuentros' : '/admin/encuentros'
  const crmHref = role === 'super_admin' ? '/super/crm' : '/admin/leads'
  const parrillaHref = role === 'super_admin' ? '/super/parrilla' : '/admin/parrilla'
  // Si solo administra uno de los dos programas, "crear tu primera sesión"
  // apunta directo ahí en vez de al hub (un paso menos).
  const entregablesEmptyHref =
    canTherapy && canEducation
      ? basePath
      : canEducation
        ? `${basePath}/education`
        : `${basePath}/terapia`

  const [sessions, charlas, communitySessions, crmLeadsResult, parrillaQueue] = await Promise.all([
    hasEntregables ? loadPipelineSessions(supabase, user, 'own') : Promise.resolve([]),
    // Las charlas no tienen dueño (las gestiona quien tiene el módulo): quien las
    // gestiona ve las próximas de todas. Quien solo tiene el calendario las ve
    // dentro de `communitySessions`.
    hasEntregables && canCharlas ? loadCharlaSessions(supabase) : Promise.resolve([]),
    hasCalendarOnly ? loadCalendarSessions(supabase, user) : Promise.resolve([]),
    hasCrm
      ? supabase
          .from('walking_list_leads')
          .select('id, nombre, apellidos, contact_status, created_at')
          .eq('assigned_to', user.id)
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: null, error: null }),
    // La cola ya viene filtrada en SQL (solo las piezas de este usuario, sin
    // terminar), no se carga toda la tabla para filtrar aquí.
    hasParrilla ? loadParrillaPending(supabase, user.id) : Promise.resolve([]),
  ])

  const counts = buildCounts(sessions)
  const crmLeads = (must(crmLeadsResult, 'Leads del dashboard') ?? []) as DashboardLead[]
  const parrillaPending = parrillaQueue.slice(0, 5)

  // Un solo cálculo de "qué sesiones puede ver este usuario", reutilizado por
  // Requiere atención y por Comunidad — evita que cada una acote distinto.
  const ids: SessionIds = { terapia: [], education: [] }
  for (const s of sessions) ids[s.programa].push(s.id)

  const [attention, community] = await Promise.all([
    hasEntregables
      ? loadAttention(supabase, sessions, basePath, role, ids)
      : Promise.resolve([] as AttentionItem[]),
    hasEntregables
      ? loadCommunity(supabase, ids)
      : Promise.resolve({ personas: 0, recurrentes: 0, porQr: null as number | null }),
  ])

  // `isUpcoming` es la definición única de «próxima»: una sesión con entregable lo
  // es si su fecha es posterior a hoy; una charla, hasta que termina su día.
  const proximas = [...sessions, ...charlas]
    .filter(isUpcoming)
    .sort((a, b) => a.session_date.localeCompare(b.session_date))
    .slice(0, 5)

  const proximasComunidad = communitySessions
    .filter(isUpcoming)
    .sort((a, b) => a.session_date.localeCompare(b.session_date))
    .slice(0, 5)

  const sinModulos = !hasEntregables && !hasCalendarOnly && !hasCrm && !hasParrilla

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

      {sinModulos && (
        <BrandCard className="text-center">
          <p className="text-muted-foreground">
            Aún no tienes módulos asignados. Pídele al super administrador que
            te otorgue acceso a las secciones que vas a necesitar.
          </p>
        </BrandCard>
      )}

      {hasEntregables &&
        (sessions.length === 0 ? (
          <BrandCard className="flex flex-col items-center gap-3 text-center">
            <p className="text-muted-foreground">
              Aún no tienes sesiones asignadas.
            </p>
            <BrandButton asChild size="sm" className="w-auto">
              <Link href={entregablesEmptyHref}>Crear tu primera sesión</Link>
            </BrandButton>
          </BrandCard>
        ) : (
          <DeliverablesPipeline
            counts={counts}
            links={{
              terapia: `${basePath}/terapia`,
              education: `${basePath}/education`,
            }}
          />
        ))}

      {hasCalendarOnly && (
        <CommunityCalendarCard sessions={proximasComunidad} href={basePath} />
      )}

      {hasCrm && <CrmCard leads={crmLeads} href={crmHref} />}

      {hasParrilla && <ParrillaCard posts={parrillaPending} href={parrillaHref} />}

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
                href={sessionHref(basePath, session)}
                className="flex items-center justify-between gap-3 px-2 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{session.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {PROGRAMA_LABEL[session.programa]}
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
      {hasEntregables && community.personas > 0 && (
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
