'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  User,
  BarChart3,
  Users,
  Briefcase,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { type Role, hasPermission } from '@/lib/permissions'
import {
  PORTAL_NAV_ITEMS,
  resolveNavHref,
} from '@/lib/data/portal-navigation'
import { cn } from '@/lib/utils'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  User,
  BarChart3,
  Users,
  Briefcase,
}

interface PortalBottomNavProps {
  role: Role
}

export function PortalBottomNav({ role }: PortalBottomNavProps) {
  const pathname = usePathname()

  const visibleItems = PORTAL_NAV_ITEMS.filter((item) => {
    if (!item.permission) return true
    return hasPermission(role, item.permission)
  })

  return (
    <nav
      className="fixed bottom-4 inset-x-4 z-50 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="glass flex items-center justify-around gap-0.5 rounded-full border border-white/10 px-2 py-1.5 shadow-lg">
        {visibleItems.map((item) => {
          const Icon = ICON_MAP[item.icon]
          const href = resolveNavHref(item, role)
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`)
          if (!Icon) return null

          return (
            <Link
              key={item.label}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 rounded-full px-2.5 py-2 min-w-0 flex-1 transition-colors',
                isActive
                  ? 'bg-white/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'size-5 shrink-0',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}
              />
              <span
                className={cn(
                  'text-[10px] leading-tight truncate max-w-full text-center',
                  isActive ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
