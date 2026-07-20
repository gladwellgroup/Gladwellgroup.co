export const ROLES = {
  super_admin: 'super_admin',
  community_admin: 'community_admin',
  community_member: 'community_member',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super administrador',
  community_admin: 'Administrador de comunidad',
  community_member: 'Integrante de comunidad',
}

export function isValidRole(value: string): value is Role {
  return Object.values(ROLES).includes(value as Role)
}
