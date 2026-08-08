'use client'

import * as React from 'react'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BrandFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  wrapperClassName?: string
}

/** Solo enlaces http(s) absolutos: un handle suelto ("@usuario") no alcanza
 *  para construir una URL real, y mostrar el ícono ahí abriría un enlace roto. */
function toAbsoluteUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : null
  } catch {
    return null
  }
}

export const BrandField = React.forwardRef<HTMLInputElement, BrandFieldProps>(
  ({ label, id, className, wrapperClassName, value, ...props }, ref) => {
    const href = toAbsoluteUrl(value)

    return (
      <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
        <label htmlFor={id} className="modal-label">
          {label}
        </label>
        <div className="relative">
          <input
            id={id}
            ref={ref}
            value={value}
            className={cn('modal-field', href && 'pr-9', className)}
            {...props}
          />
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir enlace: ${href}`}
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    )
  }
)
BrandField.displayName = 'BrandField'

interface BrandTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  wrapperClassName?: string
}

/** Next.js renderiza los client components también en el servidor, donde
 *  useLayoutEffect avisa por consola. Se mide antes del pintado en el
 *  navegador y se cae a useEffect en SSR, donde no hay nada que medir. */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect

export const BrandTextarea = React.forwardRef<
  HTMLTextAreaElement,
  BrandTextareaProps
>(({ label, id, className, wrapperClassName, value, onScroll, ...props }, ref) => {
  const innerRef = React.useRef<HTMLTextAreaElement>(null)
  const [expanded, setExpanded] = React.useState(false)
  const [overflows, setOverflows] = React.useState(false)
  const [atEnd, setAtEnd] = React.useState(false)

  // El contrato del componente expone `ref`; se combina con la interna que
  // necesita la medición.
  React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement)

  /** Al final del scroll la última línea es contenido real, no una pista de
   *  que hay más: ahí el degradado debe retirarse. */
  const syncScrollEnd = React.useCallback((el: HTMLTextAreaElement) => {
    setAtEnd(el.scrollHeight - el.scrollTop - el.clientHeight < 4)
  }, [])

  const resize = React.useCallback(() => {
    const el = innerRef.current
    if (!el) return

    // 'auto' primero: sin esto scrollHeight nunca decrece al borrar texto.
    el.style.height = 'auto'

    // El campo es border-box pero scrollHeight no cuenta los bordes: asignarlo
    // tal cual deja el elemento 2px corto y lo marca como desbordado aunque el
    // texto quepa. Hay que sumarlos.
    const styles = getComputedStyle(el)
    const borders =
      parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth)
    el.style.height = `${el.scrollHeight + borders}px`

    // max-height (CSS) recorta el alto renderizado, así que esta comparación
    // detecta el desbordamiento sin replicar el tope en JS.
    setOverflows(el.scrollHeight > el.clientHeight)
    syncScrollEnd(el)
  }, [syncScrollEnd])

  useIsomorphicLayoutEffect(() => {
    resize()
  }, [resize, value, expanded])

  // Una sección de acordeón que arranca cerrada mide 0 aunque tenga texto
  // guardado; el observer remide en cuanto se abre y al cambiar el ancho.
  useIsomorphicLayoutEffect(() => {
    const el = innerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => resize())
    observer.observe(el)
    return () => observer.disconnect()
  }, [resize])

  return (
    <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
      <label htmlFor={id} className="modal-label">
        {label}
      </label>
      <div className="relative">
        <textarea
          id={id}
          ref={innerRef}
          value={value}
          data-overflow={overflows || undefined}
          data-expanded={expanded || undefined}
          data-at-end={atEnd || undefined}
          onScroll={(event) => {
            syncScrollEnd(event.currentTarget)
            onScroll?.(event)
          }}
          className={cn('modal-field modal-textarea min-h-[80px]', className)}
          {...props}
        />
        {overflows && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            aria-controls={id}
            aria-label={expanded ? 'Contraer campo' : 'Expandir campo'}
            className="group absolute inset-x-px bottom-px flex h-7 items-end justify-center rounded-b-lg pb-2 focus-visible:outline-none"
          >
            {/* Marca visual mínima (el grabber de las hojas de iOS); el área
                táctil es toda la franja, no solo la píldora. */}
            <span className="h-1 w-9 rounded-full bg-foreground/35 transition-colors group-hover:bg-foreground/55 group-focus-visible:bg-[#7C3AED]" />
          </button>
        )}
      </div>
    </div>
  )
})
BrandTextarea.displayName = 'BrandTextarea'
