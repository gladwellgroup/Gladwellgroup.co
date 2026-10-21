import { Instagram, LayoutGrid, Linkedin, Table2, Youtube } from 'lucide-react'
import { PLATFORM_LABELS, type Platform } from '@/lib/parrilla/posts'
import type { ParrillaListView } from '@/lib/parrilla/table'

/** Compartido por el calendario, los filtros del tablero y el Banco de
 *  contenido: un solo ícono por red social en toda la parrilla. */
export const PLATFORM_ICONS: Record<Platform, typeof Instagram> = {
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
}

export function PlatformIcons({ platforms, className }: { platforms: Platform[]; className?: string }) {
  return (
    // `relative`: el texto `sr-only` es `absolute` y, sin un ancestro posicionado, flota
    // respecto a la página (y puede desplazar un contenedor con scroll).
    <span className="relative flex shrink-0 items-center gap-0.5">
      {platforms.map((p) => {
        const Icon = PLATFORM_ICONS[p]
        return <Icon key={p} className={className} />
      })}
      {/* Los íconos van `aria-hidden`: sin este texto, quien usa un lector de pantalla no oye en
          qué redes sale la pieza (en la tabla, la celda de «Redes» quedaba vacía). */}
      {platforms.length > 0 && (
        <span className="sr-only">{platforms.map((p) => PLATFORM_LABELS[p]).join(', ')}</span>
      )}
    </span>
  )
}

const LIST_VIEW_OPTIONS: { value: ParrillaListView; label: string; Icon: typeof LayoutGrid }[] = [
  { value: 'tarjetas', label: 'Tarjetas', Icon: LayoutGrid },
  { value: 'tabla', label: 'Tabla', Icon: Table2 },
]

/** Interruptor de dos iconos entre las vistas de una base de datos de la parrilla
 *  (Banco de contenido y Frases): tarjetas o tabla. Mismo aspecto que las pestañas del
 *  tablero (`PillTabs`). Cada botón lleva su nombre en `aria-label` —no tiene texto
 *  visible— y `aria-pressed` dice cuál está activo. Al tacto cada botón mide 44 px. */
export function ListViewToggle({
  value,
  onChange,
}: {
  value: ParrillaListView
  onChange: (value: ParrillaListView) => void
}) {
  return (
    <div
      role="group"
      aria-label="Vista"
      className="inline-flex shrink-0 rounded-full border border-border bg-muted/30 p-1"
    >
      {LIST_VIEW_OPTIONS.map(({ value: option, label, Icon }) => {
        const active = option === value
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={`flex size-8 items-center justify-center rounded-full transition-colors pointer-coarse:size-11 ${
              active
                ? 'bg-[#7C3AED] text-white shadow-[0_0_20px_rgba(124,58,237,0.35)]'
                : 'text-muted-foreground hover:text-foreground active:text-foreground'
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
