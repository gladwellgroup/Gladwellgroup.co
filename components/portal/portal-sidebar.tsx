'use client'

import { useRef, useCallback } from 'react'
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
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  User,
  BarChart3,
  Users,
  Briefcase,
}

interface PortalSidebarProps {
  role: Role
}

function NavIcon({ icon: IconName, active }: { icon: string; active: boolean }) {
  const Icon = ICON_MAP[IconName]
  if (!Icon) return null
  return (
    <Icon
      className={`size-5 transition-colors ${
        active ? 'text-[#7C3AED]' : 'text-muted-foreground'
      }`}
    />
  )
}

function HoverableSidebarShell({ children }: { children: React.ReactNode }) {
  const { setOpen, open, isMobile } = useSidebar()
  const expandedByHover = useRef(false)

  const handleMouseEnter = useCallback(() => {
    if (isMobile) return
    if (!open) {
      expandedByHover.current = true
      setOpen(true)
    }
  }, [isMobile, open, setOpen])

  const handleMouseLeave = useCallback(() => {
    if (isMobile) return
    if (expandedByHover.current) {
      expandedByHover.current = false
      setOpen(false)
    }
  }, [isMobile, setOpen])

  return (
    <Sidebar
      collapsible="icon"
      className="portal-header border-r border-border/50 !top-16 !bottom-0 md:!top-20 [&_[data-slot=sidebar-inner]]:!bg-transparent"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </Sidebar>
  )
}

export function PortalSidebar({ role }: PortalSidebarProps) {
  const pathname = usePathname()

  const visibleItems = PORTAL_NAV_ITEMS.filter((item) => {
    if (!item.permission) return true
    return hasPermission(role, item.permission)
  })

  return (
    <HoverableSidebarShell>
      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const href = resolveNavHref(item, role)
                const isActive =
                  pathname === href || pathname.startsWith(`${href}/`)
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link href={href}>
                        <NavIcon icon={item.icon} active={isActive} />
                        <span
                          className={
                            isActive
                              ? 'gladwell-gradient-text font-medium'
                              : 'text-muted-foreground'
                          }
                        >
                          {item.label}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </HoverableSidebarShell>
  )
}
