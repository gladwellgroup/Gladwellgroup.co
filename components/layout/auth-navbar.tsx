import { BrandLogo } from '@/components/brand/brand-logo'
import { ThemeToggle } from '@/components/brand/theme-toggle'

export function AuthNavbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50 shadow-lg">
      <div className="container mx-auto px-6">
        <div className="flex h-16 md:h-20 items-center justify-between">
          <BrandLogo />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
