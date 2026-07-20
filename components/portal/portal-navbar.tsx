'use client'

import { useRouter } from 'next/navigation'
import { LogOut, Menu } from 'lucide-react'
import { BrandLogo } from '@/components/brand/brand-logo'
import { ThemeToggle } from '@/components/brand/theme-toggle'
import { getSupabaseBrowser } from '@/lib/supabase/browser'
import { useSidebar } from '@/components/ui/sidebar'

interface PortalNavbarProps {
  userName: string
  roleLabel: string
}

function CollapseTrigger() {
  const { open, toggleSidebar } = useSidebar()

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={open ? 'Colapsar menu' : 'Expandir menu'}
    >
      <Menu className="size-5" />
    </button>
  )
}

export function PortalNavbar({ userName, roleLabel }: PortalNavbarProps) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 portal-header">
      <div className="flex h-16 md:h-20 items-center gap-2 md:gap-3">
        {/* Misma columna que el riel colapsado del sidebar (--sidebar-width-icon)
            para que el hamburguesa quede centrado exactamente sobre los iconos
            de navegación cuando el sidebar está colapsado. */}
        <div className="hidden md:flex w-(--sidebar-width-icon) shrink-0 items-center justify-center">
          <CollapseTrigger />
        </div>

        <div className="flex flex-1 items-center justify-between gap-4 min-w-0 pl-4 sm:pl-6 md:pl-0 pr-4 sm:pr-6 lg:pr-8">
          <BrandLogo href="/dashboard" className="text-xl md:text-2xl" />

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium truncate max-w-[160px]">{userName}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                {roleLabel}
              </p>
            </div>
            <ThemeToggle />
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-[#7C3AED]/40 hover:text-foreground"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
