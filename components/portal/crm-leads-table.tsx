'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Info } from 'lucide-react'
import { BrandCard } from '@/components/brand/brand-card'

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

type ContactStatus = 'sin_contactar' | 'contactado' | 'grupo_whatsapp' | 'descalificado'

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

type DisplayStatus = 'nuevo' | ContactStatus

/** Un lead recién creado no está "atrasado" todavía — solo pasadas estas
 *  horas sin que nadie lo toque se vuelve una alerta real. */
const NEW_LEAD_GRACE_HOURS = 24

function isFreshLead(createdAt: string): boolean {
  const hoursSince = (Date.now() - new Date(createdAt).getTime()) / 3_600_000
  return hoursSince < NEW_LEAD_GRACE_HOURS
}

/** "Nuevo" no es un valor guardado — es `sin_contactar` dentro de la
 *  ventana de gracia. Pasada esa ventana, mismo valor, otra lectura. */
function toDisplayStatus(status: ContactStatus, createdAt: string): DisplayStatus {
  return status === 'sin_contactar' && isFreshLead(createdAt) ? 'nuevo' : status
}

const DISPLAY_STATUS_LABELS: Record<DisplayStatus, string> = {
  nuevo: 'Nuevo',
  sin_contactar: 'Sin contactar',
  contactado: 'Contactado',
  grupo_whatsapp: 'Grupo de WhatsApp',
  descalificado: 'Descalificado',
}

// Azul = recién llegado (mismo tono que "programada" en el pipeline de
// entregables), rojo = ya pasó la ventana de gracia sin que nadie lo
// toque, ámbar = en curso, verde = cerrado, gris claro = descartado — ya
// no compite visualmente con nada, es la única que no pide acción.
const DISPLAY_STATUS_COLORS: Record<DisplayStatus, string> = {
  nuevo: 'bg-[#06B6D4]/15 text-[#06B6D4]',
  sin_contactar: 'bg-red-500/15 text-red-500',
  contactado: 'bg-yellow-500/15 text-yellow-500',
  grupo_whatsapp: 'bg-green-500/15 text-green-500',
  descalificado: 'bg-muted text-muted-foreground',
}

function normalizeContactStatus(value?: string): ContactStatus {
  if (value === 'contactado' || value === 'grupo_whatsapp' || value === 'descalificado') {
    return value
  }
  return 'sin_contactar'
}

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

function ContactStatusBadge({
  status,
  createdAt,
}: {
  status: ContactStatus
  createdAt: string
}) {
  const display = toDisplayStatus(status, createdAt)
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${DISPLAY_STATUS_COLORS[display]}`}
    >
      {DISPLAY_STATUS_LABELS[display]}
    </span>
  )
}

function ContactStatusSelect({
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
  const display = toDisplayStatus(status, createdAt)
  // La opción "sin_contactar" es la única cuyo texto depende del tiempo —
  // las otras dos siempre dicen lo mismo, se elija o no.
  const sinContactarLabel =
    display === 'nuevo' ? DISPLAY_STATUS_LABELS.nuevo : DISPLAY_STATUS_LABELS.sin_contactar

  return (
    <select
      value={status}
      disabled={updating}
      onChange={(e) => onChange(leadId, e.target.value as ContactStatus)}
      className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium ${DISPLAY_STATUS_COLORS[display]}`}
    >
      {SELECTABLE_STATUSES.map((value) => (
        <option key={value} value={value} className="bg-background text-foreground">
          {value === 'sin_contactar' ? sinContactarLabel : DISPLAY_STATUS_LABELS[value]}
        </option>
      ))}
    </select>
  )
}

function DelegateSelect({
  leadId,
  admins,
  delegating,
  onDelegate,
}: {
  leadId: string
  admins: Admin[]
  delegating: boolean
  onDelegate: (leadId: string, adminId: string) => void
}) {
  if (admins.length === 0) return null

  return (
    <select
      disabled={delegating}
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) onDelegate(leadId, e.target.value)
      }}
      className="rounded border border-border bg-background px-2 py-1 text-xs"
    >
      <option value="" disabled>
        {delegating ? 'Delegando...' : 'Seleccionar admin'}
      </option>
      {admins.map((admin) => (
        <option key={admin.id} value={admin.id}>
          {admin.nombre}
        </option>
      ))}
    </select>
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

  async function handleDelegate(leadId: string, adminId: string) {
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
      <BrandCard padding="sm" className="hidden md:block overflow-x-auto">
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
                      <ContactStatusSelect
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
                      <DelegateSelect
                        leadId={lead.id}
                        admins={admins}
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
            <BrandCard key={lead.id} padding="sm" className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm">
                  {lead.nombre} {lead.apellidos ?? ''}
                </p>
                {canUpdateStatus ? (
                  <ContactStatusSelect
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
              <div className="space-y-0.5 text-xs text-muted-foreground">
                <p>{lead.correo}</p>
                {lead.whatsapp_e164 && <p>{lead.whatsapp_e164}</p>}
                {lead.red_social && (
                  <p className="inline-flex items-center gap-1">
                    {lead.red_social}
                    <ProfileLink redSocial={lead.red_social} perfil={lead.perfil} />
                  </p>
                )}
                <p>{new Date(lead.created_at).toLocaleDateString('es-CO')}</p>
              </div>
              {canDelegate && !noAdmins && (
                <div className="pt-1">
                  <DelegateSelect
                    leadId={lead.id}
                    admins={admins}
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
