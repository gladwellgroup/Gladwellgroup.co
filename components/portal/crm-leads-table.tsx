'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronDown, ExternalLink, Info, Link2, Mail, Phone, Shield } from 'lucide-react'
import { BrandCard } from '@/components/brand/brand-card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  ContactStatusBadge,
  DISPLAY_STATUS_LABELS,
  DISPLAY_STATUS_COLORS,
  normalizeContactStatus,
  toDisplayStatus,
  type ContactStatus,
} from '@/components/portal/crm-status-badge'

interface Lead {
  id: string
  nombre: string
  apellidos?: string
  correo: string
  whatsapp_e164?: string
  red_social?: string
  perfil?: string
  status?: string
  assigned_to?: string
  contact_status?: string
  created_at: string
}

interface Admin {
  id: string
  nombre: string
  correo: string
}

interface CrmLeadsTableProps {
  leads: Lead[]
  admins: Admin[]
  currentUserId: string
  canDelegate: boolean
  canUpdateStatus: boolean
}

/** Las cuatro, para el select de cada fila — ahí sí hay que poder elegir
 *  "Descalificado". */
const SELECTABLE_STATUSES: readonly ContactStatus[] = [
  'sin_contactar',
  'contactado',
  'grupo_whatsapp',
  'descalificado',
]

/** Sin "descalificado": a un lead descartado no le sirve un chip propio —
 *  simplemente deja de aparecer al filtrar por los otros tres. Sigue
 *  visible en "Todos". */
const FILTERABLE_STATUSES: readonly Exclude<ContactStatus, 'descalificado'>[] = [
  'sin_contactar',
  'contactado',
  'grupo_whatsapp',
]

