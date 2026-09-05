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
} as const

export type ModuleKey = (typeof MODULES)[keyof typeof MODULES]

export const MODULE_LABELS: Record<ModuleKey, string> = {
  crm: 'CRM / Leads',
  entregables_terapia: 'Entregables · Terapia',
  entregables_educacion: 'Entregables · Educación',
  parrilla: 'Parrilla de contenido',
}

export const MODULE_PERMISSIONS: Record<ModuleKey, readonly Permission[]> = {
  crm: ['leads:read_delegated', 'leads:update_status'],
  entregables_terapia: ['therapy:create', 'therapy:deliver'],
  entregables_educacion: ['education:create', 'education:deliver'],
  parrilla: ['parrilla:manage'],
}

export function isModuleKey(value: string): value is ModuleKey {
  return Object.prototype.hasOwnProperty.call(MODULES, value)
}
