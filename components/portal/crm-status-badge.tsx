// Sin 'use client': es lógica pura + un componente de presentación sin
// interactividad, así que tanto `CrmLeadsTable` (cliente) como las tarjetas
// del Dashboard (Server Component) pueden usarlo — llamar una función
// exportada desde un archivo 'use client' no está permitido en el server,
// solo renderizarla como JSX, así que esto no puede vivir junto a la tabla.

export type ContactStatus = 'sin_contactar' | 'contactado' | 'grupo_whatsapp' | 'descalificado'

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
export function toDisplayStatus(status: ContactStatus, createdAt: string): DisplayStatus {
  return status === 'sin_contactar' && isFreshLead(createdAt) ? 'nuevo' : status
}

export const DISPLAY_STATUS_LABELS: Record<DisplayStatus, string> = {
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
export const DISPLAY_STATUS_COLORS: Record<DisplayStatus, string> = {
  nuevo: 'bg-[#06B6D4]/15 text-[#06B6D4]',
  sin_contactar: 'bg-red-500/15 text-red-500',
  contactado: 'bg-yellow-500/15 text-yellow-500',
  grupo_whatsapp: 'bg-green-500/15 text-green-500',
  descalificado: 'bg-muted text-muted-foreground',
}

export function normalizeContactStatus(value?: string): ContactStatus {
  if (value === 'contactado' || value === 'grupo_whatsapp' || value === 'descalificado') {
    return value
  }
  return 'sin_contactar'
}

export function ContactStatusBadge({
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
