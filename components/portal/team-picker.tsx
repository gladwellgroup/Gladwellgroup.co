'use client'

export interface TeamPickerOption {
  id: string
  nombre: string
}

/** Multi-select de community_admin — usado primero en la Parrilla para
 *  Filmmaker(es)/Editor(es), y reutilizado acá para Coadministrador(es) de
 *  una sesión de Entregables. `size="lg"` sube el área de toque a 44px
 *  (mínimo recomendado por Apple HIG) para el caso de Entregables, donde
 *  marcar a alguien es una acción de alto impacto (da acceso total de
 *  edición) — Parrilla sigue usando el tamaño compacto de siempre, sin
 *  cambios visuales. */
export function TeamPicker({
  label,
  options,
  selected,
  onToggle,
  size = 'sm',
}: {
  /** Opcional: se omite cuando el picker ya vive dentro de un desplegable
   *  con su propio título (evita repetir la misma etiqueta dos veces). */
  label?: string
  options: TeamPickerOption[]
  selected: string[]
  onToggle: (id: string) => void
  size?: 'sm' | 'lg'
}) {
  return (
    <div className="space-y-1.5 text-center">
      {label && <span className="modal-label">{label}</span>}
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No hay administradores de comunidad registrados aún.{' '}
          <a href="/super/usuarios" className="underline underline-offset-2 hover:text-foreground">
            Créalos desde Usuarios
          </a>
          .
        </p>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          {options.map((option) => {
            const active = selected.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onToggle(option.id)}
                aria-pressed={active}
                className={`rounded-full border font-medium transition-colors ${
                  size === 'lg'
                    ? 'flex min-h-11 items-center justify-center px-4 text-sm'
                    : 'px-3 py-1 text-xs'
                } ${
                  active
                    ? 'border-[#7C3AED] bg-[#7C3AED]/15 text-[#A78BFA]'
                    : 'border-border text-muted-foreground hover:bg-muted/40'
                }`}
              >
                {option.nombre}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
