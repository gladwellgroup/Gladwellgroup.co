export const EDUCATION_STATUS_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  generado: 'Generado',
  entregado: 'Entregado',
}

export const EDUCATION_STATUS_COLORS: Record<string, string> = {
  borrador: 'bg-muted text-muted-foreground',
  generado: 'bg-yellow-500/15 text-yellow-500',
  entregado: 'bg-green-500/15 text-green-500',
}

// El estado de envío por asistente (ATTENDEE_STATUS_*) vive en
// lib/deliverables/status.ts: lo comparten education-attendees.tsx y
// therapy-attendees.tsx, no es específico de Education.
