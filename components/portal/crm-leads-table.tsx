'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
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
}

const STATUS_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  delegado: 'Delegado',
  contactado: 'Contactado',
  invitado: 'Invitado',
  convertido: 'Convertido',
}

const STATUS_COLORS: Record<string, string> = {
  nuevo: 'bg-[#06B6D4]/15 text-[#06B6D4]',
  delegado: 'bg-[#7C3AED]/15 text-[#A78BFA]',
  contactado: 'bg-yellow-500/15 text-yellow-500',
  invitado: 'bg-blue-500/15 text-blue-400',
  convertido: 'bg-green-500/15 text-green-500',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_COLORS[status] ?? 'bg-muted'
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
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

export function CrmLeadsTable({
  leads,
  admins,
  canDelegate,
}: CrmLeadsTableProps) {
  const [delegating, setDelegating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      window.location.reload()
    } catch {
      setError('Error de red al delegar el lead')
    } finally {
      setDelegating(null)
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

  return (
    <div className="space-y-4">
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
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
              {canDelegate && !noAdmins && (
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Delegar</th>
              )}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  {lead.nombre} {lead.apellidos ?? ''}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{lead.correo}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {lead.whatsapp_e164 ?? '\u2014'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {lead.red_social ?? '\u2014'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={lead.status ?? 'nuevo'} />
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
            ))}
          </tbody>
        </table>
      </BrandCard>

      {/* Cards movil */}
      <div className="flex flex-col gap-3 md:hidden">
        {leads.map((lead) => (
          <BrandCard key={lead.id} padding="sm" className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">
                {lead.nombre} {lead.apellidos ?? ''}
              </p>
              <StatusBadge status={lead.status ?? 'nuevo'} />
            </div>
            <div className="space-y-0.5 text-xs text-muted-foreground">
              <p>{lead.correo}</p>
              {lead.whatsapp_e164 && <p>{lead.whatsapp_e164}</p>}
              {lead.red_social && <p>{lead.red_social}</p>}
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
        ))}
      </div>
    </div>
  )
}
