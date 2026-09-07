import Link from 'next/link'
import { BarChart3, ChevronRight } from 'lucide-react'
import { BrandCard } from '@/components/brand/brand-card'
import {
  ContactStatusBadge,
  normalizeContactStatus,
} from '@/components/portal/crm-status-badge'

export interface DashboardLead {
  id: string
  nombre: string
  apellidos?: string
  contact_status?: string
  created_at: string
}

/** Los 3-5 leads más recientes delegados a este community_admin — mismo
 *  chip de estado que ya usa "Mis leads", para no reinventar la lógica de
 *  colores/ventana de gracia de "nuevo". Null cuando no hay ninguno: un
 *  admin con CRM otorgado pero sin leads aún no necesita una tarjeta vacía. */
export function CrmCard({
  leads,
  href,
}: {
  leads: DashboardLead[]
  href: string
}) {
  if (leads.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold gladwell-gradient-text">
        <BarChart3 className="h-5 w-5" />
        CRM
      </h2>
      <BrandCard padding="sm" border="solid" className="divide-y divide-border">
        {leads.map((lead) => (
          <Link
            key={lead.id}
            href={href}
            className="flex items-center justify-between gap-3 px-2 py-3 transition-colors hover:bg-muted/40"
          >
            <p className="truncate text-sm font-medium">
              {lead.nombre} {lead.apellidos ?? ''}
            </p>
            <ContactStatusBadge
              status={normalizeContactStatus(lead.contact_status)}
              createdAt={lead.created_at}
            />
          </Link>
        ))}
      </BrandCard>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Ver mis leads
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
