/** Estado de envío por destinatario — mismas columnas en education_attendees
 *  y therapy_session_attendees, mismo badge en ambas tablas de asistentes. */
export const ATTENDEE_STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  enviado: 'Enviado',
  error: 'Error',
}

export const ATTENDEE_STATUS_COLORS: Record<string, string> = {
  pendiente: 'bg-muted text-muted-foreground',
  enviado: 'bg-green-500/15 text-green-500',
  error: 'bg-red-500/15 text-red-500',
}
