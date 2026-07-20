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
    href: '/super/crm',
    icon: 'BarChart3',
    permission: 'leads:read_all',
  },
  { label: 'Perfil', href: '/perfil', icon: 'User' },
]
