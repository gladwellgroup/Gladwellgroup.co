import { Instagram, Linkedin, Youtube } from 'lucide-react'
import type { Platform } from '@/lib/parrilla/posts'

/** Compartido por el calendario, los filtros del tablero y el Banco de
 *  contenido: un solo ícono por red social en toda la parrilla. */
export const PLATFORM_ICONS: Record<Platform, typeof Instagram> = {
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
}

export function PlatformIcons({ platforms, className }: { platforms: Platform[]; className?: string }) {
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {platforms.map((p) => {
        const Icon = PLATFORM_ICONS[p]
        return <Icon key={p} className={className} />
      })}
    </span>
  )
}
