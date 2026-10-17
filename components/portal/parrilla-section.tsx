'use client'

import type { ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface ToggleableSectionProps {
  /** Base de los ids: el contenido que controla el ojo es `${id}-section`. */
  id: string
  label: string
  hidden: boolean
  /** Si la sección tiene algo guardado. Ocultar no borra el contenido, así que
   *  una sección oculta con contenido lo avisa en la cabecera: que no quede un
   *  dato que nadie ve. */
  hasContent: boolean
  onToggle: () => void
  children: ReactNode
}

/** Una sección del modal con un ojo junto al título para ocultarla: no todas
 *  las publicaciones llevan Inspiración, Guion, Copy del post o Foto de portada.
 *
 *  Al ocultarla queda solo la cabecera — con el ojo tachado, para poder volver
 *  a mostrarla — y el contenido se DESMONTA, no se esconde con CSS: un
 *  `type="url"` oculto pero montado con un valor inválido bloquearía el envío
 *  del formulario sin que nadie vea por qué. El título NO se atenúa con
 *  opacidad: a 60 % bajaba a 2,9:1 de contraste (mínimo AA: 4,5:1); el ojo
 *  tachado y la marca «con contenido» ya dicen el estado.
 *
 *  El ojo muestra el estado (abierto = visible, tachado = oculto) y su
 *  `aria-label` la acción. Con ratón la fila no engorda (el botón de 24 px resta
 *  su margen); al tacto, botón y fila miden 44 px (Apple HIG). */
export function ToggleableSection({
  id,
  label,
  hidden,
  hasContent,
  onToggle,
  children,
}: ToggleableSectionProps) {
  const contentId = `${id}-section`
  const action = hidden ? `Mostrar ${label}` : `Ocultar ${label}`

  return (
    <div className="space-y-1.5 text-center">
      <div className="flex items-center justify-center gap-1.5 pointer-coarse:min-h-11">
        <span className="modal-label">{label}</span>
        {hidden && hasContent && (
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] leading-none text-muted-foreground">
            con contenido
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!hidden}
          aria-controls={hidden ? undefined : contentId}
          aria-label={action}
          title={action}
          className="-my-1 inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:bg-muted/60 pointer-coarse:my-0 pointer-coarse:size-11"
        >
          {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {!hidden && <div id={contentId}>{children}</div>}
    </div>
  )
}
