import { requireAuth } from '@/lib/auth/session'
import { hasPermission, type Permission } from '@/lib/permissions'
import { getSupabaseServer } from '@/lib/supabase/server'
import { BrandCard } from '@/components/brand/brand-card'
import {
  BarChart3,
  Sparkles,
  Briefcase,
  Users,
} from 'lucide-react'
import Link from 'next/link'

interface MetricCardProps {
  label: string
  value: number
  icon: React.ReactNode
}

function MetricCard({ label, value, icon }: MetricCardProps) {
  return (
    <BrandCard className="flex items-center gap-4">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#7C3AED]/10">
        {icon}
      </div>
      <div>
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </BrandCard>
  )
}

const STATUS_COLORS: Record<string, string> = {
  nuevo: 'bg-[#06B6D4]/15 text-[#06B6D4]',
  delegado: 'bg-[#7C3AED]/15 text-[#A78BFA]',
  contactado: 'bg-yellow-500/15 text-yellow-500',
  invitado: 'bg-blue-500/15 text-blue-400',
  convertido: 'bg-green-500/15 text-green-500',
}

const STATUS_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  delegado: 'Delegado',
  contactado: 'Contactado',
  invitado: 'Invitado',
  convertido: 'Convertido',
}

function can(role: string, perm: Permission) {
  return hasPermission(role as Parameters<typeof hasPermission>[0], perm)
}

export default async function DashboardPage() {
  const user = await requireAuth()
  const supabase = getSupabaseServer()
  const role = user.role

  let totalLeads = 0
  let newLeads = 0
  let therapySessions = 0
  let activeUsers = 0

  interface Lead {
    id: string
    nombre: string
    status: string | null
    created_at: string
  }
  let recentLeads: Lead[] = []

  interface Session {
    id: string
    title: string
    status: string | null
    created_at: string
    moderator_id: string
  }
  let recentSessions: Session[] = []

  if (can(role, 'leads:read_all')) {
    const { count: total } = await supabase
      .from('walking_list_leads')
      .select('*', { count: 'exact', head: true })
    totalLeads = total ?? 0

    const { count: nuevo } = await supabase
      .from('walking_list_leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'nuevo')
    newLeads = nuevo ?? 0

    const { data: leads } = await supabase
      .from('walking_list_leads')
      .select('id, nombre, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
    recentLeads = (leads as Lead[]) ?? []
  } else if (can(role, 'leads:read_delegated')) {
    const { count: total } = await supabase
      .from('walking_list_leads')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', user.id)
    totalLeads = total ?? 0

    const { count: nuevo } = await supabase
      .from('walking_list_leads')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', user.id)
      .eq('status', 'nuevo')
    newLeads = nuevo ?? 0

    const { data: leads } = await supabase
      .from('walking_list_leads')
      .select('id, nombre, status, created_at')
      .eq('assigned_to', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
    recentLeads = (leads as Lead[]) ?? []
  }

  if (can(role, 'therapy:create')) {
    const { count } = await supabase
      .from('therapy_sessions')
      .select('*', { count: 'exact', head: true })
    therapySessions = count ?? 0

    const { data: sessions } = await supabase
      .from('therapy_sessions')
      .select('id, title, status, created_at, moderator_id')
      .order('created_at', { ascending: false })
      .limit(3)
    recentSessions = (sessions as Session[]) ?? []
  } else if (can(role, 'therapy:read_own')) {
    const { count } = await supabase
      .from('therapy_sessions')
      .select('*', { count: 'exact', head: true })
    therapySessions = count ?? 0
  }

  if (can(role, 'users:list')) {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
    activeUsers = count ?? 0
  }

  const showLeadsSection = can(role, 'leads:read_all') || can(role, 'leads:read_delegated')
  const showTherapySection = can(role, 'therapy:create')

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

      {/* Bloque 1 — Metricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {showLeadsSection && (
          <>
            <MetricCard
              label="Total leads"
              value={totalLeads}
              icon={<BarChart3 className="size-6 text-[#7C3AED]" />}
            />
            <MetricCard
              label="Leads nuevos"
              value={newLeads}
              icon={<Sparkles className="size-6 text-[#06B6D4]" />}
            />
          </>
        )}
        {therapySessions > 0 || can(role, 'therapy:create') ? (
          <MetricCard
            label="Entregables"
            value={therapySessions}
            icon={<Briefcase className="size-6 text-[#7C3AED]" />}
          />
        ) : null}
        {can(role, 'users:list') && (
          <MetricCard
            label="Usuarios activos"
            value={activeUsers}
            icon={<Users className="size-6 text-[#06B6D4]" />}
          />
        )}
      </div>

      {/* Bloque 2 — Leads recientes */}
      {showLeadsSection && recentLeads.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold gladwell-gradient-text">
              Leads recientes
            </h2>
            <Link
              href={can(role, 'leads:read_all') ? '/super/crm' : '/admin/leads'}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Ver todos
            </Link>
          </div>

          {/* Tabla en desktop */}
          <BrandCard padding="sm" className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.map((lead) => (
                  <tr key={lead.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{lead.nombre}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[lead.status ?? 'nuevo'] ?? 'bg-muted'
                        }`}
                      >
                        {STATUS_LABELS[lead.status ?? 'nuevo'] ?? lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString('es-CO')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </BrandCard>

          {/* Cards en movil */}
          <div className="flex flex-col gap-3 md:hidden">
            {recentLeads.map((lead) => (
              <BrandCard key={lead.id} padding="sm" className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{lead.nombre}</p>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      STATUS_COLORS[lead.status ?? 'nuevo'] ?? 'bg-muted'
                    }`}
                  >
                    {STATUS_LABELS[lead.status ?? 'nuevo'] ?? lead.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(lead.created_at).toLocaleDateString('es-CO')}
                </p>
              </BrandCard>
            ))}
          </div>
        </div>
      )}

      {/* Bloque 3 — Entregables / sesiones */}
      {showTherapySection && recentSessions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold gladwell-gradient-text">
              Terapia Organizacional reciente
            </h2>
            <Link
              href={
                can(role, 'leads:read_all')
                  ? '/super/entregables/terapia'
                  : '/admin/entregables/terapia'
              }
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Ver todas
            </Link>
          </div>

          {/* Tabla en desktop */}
          <BrandCard padding="sm" className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sesion</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((session) => (
                  <tr key={session.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{session.title}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-[#7C3AED]/15 px-2.5 py-0.5 text-xs font-medium text-[#A78BFA]">
                        {session.status ?? 'borrador'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(session.created_at).toLocaleDateString('es-CO')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </BrandCard>

          {/* Cards en movil */}
          <div className="flex flex-col gap-3 md:hidden">
            {recentSessions.map((session) => (
              <BrandCard key={session.id} padding="sm" className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{session.title}</p>
                  <span className="inline-flex items-center rounded-full bg-[#7C3AED]/15 px-2.5 py-0.5 text-xs font-medium text-[#A78BFA]">
                    {session.status ?? 'borrador'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(session.created_at).toLocaleDateString('es-CO')}
                </p>
              </BrandCard>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
