import type { Permission, Role } from '@/lib/permissions'

export interface PortalNavItem {
  label: string
  icon: string
  permission?: Permission
  /** Static href, or role-based resolver (e.g. Entregables). */
  href: string | ((role: Role) => string)
  /**
   * Si es `true`, el ítem queda fijo en la barra inferior de móvil/tablet
   * (`PortalBottomNav`). Todo lo demás solo es alcanzable desde el menú
   * hamburguesa — así agregar un módulo nuevo nunca desborda la barra por
   * defecto; alguien tiene que decidir explícitamente fijarlo acá.
   */
  pinnedMobile?: boolean
}

export function resolveNavHref(item: PortalNavItem, role: Role): string {
  return typeof item.href === 'function' ? item.href(role) : item.href
}

export const PORTAL_NAV_ITEMS: PortalNavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', pinnedMobile: true },
  {
    label: 'CRM',
    href: (role) => (role === 'super_admin' ? '/super/crm' : '/admin/leads'),
    icon: 'BarChart3',
    // community_admin lo tiene explícito; super_admin lo hereda igual que
    // el resto de permisos — un solo ítem de menú para ambos roles.
    permission: 'leads:read_delegated',
    pinnedMobile: true,
  },
  {
    label: 'Entregables',
    href: (role) =>
      role === 'super_admin' ? '/super/entregables' : '/admin/entregables',
    icon: 'Briefcase',
    permission: 'sessions:read_community',
    pinnedMobile: true,
  },
  {
    label: 'Parrilla',
    href: (role) => (role === 'super_admin' ? '/super/parrilla' : '/admin/parrilla'),
    icon: 'Calendar',
    permission: 'parrilla:manage',
    pinnedMobile: true,
  },
  { label: 'Perfil', href: '/perfil', icon: 'User', pinnedMobile: true },
  {
    label: 'Usuarios',
    href: '/super/usuarios',
    icon: 'Users',
    permission: 'users:list',
  },
]
