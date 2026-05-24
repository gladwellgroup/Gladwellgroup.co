"use client"

import { Linkedin, Instagram, Youtube, MapPin } from "lucide-react"
import { useWalkingList } from "@/components/providers/walking-list-provider"
import { SectionDivider } from "@/components/shared"
import { FOOTER_NAV_LINKS } from "@/lib/data/navigation"

const socialLinks = [
  { href: "https://www.linkedin.com/company/gladwellcomunidad/", label: "LinkedIn de Gladwell", icon: Linkedin },
  { href: "https://www.instagram.com/gladwellgroup.co/", label: "Instagram de Gladwell", icon: Instagram },
  { href: "https://www.youtube.com/@GladwellGroup", label: "YouTube de Gladwell", icon: Youtube },
] as const

const navLinkClass = "text-sm text-muted-foreground hover:text-foreground transition-colors"
const socialIconClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-[#7C3AED]/40 hover:bg-muted/50 transition-colors"

export function Footer() {
  const { openWalkingList } = useWalkingList()

  return (
    <footer className="py-12 bg-background relative">
      <SectionDivider />

      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <a href="#inicio">
              <span className="text-xl font-bold tracking-tight gladwell-gradient-text">GLADWELL</span>
            </a>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin size={16} className="shrink-0 text-[#7C3AED]" aria-hidden />
              Bogotá, Colombia
            </p>
          </div>

          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {FOOTER_NAV_LINKS.map(({ label, href }) => (
              <a key={href} href={href} className={navLinkClass}>
                {label}
              </a>
            ))}
            <button type="button" onClick={openWalkingList} className={navLinkClass}>
              Contacto
            </button>
          </nav>

          <div
            className="flex w-full max-w-sm flex-col items-center gap-4 border-t border-border pt-8"
            aria-label="Redes sociales de Gladwell"
          >
            <div className="flex items-center justify-center gap-4">
              {socialLinks.map(({ href, label, icon: Icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={socialIconClass}
                >
                  <Icon size={20} aria-hidden />
                </a>
              ))}
            </div>
          </div>

          <p className="w-full text-sm text-muted-foreground border-t border-border pt-6">
            &copy; {new Date().getFullYear()} Gladwell.{" "}
            <span className="gladwell-gradient-text">Apasionados por la estrategia.</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
