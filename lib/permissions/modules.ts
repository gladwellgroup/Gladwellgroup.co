import type { Permission } from './matrix'

// Módulos que un super_admin puede otorgar/revocar por persona (ver
// profile_module_grants) — hoy solo aplican a community_admin porque son
// los únicos permisos que ROLE_PERMISSIONS.community_admin ya NO trae fijos,
// pero el mecanismo (tabla + getEffectivePermissions) es genérico a
// cualquier perfil, no exclusivo de ese rol.
export const MODULES = {
  crm: 'crm',
  entregables_terapia: 'entregables_terapia',
  entregables_educacion: 'entregables_educacion',
  parrilla: 'parrilla',
  calendario_sesiones: 'calendario_sesiones',
} as const

export type ModuleKey = (typeof MODULES)[keyof typeof MODULES]

export const MODULE_LABELS: Record<ModuleKey, string> = {
  crm: 'CRM / Leads',
  entregables_terapia: 'Entregables · Terapia',
  entregables_educacion: 'Entregables · Educación',
  parrilla: 'Parrilla de contenido',
  calendario_sesiones: 'Calendario de sesiones',
}

export const MODULE_PERMISSIONS: Record<ModuleKey, readonly Permission[]> = {
  crm: ['leads:read_delegated', 'leads:update_status'],
  // Quien administra un programa también puede ver el calendario completo
  // de la comunidad (no solo sus propias sesiones) — no debería necesitar
  // un segundo módulo aparte solo para eso.
  entregables_terapia: ['therapy:create', 'therapy:deliver', 'sessions:read_community'],
  entregables_educacion: ['education:create', 'education:deliver', 'sessions:read_community'],
  parrilla: ['parrilla:manage'],
  // Módulo de solo lectura: ver el calendario de todas las sesiones de la
  // comunidad y abrir el detalle de cualquiera (sin datos de contacto salvo
  // que el super_admin delegue esa sesión puntual), sin poder administrar.
  calendario_sesiones: ['sessions:read_community'],
}

export function isModuleKey(value: string): value is ModuleKey {
  return Object.prototype.hasOwnProperty.call(MODULES, value)
}