// linkedin siempre llega como URL completa; instagram puede llegar como
// @usuario o como URL — los tres formatos que ya acepta la validación del
// formulario público (lib/validations/walking-list.ts).
function profileHref(redSocial?: string, perfil?: string): string | null {
  if (!perfil) return null
  const trimmed = perfil.trim()
  if (!trimmed) return null
  if (redSocial === 'instagram' && trimmed.startsWith('@')) {
    return `https://instagram.com/${trimmed.slice(1)}`
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function ProfileLink({ redSocial, perfil }: { redSocial?: string; perfil?: string }) {
  const href = profileHref(redSocial, perfil)
  if (!href) return <span className="text-muted-foreground">{'—'}</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Visitar perfil"
    >
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  )
}

function ContactStatusDropdown({
  leadId,
  status,
  createdAt,
  updating,
  onChange,
}: {
  leadId: string
  status: ContactStatus
  createdAt: string
  updating: boolean
  onChange: (leadId: string, status: ContactStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const display = toDisplayStatus(status, createdAt)
  // La opción "sin_contactar" es la única cuyo texto depende del tiempo —
  // las otras dos siempre dicen lo mismo, se elija o no.
  const sinContactarLabel =
    display === 'nuevo' ? DISPLAY_STATUS_LABELS.nuevo : DISPLAY_STATUS_LABELS.sin_contactar

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={updating}
          aria-label="Cambiar estado de contacto"
          aria-expanded={open}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity disabled:opacity-60',
            DISPLAY_STATUS_COLORS[display]
          )}
        >
          {display === 'nuevo' ? sinContactarLabel : DISPLAY_STATUS_LABELS[display]}
          <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" collisionPadding={12} className="z-[60] w-40 p-1">
        <ul role="listbox" aria-label="Estado de contacto">
          {SELECTABLE_STATUSES.map((value) => {
            const isSelected = value === status
            const label = value === 'sin_contactar' ? sinContactarLabel : DISPLAY_STATUS_LABELS[value]
            return (
              <li key={value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(leadId, value)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-muted',
                    isSelected && 'bg-muted font-medium'
                  )}
                >
                  <span
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      DISPLAY_STATUS_COLORS[value].split(' ')[1]?.replace('text-', 'bg-')
                    )}
                    aria-hidden="true"
                  />
                  {label}
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

const SUPER_ADMIN_LABEL = 'Superadministrador'

function AdminDelegateDropdown({
  leadId,
  admins,
  assignedTo,
  delegating,
  onDelegate,
}: {
  leadId: string
  admins: Admin[]
  assignedTo?: string
  delegating: boolean
  onDelegate: (leadId: string, adminId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  if (admins.length === 0) return null

  const assignedAdmin = admins.find((admin) => admin.id === assignedTo)
  // Un lead puede seguir delegado a alguien cuyo módulo de CRM ya fue
  // revocado — esa persona ya no aparece en `admins`. Mostrarlo como
  // "Superadministrador" mentiría: el lead sigue asignado, solo que a
  // alguien que ya no lo puede ver en /admin/leads.
  const isOrphaned = Boolean(assignedTo) && !assignedAdmin

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={delegating}
          aria-label="Asignar administrador"
          aria-expanded={open}
          className="modal-field flex w-auto max-w-[11rem] items-center justify-between gap-1.5 px-2.5 py-1.5 text-left text-xs disabled:opacity-60"
        >
          <span className={cn('truncate', !assignedAdmin && 'text-muted-foreground')}>
            {delegating
              ? 'Delegando...'
              : isOrphaned
                ? 'Admin sin módulo'
                : (assignedAdmin?.nombre ?? SUPER_ADMIN_LABEL)}
          </span>
          <ChevronDown
            className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" collisionPadding={12} className="z-[60] w-56 p-1">
        <ul role="listbox" aria-label="Administradores de comunidad">
          {/* Opción por defecto: sin delegar, el lead lo maneja el
              superadministrador — antes era un placeholder mudo
              ("Seleccionar admin") que no reflejaba este estado real. */}
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={!assignedTo}
              onClick={() => {
                onDelegate(leadId, null)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-muted',
                !assignedTo ? 'bg-[#7C3AED]/15 font-medium text-[#A78BFA]' : 'text-foreground'
              )}
            >
              <Shield className="size-3.5 shrink-0" aria-hidden="true" />
              {SUPER_ADMIN_LABEL}
            </button>
          </li>
          <li role="presentation" className="my-1 border-t border-border/50" />
          {admins.map((admin) => {
            const isSelected = admin.id === assignedTo
            return (
              <li key={admin.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onDelegate(leadId, admin.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-muted',
                    isSelected ? 'bg-[#7C3AED]/15 font-medium text-[#A78BFA]' : 'text-foreground'
                  )}
                >
                  {admin.nombre}
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

type LeadFilter = Exclude<ContactStatus, 'descalificado'> | 'todos'

/** Mismo orden fijo 2×2 en mobile que `PipelineFilter`: Todos siempre
 *  abajo a la derecha, como "Todas" en el filtro de sesiones. */
const MOBILE_ORDER: Record<LeadFilter, string> = {
  sin_contactar: 'order-1',
  contactado: 'order-2',
  grupo_whatsapp: 'order-3',
  todos: 'order-4',
}

function ContactStatusFilter({
  leads,
  value,
  onChange,
}: {
  leads: Lead[]
  value: LeadFilter
  onChange: (value: LeadFilter) => void
}) {
  const opciones: { key: LeadFilter; label: string; count: number }[] = [
    { key: 'todos', label: 'Todos', count: leads.length },
    ...FILTERABLE_STATUSES.map((key) => ({
      key,
      // El chip de filtro agrupa por el valor real guardado — "Sin
      // contactar" incluye tanto los recién llegados (Nuevo) como los
      // atrasados; la distinción visual vive en el badge/select de cada fila.
      // "Descalificado" no tiene chip propio — se ve en "Todos", no filtra.
      label: DISPLAY_STATUS_LABELS[key],
      count: leads.filter((l) => normalizeContactStatus(l.contact_status) === key).length,
    })),
  ]

  return (
    // Mismo lenguaje que PipelineFilter (Terapia/Education): grid 2×2 fijo
    // en mobile, flex centrado desde `sm:` en adelante.
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center">
      {opciones.map((opcion) => {
        const activo = value === opcion.key
        return (
          <button
            key={opcion.key}
            type="button"
            onClick={() => onChange(opcion.key)}
            aria-pressed={activo}
            className={`flex items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors sm:order-none ${MOBILE_ORDER[opcion.key]} ${
              activo
                ? 'border-[#7C3AED] bg-[#7C3AED]/15 text-[#A78BFA]'
                : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            {opcion.label}
            <span className="tabular-nums opacity-70">{opcion.count}</span>
          </button>
        )
      })}
    </div>
  )
}

export function CrmLeadsTable({
  leads,
  admins,
  canDelegate,
  canUpdateStatus,
}: CrmLeadsTableProps) {
  const router = useRouter()
  const [delegating, setDelegating] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<LeadFilter>('todos')

  async function handleDelegate(leadId: string, adminId: string | null) {
    setDelegating(leadId)
    setError(null)
    try {
      const res = await fetch(`/api/leads/${leadId}/delegate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: adminId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'No se pudo delegar el lead')
        return
      }
      router.refresh()
    } catch {
      setError('Error de red al delegar el lead')
    } finally {
      setDelegating(null)
    }
  }

  async function handleStatusChange(leadId: string, status: ContactStatus) {
    setUpdatingStatus(leadId)
    setError(null)
    try {
      const res = await fetch(`/api/leads/${leadId}/contact-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_status: status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'No se pudo actualizar el estado')
        return
      }
      router.refresh()
    } catch {
      setError('Error de red al actualizar el estado')
    } finally {
      setUpdatingStatus(null)
    }
  }

  if (leads.length === 0) {
    return (
      <BrandCard className="text-center">
        <p className="text-muted-foreground">No hay leads registrados aun.</p>
      </BrandCard>
    )
  }

  const noAdmins = canDelegate && admins.length === 0
  const visibles =
    filtro === 'todos'
      ? leads
      : leads.filter((l) => normalizeContactStatus(l.contact_status) === filtro)

  return (
    <div className="space-y-4">
      {/* Mismo ancho y centrado que la barra de búsqueda + filtro de
          Terapia/Education — aquí no hay búsqueda, solo el filtro. */}
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        <ContactStatusFilter leads={leads} value={filtro} onChange={setFiltro} />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {noAdmins && (
        <div className="flex items-center gap-3 rounded-xl border border-[#7C3AED]/20 bg-[#7C3AED]/5 px-4 py-3">
          <Info className="size-5 shrink-0 text-[#A78BFA]" />
          <p className="text-sm text-muted-foreground">
            No hay administradores de comunidad registrados.{' '}
            <a
              href="/super/usuarios"
              className="text-foreground underline underline-offset-2 hover:text-[#A78BFA] transition-colors"
            >
              Invita uno desde Usuarios
            </a>
            .
          </p>
        </div>
      )}

      {/* Tabla desktop/tablet */}
      <BrandCard padding="sm" border="solid" className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Correo</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">WhatsApp</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Red</th>
              <th className="w-px px-4 py-3 text-left font-medium text-muted-foreground">
                Perfil
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
              {canDelegate && !noAdmins && (
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Delegar</th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibles.map((lead) => {
              const contactStatus = normalizeContactStatus(lead.contact_status)
              return (
                <tr key={lead.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    {lead.nombre} {lead.apellidos ?? ''}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{lead.correo}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lead.whatsapp_e164 ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lead.red_social ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <ProfileLink redSocial={lead.red_social} perfil={lead.perfil} />
                  </td>
                  <td className="px-4 py-3">
                    {canUpdateStatus ? (
                      <ContactStatusDropdown
                        leadId={lead.id}
                        status={contactStatus}
                        createdAt={lead.created_at}
                        updating={updatingStatus === lead.id}
                        onChange={handleStatusChange}
                      />
                    ) : (
                      <ContactStatusBadge status={contactStatus} createdAt={lead.created_at} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(lead.created_at).toLocaleDateString('es-CO')}
                  </td>
                  {canDelegate && !noAdmins && (
                    <td className="px-4 py-3">
                      <AdminDelegateDropdown
                        leadId={lead.id}
                        admins={admins}
                        assignedTo={lead.assigned_to}
                        delegating={delegating === lead.id}
                        onDelegate={handleDelegate}
                      />
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </BrandCard>

      {/* Cards movil */}
      <div className="flex flex-col gap-3 md:hidden">
        {visibles.map((lead) => {
          const contactStatus = normalizeContactStatus(lead.contact_status)
          return (
            <BrandCard key={lead.id} padding="sm" border="solid" className="space-y-2.5 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm">
                  {lead.nombre} {lead.apellidos ?? ''}
                </p>
                {canUpdateStatus ? (
                  <ContactStatusDropdown
                    leadId={lead.id}
                    status={contactStatus}
                    createdAt={lead.created_at}
                    updating={updatingStatus === lead.id}
                    onChange={handleStatusChange}
                  />
                ) : (
                  <ContactStatusBadge status={contactStatus} createdAt={lead.created_at} />
                )}
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{lead.correo}</span>
                </p>
                {lead.whatsapp_e164 && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                    {lead.whatsapp_e164}
                  </p>
                )}
                {lead.red_social && (
                  <p className="flex items-center gap-1.5">
                    <Link2 className="size-3.5 shrink-0" aria-hidden="true" />
                    {lead.red_social}
                    <ProfileLink redSocial={lead.red_social} perfil={lead.perfil} />
                  </p>
                )}
                <p className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
                  {new Date(lead.created_at).toLocaleDateString('es-CO')}
                </p>
              </div>
              {canDelegate && !noAdmins && (
                <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2.5">
                  <span className="text-xs text-muted-foreground">Asignar a</span>
                  <AdminDelegateDropdown
                    leadId={lead.id}
                    admins={admins}
                    assignedTo={lead.assigned_to}
                    delegating={delegating === lead.id}
                    onDelegate={handleDelegate}
                  />
                </div>
              )}
            </BrandCard>
          )
        })}
      </div>
    </div>
  )
}
