import { type Role } from './roles'

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
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: Object.values(PERMISSIONS),

  community_admin: [
    'profile:edit_own',
    'profile:view_members',
    'leads:read_delegated',
    'therapy:create',
    'therapy:deliver',
    'therapy:read_own',
    'education:create',
    'education:deliver',
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

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function getPermissions(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}
