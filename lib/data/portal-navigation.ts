import type { Permission, Role } from '@/lib/permissions'

export interface PortalNavItem {
  label: string
  icon: string
  permission?: Permission
  /** Static href, or role-based resolver (e.g. Entregables). */
  href: string | ((role: Role) => string)
}

export function resolveNavHref(item: PortalNavItem, role: Role): string {
  return typeof item.href === 'function' ? item.href(role) : item.href
}

export const PORTAL_NAV_ITEMS: PortalNavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
  {
    label: 'Usuarios',
    href: '/super/usuarios',
    icon: 'Users',
    permission: 'users:list',
  },
  {
    label: 'Entregables',
    href: (role) =>
      role === 'super_admin' ? '/super/entregables' : '/admin/entregables',
    icon: 'Briefcase',
    permission: 'therapy:create',
  },
  {
    label: 'CRM',
    href: (role) => (role === 'super_admin' ? '/super/crm' : '/admin/leads'),
    icon: 'BarChart3',
    // community_admin lo tiene explícito; super_admin lo hereda igual que
    // el resto de permisos — un solo ítem de menú para ambos roles.
    permission: 'leads:read_delegated',
  },
  { label: 'Perfil', href: '/perfil', icon: 'User' },
]
