// Tipos y límites de las charlas que comparten el servidor y el navegador. Sin
// imports de servidor ni de zod a propósito: un componente de cliente que
// importara el esquema de validación (o `queries.ts`) arrastraría esas
// dependencias al bundle del navegador.

export const CHARLA_TITLE_MIN = 3
export const CHARLA_TITLE_MAX = 120

export interface CharlaListItem {
  id: string
  title: string
  session_date: string
  photo_url: string | null
  /** Cuántas personas registraron su asistencia. */
  asistentes: number
}

export interface CharlaAttendee {
  id: string
  nombre: string
  correo: string
  created_at: string
}

export interface CharlaAttendanceLink {
  token: string
  expires_at: string
}

export interface CharlaFields {
  id: string
  title: string
  session_date: string
  photo_url: string | null
}

export interface CharlaDetail {
  charla: CharlaFields
  /** Cuántas personas registraron su asistencia: lo único de la lista que ve
   *  quien solo tiene el calendario. */
  asistentes: number
  /** `null` cuando quien mira no gestiona charlas: nombre y correo de los
   *  asistentes nunca salen del servidor hacia esa persona. */
  attendees: CharlaAttendee[] | null
  /** Igual que `attendees`: el QR solo lo ve quien puede generarlo. */
  attendanceLink: CharlaAttendanceLink | null
}
