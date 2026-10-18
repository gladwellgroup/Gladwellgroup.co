/** Los tipos de encuentro de la sección «Encuentros». Terapia y Education
 *  producen un entregable; la charla no: es un espacio abierto de la comunidad,
 *  sin guion, del que solo importa tenerlo mapeado y su asistencia.
 *
 *  Vive en un solo sitio porque lo consumen el calendario, el dashboard y el
 *  hub: antes cada uno decidía el destino con `programa === 'terapia' ?
 *  'terapia' : 'education'`, y con tres programas ese ternario habría mandado
 *  las charlas a Education sin que nada avisara. */
export const CALENDAR_PROGRAMAS = ['terapia', 'education', 'charla'] as const

/** Cualquier encuentro que pinta el calendario. */
export type CalendarPrograma = (typeof CALENDAR_PROGRAMAS)[number]

/** Los programas con entregable: los únicos que cuentan el pipeline y la
 *  atención del dashboard. Se deriva del anterior para que añadir un programa
 *  con entregable obligue a decidirlo aquí. */
export type Programa = Exclude<CalendarPrograma, 'charla'>

/** Segmento de la URL de cada programa, bajo `/super|admin/encuentros/`. */
export const PROGRAMA_ROUTE: Record<CalendarPrograma, string> = {
  terapia: 'terapia',
  education: 'education',
  charla: 'charlas',
}

export const PROGRAMA_LABEL: Record<CalendarPrograma, string> = {
  terapia: 'Terapia Organizacional',
  education: 'Gladwell Education',
  charla: 'Charlas Catárticas',
}

/** Enlace a la ficha de un encuentro. `basePath` es la raíz de la sección
 *  (`/super/encuentros` o `/admin/encuentros`). */
export function sessionHref(
  basePath: string,
  session: { programa: CalendarPrograma; id: string }
): string {
  return `${basePath}/${PROGRAMA_ROUTE[session.programa]}/${session.id}`
}
