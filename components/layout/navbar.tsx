"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Menu } from "lucide-react"
import { useWalkingList } from "@/components/providers/walking-list-provider"
import { NAV_LINKS } from "@/lib/data/navigation"
import { scrollToAnchor } from "@/lib/scroll-to-anchor"
import { ThemeToggle } from "@/components/brand/theme-toggle"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function Navbar() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { openWalkingList } = useWalkingList()

  useEffect(() => {
    setMounted(true)
    const handleScroll = () => setScrolled(window.scrollY > 20)
    handleScroll()
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const isDark = !mounted || resolvedTheme === "dark"
  const onHero = !scrolled
  const linkClass = onHero
    ? isDark
      ? "text-sm font-medium text-white/80 hover:text-white transition-colors relative group drop-shadow-md"
      : "text-sm font-medium text-foreground/80 hover:text-foreground transition-colors relative group"
    : "text-sm font-medium text-foreground/80 hover:text-foreground transition-colors relative group"

  const handleMobileNav = (href: string) => {
    setMobileOpen(false)
    setTimeout(() => scrollToAnchor(href), 150)
  }

  const handleMobileWalkingList = () => {
    setMobileOpen(false)
    setTimeout(openWalkingList, 150)
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "glass border-b border-border/50 shadow-lg" : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <a href="#inicio" className="flex items-center">
            <span className="text-xl md:text-2xl font-bold tracking-tight gladwell-gradient-text no-underline decoration-transparent">
              GLADWELL
            </span>
          </a>

          {/* Nav Links - Desktop */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(({ label, href }) => (
              <a key={label} href={href} className={linkClass}>
                {label}
                <span className="absolute -bottom-0.5 left-0 w-0 h-px gladwell-gradient group-hover:w-full transition-all duration-300" />
              </a>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            {mounted && <ThemeToggle />}

            {/* CTA Desktop */}
            <button
              onClick={openWalkingList}
              className="hidden md:inline-flex items-center px-5 py-2 rounded-full gladwell-gradient text-white text-sm font-semibold hover:scale-105 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all duration-300"
            >
              Walking List
            </button>

            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  className={`md:hidden p-2 rounded-lg transition-colors ${
                    onHero && isDark
                      ? "text-white hover:bg-white/10"
                      : "text-foreground hover:bg-muted/50"
                  }`}
                  aria-label="Abrir menú"
                >
                  <Menu size={22} />
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-72 border-border bg-background/95 text-center backdrop-blur-xl"
              >
                <SheetHeader className="items-center">
                  <SheetTitle className="gladwell-gradient-text text-xl font-bold">
                    GLADWELL
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-8 flex flex-col items-center gap-2">
                  {NAV_LINKS.map(({ label, href }) => (
                    <button
                      key={label}
                      onClick={() => handleMobileNav(href)}
                      className="w-full rounded-xl px-4 py-3 text-center text-base font-medium text-foreground/80 transition-all hover:bg-muted/50 hover:text-foreground"
                    >
                      {label}
                    </button>
                  ))}
                  <div className="h-px w-full bg-border my-2" />
                  <button
                    onClick={handleMobileWalkingList}
                    className="flex items-center justify-center px-6 py-3 rounded-full gladwell-gradient text-white font-semibold text-sm hover:scale-105 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all duration-300"
                  >
                    Únete a la Walking List
                  </button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
