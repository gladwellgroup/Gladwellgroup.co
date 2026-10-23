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
  Calendar,
  LogOut,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useSignOut } from '@/hooks/use-sign-out'
import { type Role, type Permission } from '@/lib/permissions'
import {
  PORTAL_NAV_ITEMS,
  resolveNavHref,
} from '@/lib/data/portal-navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  User,
  BarChart3,
  Users,
  Briefcase,
  Calendar,
}

interface PortalSidebarProps {
  role: Role
  permissions: Permission[]
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

  // Solo con RATÓN (`pointerType === 'mouse'`). Un iPad horizontal supera los 1024 px y no es «móvil» para el sidebar, pero
  // sigue siendo un dedo: `mouseenter` se dispara también al tocar (Safari lo emula), así que el toque expandía el riel y
  // empujaba el contenido 208 px. Los eventos de puntero sí dicen quién los causó; el toque no los pasa.
  const handlePointerEnter = useCallback(
    (event: React.PointerEvent) => {
      if (isMobile || event.pointerType !== 'mouse') return
      if (!open) {
        expandedByHover.current = true
        setOpen(true)
      }
    },
    [isMobile, open, setOpen]
  )

  const handlePointerLeave = useCallback(
    (event: React.PointerEvent) => {
      if (isMobile || event.pointerType !== 'mouse') return
      if (expandedByHover.current) {
        expandedByHover.current = false
        setOpen(false)
      }
    },
    [isMobile, setOpen]
  )

  return (
    <Sidebar
      collapsible="icon"
      mobileSide="right"
      className="portal-header border-r border-border/50 !top-[calc(4rem+env(safe-area-inset-top,0px))] !bottom-0 md:!top-[calc(5rem+env(safe-area-inset-top,0px))] [&_[data-slot=sidebar-inner]]:!bg-transparent"
      mobileOverlayClassName="!top-[calc(4rem+env(safe-area-inset-top,0px))] md:!top-[calc(5rem+env(safe-area-inset-top,0px))]"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </Sidebar>
  )
}

export function PortalSidebar({ role, permissions }: PortalSidebarProps) {
  const pathname = usePathname()
  const { signOut, signingOut } = useSignOut()
  const { isMobile, setOpenMobile } = useSidebar()

  const visibleItems = PORTAL_NAV_ITEMS.filter((item) => {
    if (!item.permission) return true
    return permissions.includes(item.permission)
  })

  function handleNavigate() {
    if (isMobile) setOpenMobile(false)
  }

  async function handleSignOut() {
    setOpenMobile(false)
    await signOut()
  }

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
                      <Link href={href} onClick={handleNavigate}>
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
      {/* Solo en el panel de móvil/tablet: en escritorio "Salir" ya vive en
          el navbar, y este mismo componente también renderiza el riel fijo
          de escritorio — duplicarlo ahí sería redundante. */}
      {isMobile && (
        <SidebarFooter className="pb-4">
          <SidebarSeparator className="mb-2" />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleSignOut} disabled={signingOut}>
                <LogOut className="size-5 text-muted-foreground" />
                <span className="text-muted-foreground">Cerrar sesión</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </HoverableSidebarShell>
  )
}
