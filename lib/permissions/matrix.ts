import { type Role } from './roles'
import { isModuleKey, MODULE_PERMISSIONS } from './modules'

export const PERMISSIONS = {
  'users:invite': 'users:invite',
  'users:create_admin': 'users:create_admin',
  'users:delete': 'users:delete',
  'users:list': 'users:list',

  'profile:edit_own': 'profile:edit_own',
  'profile:view_members': 'profile:view_members',

  'leads:read_all': 'leads:read_all',
  'leads:read_delegated': 'leads:read_delegated',
  'leads:delegate': 'leads:delegate',
  'leads:update_status': 'leads:update_status',

  'therapy:create': 'therapy:create',
  'therapy:deliver': 'therapy:deliver',
  'therapy:read_own': 'therapy:read_own',

  'education:create': 'education:create',
  'education:deliver': 'education:deliver',

  'content:publish': 'content:publish',
  'content:read': 'content:read',

  'events:create': 'events:create',

  'landing:weekly_message': 'landing:weekly_message',

  'config:global': 'config:global',

  'parrilla:manage': 'parrilla:manage',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// Base fija por rol — para community_admin es deliberadamente conservadora:
// los permisos "de módulo" (CRM, Entregables, Parrilla...) ya no viven acá,
// se otorgan por persona vía profile_module_grants (ver getEffectivePermissions).
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: Object.values(PERMISSIONS),

  community_admin: [
    'profile:edit_own',
    'profile:view_members',
    'therapy:read_own',
    'content:publish',
    'content:read',
  ],

  community_member: [
    'profile:edit_own',
    'profile:view_members',
    'therapy:read_own',
    'content:read',
  ],
}

/** Solo la base fija por rol — no sabe nada de módulos otorgados. Útil para
 *  detectar por grep cualquier sitio que quedó sin migrar a
 *  getEffectivePermissions tras reducir la base de community_admin. */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function getPermissions(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

/** Base fija del rol ∪ permisos de cada módulo otorgado por persona.
 *  Genérica a propósito (sin casos especiales por rol más allá de
 *  super_admin): el día que exista un perfil de invitado con su propia base
 *  en ROLE_PERMISSIONS, ya puede recibir módulos por la misma vía. */
export function getEffectivePermissions(
  role: Role,
  grantedModules: readonly string[] = []
): Permission[] {
  if (role === 'super_admin') return [...Object.values(PERMISSIONS)]
  const effective = new Set<Permission>(ROLE_PERMISSIONS[role] ?? [])
  for (const key of grantedModules) {
    if (isModuleKey(key)) {
      MODULE_PERMISSIONS[key].forEach((p) => effective.add(p))
    }
  }
  return [...effective]
}
