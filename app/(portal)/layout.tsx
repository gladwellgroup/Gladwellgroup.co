import { requireAuth } from '@/lib/auth/session'
import { ROLE_LABELS, type Role } from '@/lib/permissions'
import { PortalSidebar } from '@/components/portal/portal-sidebar'
import { PortalNavbar } from '@/components/portal/portal-navbar'
import { PortalBottomNav } from '@/components/portal/portal-bottom-nav'
import { BrandPageBackground } from '@/components/brand/brand-page-background'
import { SidebarProvider } from '@/components/ui/sidebar'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()
  const role = user.role as Role

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-svh w-full flex-col">
        <PortalNavbar
          userName={user.nombre}
          roleLabel={ROLE_LABELS[role]}
        />
        <div className="flex flex-1 w-full min-h-0">
          <PortalSidebar role={role} />
          <div className="flex-1 flex flex-col min-w-0">
            <BrandPageBackground orbOpacity={0.7}>
              <main className="flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-8 lg:px-8">
                {children}
              </main>
            </BrandPageBackground>
          </div>
        </div>
        <PortalBottomNav role={role} />
      </div>
    </SidebarProvider>
  )
}
