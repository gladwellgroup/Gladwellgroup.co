/** Un lead tal como lo pinta el CRM. */
export interface CrmLead {
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

/** Las columnas de `walking_list_leads` que pinta el CRM (tabla, tarjetas y filtros). Antes se pedía `select('*')`: la
 *  tabla guarda también el país, el indicativo y el número de WhatsApp por separado y otros campos que la pantalla no
 *  usa, y viajaban al navegador con cada lead. */
export const LEAD_COLUMNS = [
  'id',
  'nombre',
  'apellidos',
  'correo',
  'whatsapp_e164',
  'red_social',
  'perfil',
  'status',
  'assigned_to',
  'contact_status',
  'created_at',
] as const satisfies readonly (keyof CrmLead)[]

/** Falla al compilar si a `CrmLead` se le añade un campo que la consulta no pide (o al revés): la pantalla leería
 *  `undefined` sin que nadie lo notara. */
export type AllLeadFieldsSelected = [Exclude<keyof CrmLead, (typeof LEAD_COLUMNS)[number]>] extends [never] ? true : never
export const LEAD_FIELDS_COMPLETE: AllLeadFieldsSelected = true

export const LEAD_SELECT: string = LEAD_COLUMNS.join(', ')

/** Cuántos leads se pintan de entrada y por cada «Cargar más». Con cientos de leads, tabla Y tarjetas completas
 *  (≈64 elementos y 4 menús por lead, con `backdrop-filter` en cada tarjeta) pesaban el DOM y el scroll del iPad. */
export const LEADS_PAGE_SIZE = 50

/** PostgREST devuelve como mucho 1000 filas por consulta (el tope de la API de Supabase): con más leads, el resto no
 *  llegaría y nadie lo notaría sin un aviso. */
export const POSTGREST_MAX_ROWS = 1000
